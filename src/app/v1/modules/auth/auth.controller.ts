import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";
import { AuthService } from "./auth.service";

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",
    data: {},
  });
});

export const AuthController = {
  loginUser,
};
