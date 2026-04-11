import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function decodeBase64Pdf(pdfBase64: string): Buffer {
  const normalized = pdfBase64.replace(/^data:application\/pdf;base64,/, '').trim();
  if (!normalized) {
    throw new Error('Missing PDF attachment data');
  }

  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(normalized)) {
    throw new Error('Invalid PDF base64 payload');
  }

  const buffer = Buffer.from(normalized, 'base64');
  if (buffer.length === 0) {
    throw new Error('Invalid PDF attachment data');
  }

  return buffer;
}

export async function sendReportEmail({
  to,
  subject,
  pdfBase64,
  filename,
  reportTitle,
  dateRange,
}: {
  to: string[];
  subject: string;
  pdfBase64: string;
  filename: string;
  reportTitle: string;
  dateRange?: string;
}) {
  try {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const safeTitle = escapeHtml(reportTitle);
    const safeDateRange = dateRange ? escapeHtml(dateRange) : '';
    const attachment = decodeBase64Pdf(pdfBase64);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2563eb; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">${safeTitle}</h2>
          ${safeDateRange ? `<p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">${safeDateRange}</p>` : ""}
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; margin: 0 0 12px;">Please find the <strong>${safeTitle}</strong> report attached to this email.</p>
          ${safeDateRange ? `<p style="color: #6b7280; font-size: 13px; margin: 0 0 12px;">Period: ${safeDateRange}</p>` : ""}
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated email from Smart Inventory.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Smart Inventory" <${fromAddress}>`,
      to: to.join(", "),
      subject,
      html,
      attachments: [
        {
          filename,
          content: attachment,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (error) {
    console.error('Failed to send report email:', error);
    throw new Error('Failed to send report email');
  }
}
