import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";
import config from "../../../config";
import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  const data = await PaymentService.initiatePayment(req.body, req.user!);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "bKash payment initiated. Redirect user to bkashURL.",
    data,
  });
});

/**
 * bKash hits this endpoint after the user completes payment on their side.
 * It's a GET because bKash redirects the browser here via query params.
 * No auth middleware — bKash doesn't send our JWT.
 */
const handleCallback = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.handleCallback(req.query as any);

  // If request comes from a browser redirect, redirect the user back to the client dashboard
  if (config.frontend_url && req.headers.accept?.includes("text/html")) {
    const statusParam = result?.success ? "success" : "failed";
    const msgParam = encodeURIComponent(result?.message || "");
    const trxParam = result?.trxID ? `&trxID=${encodeURIComponent(result.trxID)}` : "";
    const amountParam = result?.amount ? `&amount=${encodeURIComponent(result.amount)}` : "";

    return res.redirect(
      `${config.frontend_url}/dashboard/sender/payments?paymentStatus=${statusParam}&message=${msgParam}${trxParam}${amountParam}`,
    );
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: result?.success,
    message: result?.message,
    data: result,
  });
});

const getPaymentStatus = catchAsync(async (req: Request, res: Response) => {
  const payment = await PaymentService.getPaymentStatus(
    req.params.id as string,
    req.user!,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment retrieved successfully.",
    data: payment,
  });
});

export const PaymentController = {
  initiatePayment,
  handleCallback,
  getPaymentStatus,
};
