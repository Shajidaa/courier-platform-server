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


export const HubController = {
    createHub,
    getAllHubs,

};
