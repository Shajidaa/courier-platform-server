import { z } from "zod";

const PHONE_REGEX = /^(\+?880|0)?1[3-9]\d{8}$/;

const STATUS_ENUM = [
    "PENDING",
    "ACCEPTED",
    "PICKED_UP",
    "IN_HUB",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
    "FAILED",
] as const;

const createShipmentSchema = z.object({
    body: z.object({
        recipientName: z
            .string()
            .min(2, "Recipient name must be at least 2 characters")
            .max(100)
            .trim(),
        recipientPhone: z
            .string()
            .regex(PHONE_REGEX, "Invalid Bangladeshi phone number"),
        recipientAddress: z
            .string()
            .min(10, "Recipient address must be at least 10 characters")
            .max(255)
            .trim(),
        weight: z
            .number()
            .positive("Weight must be a positive number")
            .max(500, "Weight cannot exceed 500 KG"),
        category: z
            .enum(["DOCUMENT", "PARCEL", "FRAGILE", "ELECTRONICS", "FOOD", "OTHER"])
            .optional()
            .default("PARCEL"),
        packageDimensions: z.string().max(50).trim().optional(),
        deliveryType: z
            .enum(["STANDARD", "EXPRESS", "SAME_DAY", "NEXT_DAY"])
            .optional()
            .default("STANDARD"),
        codAmount: z
            .number()
            .min(0, "COD amount cannot be negative")
            .max(1_000_000)
            .optional()
            .default(0),
        paymentMethod: z
            .enum(["CASH_ON_DELIVERY", "BKASH", "NAGAD", "CARD", "STRIPE", "SSLCOMMERZ"])
            .optional()
            .default("CASH_ON_DELIVERY"),
    }),
});

const updateShipmentSchema = z.object({
    body: z
        .object({
            recipientName: z.string().min(2).max(100).trim().optional(),
            recipientPhone: z
                .string()
                .regex(PHONE_REGEX, "Invalid Bangladeshi phone number")
                .optional(),
            recipientAddress: z.string().min(10).max(255).trim().optional(),
            packageDimensions: z.string().max(50).trim().optional(),
            codAmount: z.number().min(0).max(1_000_000).optional(),
            category: z
                .enum(["DOCUMENT", "PARCEL", "FRAGILE", "ELECTRONICS", "FOOD", "OTHER"])
                .optional(),
            deliveryType: z
                .enum(["STANDARD", "EXPRESS", "SAME_DAY", "NEXT_DAY"])
                .optional(),
        })
        .refine((data) => Object.keys(data).length > 0, {
            message: "At least one field must be provided to update.",
        }),
});

const listShipmentsSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).max(100).optional().default(10),
        status: z.enum(STATUS_ENUM).optional(),
    }),
});

const adminListShipmentsSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).max(100).optional().default(10),
        status: z.enum(STATUS_ENUM).optional(),
        senderId: z.string().uuid().optional(),
        search: z.string().trim().optional(),
    }),
});

const updateStatusSchema = z.object({
    body: z.object({
        status: z.enum(STATUS_ENUM),
        note: z.string().max(500).trim().optional(),
        cancellationReason: z.string().max(500).trim().optional(),
        hubId: z.string().uuid("Invalid hub ID").optional(),
    }),
});

const assignRiderSchema = z.object({
    body: z.object({
        riderId: z.string().uuid("Invalid rider ID"),
    }),
});

export const ShipmentValidation = {
    createShipmentSchema,
    updateShipmentSchema,
    listShipmentsSchema,
    adminListShipmentsSchema,
    updateStatusSchema,
    assignRiderSchema,
};
