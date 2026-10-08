export interface IBkashInitiatePayload {
    shipmentId: string;
}

// bKash API response shapes
export interface IBkashTokenResponse {
    id_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    statusCode: string;
    statusMessage: string;
}

export interface IBkashCreatePaymentResponse {
    paymentID: string;
    bkashURL: string;
    callbackURL: string;
    successCallbackURL: string;
    failureCallbackURL: string;
    cancelledCallbackURL: string;
    amount: string;
    intent: string;
    currency: string;
    paymentCreateTime: string;
    transactionStatus: string;
    merchantInvoiceNumber: string;
    statusCode: string;
    statusMessage: string;
}

export interface IBkashExecuteResponse {
    paymentID: string;
    trxID: string;
    transactionStatus: string;
    amount: string;
    currency: string;
    intent: string;
    paymentExecuteTime: string;
    merchantInvoiceNumber: string;
    statusCode: string;
    statusMessage: string;
}
