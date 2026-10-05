import httpStatus from "http-status";
import { Role, UserStatus } from "../../../../../generated/prisma/client";
import AppError from "../../../errors/AppError";
import { prisma } from "../../../libs/prisma";
import type {

    ICreateHubPayload,
    IHubListQuery,
} from "./hub.interface";

/**
 * Create a new operational hub.
 * - Hub name must be unique.
 * - If managerId is provided, the user must exist, be active, and have the HUB_MANAGER role.
 * - A manager can only manage one hub at a time.
 */
const createHub = async (payload: ICreateHubPayload) => {
    const { hubName, address, managerId } = payload;

    // Check for duplicate hub name (case-insensitive)
    const existingHub = await prisma.hub.findFirst({
        where: { hubName: { equals: hubName, mode: "insensitive" } },
    });

    if (existingHub) {
        throw new AppError(
            httpStatus.CONFLICT,
            `A hub with the name "${hubName}" already exists.`,
        );
    }

    // Validate manager if provided
    if (managerId) {
        const manager = await prisma.user.findUnique({
            where: { id: managerId },
            include: { managedHub: true },
        });

        if (!manager) {
            throw new AppError(httpStatus.NOT_FOUND, "Manager not found.");
        }

        if (manager.isDeleted || manager.status === UserStatus.DELETED) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                "Cannot assign a deleted user as hub manager.",
            );
        }

        if (
            manager.status === UserStatus.BLOCKED ||
            manager.status === UserStatus.SUSPENDED
        ) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Cannot assign a ${manager.status.toLowerCase()} user as hub manager.`,
            );
        }

        if (manager.role !== Role.HUB_MANAGER) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                "Assigned manager must have the HUB_MANAGER role.",
            );
        }

        if (manager.managedHub) {
            throw new AppError(
                httpStatus.CONFLICT,
                "This user is already managing another hub.",
            );
        }
    }

    const hub = await prisma.hub.create({
        data: { hubName, address, managerId },
        include: {
            manager: {
                select: { id: true, name: true, email: true, role: true },
            },
            _count: { select: { areas: true } },
        },
    });

    return hub;
};

/**
 * List all hubs with optional search and pagination.
 */
const getAllHubs = async (query: IHubListQuery) => {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where = search
        ? {
            OR: [
                { hubName: { contains: search, mode: "insensitive" as const } },
                { address: { contains: search, mode: "insensitive" as const } },
            ],
        }
        : {};

    const [hubs, total] = await prisma.$transaction([
        prisma.hub.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                manager: {
                    select: { id: true, name: true, email: true, role: true },
                },
                areas: {
                    select: { id: true, name: true, postalCode: true },
                    orderBy: { createdAt: "asc" },
                },
                _count: { select: { areas: true, currentShipments: true } },
            },
        }),
        prisma.hub.count({ where }),
    ]);

    return {
        data: hubs,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};


export const HubService = {
    createHub,
    getAllHubs,

};
