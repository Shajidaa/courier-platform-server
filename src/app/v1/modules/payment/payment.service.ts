import httpStatus from "http-status";
import {
  PaymentMethod,
  PaymentStatus,
} from "../../../../../generated/prisma/client";
import config from "../../../config";
import AppError from "../../../errors/AppError";
import {
  bkashCreatePayment,
  bkashExecutePayment,
  bkashGrantToken,
} from "../../../libs/bkash";
import { prisma } from "../../../libs/prisma";
import type { IJwtPayload } from "../auth/auth.interface";
import type { IBkashInitiatePayload } from "./payment.interface";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a unique merchant invoice number tied to the payment row. */
const buildInvoiceNumber = (paymentId: string): string =>
  `INV-${paymentId.substring(0, 8).toUpperCase()}`;

// ─── Services ─────────────────────────────────────────────────────────────────

/**
 * Initiate a bKash payment for a shipment.
 * Status will be set to PENDING upon initiation.
 */
const initiatePayment = async (
  payload: IBkashInitiatePayload,
  requestUser: IJwtPayload,
) => {
  const { shipmentId } = payload;

  // Verify the shipment belongs to this sender
  const sender = await prisma.sender.findUnique({
    where: { userId: requestUser.userId },
  });

  if (!sender) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only users with a Sender profile can initiate payments.",
    );
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      senderId: true,
      deliveryCharge: true,
      codAmount: true,
      trackingNumber: true,
    },
  });

  if (!shipment) {
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
  }

  if (shipment.senderId !== sender.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have permission to pay for this shipment.",
    );
  }

  // Check if already paid via bKash
  const paidPayment = await prisma.payment.findFirst({
    where: {
      shipmentId,
      paymentMethod: PaymentMethod.BKASH,
      paymentStatus: PaymentStatus.PAID,
    },
  });

  if (paidPayment) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This shipment has already been paid via bKash.",
    );
  }

  const amountNum =
    Number(shipment.deliveryCharge) + Number(shipment.codAmount);
  const amount = amountNum.toFixed(2);

  // Find existing PENDING bKash payment record or create/update it with PENDING status
  let payment = await prisma.payment.findFirst({
    where: {
      shipmentId,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        shipmentId,
        paymentMethod: PaymentMethod.BKASH,
        paymentStatus: PaymentStatus.PENDING,
        amount: amountNum,
      },
    });
  } else {
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentMethod: PaymentMethod.BKASH,
        paymentStatus: PaymentStatus.PAID,
        amount: amountNum,

        transactionId: payment.transactionId,
      },
    });
  }

  const invoiceNumber = buildInvoiceNumber(payment.id);
  const callbackURL = `${config.bkash_callback_url}?paymentRecordId=${payment.id}`;

  // Step 1: Get bKash token
  const idToken = await bkashGrantToken();

  // Step 2: Create payment on bKash gateway
  const bkashResponse = await bkashCreatePayment(
    idToken,
    amount,
    invoiceNumber,
    callbackURL,
  );

  if (!bkashResponse.bkashURL || bkashResponse.statusCode !== "0000") {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `bKash payment creation failed: ${bkashResponse.statusMessage ?? "unknown error"}`,
    );
  }

  // Step 3: Persist the gateway response while keeping status PENDING
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      gatewayResponse: bkashResponse as any,
    },
  });

  return {
    bkashURL: bkashResponse.bkashURL,
    paymentID: bkashResponse.paymentID,
    amount,
    trackingNumber: shipment.trackingNumber,
    callbackURL,
  };
};

/**
 * Handle bKash callback after user completes or cancels payment.
 * Status becomes PAID only after successful execution.
 */
const handleCallback = async (query: {
  paymentRecordId: string;
  paymentID: string;
  status: string;
}) => {
  const { paymentRecordId, paymentID, status } = query;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentRecordId },
    include: { shipment: { select: { id: true, trackingNumber: true } } },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment record not found.");
  }

  if (payment.paymentStatus === PaymentStatus.PAID) {
    return { success: true, message: "Payment already confirmed.", payment };
  }

  // User cancelled or bKash returned failure
  if (status !== "success") {
    const updated = await prisma.payment.update({
      where: { id: paymentRecordId },
      data: {
        paymentStatus: PaymentStatus.FAILED,
        gatewayResponse: { status, paymentID } as any,
      },
    });

    return {
      success: false,
      message: `Payment ${status}. No charge was made.`,
      payment: updated,
    };
  }

  // Step 3: Execute (capture) the payment from bKash
  const idToken = await bkashGrantToken();
  const executeResponse = await bkashExecutePayment(idToken, paymentID);

  const isSuccess =
    executeResponse.statusCode === "0000" &&
    executeResponse.transactionStatus === "Completed";

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({
      where: { id: paymentRecordId },
      data: {
        // Status becomes PAID only on successful execution
        paymentStatus: isSuccess ? PaymentStatus.PAID : PaymentStatus.FAILED,
        ...(isSuccess && { transactionId: executeResponse.trxID }),
        gatewayResponse: executeResponse as any,
      },
    });

    return result;
  });

  if (!isSuccess) {
    return {
      success: false,
      message: `bKash execution failed: ${executeResponse.statusMessage ?? "unknown error"}`,
      payment: updated,
    };
  }

  return {
    success: true,
    message: "Payment completed successfully.",
    trxID: executeResponse.trxID,
    amount: executeResponse.amount,
    payment: updated,
  };
};

/**
 * Get payment status for a given payment record.
 * Senders can only see their own. Staff can see any.
 */
const getPaymentStatus = async (
  paymentId: string,
  requestUser: IJwtPayload,
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      shipment: {
        select: {
          id: true,
          trackingNumber: true,
          status: true,
          senderId: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
  }

  const staffRoles = ["ADMIN", "SUPER_ADMIN", "OPS_MANAGER", "HUB_MANAGER"];

  if (!staffRoles.includes(requestUser.role)) {
    const sender = await prisma.sender.findUnique({
      where: { userId: requestUser.userId },
    });

    if (!sender || payment.shipment?.senderId !== sender.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You do not have permission to view this payment.",
      );
    }
  }

  return payment;
};

export const PaymentService = {
  initiatePayment,
  handleCallback,
  getPaymentStatus,
};
