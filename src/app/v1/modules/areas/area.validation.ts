import { z } from "zod";
const createAreaSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Area name must be at least 2 characters")
      .max(100, "Area name cannot exceed 100 characters")
      .trim(),
    hubId: z.string().uuid("Invalid hub ID format"),
    postalCode: z
      .string()
      .min(4, "Postal code must be at least 4 characters")
      .max(10, "Postal code cannot exceed 10 characters")
      .trim(),
  }),
});
const areaListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    hubId: z.string().uuid("Invalid hub ID format").optional(),
    search: z.string().trim().optional(),
  }),
});
export const areaValidation = {
  createAreaSchema,
  areaListQuerySchema,
};
