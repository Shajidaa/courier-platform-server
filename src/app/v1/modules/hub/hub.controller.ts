import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";
import { HubService } from "./hub.service";

const createHub = catchAsync(async (req: Request, res: Response) => {
    const hub = await HubService.createHub(req.body);
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Hub created successfully.",
        data: hub,
    });
});

const getAllHubs = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await HubService.getAllHubs(req.query as any);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Hubs retrieved successfully.",
        meta,
        data,
    });
});

const getHubById = catchAsync(async (req: Request, res: Response) => {
    const hub = await HubService.getHubById(req.params.id as string);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Hub retrieved successfully.",
        data: hub,
    });
});

const updateHub = catchAsync(async (req: Request, res: Response) => {
    const hub = await HubService.updateHub(req.params.id as string, req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Hub updated successfully.",
        data: hub,
    });
});

const assignManager = catchAsync(async (req: Request, res: Response) => {
    const hub = await HubService.assignManager(req.params.id as string, req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Manager assigned successfully.",
        data: hub,
    });
});

const deleteHub = catchAsync(async (req: Request, res: Response) => {
    await HubService.deleteHub(req.params.id as string);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Hub deleted successfully.",
        data: null,
    });
});

export const HubController = {
    createHub,
    getAllHubs,
    getHubById,
    updateHub,
    assignManager,
    deleteHub,
};
