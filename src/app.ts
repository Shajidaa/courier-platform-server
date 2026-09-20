import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import AppError from "./app/errors/AppError";
import { globalErrorHandler } from "./app/middlewares/globalErrorHandler";
import v1Routes from "./app/v1/routes";

const app: Application = express();

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Courier Platform API is running.",
  });
});

// application routes
app.use("/api/v1", v1Routes);

// 404 Handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, `Route not found: ${req.originalUrl}`));
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
