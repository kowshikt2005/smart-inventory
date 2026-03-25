import FormData from "form-data";

const GRAPH_API = "https://graph.facebook.com/v21.0";

function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "WhatsApp API not configured: set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN"
    );
  }
  return { phoneNumberId, accessToken };
}

/** Normalise any Indian phone to 91XXXXXXXXXX (no +, no spaces) */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// ─── Media Upload ──────────────────────────────────────────────

/**
 * Upload a PNG buffer to WhatsApp Media API → returns media_id.
 * Uses the `form-data` npm package (NOT Web FormData) for Node.js compatibility.
 */
export async function uploadMedia(
  buffer: Buffer,
  mimeType: string = "image/png"
): Promise<string> {
  const { phoneNumberId, accessToken } = getConfig();

  const filename = mimeType.includes("image") ? "report.png" : "document.pdf";

  const form = new FormData();
  form.append("file", buffer, { filename, contentType: mimeType });
  form.append("type", mimeType);
  form.append("messaging_product", "whatsapp");

  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...form.getHeaders(),
    },
    body: form.getBuffer() as unknown as BodyInit,
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("WhatsApp media upload failed:", JSON.stringify(data));
    throw new Error(
      `Media upload failed: ${data?.error?.message || JSON.stringify(data)}`
    );
  }

  console.log(`WhatsApp media uploaded: ${data.id}`);
  return data.id as string;
}

// ─── Send Messages ─────────────────────────────────────────────

/** Helper: POST to the messages endpoint */
async function postMessage(payload: Record<string, unknown>): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const { phoneNumberId, accessToken } = getConfig();

  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg =
      data?.error?.message ||
      data?.error?.error_data?.details ||
      JSON.stringify(data);
    console.error("WhatsApp send failed:", errMsg);
    return { success: false, error: errMsg };
  }

  const messageId = data?.messages?.[0]?.id;
  console.log(`WhatsApp message sent: ${messageId}`);
  return { success: true, messageId };
}

/**
 * Send a template message with an image header + body variables.
 * This is the correct approach for business-initiated messages (outside 24h window).
 *
 * Template must be pre-approved in Meta Business Manager with:
 *   - Header: IMAGE
 *   - Body: text with {{1}}, {{2}}, etc. variables
 */
export async function sendTemplateWithImage(
  phone: string,
  templateName: string,
  mediaId: string,
  bodyParams: string[],
  language: string = "en"
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const to = normalizePhone(phone);

  return postMessage({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName.trim().toLowerCase(),
      language: { code: language },
      components: [
        {
          type: "header",
          parameters: [{ type: "image", image: { id: mediaId } }],
        },
        {
          type: "body",
          parameters: bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
    },
  });
}

/**
 * Send a direct image message with caption.
 * Only works within 24-hour conversation window (customer messaged first).
 * Falls back gracefully if window is closed.
 */
export async function sendImageMessage(
  phone: string,
  mediaId: string,
  caption: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const to = normalizePhone(phone);

  return postMessage({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { id: mediaId, caption },
  });
}

/**
 * Send outstanding report to a customer.
 * Strategy:
 *   1. If WHATSAPP_TEMPLATE_NAME is set → use template with image header (works always)
 *   2. Otherwise → try direct image message (only works in 24h window)
 */
/**
 * Send outstanding report using the `payment_reminder_image` template.
 * Template body variables:
 *   {{1}} = customer name
 *   {{2}} = total outstanding (₹ formatted)
 *   {{3}} = download excel link (pass "-" as placeholder)
 */
export async function sendOutstandingToCustomer(
  phone: string,
  mediaId: string,
  customerName: string,
  totalOutstanding: number
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateName =
    process.env.WHATSAPP_TEMPLATE_NAME || "payment_reminder_image";

  const fmtAmount = `₹${new Intl.NumberFormat("en-IN").format(
    Math.round(totalOutstanding)
  )}`;

  return sendTemplateWithImage(phone, templateName, mediaId, [
    customerName,  // {{1}}
    fmtAmount,     // {{2}}
    "-",           // {{3}} — download excel link (placeholder)
  ]);
}
