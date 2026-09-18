import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";

const registerUser = catchAsync(async (req: Request, res: Response) => {
  const payload = await req.body;

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Verification OTP Sent",
    data: null,
  });
});

export const UserController = {
  registerUser,
};
