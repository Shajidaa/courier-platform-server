import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../../config";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";
import { UserService } from "./user.service";

const registerUser = catchAsync(async (req: Request, res: Response) => {
  await UserService.registerUser(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Verification OTP sent to your email.",
    data: null,
  });
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.verifyEmail(req.body);
  const { accessToken, refreshToken, user } = result;

  const isProduction = config.node_env === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Email verified and user registered successfully.",
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId as string;
  const user = await UserService.getMyProfile(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile retrieved successfully.",
    data: user,
  });
});

const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.googleAuth(req.body);
  const { accessToken, refreshToken, user } = result;

  const isProduction = config.node_env === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User authenticated via Google successfully.",
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  await UserService.forgotPassword(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset OTP sent to your email.",
    data: null,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await UserService.resetPassword(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully. You can now login.",
    data: null,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId as string;
  await UserService.changePassword(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully.",
    data: null,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId as string;
  const result = await UserService.updateProfile(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully.",
    data: result,
  });
});

export const UserController = {
  registerUser,
  verifyEmail,
  getMyProfile,
  googleAuth,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
};
