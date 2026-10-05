import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";
import { AreaService } from "./area.service";



const createArea = catchAsync(async (req: Request, res: Response) => {
    const area = await AreaService.createArea(req.body);

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Area created successfully.",
        data: area,
    });
});

const getAllAreas = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await AreaService.getAllAreas(req.query as any);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Areas retrieved successfully.",
        meta,
        data,
    });
});

export const AreaController = {

    createArea,
    getAllAreas,
};
