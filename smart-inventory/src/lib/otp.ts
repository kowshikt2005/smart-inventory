import { redis } from "@/lib/redis";
import twilio from "twilio";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const OTP_PREFIX = "otp:";
const OTP_ATTEMPTS_PREFIX = "otp_attempts:";
const MAX_OTP_ATTEMPTS = 5;

// SMS Provider: "dev" (console log), "twilio", or "sns" (AWS SNS)
const SMS_PROVIDER = process.env.SMS_PROVIDER || "dev";

// Twilio client (only initialized if using twilio)
const twilioClient =
  SMS_PROVIDER === "twilio"
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

// AWS SNS client (only initialized if using sns)
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
  // Remove spaces and dashes, ensure +91 prefix for Indian numbers
  let cleaned = phone.replace(/[\s-]/g, "");
  if (!cleaned.startsWith("+")) {
    cleaned = "+91" + cleaned;
  }
  return cleaned;
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
  const normalizedPhone = normalizePhone(phone);

  // Check rate limiting
  const attemptsKey = `${OTP_ATTEMPTS_PREFIX}${normalizedPhone}`;
  const attempts = await redis.get(attemptsKey);
  if (attempts && parseInt(attempts) >= MAX_OTP_ATTEMPTS) {
    return { success: false, error: "Too many OTP requests. Please try again later." };
  }

  const otp = generateOTP();
  const otpKey = `${OTP_PREFIX}${normalizedPhone}`;

  // Store OTP in Redis with expiry
  await redis.set(otpKey, otp, "EX", OTP_EXPIRY_SECONDS);

  // Increment attempt counter (expires in 15 minutes)
  await redis.incr(attemptsKey);
  await redis.expire(attemptsKey, 900);

  try {
    await sendSMS(
      normalizedPhone,
      `Your Smart Inventory login OTP is: ${otp}. Valid for 5 minutes.`
    );
    return { success: true };
  } catch (error) {
    console.error(`${SMS_PROVIDER} SMS error:`, error);
    // Remove the stored OTP if SMS fails
    await redis.del(otpKey);
    return { success: false, error: "Failed to send OTP. Please try again." };
  }
}

export async function verifyOTP(phone: string, otp: string): Promise<boolean> {
  const normalizedPhone = normalizePhone(phone);
  const otpKey = `${OTP_PREFIX}${normalizedPhone}`;

  const storedOTP = await redis.get(otpKey);
  if (!storedOTP || storedOTP !== otp) {
    return false;
  }

  // OTP is valid - delete it so it can't be reused
  await redis.del(otpKey);
  return true;
}
