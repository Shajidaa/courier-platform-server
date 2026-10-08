import { Router } from "express";
import { Role } from "../../../../../generated/prisma/client";
import { auth } from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { ShipmentController } from "./shipment.controller";
import { ShipmentValidation } from "./shipment.validation";

const router = Router();

const OPS_ROLES = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPS_MANAGER];

// ─── Sender routes ────────────────────────────────────────────────────────────

router.post(
  "/",
  auth(Role.SENDER, ...OPS_ROLES),
  validateRequest(ShipmentValidation.createShipmentSchema),
  ShipmentController.createShipment,
);

router.get(
  "/my",
  auth(Role.SENDER, ...OPS_ROLES),
  validateRequest(ShipmentValidation.listShipmentsSchema),
  ShipmentController.getMyShipments,
);

// ─── Admin / Ops / Rider routes ───────────────────────────────────────────────

router.get(
  "/",
  auth(...OPS_ROLES, Role.HUB_MANAGER, Role.RIDER),
  validateRequest(ShipmentValidation.adminListShipmentsSchema),
  ShipmentController.getAllShipments,
);

router.patch(
  "/:id/status",
  auth(...OPS_ROLES, Role.HUB_MANAGER, Role.RIDER),
  validateRequest(ShipmentValidation.updateStatusSchema),
  ShipmentController.updateShipmentStatus,
);

router.patch(
  "/:id/assign-rider",
  auth(...OPS_ROLES),
  validateRequest(ShipmentValidation.assignRiderSchema),
  ShipmentController.assignRider,
);

// ─── Shared ───────────────────────────────────────────────────────────────────

router.get(
  "/:id",
  auth(
    Role.SENDER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.OPS_MANAGER,
    Role.HUB_MANAGER,
    Role.RIDER,
  ),
  ShipmentController.getShipmentById,
);

router.patch(
  "/:id",
  auth(Role.SENDER),
  validateRequest(ShipmentValidation.updateShipmentSchema),
  ShipmentController.updateShipment,
);

router.delete("/:id", auth(Role.SENDER), ShipmentController.cancelShipment);

export const ShipmentRoutes = router;
