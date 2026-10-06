import httpStatus from "http-status";
import {
  ShipmentStatus,
  TransferStatus,
  VehicleStatus,
} from "../../../../../generated/prisma/client";
import AppError from "../../../errors/AppError";
import { prisma } from "../../../libs/prisma";
import type { IJwtPayload } from "../auth/auth.interface";
import type {
  IInitiateTransferPayload,
  IReceiveTransferPayload,
  ITransferListQuery,
} from "./hub-transfer.interface";

// ─── Shared include shape ─────────────────────────────────────────────────────

const transferInclude = {
  sourceHub: { select: { id: true, hubName: true, address: true } },
  destinationHub: { select: { id: true, hubName: true, address: true } },
  vehicle: {
    select: { id: true, vehicleNumber: true, type: true, driverName: true },
  },
  receivedBy: { select: { id: true, name: true, role: true } },
} as const;

// ─── Services ─────────────────────────────────────────────────────────────────

/**
 * Initiate a parcel transfer between two hubs.

 */
const initiateTransfer = async (
  payload: IInitiateTransferPayload,
  requestUser: IJwtPayload,
) => {
  const { sourceHubId, destinationHubId, shipmentIds, vehicleId, remarks } =
    payload;

  if (sourceHubId === destinationHubId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Source and destination hubs must be different.",
    );
  }

  // Validate both hubs exist in parallel
  const [sourceHub, destinationHub] = await Promise.all([
    prisma.hub.findUnique({ where: { id: sourceHubId } }),
    prisma.hub.findUnique({ where: { id: destinationHubId } }),
  ]);

  if (!sourceHub) {
    throw new AppError(httpStatus.NOT_FOUND, "Source hub not found.");
  }
  if (!destinationHub) {
    throw new AppError(httpStatus.NOT_FOUND, "Destination hub not found.");
  }

  const uniqueShipmentIds = [...new Set(shipmentIds)];

  const shipments = await prisma.shipment.findMany({
    where: { id: { in: uniqueShipmentIds } },
    select: {
      id: true,
      trackingNumber: true,
      status: true,
      currentHubId: true,
    },
  });

  if (shipments.length !== uniqueShipmentIds.length) {
    const foundIds = new Set(shipments.map((s) => s.id));
    const missing = uniqueShipmentIds.filter((id) => !foundIds.has(id));
    throw new AppError(
      httpStatus.NOT_FOUND,
      `Shipment(s) not found: ${missing.join(", ")}`,
    );
  }

  // Validate shipments: Allow PENDING (will auto-check in) or already IN_HUB at sourceHubId
  const invalidShipments = shipments.filter(
    (s) =>
      !(
        (s.status === ShipmentStatus.PENDING && !s.currentHubId) ||
        (s.status === ShipmentStatus.IN_HUB && s.currentHubId === sourceHubId)
      ),
  );

  if (invalidShipments.length > 0) {
    const details = invalidShipments
      .map(
        (s) =>
          `${s.trackingNumber} (status: ${s.status}, hub: ${s.currentHubId ?? "none"})`,
      )
      .join("; ");
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `The following shipments cannot be transferred: ${details}`,
    );
  }

  // Validate vehicle if provided
  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new AppError(httpStatus.NOT_FOUND, "Vehicle not found.");
    }

    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Vehicle is not available. Current status: ${vehicle.status}.`,
      );
    }
  }

  // Atomic transaction: create transfer + check-in pending items + move to IN_TRANSIT + log + update vehicle
  const transfer = await prisma.$transaction(async (tx) => {
    const created = await tx.hubTransfer.create({
      data: {
        sourceHubId,
        destinationHubId,
        vehicleId: vehicleId ?? null,
        status: TransferStatus.DISPATCHED,
        dispatchedAt: new Date(),
        remarks: remarks ?? null,
      },
      include: transferInclude,
    });

    for (const shipment of shipments) {
      // If shipment is PENDING, check it into the source hub first
      if (shipment.status === ShipmentStatus.PENDING) {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: {
            status: ShipmentStatus.IN_HUB,
            currentHubId: sourceHubId,
          },
        });

        await tx.shipmentLog.create({
          data: {
            shipmentId: shipment.id,
            status: ShipmentStatus.IN_HUB,
            note: `Checked into ${sourceHub.hubName} prior to transfer.`,
            updatedById: requestUser.userId,
          },
        });
      }

      // Now move to IN_TRANSIT
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: ShipmentStatus.IN_TRANSIT },
      });

      await tx.shipmentLog.create({
        data: {
          shipmentId: shipment.id,
          status: ShipmentStatus.IN_TRANSIT,
          note: `Dispatched from ${sourceHub.hubName} to ${destinationHub.hubName} via transfer ${created.id}.`,
          updatedById: requestUser.userId,
        },
      });
    }

    if (vehicleId) {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { status: VehicleStatus.IN_TRANSIT },
      });
    }

    return created;
  });

  return transfer;
};

/**
 * Confirm receipt of parcels at the destination hub.

 */
const receiveTransfer = async (
  transferId: string,
  payload: IReceiveTransferPayload,
  requestUser: IJwtPayload,
) => {
  const transfer = await prisma.hubTransfer.findUnique({
    where: { id: transferId },
    include: transferInclude,
  });

  if (!transfer) {
    throw new AppError(httpStatus.NOT_FOUND, "Hub transfer not found.");
  }

  const receivableStatuses: TransferStatus[] = [
    TransferStatus.DISPATCHED,
    TransferStatus.IN_TRANSIT,
  ];

  if (!receivableStatuses.includes(transfer.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Transfer cannot be received. Current status: ${transfer.status}. Expected DISPATCHED or IN_TRANSIT.`,
    );
  }

  // Find all shipments that belong to this transfer (still IN_TRANSIT)

  const shipmentLogs = await prisma.shipmentLog.findMany({
    where: {
      note: { contains: `transfer ${transferId}` },
      status: ShipmentStatus.IN_TRANSIT,
    },
    select: { shipmentId: true },
    distinct: ["shipmentId"],
  });

  const shipmentIds = shipmentLogs.map((l) => l.shipmentId);

  if (shipmentIds.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No shipments found linked to this transfer.",
    );
  }

  // Fetch them to verify state before touching
  const shipments = await prisma.shipment.findMany({
    where: { id: { in: shipmentIds } },
    select: { id: true, trackingNumber: true, status: true },
  });

  const destinationHub = transfer.destinationHub;

  const updated = await prisma.$transaction(async (tx) => {
    for (const shipment of shipments) {
      // Skip if already moved (partial receive scenario)
      if (shipment.status === ShipmentStatus.IN_HUB) continue;

      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: ShipmentStatus.IN_HUB,
          currentHubId: transfer.destinationHubId,
        },
      });

      await tx.shipmentLog.create({
        data: {
          shipmentId: shipment.id,
          status: ShipmentStatus.IN_HUB,
          note: `Received at ${destinationHub.hubName} via transfer ${transferId}.`,
          updatedById: requestUser.userId,
        },
      });
    }

    // Mark transfer as received
    const receivedTransfer = await tx.hubTransfer.update({
      where: { id: transferId },
      data: {
        status: TransferStatus.RECEIVED,
        receivedAt: new Date(),
        receivedById: requestUser.userId,
        ...(payload.remarks && { remarks: payload.remarks }),
      },
      include: transferInclude,
    });

    // Free the vehicle
    if (transfer.vehicleId) {
      await tx.vehicle.update({
        where: { id: transfer.vehicleId },
        data: { status: VehicleStatus.AVAILABLE },
      });
    }

    return receivedTransfer;
  });

  return updated;
};

/**
 * List all transfers with optional filters.
 */
const getAllTransfers = async (query: ITransferListQuery) => {
  const { page = 1, limit = 10, status, sourceHubId, destinationHubId } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (sourceHubId) where.sourceHubId = sourceHubId;
  if (destinationHubId) where.destinationHubId = destinationHubId;

  const [transfers, total] = await prisma.$transaction([
    prisma.hubTransfer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: transferInclude,
    }),
    prisma.hubTransfer.count({ where }),
  ]);

  return {
    data: transfers,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Get a single transfer by ID with full detail.
 */
const getTransferById = async (transferId: string) => {
  const transfer = await prisma.hubTransfer.findUnique({
    where: { id: transferId },
    include: transferInclude,
  });

  if (!transfer) {
    throw new AppError(httpStatus.NOT_FOUND, "Hub transfer not found.");
  }

  return transfer;
};

export const HubTransferService = {
  initiateTransfer,
  receiveTransfer,
  getAllTransfers,
  getTransferById,
};
