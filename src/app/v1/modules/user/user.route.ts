import { Router } from "express";
import { UserController } from "./user.controller";

const router = Router();

router.post("/register", UserController.registerUser);
router.post("/verify-email", UserController.verifyEmail);
router.get("/me", () => {});
router.post("/google", () => {});
router.post(
  "/forgot-password",

  () => {},
);
router.post(
  "/reset-password",

  () => {},
);
export const UserRoutes = router;
