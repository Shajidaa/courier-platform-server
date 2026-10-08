import httpStatus from "http-status";
import { Role, UserStatus } from "../../../../../generated/prisma/client";
import AppError from "../../../errors/AppError";
import { prisma } from "../../../libs/prisma";
import { IAreaListQuery, ICreateAreaPayload } from "./area.interface";




/**
 * Create service areas and postal codes under a hub.
 * - Hub must exist.
 * - Postal code must be unique across all areas globally (a postal code belongs to one hub).
 * - Area name must be unique within the same hub.
 */
const createArea = async (payload: ICreateAreaPayload) => {
    const { name, hubId, postalCode } = payload;

    // Ensure hub exists
    const hub = await prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) {
        throw new AppError(httpStatus.NOT_FOUND, "Hub not found.");
    }

    // Postal codes must be globally unique — a postal code can only belong to one hub
    const existingPostalCode = await prisma.area.findFirst({
        where: { postalCode: { equals: postalCode, mode: "insensitive" } },
        include: { hub: { select: { hubName: true } } },
    });

    if (existingPostalCode) {
        throw new AppError(
            httpStatus.CONFLICT,
            `Postal code "${postalCode}" is already assigned to hub "${existingPostalCode.hub.hubName}".`,
        );
    }

    // Area name must be unique within the same hub
    const existingAreaName = await prisma.area.findFirst({
        where: {
            hubId,
            name: { equals: name, mode: "insensitive" },
        },
    });

    if (existingAreaName) {
        throw new AppError(
            httpStatus.CONFLICT,
            `An area named "${name}" already exists in this hub.`,
        );
    }

    const area = await prisma.area.create({
        data: { name, hubId, postalCode },
        include: {
            hub: { select: { id: true, hubName: true, address: true } },
        },
    });

    return area;
};

/**
 * List all service areas with their assigned hubs.
 * Supports filtering by hubId, search, and pagination.
 */
const getAllAreas = async (query: IAreaListQuery) => {
    const { page = 1, limit = 10, hubId, search } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (hubId) {
        where.hubId = hubId;
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { postalCode: { contains: search, mode: "insensitive" } },
            { hub: { hubName: { contains: search, mode: "insensitive" } } },
        ];
    }

    const [areas, total] = await prisma.$transaction([
        prisma.area.findMany({
            where,
            skip,
            take: Number(limit),
            orderBy: { createdAt: "desc" },
            include: {
                hub: {
                    select: {
                        id: true,
                        hubName: true,
                        address: true,
                        manager: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
        }),
        prisma.area.count({ where }),
    ]);

    return {
        data: areas,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

export const AreaService = {

    createArea,
    getAllAreas,
};
