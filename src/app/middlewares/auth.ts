import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Role, UserStatus } from "../../../generated/prisma/client";
import config from "../config";
import AppError from "../errors/AppError";
import { prisma } from "../libs/prisma";
import { jwtUtils } from "../utils/jwtUtils";
import type { IJwtPayload } from "../v1/modules/auth/auth.interface";

declare global {
  namespace Express {
    interface Request {
      user?: IJwtPayload;
    }
  }
}

export const auth = (...requiredRoles: Role[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      let token: string | undefined;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      } else if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
      }

      if (!token) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "You are not authorized to access this resource.",
        );
      }

      let decoded: IJwtPayload;
      try {
        decoded = jwtUtils.verifyToken<IJwtPayload>(
          token,
          config.jwt_access_secret,
        );
      } catch (err: any) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "Invalid or expired token. Please log in again.",
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, "User no longer exists.");
      }

      if (user.isDeleted || user.status === UserStatus.DELETED) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "This account has been deleted.",
        );
      }

      if (
        user.status === UserStatus.BLOCKED ||
        user.status === UserStatus.SUSPENDED
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `This account is currently ${user.status.toLowerCase()}.`,
        );
      }

      if (
        requiredRoles.length > 0 &&
        !requiredRoles.includes(user.role as Role)
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You do not have permission to access this resource.",
        );
      }

      req.user = decoded;
      next();
    } catch (error) {
      next(error);
    }
  };
};
