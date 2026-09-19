import bcrypt from "bcryptjs";
import ejs from "ejs";
import { prisma } from "../../../libs/prisma";
import { redisClient } from "../../../libs/redis";
import crypto from "crypto";
import config from "../../../config";
import path from "path";
import { transporter } from "../../../libs/nodemailer";
const registerUser = async (payload: any) => {
  console.log(payload);
  const { name, password } = payload;
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
const verifyEmail = async () => {};

export const UserService = {
  registerUser,

  verifyEmail,
};
