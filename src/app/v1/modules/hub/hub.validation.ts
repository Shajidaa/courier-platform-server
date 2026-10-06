import { z } from "zod";

const createHubSchema = z.object({
    body: z.object({
        hubName: z
            .string()
            .min(2, "Hub name must be at least 2 characters")
            .max(100, "Hub name cannot exceed 100 characters")
            .trim(),
        address: z
            .string()
            .min(5, "Address must be at least 5 characters")
            .max(255, "Address cannot exceed 255 characters")
            .trim(),
        managerId: z.string().uuid("Invalid manager ID format").optional(),
    }),
});

const updateHubSchema = z.object({
    body: z
        .object({
            hubName: z.string().min(2).max(100).trim().optional(),
            address: z.string().min(5).max(255).trim().optional(),
        })
        .refine((data) => Object.keys(data).length > 0, {
            message: "At least one field must be provided to update.",
        }),
});

const assignManagerSchema = z.object({
    body: z.object({
        managerId: z.string().uuid("Invalid manager ID format"),
    }),
});

const hubListQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).max(100).optional().default(10),
        search: z.string().trim().optional(),
    }),
});

export const HubValidation = {
    createHubSchema,
    updateHubSchema,
    assignManagerSchema,
    hubListQuerySchema,
};
