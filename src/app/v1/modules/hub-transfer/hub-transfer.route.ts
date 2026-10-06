import { Router } from "express";
import { Role } from "../../../../../generated/prisma/client";
import { auth } from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { HubTransferController } from "./hub-transfer.controller";
import { HubTransferValidation } from "./hub-transfer.validation";

const router = Router();

const STAFF_ROLES = [
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.OPS_MANAGER,
    Role.HUB_MANAGER,
];

// POST /api/v1/hub-transfers — Initiate a transfer between hubs
router.post(
    "/",
    auth(...STAFF_ROLES),
    validateRequest(HubTransferValidation.initiateTransferSchema),
    HubTransferController.initiateTransfer,
);

// GET /api/v1/hub-transfers — List all transfers
router.get(
    "/",
    auth(...STAFF_ROLES),
    validateRequest(HubTransferValidation.transferListQuerySchema),
    HubTransferController.getAllTransfers,
);

// GET /api/v1/hub-transfers/:id — Get single transfer
router.get(
    "/:id",
    auth(...STAFF_ROLES),
    HubTransferController.getTransferById,
);

// PATCH /api/v1/hub-transfers/:id/receive — Confirm receipt at destination hub
router.patch(
    "/:id/receive",
    auth(...STAFF_ROLES),
    validateRequest(HubTransferValidation.receiveTransferSchema),
    HubTransferController.receiveTransfer,
);

export const HubTransferRoutes = router;
