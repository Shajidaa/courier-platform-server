import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";
import { AuthProvider, Gender, Role, UserStatus } from "../../../../../generated/prisma/client";
import config from "../../../config";
import AppError from "../../../errors/AppError";
import { transporter } from "../../../libs/nodemailer";
import { prisma } from "../../../libs/prisma";
import { redisClient } from "../../../libs/redis";
import { jwtUtils } from "../../../utils/jwtUtils";
import type {
  IChangePasswordPayload,
  IForgotPasswordPayload,
  IGoogleAuthPayload,
  IRedisUserData,
  IRegisterUserPayload,
  IResetPasswordPayload,
  IUpdateProfilePayload,
  IVerifyEmailPayload,
  IVerifyEmailResponse,
  TUserWithProfile,
} from "./user.interface";

const registerUser = async (payload: IRegisterUserPayload): Promise<void> => {
  const { name, password, role = Role.RIDER, gender } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    if (isUserExists.isDeleted || isUserExists.status === UserStatus.DELETED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "An account with this email was previously deleted. Please contact support.",
      );
    }
    throw new AppError(
      httpStatus.CONFLICT,
      "User with this email already exists",
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const expirationSeconds = 5 * 60; // 5 minutes
  const otpKey = `user-registration-otp:${email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const userRegistrationKey = `user-registration-data:${email}`;
  const redisUserDataPayload: IRedisUserData = {
    name,
    email,
    password: hashedPassword,
    role,
    gender,
  };

  await redisClient.set(
    userRegistrationKey,
    JSON.stringify(redisUserDataPayload),
    {
      expiration: {
        type: "EX",
        value: expirationSeconds,
      },
    },
  );

  const templatePath = path.join(
    process.cwd(),
    "src/app/v1/modules/templates/registration-user-otp.ejs",
  );

  const templateData = {
    name,
    email,
    otp: otpValue,
    expirationMinutes: expirationSeconds / 60,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Email Verification - Courier Platform",
    html,
  });
};

const verifyEmail = async (
  payload: IVerifyEmailPayload,
): Promise<IVerifyEmailResponse> => {
  const { otp } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExist = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExist?.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "User account is blocked");
  }

  if (isUserExist?.status === UserStatus.SUSPENDED) {
    throw new AppError(httpStatus.FORBIDDEN, "User account is suspended");
  }

  if (isUserExist?.emailVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Email is already verified. Please login.",
    );
  }

  if (isUserExist?.isDeleted || isUserExist?.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.FORBIDDEN, "User account has been deleted");
  }

  const otpKey = `user-registration-otp:${email}`;
  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP has expired or is invalid. Please request a new one.",
    );
  }

  if (redisOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
  }

  const userRegistrationKey = `user-registration-data:${email}`;
  const redisUserData = await redisClient.get(userRegistrationKey);

  if (!redisUserData) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Registration session expired. Please register again.",
    );
  }

  const userPayload: IRedisUserData = JSON.parse(redisUserData);

  const createdUser = await prisma.user.create({
    data: {
      name: userPayload.name,
      email: userPayload.email,
      password: userPayload.password,
      role: userPayload.role,
      gender: userPayload.gender,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
    omit: { password: true },
  });

  // Cleanup Redis cache
  await Promise.all([
    redisClient.del(otpKey),
    redisClient.del(userRegistrationKey),
  ]);

  // Send welcome email asynchronously
  try {
    const templatePath = path.join(
      process.cwd(),
      "src/app/v1/modules/templates/user-welcome-email.ejs",
    );

    const templateData = {
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      gender: createdUser.gender,
    };

    const html = await ejs.renderFile(templatePath, templateData);

    await transporter.sendMail({
      from: config.email_sender,
      to: email,
      subject: "Welcome To Courier Platform System",
      html,
    });
  } catch (mailError) {
    console.error("Failed to send welcome email:", mailError);
  }

  const jwtPayload = {
    userId: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role,
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

  return {
    user: createdUser,
    accessToken,
    refreshToken,
  };
};

const getMyProfile = async (userId: string): Promise<TUserWithProfile> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
    },
    omit: {
      password: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User profile not found");
  }

  if (user.isDeleted || user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.FORBIDDEN, "Account has been deleted");
  }

  return user;
};

const googleAuth = async (
  payload: IGoogleAuthPayload,
): Promise<IVerifyEmailResponse> => {
  const {
    name,
    googleId,
    imageUrl = "",
    gender = Gender.OTHER,
    role = Role.RIDER,
  } = payload;
  const email = payload.email.trim().toLowerCase();

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { googleId }],
    },
  });

  if (user) {
    if (user.isDeleted || user.status === UserStatus.DELETED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "This account has been deleted. Please contact support.",
      );
    }

    if (
      user.status === UserStatus.BLOCKED ||
      user.status === UserStatus.SUSPENDED
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Your account is ${user.status.toLowerCase()}. Please contact support.`,
      );
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId,
        authProvider: AuthProvider.GOOGLE,
        emailVerified: true,
        imageUrl: user.imageUrl || imageUrl,
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        name,
        email,
        googleId,
        authProvider: AuthProvider.GOOGLE,
        emailVerified: true,
        role,
        gender,
        imageUrl,
        status: UserStatus.ACTIVE,
      },
    });
  }

  const { password: _, ...sanitizedUser } = user;

  const jwtPayload = {
    userId: sanitizedUser.id,
    name: sanitizedUser.name,
    email: sanitizedUser.email,
    role: sanitizedUser.role,
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

  return {
    user: sanitizedUser,
    accessToken,
    refreshToken,
  };
};

const forgotPassword = async (payload: IForgotPasswordPayload): Promise<void> => {
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "No account found with this email address.",
    );
  }

  if (
    user.status === UserStatus.BLOCKED ||
    user.status === UserStatus.SUSPENDED
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Your account is ${user.status.toLowerCase()}. Please contact support.`,
    );
  }

  const otpValue = crypto.randomInt(100000, 1000000).toString();
  const expirationSeconds = 5 * 60; // 5 minutes
  const otpKey = `user-forgot-password-otp:${email}`;

  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/v1/modules/templates/forgot-password-otp.ejs",
  );

  const templateData = {
    name: user.name,
    email,
    otp: otpValue,
    expirationMinutes: expirationSeconds / 60,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "Reset Your Password - Courier Platform",
    html,
  });
};

const resetPassword = async (payload: IResetPasswordPayload): Promise<void> => {
  const { otp, newPassword } = payload;
  const email = payload.email.trim().toLowerCase();

  const otpKey = `user-forgot-password-otp:${email}`;
  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Password reset OTP has expired or is invalid.",
    );
  }

  if (redisOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.NOT_FOUND, "User no longer exists.");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      needPasswordChange: false,
    },
  });

  await redisClient.del(otpKey);
};

const changePassword = async (
  userId: string,
  payload: IChangePasswordPayload,
): Promise<void> => {
  const { oldPassword, newPassword } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }

  if (!user.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This account was authenticated with Google and has no password set.",
    );
  }

  const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordMatch) {
    throw new AppError(httpStatus.BAD_REQUEST, "Current password is incorrect.");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      needPasswordChange: false,
    },
  });
};

const updateProfile = async (
  userId: string,
  payload: IUpdateProfilePayload,
): Promise<TUserWithProfile> => {
  const {
    name,
    gender,
    imageUrl,
    bio,
    phoneNumber,
    nid,
    passport,
  } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name && { name }),
      ...(gender && { gender }),
      ...(imageUrl !== undefined && { imageUrl }),
      profile: {
        upsert: {
          create: {
            bio,
            phoneNumber,
            nid,
            passport,
          },
          update: {
            ...(bio !== undefined && { bio }),
            ...(phoneNumber !== undefined && { phoneNumber }),
            ...(nid !== undefined && { nid }),
            ...(passport !== undefined && { passport }),
          },
        },
      },
    },
    include: {
      profile: true,
    },
    omit: {
      password: true,
    },
  });

  return updatedUser;
};

export const UserService = {
  registerUser,
  verifyEmail,
  getMyProfile,
  googleAuth,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
};
