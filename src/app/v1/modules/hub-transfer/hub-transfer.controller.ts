import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../../utils/asyncHandler";
import { sendResponse } from "../../../utils/sendResponse";
import { HubTransferService } from "./hub-transfer.service";

const initiateTransfer = catchAsync(async (req: Request, res: Response) => {
    const transfer = await HubTransferService.initiateTransfer(
        req.body,
        req.user!,
    );
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Transfer initiated successfully.",
        data: transfer,
    });
});

const receiveTransfer = catchAsync(async (req: Request, res: Response) => {
    const transfer = await HubTransferService.receiveTransfer(
        req.params.id as string,
        req.body,
        req.user!,
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Transfer received successfully.",
        data: transfer,
    });
});

const getAllTransfers = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await HubTransferService.getAllTransfers(
        req.query as any,
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Transfers retrieved successfully.",
        meta,
        data,
    });
});

const getTransferById = catchAsync(async (req: Request, res: Response) => {
    const transfer = await HubTransferService.getTransferById(req.params.id as string);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Transfer retrieved successfully.",
        data: transfer,
    });
});

export const HubTransferController = {
    initiateTransfer,
    receiveTransfer,
    getAllTransfers,
    getTransferById,
};
