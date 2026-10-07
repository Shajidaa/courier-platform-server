import { Router } from "express";
import { Role } from "../../../../../generated/prisma/client";
import { auth } from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { VehicleController } from "./vehicle.controller";
import { VehicleValidation } from "./vehicle.validation";

const router = Router();

const ROLES = [
  Role.ADMIN,
  Role.SUPER_ADMIN,
  Role.OPS_MANAGER,
  Role.HUB_MANAGER,
];

// POST /api/v1/vehicles — Add a new vehicle to the fleet
router.post(
  "/",
  auth(...ROLES),
  validateRequest(VehicleValidation.createVehicleSchema),
  VehicleController.createVehicle,
);

// GET /api/v1/vehicles — View vehicle list and current status
router.get(
  "/",
  auth(...ROLES),
  validateRequest(VehicleValidation.vehicleListQuerySchema),
  VehicleController.getAllVehicles,
);
router.get("/:id", auth(...ROLES), VehicleController.getVehicleById);
router.delete("/:id", auth(...ROLES), VehicleController.deleteVehicle);
router.patch(
  "/:id",
  auth(...ROLES),
  validateRequest(VehicleValidation.updateVehicleSchema),
  VehicleController.updateVehicle,
);
export const VehicleRoutes = router;
