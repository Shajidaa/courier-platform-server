import { z } from "zod";

const initiatePaymentSchema = z.object({
    body: z.object({
        shipmentId: z.string().uuid("Invalid shipment ID"),
    }),
});

const callbackQuerySchema = z.object({
    query: z.object({
        paymentRecordId: z.string().uuid("Invalid payment record ID"),
        paymentID: z.string().min(1, "paymentID is required"),
        status: z.enum(["success", "failure", "cancel"]),
    }),
});

export const PaymentValidation = {
    initiatePaymentSchema,
    callbackQuerySchema,
};
