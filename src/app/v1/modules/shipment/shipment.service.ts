import { Decimal } from "../../../../../generated/prisma/internal/prismaNamespace";
import httpStatus from "http-status";
import {
  DeliveryType,
  PaymentMethod,
  PaymentStatus,
  Role,
  ShipmentStatus,
} from "../../../../../generated/prisma/client";
import AppError from "../../../errors/AppError";
import { prisma } from "../../../libs/prisma";
import type { IJwtPayload } from "../auth/auth.interface";
import type {
  IAdminShipmentListQuery,
  IAssignRiderPayload,
  ICreateShipmentPayload,
  IShipmentListQuery,
  IUpdateShipmentPayload,
  IUpdateShipmentStatusPayload,
} from "./shipment.interface";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateTrackingNumber = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TRK-${date}-${rand}`;
};

const getEstimatedDeliveryDate = (type: DeliveryType): Date => {
  const now = new Date();
  const daysMap: Record<DeliveryType, number> = {
    SAME_DAY: 0,
    NEXT_DAY: 1,
    EXPRESS: 2,
    STANDARD: 5,
  };
  now.setDate(now.getDate() + daysMap[type]);
  return now;
};

const calculateDeliveryCharge = (
  weightKg: number,
  type: DeliveryType,
): number => {
  const BASE_RATE = 60; // BDT per KG
  const MINIMUM_CHARGE = 60; // BDT floor
  const TYPE_MULTIPLIER: Record<DeliveryType, number> = {
    STANDARD: 1,
    EXPRESS: 1.5,
    NEXT_DAY: 1.75,
    SAME_DAY: 2,
  };
  const raw = Math.max(weightKg * BASE_RATE, MINIMUM_CHARGE);
  return Math.round(raw * TYPE_MULTIPLIER[type]);
};

// ─── Shared select shape ──────────────────────────────────────────────────────

const shipmentSelect = {
  id: true,
  trackingNumber: true,
  recipientName: true,
  recipientPhone: true,
  recipientAddress: true,
  maxWeight: true,
  minWeight: true,
  category: true,
  codAmount: true,
  deliveryCharge: true,
  status: true,
  deliveryType: true,
  packageDimensions: true,
  estimatedDeliveryDate: true,
  actualDeliveryDate: true,
  cancellationReason: true,
  proofOfDelivery: true,
  createdAt: true,
  updatedAt: true,
  currentHub: {
    select: { id: true, hubName: true, address: true },
  },
  assignedCourier: {
    select: {
      id: true,
      vehicleType: true,
      user: { select: { id: true, name: true } },
    },
  },
  sender: {
    select: {
      id: true,
      defaultPickupAddress: true,
      city: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  payments: {
    select: {
      id: true,
      amount: true,
      paymentMethod: true,
      paymentStatus: true,
      transactionId: true,
      currency: true,
      createdAt: true,
    },
  },
} as const;

// ─── Sender-facing services ───────────────────────────────────────────────────

/**
 * Create a new shipment (parcel booking).
 * - Auto-generates unique tracking number.
 * - Calculates delivery charge from weight × delivery type multiplier.
 * - Creates initial ShipmentLog + pending Payment atomically.
 * - Increments sender totalOrders.
 */
const createShipment = async (
  payload: ICreateShipmentPayload,
  requestUser: IJwtPayload,
) => {
  let sender = await prisma.sender.findUnique({
    where: { userId: requestUser.userId },
  });

  if (!sender) {
    if (
      requestUser.role === Role.SENDER ||
      requestUser.role === Role.ADMIN ||
      requestUser.role === Role.SUPER_ADMIN ||
      requestUser.role === Role.OPS_MANAGER
    ) {
      sender = await prisma.sender.create({
        data: { userId: requestUser.userId },
      });
    } else {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Only users with a Sender profile can create shipments.",
      );
    }
  }

  const {
    recipientName,
    recipientPhone,
    recipientAddress,
    weight,
    category = "PARCEL",
    packageDimensions,
    deliveryType = DeliveryType.STANDARD,
    codAmount = 0,
    paymentMethod = PaymentMethod.BKASH,
  } = payload;

  // Block self-delivery
  const senderUser = await prisma.user.findUnique({
    where: { id: requestUser.userId },
  });

  // if (senderUser?.phone && senderUser.phone === recipientPhone) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     "Recipient phone cannot be the same as the sender's phone number.",
  //   );
  // }

  const deliveryCharge = calculateDeliveryCharge(weight, deliveryType);
  const estimatedDeliveryDate = getEstimatedDeliveryDate(deliveryType);

  // Collision-safe tracking number generation
  let trackingNumber = generateTrackingNumber();
  let attempt = 0;
  while (await prisma.shipment.findUnique({ where: { trackingNumber } })) {
    trackingNumber = generateTrackingNumber();
    if (++attempt > 5)
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to generate a unique tracking number. Please try again.",
      );
  }

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        trackingNumber,
        senderId: sender.id,
        recipientName,
        recipientPhone,
        recipientAddress,
        minWeight: new Decimal(weight),
        maxWeight: new Decimal(weight),
        category,
        packageDimensions,
        deliveryType,
        codAmount: new Decimal(codAmount),
        deliveryCharge: new Decimal(deliveryCharge),
        estimatedDeliveryDate,
        status: ShipmentStatus.PENDING,
      },
      select: shipmentSelect,
    });

    await tx.shipmentLog.create({
      data: {
        shipmentId: created.id,
        status: ShipmentStatus.PENDING,
        note: "Shipment created and pending pickup.",
        updatedById: requestUser.userId,
      },
    });

    const payment = await tx.payment.create({
      data: {
        shipmentId: created.id,
        amount: new Decimal(deliveryCharge + codAmount),
        paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        currency: "BDT",
      },
    });

    await tx.sender.update({
      where: { userId: requestUser.userId },
      data: { totalOrders: { increment: 1 } },
    });

    return {
      ...created,
      payments: [
        {
          id: payment.id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentStatus: payment.paymentStatus,
          transactionId: payment.transactionId,
          currency: payment.currency,
          createdAt: payment.createdAt,
        },
      ],
    };
  });

  return shipment;
};

/**
 * List all shipments for the authenticated sender with optional status filter.
 */
const getMyShipments = async (
  requestUser: IJwtPayload,
  query: IShipmentListQuery,
) => {
  let sender = await prisma.sender.findUnique({
    where: { userId: requestUser.userId },
  });

  if (!sender) {
    if (
      requestUser.role === Role.SENDER ||
      requestUser.role === Role.ADMIN ||
      requestUser.role === Role.SUPER_ADMIN ||
      requestUser.role === Role.OPS_MANAGER
    ) {
      sender = await prisma.sender.create({
        data: { userId: requestUser.userId },
      });
    } else {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Only users with a Sender profile can view shipments.",
      );
    }
  }

  const { page = 1, limit = 10, status } = query;
  const skip = (page - 1) * limit;

  const where = {
    senderId: sender.id,
    ...(status ? { status } : {}),
  };

  const [shipments, total] = await prisma.$transaction([
    prisma.shipment.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      select: shipmentSelect,
    }),
    prisma.shipment.count({ where }),
  ]);

  return {
    data: shipments,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Get full tracking detail + shipment logs for a single shipment.
 * Senders can only view their own. Staff roles can view any.
 */
const getShipmentById = async (
  shipmentId: string,
  requestUser: IJwtPayload,
) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      ...shipmentSelect,
      payments: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          paymentStatus: true,
          transactionId: true,
          currency: true,
          createdAt: true,
        },
      },
      shipmentLogs: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          note: true,
          createdAt: true,
          updatedBy: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });

  if (!shipment) {
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
  }

  // Senders can only see their own shipments
  const staffRoles: string[] = [
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.OPS_MANAGER,
    Role.HUB_MANAGER,
    Role.RIDER,
  ];

  if (!staffRoles.includes(requestUser.role)) {
    const sender = await prisma.sender.findUnique({
      where: { userId: requestUser.userId },
    });

    if (!sender || shipment.sender?.id !== sender.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You do not have permission to view this shipment.",
      );
    }
  }

  return shipment;
};

/**
 * Update mutable shipment fields.
 * Only allowed while status is PENDING or ACCEPTED.
 * Recalculates delivery charge if deliveryType changes.
 */
const updateShipment = async (
  shipmentId: string,
  payload: IUpdateShipmentPayload,
  requestUser: IJwtPayload,
) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { sender: true },
  });

  if (!shipment) {
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
  }

  const sender = await prisma.sender.findUnique({
    where: { userId: requestUser.userId },
  });

  if (!sender || shipment.senderId !== sender.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to update this shipment.",
    );
  }

  const EDITABLE_STATUSES: ShipmentStatus[] = [
    ShipmentStatus.PENDING,
    ShipmentStatus.ACCEPTED,
  ];

  if (!EDITABLE_STATUSES.includes(shipment.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Shipment cannot be updated once it is ${shipment.status.toLowerCase().replace(/_/g, " ")}.`,
    );
  }

  const {
    recipientName,
    recipientPhone,
    recipientAddress,
    packageDimensions,
    codAmount,
    category,
    deliveryType,
  } = payload;

  const effectiveDeliveryType = deliveryType ?? shipment.deliveryType;
  const currentWeight = Number(shipment.maxWeight);
  const newDeliveryCharge = calculateDeliveryCharge(
    currentWeight,
    effectiveDeliveryType,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        ...(recipientName && { recipientName }),
        ...(recipientPhone && { recipientPhone }),
        ...(recipientAddress && { recipientAddress }),
        ...(packageDimensions !== undefined && { packageDimensions }),
        ...(codAmount !== undefined && { codAmount: new Decimal(codAmount) }),
        ...(category && { category }),
        ...(deliveryType && {
          deliveryType,
          deliveryCharge: new Decimal(newDeliveryCharge),
          estimatedDeliveryDate: getEstimatedDeliveryDate(deliveryType),
        }),
      },
      select: shipmentSelect,
    });

    await tx.shipmentLog.create({
      data: {
        shipmentId,
        status: shipment.status,
        note: "Shipment details updated by sender.",
        updatedById: requestUser.userId,
      },
    });

    return result;
  });

  return updated;
};

/**
 * Cancel a shipment — only allowed while status is PENDING.
 * Voids pending payments and decrements sender totalOrders.
 */
const cancelShipment = async (shipmentId: string, requestUser: IJwtPayload) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
  }

  const sender = await prisma.sender.findUnique({
    where: { userId: requestUser.userId },
  });

  if (!sender || shipment.senderId !== sender.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to cancel this shipment.",
    );
  }

  if (shipment.status !== ShipmentStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only PENDING shipments can be cancelled. Current status: ${shipment.status}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.CANCELLED,
        cancellationReason: "Cancelled by sender.",
      },
    });

    await tx.shipmentLog.create({
      data: {
        shipmentId,
        status: ShipmentStatus.CANCELLED,
        note: "Shipment cancelled by sender before pickup.",
        updatedById: requestUser.userId,
      },
    });

    await tx.payment.updateMany({
      where: { shipmentId, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.FAILED },
    });

    await tx.sender.update({
      where: { id: sender.id },
      data: { totalOrders: { decrement: 1 } },
    });
  });
};

// ─── Admin / Ops-facing services ──────────────────────────────────────────────

/**
 * List ALL shipments across all senders.
 * For ADMIN, SUPER_ADMIN, OPS_MANAGER, HUB_MANAGER.
 * Supports filtering by status, senderId, and full-text search.
 */
const getAllShipments = async (
  query: IAdminShipmentListQuery,
  requestUser?: IJwtPayload,
) => {
  const { page = 1, limit = 10, status, senderId, search } = query;
  const skip = (page - 1) * limit;

  const andConditions: Record<string, unknown>[] = [];

  if (status) andConditions.push({ status });
  if (senderId) andConditions.push({ senderId });

  if (requestUser?.role === Role.RIDER) {
    let rider = await prisma.rider.findUnique({
      where: { userId: requestUser.userId },
    });
    if (!rider) {
      rider = await prisma.rider.create({
        data: { userId: requestUser.userId },
      });
    }
    andConditions.push({
      OR: [
        { assignedCourierId: rider.id },
        { assignedCourier: { userId: requestUser.userId } },
      ],
    });
  }

  if (search) {
    andConditions.push({
      OR: [
        { trackingNumber: { contains: search, mode: "insensitive" } },
        { recipientName: { contains: search, mode: "insensitive" } },
        { recipientPhone: { contains: search, mode: "insensitive" } },
        {
          sender: {
            user: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const [shipments, total] = await prisma.$transaction([
    prisma.shipment.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      select: shipmentSelect,
    }),
    prisma.shipment.count({ where }),
  ]);

  return {
    data: shipments,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Update shipment status (ops/admin workflow).
 *
 * Business rules:
 * - Status transitions must follow the pipeline order.
 * - DELIVERED sets actualDeliveryDate.
 * - CANCELLED requires a cancellationReason.
 * - Each transition is logged with the operator's identity.
 */
const ALLOWED_TRANSITIONS: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  [ShipmentStatus.PENDING]: [ShipmentStatus.ACCEPTED, ShipmentStatus.CANCELLED],
  [ShipmentStatus.ACCEPTED]: [
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.IN_HUB],
  [ShipmentStatus.IN_HUB]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.OUT_FOR_DELIVERY],
  [ShipmentStatus.OUT_FOR_DELIVERY]: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.FAILED,
    ShipmentStatus.RETURNED,
  ],
  [ShipmentStatus.FAILED]: [ShipmentStatus.RETURNED],
};

const updateShipmentStatus = async (
  shipmentId: string,
  payload: IUpdateShipmentStatusPayload,
  requestUser: IJwtPayload,
) => {
  const { status: newStatus, note, cancellationReason, hubId } = payload;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
  }

  // Already in a terminal state
  const terminalStatuses: ShipmentStatus[] = [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.CANCELLED,
    ShipmentStatus.RETURNED,
  ];

  if (terminalStatuses.includes(shipment.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Shipment is already in a terminal state: ${shipment.status}.`,
    );
  }

  const allowed = ALLOWED_TRANSITIONS[shipment.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot transition from ${shipment.status} to ${newStatus}. Allowed: ${allowed.join(", ") || "none"}.`,
    );
  }

  if (newStatus === ShipmentStatus.CANCELLED && !cancellationReason) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A cancellation reason is required when cancelling a shipment.",
    );
  }

  // Validate hubId if transitioning to IN_HUB or IN_TRANSIT
  if (
    hubId &&
    (newStatus === ShipmentStatus.IN_HUB ||
      newStatus === ShipmentStatus.IN_TRANSIT)
  ) {
    const hub = await prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) throw new AppError(httpStatus.NOT_FOUND, "Hub not found.");
  }

  // Enforce payment completion before delivery
  if (newStatus === ShipmentStatus.DELIVERED) {
    const payments = await prisma.payment.findMany({
      where: { shipmentId },
    });

    const hasUnpaidPayment =
      payments.length === 0 ||
      payments.some((p) => p.paymentStatus !== PaymentStatus.PAID);

    if (hasUnpaidPayment) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Cannot mark shipment as DELIVERED without completed payment.",
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: newStatus,
        ...(newStatus === ShipmentStatus.DELIVERED && {
          actualDeliveryDate: new Date(),
        }),
        ...(newStatus === ShipmentStatus.CANCELLED && { cancellationReason }),
        ...(hubId && { currentHubId: hubId }),
      },
      select: shipmentSelect,
    });

    await tx.shipmentLog.create({
      data: {
        shipmentId,
        status: newStatus,
        note: note ?? `Status updated to ${newStatus} by ops.`,
        updatedById: requestUser.userId,
      },
    });

    return result;
  });

  return updated;
};

/**
 * Assign a rider to a shipment.
 *
 * Business rules:
 * - Shipment must be ACCEPTED before a rider is assigned.
 * - Rider must exist and be an active user with RIDER role.
 * - Logs the assignment.
 */
const assignRider = async (
  shipmentId: string,
  payload: IAssignRiderPayload,
  requestUser: IJwtPayload,
) => {
  const { riderId } = payload;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
  }

  const assignableStatuses: ShipmentStatus[] = [
    ShipmentStatus.ACCEPTED,
    ShipmentStatus.PICKED_UP,
  ];

  if (!assignableStatuses.includes(shipment.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Rider can only be assigned when shipment is ACCEPTED or PICKED_UP. Current: ${shipment.status}.`,
    );
  }

  let rider = await prisma.rider.findUnique({
    where: { id: riderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          status: true,
          isDeleted: true,
          role: true,
        },
      },
    },
  });

  if (!rider) {
    rider = await prisma.rider.findUnique({
      where: { userId: riderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            status: true,
            isDeleted: true,
            role: true,
          },
        },
      },
    });
  }

  if (!rider) {
    // Check if riderId belongs to a User with RIDER role
    const riderUser = await prisma.user.findUnique({
      where: { id: riderId },
    });
    if (riderUser && riderUser.role === Role.RIDER && !riderUser.isDeleted) {
      rider = await prisma.rider.create({
        data: { userId: riderUser.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              status: true,
              isDeleted: true,
              role: true,
            },
          },
        },
      });
    }
  }

  if (!rider) {
    throw new AppError(httpStatus.NOT_FOUND, "Rider not found.");
  }

  if (rider.user.isDeleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot assign a deleted user as courier.",
    );
  }

  if (rider.user.role !== Role.RIDER) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Assigned user does not have the RIDER role.",
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.shipment.update({
      where: { id: shipmentId },
      data: { assignedCourierId: rider.id },
      select: shipmentSelect,
    });

    await tx.shipmentLog.create({
      data: {
        shipmentId,
        status: shipment.status,
        note: `Courier assigned by ops (rider: ${rider.user.name || rider.id}).`,
        updatedById: requestUser.userId,
      },
    });

    return result;
  });

  return updated;
};

export const ShipmentService = {
  // Sender
  createShipment,
  getMyShipments,
  getShipmentById,
  updateShipment,
  cancelShipment,
  // Admin / Ops
  getAllShipments,
  updateShipmentStatus,
  assignRider,
};
