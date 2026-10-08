import httpStatus from "http-status";
import { Role, UserStatus } from "../../../../../generated/prisma/client";
import AppError from "../../../errors/AppError";
import { prisma } from "../../../libs/prisma";
import type {
  ICreateVehiclePayload,
  IVehicleListQuery,
  IUpdateVehiclePayload,
} from "./vehicle.interface";

// ─── Shared select shape ──────────────────────────────────────────────────────

const vehicleSelect = {
  id: true,
  vehicleNumber: true,
  type: true,
  driverName: true,
  capacity: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  currentDriver: {
    select: { id: true, name: true, email: true, role: true },
  },
} as const;

// ─── Services ─────────────────────────────────────────────────────────────────

/**
 * Add a new vehicle to the fleet.
 *

 */
const createVehicle = async (payload: ICreateVehiclePayload) => {
  const { vehicleNumber, type, driverName, capacity, currentDriverId } =
    payload;

  // Unique vehicle number check
  const existing = await prisma.vehicle.findUnique({
    where: { vehicleNumber: vehicleNumber.toUpperCase() },
  });

  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      `A vehicle with number "${vehicleNumber}" already exists.`,
    );
  }

  // Validate driver if provided
  if (currentDriverId) {
    const driver = await prisma.user.findUnique({
      where: { id: currentDriverId },
      include: { drivenVehicles: { select: { id: true } } },
    });

    if (!driver) {
      throw new AppError(httpStatus.NOT_FOUND, "Driver not found.");
    }

    if (driver.isDeleted || driver.status === UserStatus.DELETED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Cannot assign a deleted user as driver.",
      );
    }

    if (
      driver.status === UserStatus.BLOCKED ||
      driver.status === UserStatus.SUSPENDED
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot assign a ${driver.status.toLowerCase()} user as driver.`,
      );
    }

    if (driver.role !== Role.RIDER) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Only users with the RIDER role can be assigned as a vehicle driver.",
      );
    }

    if (driver.drivenVehicles.length > 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        "This driver is already assigned to another vehicle.",
      );
    }
  }

  return prisma.vehicle.create({
    data: {
      vehicleNumber: vehicleNumber.toUpperCase(),
      type,
      driverName: driverName ?? null,
      capacity: capacity ?? null,
      currentDriverId: currentDriverId ?? null,
    },
    select: vehicleSelect,
  });
};

/**
 * List all vehicles with optional filters.

 */
const getAllVehicles = async (query: IVehicleListQuery) => {
  const { page = 1, limit = 10, status, type, search } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (type) where.type = type;

  if (search) {
    where.OR = [
      { vehicleNumber: { contains: search, mode: "insensitive" } },
      { driverName: { contains: search, mode: "insensitive" } },
      {
        currentDriver: {
          name: { contains: search, mode: "insensitive" },
        },
      },
    ];
  }

  const [vehicles, total] = await prisma.$transaction([
    prisma.vehicle.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      select: vehicleSelect,
    }),
    prisma.vehicle.count({ where }),
  ]);

  return {
    data: vehicles,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Get vehicle details by ID.
 
 */
const getVehicleById = async (id: string) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: {
      ...vehicleSelect,
      transfers: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!vehicle) {
    throw new AppError(httpStatus.NOT_FOUND, "Vehicle not found.");
  }

  return vehicle;
};

/**
 * Delete a vehicle from the fleet.
 *
 */
const deleteVehicle = async (id: string) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!vehicle) {
    throw new AppError(httpStatus.NOT_FOUND, "Vehicle not found.");
  }

  if (vehicle.status === "IN_TRANSIT") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete a vehicle that is currently in transit.",
    );
  }

  return prisma.vehicle.delete({
    where: { id },
  });
};

/**
 * Update an existing vehicle in the fleet.

 */
const updateVehicle = async (id: string, payload: IUpdateVehiclePayload) => {
  const { vehicleNumber, type, driverName, capacity, status, currentDriverId } =
    payload;

  // 1. Check if vehicle exists
  const existingVehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: { id: true, vehicleNumber: true, currentDriverId: true },
  });

  if (!existingVehicle) {
    throw new AppError(httpStatus.NOT_FOUND, "Vehicle not found.");
  }

  // 2. Check unique vehicle number if it's being updated
  if (
    vehicleNumber &&
    vehicleNumber.toUpperCase() !== existingVehicle.vehicleNumber
  ) {
    const duplicateVehicle = await prisma.vehicle.findUnique({
      where: { vehicleNumber: vehicleNumber.toUpperCase() },
    });

    if (duplicateVehicle) {
      throw new AppError(
        httpStatus.CONFLICT,
        `A vehicle with number "${vehicleNumber}" already exists.`,
      );
    }
  }

  // 3. Validate driver if currentDriverId is provided / changed
  if (
    currentDriverId !== undefined &&
    currentDriverId !== existingVehicle.currentDriverId
  ) {
    if (currentDriverId === null) {
      // Allowing driver un assignment (setting currentDriverId to null)
    } else {
      const driver = await prisma.user.findUnique({
        where: { id: currentDriverId },
        include: { drivenVehicles: { select: { id: true } } },
      });

      if (!driver) {
        throw new AppError(httpStatus.NOT_FOUND, "Driver not found.");
      }

      if (driver.isDeleted || driver.status === UserStatus.DELETED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Cannot assign a deleted user as driver.",
        );
      }

      if (
        driver.status === UserStatus.BLOCKED ||
        driver.status === UserStatus.SUSPENDED
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Cannot assign a ${driver.status.toLowerCase()} user as driver.`,
        );
      }

      if (driver.role !== Role.RIDER) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Only users with the RIDER role can be assigned as a vehicle driver.",
        );
      }

      // Check if driver is already driving another vehicle (excluding the current vehicle itself)
      const isAssignedElsewhere = driver.drivenVehicles.some(
        (v) => v.id !== id,
      );
      if (isAssignedElsewhere) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This driver is already assigned to another vehicle.",
        );
      }
    }
  }

  // 4. Perform the update
  return prisma.vehicle.update({
    where: { id },
    data: {
      ...(vehicleNumber && { vehicleNumber: vehicleNumber.toUpperCase() }),
      ...(type && { type }),
      ...(driverName !== undefined && { driverName: driverName ?? null }),
      ...(capacity !== undefined && { capacity: capacity ?? null }),
      ...(status && { status }),
      ...(currentDriverId !== undefined && {
        currentDriverId: currentDriverId ?? null,
      }),
    },
    select: vehicleSelect,
  });
};
export const VehicleService = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  deleteVehicle,
  updateVehicle,
};
