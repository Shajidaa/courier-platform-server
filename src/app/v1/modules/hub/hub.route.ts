import { Router } from "express";
import { Role } from "../../../../../generated/prisma/client";
import { auth } from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { HubController } from "./hub.controller";
import { HubValidation } from "./hub.validation";

const router = Router();

// Hub routes
router.post(
    "/",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(HubValidation.createHubSchema),
    HubController.createHub,
);

router.get(
    "/",
    auth(Role.ADMIN, Role.SUPER_ADMIN, Role.OPS_MANAGER, Role.HUB_MANAGER),
    validateRequest(HubValidation.hubListQuerySchema),
    HubController.getAllHubs,
);

export const HubRoutes = router;
