import { VehicleStatus, VehicleType } from "../../../../../generated/prisma/client";

export interface ICreateVehiclePayload {
    vehicleNumber: string;
    type: VehicleType;
    driverName?: string;
    capacity?: string;
    currentDriverId?: string;
}

export interface IVehicleListQuery {
    page?: number;
    limit?: number;
    status?: VehicleStatus;
    type?: VehicleType;
    search?: string;
}
