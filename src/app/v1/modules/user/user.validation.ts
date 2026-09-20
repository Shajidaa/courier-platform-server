import { z } from "zod";

const registerUserSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name cannot exceed 100 characters"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters long"),
    gender: z.enum(["MALE", "FEMALE", "OTHER"] as const),
    role: z
      .enum([
        "SENDER",
        "RIDER",
        "HUB_MANAGER",
        "OPS_MANAGER",
        "SUPPORT_AGENT",
        "ADMIN",
        "SUPER_ADMIN",
      ] as const)
      .optional()
      .default("RIDER"),
  }),
});

const verifyEmailSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .trim()
      .toLowerCase(),
    otp: z
      .string()
      .length(6, "OTP must be exactly 6 digits"),
  }),
});

const googleAuthSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .trim()
      .toLowerCase(),
    googleId: z.string().min(1, "Google ID is required"),
    imageUrl: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"] as const).optional(),
    role: z
      .enum([
        "SENDER",
        "RIDER",
        "HUB_MANAGER",
        "OPS_MANAGER",
        "SUPPORT_AGENT",
        "ADMIN",
        "SUPER_ADMIN",
      ] as const)
      .optional(),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .trim()
      .toLowerCase(),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .trim()
      .toLowerCase(),
    otp: z
      .string()
      .length(6, "OTP must be exactly 6 digits"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters long"),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters long"),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"] as const).optional(),
    imageUrl: z.string().optional(),
    bio: z.string().max(500).optional(),
    phoneNumber: z.string().optional(),
    nid: z.string().optional(),
    passport: z.string().optional(),
  }),
});

export const UserValidation = {
  registerUserSchema,
  verifyEmailSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
};
