import { z } from "zod";

const initiateTransferSchema = z.object({
  body: z.object({
    sourceHubId: z.string().uuid("Invalid source hub ID"),
    destinationHubId: z.string().uuid("Invalid destination hub ID"),
    shipmentIds: z
      .array(z.string().uuid("Each shipment ID must be a valid UUID"))
      .min(1, "At least one shipment is required"),
    vehicleId: z.string().uuid("Invalid vehicle ID").optional(),
    remarks: z.string().max(500).optional(),
  }),
});

const receiveTransferSchema = z.object({
  body: z.object({
    remarks: z.string().max(500).optional(),
  }),
});

const transferListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    status: z
      .enum(["PENDING", "DISPATCHED", "IN_TRANSIT", "RECEIVED", "CANCELLED"])
      .optional(),
    sourceHubId: z.string().uuid().optional(),
    destinationHubId: z.string().uuid().optional(),
  }),
});

export const HubTransferValidation = {
  initiateTransferSchema,
  receiveTransferSchema,
  transferListQuerySchema,
};
