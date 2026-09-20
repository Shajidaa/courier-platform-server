import { Gender, Profile, Role, User } from "../../../../../generated/prisma/client";

export interface IRegisterUserPayload {
  name: string;
  email: string;
  password: string;
  gender: Gender;
  role?: Role;
}

export interface IVerifyEmailPayload {
  email: string;
  otp: string;
}

export interface IRedisUserData {
  name: string;
  email: string;
  password: string;
  role: Role;
  gender: Gender;
}

export type TSanitizedUser = Omit<User, "password">;

export type TUserWithProfile = TSanitizedUser & {
  profile?: Profile | null;
};

export interface IVerifyEmailResponse {
  user: TSanitizedUser;
  accessToken: string;
  refreshToken: string;
}

export interface IGoogleAuthPayload {
  name: string;
  email: string;
  googleId: string;
  imageUrl?: string;
  gender?: Gender;
  role?: Role;
}

export interface IForgotPasswordPayload {
  email: string;
}

export interface IResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}

export interface IChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export interface IUpdateProfilePayload {
  name?: string;
  gender?: Gender;
  imageUrl?: string;
  bio?: string;
  phoneNumber?: string;
  nid?: string;
  passport?: string;
}
