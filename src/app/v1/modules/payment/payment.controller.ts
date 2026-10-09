import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";
import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  const data = await PaymentService.initiatePayment(req.body, req.user!);
  // console.log("Payment initiation data:", data);
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
