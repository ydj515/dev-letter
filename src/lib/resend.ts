import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient() {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  resendClient = new Resend(apiKey);
  return resendClient;
}

export function getSenderEmail() {
  const sender = process.env.RESEND_FROM_EMAIL;
  if (!sender) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }
  return sender;
}
