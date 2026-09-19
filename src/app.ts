import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
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
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
    path: req.originalUrl,
  });
});

export default app;
