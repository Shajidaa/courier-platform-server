import { Router } from "express";
import { auth } from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

// Public Routes
router.post(
  "/register",
  validateRequest(UserValidation.registerUserSchema),
  UserController.registerUser,
);

router.post(
  "/verify-email",
  validateRequest(UserValidation.verifyEmailSchema),
  UserController.verifyEmail,
);

router.post(
  "/google",
  validateRequest(UserValidation.googleAuthSchema),
  UserController.googleAuth,
);

router.post(
  "/forgot-password",
  validateRequest(UserValidation.forgotPasswordSchema),
  UserController.forgotPassword,
);

router.post(
  "/reset-password",
  validateRequest(UserValidation.resetPasswordSchema),
  UserController.resetPassword,
);

// Protected Routes (Require Authentication)
router.get("/me", auth(), UserController.getMyProfile);

router.patch(
  "/me",
  auth(),
  validateRequest(UserValidation.updateProfileSchema),
  UserController.updateProfile,
);

router.post(
  "/change-password",
  auth(),
  validateRequest(UserValidation.changePasswordSchema),
  UserController.changePassword,
);

export const UserRoutes = router;
