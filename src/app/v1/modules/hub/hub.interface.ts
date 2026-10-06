export interface ICreateHubPayload {
    hubName: string;
    address: string;
    managerId?: string;
}

export interface IUpdateHubPayload {
    hubName?: string;
    address?: string;
}

export interface IAssignManagerPayload {
    managerId: string;
}

export interface IHubListQuery {
    page?: number;
    limit?: number;
    search?: string;
}
