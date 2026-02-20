import { timingSafeEqual } from "crypto";
import { cache } from "@/lib/cache";
import twilio from "twilio";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const OTP_EXPIRY_SECONDS = 300;     // 5 minutes
const OTP_ATTEMPTS_EXPIRY = 900;    // 15 minutes (send rate limit window)
const MAX_OTP_SEND_ATTEMPTS = 5;    // max OTP sends per window
const MAX_OTP_VERIFY_ATTEMPTS = 5;  // max wrong guesses before OTP is burned

const OTP_PREFIX = "otp:";
const OTP_SEND_ATTEMPTS_PREFIX = "otp_send_attempts:";
const OTP_VERIFY_ATTEMPTS_PREFIX = "otp_verify_attempts:";

// SMS Provider: "dev" (console log), "twilio", or "sns" (AWS SNS)
const SMS_PROVIDER = process.env.SMS_PROVIDER || "dev";

const twilioClient =
  SMS_PROVIDER === "twilio"
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const snsClient =
  SMS_PROVIDER === "sns"
    ? new SNSClient({
        region: process.env.AWS_REGION || "ap-south-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
      })
    : null;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(phone: string): string {
  if (typeof phone !== "string" || phone.length > 20) {
    throw new Error("Invalid phone number");
  }
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (!/^\+?\d{7,15}$/.test(cleaned)) {
    throw new Error("Invalid phone number format");
  }
  return cleaned.startsWith("+") ? cleaned : "+91" + cleaned;
}

async function sendSMS(phone: string, message: string): Promise<void> {
  switch (SMS_PROVIDER) {
    case "dev":
      console.log(`\n========================================`);
      console.log(`  DEV MODE - SMS to ${phone}`);
      console.log(`  Message: ${message}`);
      console.log(`========================================\n`);
      return;

    case "twilio":
      await twilioClient!.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });
      return;

    case "sns":
      await snsClient!.send(
        new PublishCommand({
          PhoneNumber: phone,
          Message: message,
          MessageAttributes: {
            "AWS.SNS.SMS.SMSType": {
              DataType: "String",
              StringValue: "Transactional",
            },
            ...(process.env.AWS_SNS_SENDER_ID
              ? {
                  "AWS.SNS.SMS.SenderID": {
                    DataType: "String",
                    StringValue: process.env.AWS_SNS_SENDER_ID,
                  },
                }
              : {}),
          },
        })
      );
      return;

    default:
      throw new Error(`Unknown SMS provider: ${SMS_PROVIDER}`);
  }
}

export async function sendOTP(phone: string): Promise<{ success: boolean; error?: string }> {
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch {
    return { success: false, error: "Invalid phone number format" };
  }

  // Check send rate limit
  const sendAttemptsKey = `${OTP_SEND_ATTEMPTS_PREFIX}${normalizedPhone}`;
  const attempts = cache.get<number>(sendAttemptsKey) ?? 0;
  if (attempts >= MAX_OTP_SEND_ATTEMPTS) {
    return { success: false, error: "Too many OTP requests. Please try again later." };
  }

  const otp = generateOTP();
  const otpKey = `${OTP_PREFIX}${normalizedPhone}`;
  const verifyAttemptsKey = `${OTP_VERIFY_ATTEMPTS_PREFIX}${normalizedPhone}`;

  // Store OTP and reset verify-attempt counter for the new OTP
  cache.set(otpKey, otp, OTP_EXPIRY_SECONDS);
  cache.set(sendAttemptsKey, attempts + 1, OTP_ATTEMPTS_EXPIRY);
  cache.delete(verifyAttemptsKey); // reset on new OTP issue

  try {
    await sendSMS(normalizedPhone, `Your Smart Inventory login OTP is: ${otp}. Valid for 5 minutes.`);
    return { success: true };
  } catch (error) {
    console.error(`${SMS_PROVIDER} SMS error:`, error instanceof Error ? error.message : error);
    cache.delete(otpKey);
    return { success: false, error: "Failed to send OTP. Please try again." };
  }
}

export async function verifyOTP(phone: string, otp: string): Promise<boolean> {
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizePhone(phone);
  } catch {
    return false;
  }

  const otpKey = `${OTP_PREFIX}${normalizedPhone}`;
  const sendAttemptsKey = `${OTP_SEND_ATTEMPTS_PREFIX}${normalizedPhone}`;
  const verifyAttemptsKey = `${OTP_VERIFY_ATTEMPTS_PREFIX}${normalizedPhone}`;

  const storedOTP = cache.get<string>(otpKey);
  if (!storedOTP) return false;

  // Constant-time comparison to prevent timing attacks
  const match =
    storedOTP.length === otp.length &&
    timingSafeEqual(Buffer.from(storedOTP), Buffer.from(otp));

  if (!match) {
    // Increment verify-attempt counter; burn OTP after max failures
    const verifyAttempts = (cache.get<number>(verifyAttemptsKey) ?? 0) + 1;
    cache.set(verifyAttemptsKey, verifyAttempts, OTP_EXPIRY_SECONDS);
    if (verifyAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      cache.delete(otpKey); // burn the OTP after too many wrong guesses
    }
    return false;
  }

  // Consume OTP and clear all rate-limit counters on success
  cache.delete(otpKey);
  cache.delete(sendAttemptsKey);
  cache.delete(verifyAttemptsKey);
  return true;
}
