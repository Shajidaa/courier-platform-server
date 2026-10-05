export interface ICreateAreaPayload {
    name: string;
    hubId: string;
    postalCode: string;
}


export interface IAreaListQuery {
    page?: number;
    limit?: number;
    hubId?: string;
    search?: string;
}
