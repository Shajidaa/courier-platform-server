import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import { AuthProvider, UserStatus } from "../../../../../generated/prisma/client";
import config from "../../../config";
import AppError from "../../../errors/AppError";
import { prisma } from "../../../libs/prisma";
import { jwtUtils } from "../../../utils/jwtUtils";
import type {
  IJwtPayload,
  ILoginUserPayload,
  ILoginUserResponse,
  IRefreshTokenResponse,
} from "./auth.interface";

const loginUser = async (
  payload: ILoginUserPayload,
): Promise<ILoginUserResponse> => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User does not exist with this email");
  }

  if (user.isDeleted || user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.FORBIDDEN, "This account has been deleted");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been blocked. Please contact support.",
    );
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. Please contact support.",
    );
  }

  if (user.status === UserStatus.INACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account is inactive. Please contact support.",
    );
  }

  if (user.authProvider === AuthProvider.GOOGLE && !user.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This account is registered with Google. Please log in using Google.",
    );
  }

  if (!user.emailVerified) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Email is not verified. Please verify your email first.",
    );
  }

  const isPasswordMatched = await bcrypt.compare(
    password,
    user.password || "",
  );

  if (!isPasswordMatched) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  const jwtPayload: IJwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as any,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as any,
  );

  const { password: _, ...sanitizedUser } = user;

  return {
    user: sanitizedUser,
    accessToken,
    refreshToken,
    needPasswordChange: user.needPasswordChange,
  };
};

const refreshToken = async (
  token: string,
): Promise<IRefreshTokenResponse> => {
  if (!token) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
  }

  const decoded = jwtUtils.verifyToken<IJwtPayload>(
    token,
    config.jwt_refresh_secret,
  );

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted || user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.FORBIDDEN, "Account has been deleted");
  }

  if (user.status === UserStatus.BLOCKED || user.status === UserStatus.SUSPENDED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account is not active. Please contact support.",
    );
  }

  const jwtPayload: IJwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as any,
  );

  return {
    accessToken,
  };
};

export const AuthService = {
  loginUser,
  refreshToken,
};
