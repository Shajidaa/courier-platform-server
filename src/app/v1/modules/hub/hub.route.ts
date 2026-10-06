import { Router } from "express";
import { Role } from "../../../../../generated/prisma/client";
import { auth } from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { HubController } from "./hub.controller";
import { HubValidation } from "./hub.validation";

const router = Router();

const ADMIN_ROLES = [Role.ADMIN, Role.SUPER_ADMIN];
const READ_ROLES = [
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.OPS_MANAGER,
    Role.HUB_MANAGER,
];

router.post(
    "/",
    auth(...ADMIN_ROLES),
    validateRequest(HubValidation.createHubSchema),
    HubController.createHub,
);

router.get(
    "/",
    auth(...READ_ROLES),
    validateRequest(HubValidation.hubListQuerySchema),
    HubController.getAllHubs,
);

router.get(
    "/:id",
    auth(...READ_ROLES),
    HubController.getHubById,
);

router.patch(
    "/:id",
    auth(...ADMIN_ROLES),
    validateRequest(HubValidation.updateHubSchema),
    HubController.updateHub,
);

router.patch(
    "/:id/assign-manager",
    auth(...ADMIN_ROLES),
    validateRequest(HubValidation.assignManagerSchema),
    HubController.assignManager,
);

router.delete(
    "/:id",
    auth(...ADMIN_ROLES),
    HubController.deleteHub,
);

export const HubRoutes = router;
