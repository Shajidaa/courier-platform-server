import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";
import { VehicleService } from "./vehicle.service";

const createVehicle = catchAsync(async (req: Request, res: Response) => {
  const vehicle = await VehicleService.createVehicle(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Vehicle added to fleet successfully.",
    data: vehicle,
  });
});

const getAllVehicles = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await VehicleService.getAllVehicles(req.query as any);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vehicles retrieved successfully.",
    meta,
    data,
  });
});
const getVehicleById = catchAsync(async (req: Request, res: Response) => {
  const result = await VehicleService.getVehicleById(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vehicle retrieved successfully",
    data: result,
  });
});

const deleteVehicle = catchAsync(async (req: Request, res: Response) => {
  const result = await VehicleService.deleteVehicle(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vehicle deleted successfully",
    data: result,
  });
});
const updateVehicle = catchAsync(async (req: Request, res: Response) => {
  await VehicleService.updateVehicle(req.params.id as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vehicle updated successfully",
  });
});
export const VehicleController = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
};
