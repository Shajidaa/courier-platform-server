import config from "../config";
import type {
  IBkashCreatePaymentResponse,
  IBkashExecuteResponse,
  IBkashTokenResponse,
} from "../v1/modules/payment/payment.interface";

const BASE_URL = config.bkash_base_url;
const APP_KEY = config.bkash_app_key;

/**
 * Step 1 — Grant a short-lived id_token from bKash.
 * Called fresh for every payment initiation (tokens expire in ~1 hour;
 * for production you'd cache + refresh, but per-request is safe for now).
 */
export const bkashGrantToken = async (): Promise<string> => {
  const res = await fetch(`${BASE_URL}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: config.bkash_username,
      password: config.bkash_password,
    },
    body: JSON.stringify({
      app_key: APP_KEY,
      app_secret: config.bkash_app_secret,
    }),
  });

  const data: IBkashTokenResponse = await res.json();

  if (!data.id_token) {
    throw new Error(
      `bKash token grant failed: ${data.statusMessage ?? "unknown error"}`,
    );
  }

  return data.id_token;
};

/**
 * Step 2 — Create a payment intent on bKash and get the redirect URL.
 */
export const bkashCreatePayment = async (
  idToken: string,
  amount: string,
  merchantInvoiceNumber: string,
  callbackURL: string,
): Promise<IBkashCreatePaymentResponse> => {
  const res = await fetch(`${BASE_URL}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: idToken,
      "x-app-key": APP_KEY,
    },
    body: JSON.stringify({
      mode: "0011",            // checkout
      payerReference: " ",
      callbackURL,
      amount,
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber,
    }),
  });

  const data: IBkashCreatePaymentResponse = await res.json();
  return data;
};

/**
 * Step 3 — Execute (capture) the payment after user approves on bKash.
 */
export const bkashExecutePayment = async (
  idToken: string,
  paymentID: string,
): Promise<IBkashExecuteResponse> => {
  const res = await fetch(`${BASE_URL}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: idToken,
      "x-app-key": APP_KEY,
    },
    body: JSON.stringify({ paymentID }),
  });

  const data: IBkashExecuteResponse = await res.json();
  return data;
};
