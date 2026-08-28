import crypto from "crypto";

export function generateOtp(): string {
  return crypto.randomInt(100000, 1_000_000).toString();
}

export function otpExpiryTime(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15);
  return expiry;
}

function emailDeliveryUnavailable(): never {
  throw new Error("Transactional email delivery is not configured");
}

export async function sendVerificationEmail(_email: string, _firstName: string, _otp: string): Promise<void> {
  emailDeliveryUnavailable();
}

export async function sendLoginOtpEmail(_email: string, _firstName: string, _otp: string): Promise<void> {
  emailDeliveryUnavailable();
}

export async function sendPasswordResetEmail(_email: string, _firstName: string, _otp: string): Promise<void> {
  emailDeliveryUnavailable();
}