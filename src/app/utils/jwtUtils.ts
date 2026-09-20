import jwt, { type JwtPayload, type Secret, type SignOptions } from "jsonwebtoken";

const createToken = (
  payload: JwtPayload | Record<string, unknown>,
  secret: Secret,
  expiresIn: SignOptions["expiresIn"],
): string => {
  return jwt.sign(payload, secret, {
    expiresIn,
  } as SignOptions);
};

const verifyToken = <T extends JwtPayload = JwtPayload>(
  token: string,
  secret: Secret,
): T => {
  return jwt.verify(token, secret) as T;
};

export const jwtUtils = {
  createToken,
  verifyToken,
};
