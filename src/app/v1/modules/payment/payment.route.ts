import { Router } from "express";
import { Role } from "../../../../../generated/prisma/client";
import { auth } from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

// POST /api/v1/payments/bkash/initiate — Sender initiates bKash payment for a shipment
router.post(
    "/bkash/initiate",
    auth(Role.SENDER),
    validateRequest(PaymentValidation.initiatePaymentSchema),
    PaymentController.initiatePayment,
);

// GET /api/v1/payments/callback & /api/v1/payments/bkash/callback — bKash redirects here after user action (no JWT)
router.get(
    "/callback",
    validateRequest(PaymentValidation.callbackQuerySchema),
    PaymentController.handleCallback,
);

router.get(
    "/bkash/callback",
    validateRequest(PaymentValidation.callbackQuerySchema),
    PaymentController.handleCallback,
);

// GET /api/v1/payments/:id — Check payment status (defined after static routes)
router.get(
    "/:id",
    auth(
        Role.SENDER,
        Role.ADMIN,
        Role.SUPER_ADMIN,
        Role.OPS_MANAGER,
        Role.HUB_MANAGER,
    ),
    PaymentController.getPaymentStatus,
);

export const PaymentRoutes = router;
