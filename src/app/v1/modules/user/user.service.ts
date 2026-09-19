import bcrypt from "bcryptjs";
import ejs from "ejs";
import { prisma } from "../../../libs/prisma";
import { redisClient } from "../../../libs/redis";
import crypto from "crypto";
import config from "../../../config";
import path from "path";
import { transporter } from "../../../libs/nodemailer";
import { Role, UserStatus } from "../../../../../generated/prisma/client";
import { jwtUtils } from "../../../utils/jwtUtils";
import { SignOptions } from "jsonwebtoken";
const registerUser = async (payload: any) => {
  console.log(payload);
  const { name, password, role, gender } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 8);
  const expirationSeconds = 5 * 60;
  const otpKey = `user-registration-otp:${email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });
  const userRegistrationKey = `user-registration-data:${email}`;
  const redisUserDataPayload = {
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
    subject: "Email Verification",

    html,
  });
};
const verifyEmail = async (payload: any) => {
  const otp = payload.otp;
  const email = payload.email.trim().toLowerCase();

  const isUserExist = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExist?.status === "BLOCKED") {
    throw new Error("User is Blocked");
  }
  console.log(isUserExist);

  if (isUserExist?.emailVerified) {
    throw new Error("Email ALready Verified");
  }

  if (isUserExist?.isDeleted || isUserExist?.status === "DELETED") {
    throw new Error("User is Deleted");
  }

  const otpKey = `user-registration-otp:${email}`;

  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new Error("Invalid OTP");
  }

  if (redisOtp !== otp) {
    throw new Error("OTP Does Not Match");
  }

  await redisClient.del(otpKey);

  const userRegistrationKey = `user-registration-data:${email}`;

  const redisUserData = await redisClient.get(userRegistrationKey);

  if (!redisUserData) {
    throw new Error("User Does not Exist");
  }

  const userPayload: any = JSON.parse(redisUserData);

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

  await redisClient.del(userRegistrationKey);

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

  const { ...user } = createdUser;
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    user,

    accessToken,
    refreshToken,
  };
};

export const UserService = {
  registerUser,

  verifyEmail,
};
