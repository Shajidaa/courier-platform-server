import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";
import { ShipmentService } from "./shipment.service";

const createShipment = catchAsync(async (req: Request, res: Response) => {
  const shipment = await ShipmentService.createShipment(req.body, req.user!);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Shipment booked successfully.",
    data: shipment,
  });
});

const getMyShipments = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await ShipmentService.getMyShipments(
    req.user!,
    req.query as any,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipments retrieved successfully.",
    meta,
    data,
  });
});

const getShipmentById = catchAsync(async (req: Request, res: Response) => {
  const shipment = await ShipmentService.getShipmentById(
    req.params.id as string,
    req.user!,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipment retrieved successfully.",
    data: shipment,
  });
});

const updateShipment = catchAsync(async (req: Request, res: Response) => {
  const shipment = await ShipmentService.updateShipment(
    req.params.id as string,
    req.body,
    req.user!,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipment updated successfully.",
    data: shipment,
  });
});

const cancelShipment = catchAsync(async (req: Request, res: Response) => {
  await ShipmentService.cancelShipment(req.params.id as string, req.user!);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipment cancelled successfully.",
    data: null,
  });
});

// ─── Admin / Ops handlers ─────────────────────────────────────────────────────

const getAllShipments = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await ShipmentService.getAllShipments(
    req.query as any,
    req.user!,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All shipments retrieved successfully.",
    meta,
    data,
  });
});

const updateShipmentStatus = catchAsync(async (req: Request, res: Response) => {
  const shipment = await ShipmentService.updateShipmentStatus(
    req.params.id as string,
    req.body,
    req.user!,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shipment status updated successfully.",
    data: shipment,
  });
});

const assignRider = catchAsync(async (req: Request, res: Response) => {
  const shipment = await ShipmentService.assignRider(
    req.params.id as string,
    req.body,
    req.user!,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Rider assigned successfully.",
    data: shipment,
  });
});

export const ShipmentController = {
  createShipment,
  getMyShipments,
  getShipmentById,
  updateShipment,
  cancelShipment,
  getAllShipments,
  updateShipmentStatus,
  assignRider,
};
