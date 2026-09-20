import { User } from "../../../../../generated/prisma/client";

export interface ILoginUserPayload {
  email: string;
  password: string;
}

export type TSanitizedUser = Omit<User, "password">;

export interface ILoginUserResponse {
  user: TSanitizedUser;
  accessToken: string;
  refreshToken: string;
  needPasswordChange: boolean;
}

export interface IRefreshTokenResponse {
  accessToken: string;
}

export interface IJwtPayload {
  userId: string;
  name: string;
  email: string;
  role: string;
}
