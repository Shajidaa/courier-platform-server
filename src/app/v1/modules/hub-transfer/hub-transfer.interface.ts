export interface IInitiateTransferPayload {
    sourceHubId: string;
    destinationHubId: string;
    shipmentIds: string[];
    vehicleId?: string;
    remarks?: string;
}

export interface IReceiveTransferPayload {
    remarks?: string;
}

export interface ITransferListQuery {
    page?: number;
    limit?: number;
    status?: string;
    sourceHubId?: string;
    destinationHubId?: string;
}
