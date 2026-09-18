import { Router } from "express";

const router = Router();

router.post("/register", () => {});
router.post("/verify-email", () => {});
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
