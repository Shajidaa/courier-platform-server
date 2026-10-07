import { z } from "zod";

const VEHICLE_TYPES = [
  "BIKE",
  "BICYCLE",
  "SCOOTER",
  "VAN",
  "TRUCK",
  "OTHER",
] as const;
const VEHICLE_STATUSES = [
  "AVAILABLE",
  "IN_TRANSIT",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
] as const;

const createVehicleSchema = z.object({
  body: z.object({
    vehicleNumber: z
      .string()
      .min(2, "Vehicle number must be at least 2 characters")
      .max(20, "Vehicle number cannot exceed 20 characters")
      .trim()
      .toUpperCase(),
    type: z.enum(VEHICLE_TYPES, {
      message: "Vehicle type is required and must be valid",
    }),
    driverName: z.string().min(2).max(100).trim().optional(),
    capacity: z.string().max(50).trim().optional(),
    currentDriverId: z.string().uuid("Invalid driver ID").optional(),
  }),
});

const vehicleListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    status: z.enum(VEHICLE_STATUSES).optional(),
    type: z.enum(VEHICLE_TYPES).optional(),
    search: z.string().trim().optional(),
  }),
});

export const VehicleValidation = {
  createVehicleSchema,
  vehicleListQuerySchema,
};
