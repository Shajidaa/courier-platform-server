import type {
  DeliveryType,
  PaymentMethod,
  ShipmentCategory,
  ShipmentStatus,
} from "../../../../../generated/prisma/client";

export interface ICreateShipmentPayload {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  weight: number;
  category?: ShipmentCategory;
  packageDimensions?: string;
  deliveryType?: DeliveryType;
  codAmount?: number;
  paymentMethod?: PaymentMethod;
}

export interface IUpdateShipmentPayload {
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  packageDimensions?: string;
  codAmount?: number;
  category?: ShipmentCategory;
  deliveryType?: DeliveryType;
}

export interface IShipmentListQuery {
  page?: number;
  limit?: number;
  status?: ShipmentStatus;
}

export interface IAdminShipmentListQuery {
  page?: number;
  limit?: number;
  status?: ShipmentStatus;
  senderId?: string;
  search?: string;
}

export interface IUpdateShipmentStatusPayload {
  status: ShipmentStatus;
  note?: string;
  cancellationReason?: string;
  hubId?: string;
}

export interface IAssignRiderPayload {
  riderId: string;
}
