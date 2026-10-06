import httpStatus from "http-status";
import { Role, UserStatus } from "../../../../../generated/prisma/client";
import AppError from "../../../errors/AppError";
import { prisma } from "../../../libs/prisma";
import type {
    IAssignManagerPayload,
    ICreateHubPayload,
    IHubListQuery,
    IUpdateHubPayload,
} from "./hub.interface";

// ─── Shared include shape ─────────────────────────────────────────────────────

const hubInclude = {
    manager: {
        select: { id: true, name: true, email: true, role: true },
    },
    areas: {
        select: { id: true, name: true, postalCode: true },
        orderBy: { createdAt: "asc" as const },
    },
    _count: { select: { areas: true, currentShipments: true } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const assertValidManager = async (managerId: string) => {
    const manager = await prisma.user.findUnique({
        where: { id: managerId },
        include: { managedHub: true },
    });

    if (!manager) throw new AppError(httpStatus.NOT_FOUND, "Manager not found.");

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

    return manager;
};

// ─── Services ─────────────────────────────────────────────────────────────────

/**
 * Create a new operational hub.
 * - Hub name must be globally unique (case-insensitive).
 * - Optional managerId must be an active HUB_MANAGER not already managing a hub.
 */
const createHub = async (payload: ICreateHubPayload) => {
    const { hubName, address, managerId } = payload;

    const existingHub = await prisma.hub.findFirst({
        where: { hubName: { equals: hubName, mode: "insensitive" } },
    });

    if (existingHub) {
        throw new AppError(
            httpStatus.CONFLICT,
            `A hub with the name "${hubName}" already exists.`,
        );
    }

    if (managerId) {
        const manager = await assertValidManager(managerId);
        if (manager.managedHub) {
            throw new AppError(
                httpStatus.CONFLICT,
                "This user is already managing another hub.",
            );
        }
    }

    return prisma.hub.create({
        data: { hubName, address, managerId },
        include: hubInclude,
    });
};

/**
 * List all hubs with search and pagination.
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
            include: hubInclude,
        }),
        prisma.hub.count({ where }),
    ]);

    return {
        data: hubs,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Get a single hub by ID with full details.
 */
const getHubById = async (hubId: string) => {
    const hub = await prisma.hub.findUnique({
        where: { id: hubId },
        include: hubInclude,
    });

    if (!hub) throw new AppError(httpStatus.NOT_FOUND, "Hub not found.");

    return hub;
};

/**
 * Update hub name and/or address.
 * Rejects duplicate hub names.
 */
const updateHub = async (hubId: string, payload: IUpdateHubPayload) => {
    const hub = await prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) throw new AppError(httpStatus.NOT_FOUND, "Hub not found.");

    if (payload.hubName && payload.hubName !== hub.hubName) {
        const conflict = await prisma.hub.findFirst({
            where: {
                hubName: { equals: payload.hubName, mode: "insensitive" },
                id: { not: hubId },
            },
        });
        if (conflict) {
            throw new AppError(
                httpStatus.CONFLICT,
                `A hub with the name "${payload.hubName}" already exists.`,
            );
        }
    }

    return prisma.hub.update({
        where: { id: hubId },
        data: {
            ...(payload.hubName && { hubName: payload.hubName }),
            ...(payload.address && { address: payload.address }),
        },
        include: hubInclude,
    });
};

/**
 * Assign or replace the manager of a hub.
 * - New manager must be an active HUB_MANAGER not already assigned elsewhere.
 * - Releases the previous manager's link before assigning the new one.
 */
const assignManager = async (
    hubId: string,
    payload: IAssignManagerPayload,
) => {
    const hub = await prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) throw new AppError(httpStatus.NOT_FOUND, "Hub not found.");

    const manager = await assertValidManager(payload.managerId);

    // Check manager isn't already running a different hub
    if (manager.managedHub && manager.managedHub.id !== hubId) {
        throw new AppError(
            httpStatus.CONFLICT,
            "This user is already managing another hub.",
        );
    }

    return prisma.hub.update({
        where: { id: hubId },
        data: { managerId: payload.managerId },
        include: hubInclude,
    });
};

/**
 * Delete a hub.
 * - Rejected if the hub still has active (non-delivered/cancelled) shipments.
 */
const deleteHub = async (hubId: string) => {
    const hub = await prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) throw new AppError(httpStatus.NOT_FOUND, "Hub not found.");

    const activeShipmentCount = await prisma.shipment.count({
        where: {
            currentHubId: hubId,
            status: {
                notIn: ["DELIVERED", "CANCELLED", "RETURNED"],
            },
        },
    });

    if (activeShipmentCount > 0) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Cannot delete hub with ${activeShipmentCount} active shipment(s). Resolve them first.`,
        );
    }

    await prisma.hub.delete({ where: { id: hubId } });
};

export const HubService = {
    createHub,
    getAllHubs,
    getHubById,
    updateHub,
    assignManager,
    deleteHub,
};
