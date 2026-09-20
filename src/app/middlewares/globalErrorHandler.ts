import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import config from "../config";
import AppError from "../errors/AppError";

type TErrorSource = {
  path: string | number;
  message: string;
};

export const globalErrorHandler: ErrorRequestHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message: string = "Something went wrong!";
  let errorSources: TErrorSource[] = [
    {
      path: "",
      message: "Something went wrong!",
    },
  ];

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [
      {
        path: "",
        message: err.message,
      },
    ];
  } else if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation Error";
    errorSources = err.issues.map((issue) => {
      const path = issue.path[issue.path.length - 1] ?? "";
      return {
        path: String(path),
        message: issue.message,
      };
    });
  } else if (err?.name === "PrismaClientKnownRequestError") {
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(", ")
        : err.meta?.target || "Field";
      message = `${target} already exists.`;
      errorSources = [
        {
          path: String(target),
          message: `${target} already exists.`,
        },
      ];
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      message = "Record not found.";
      errorSources = [
        {
          path: "",
          message: "Record not found.",
        },
      ];
    }
  } else if (err?.name === "JsonWebTokenError") {
    statusCode = httpStatus.UNAUTHORIZED;
    message = "Invalid token. Please authenticate again.";
    errorSources = [
      {
        path: "",
        message: err.message,
      },
    ];
  } else if (err?.name === "TokenExpiredError") {
    statusCode = httpStatus.UNAUTHORIZED;
    message = "Token has expired. Please authenticate again.";
    errorSources = [
      {
        path: "",
        message: err.message,
      },
    ];
  } else if (err instanceof Error) {
    message = err.message;
    errorSources = [
      {
        path: "",
        message: err.message,
      },
    ];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    stack: config.node_env === "development" ? err?.stack : undefined,
  });
};
