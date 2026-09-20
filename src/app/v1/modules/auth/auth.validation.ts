import { z } from "zod";

const loginUserSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(1, "Password is required"),
  }),
});

const refreshTokenSchema = z.object({
  cookies: z
    .object({
      refreshToken: z.string().min(1, "Refresh token is required"),
    })
    .optional(),
  body: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
});

export const AuthValidation = {
  loginUserSchema,
  refreshTokenSchema,
};
