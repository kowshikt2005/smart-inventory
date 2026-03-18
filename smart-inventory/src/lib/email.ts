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
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2563eb; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">${reportTitle}</h2>
        ${dateRange ? `<p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">${dateRange}</p>` : ""}
      </div>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; margin: 0 0 12px;">Please find the <strong>${reportTitle}</strong> report attached to this email.</p>
        ${dateRange ? `<p style="color: #6b7280; font-size: 13px; margin: 0 0 12px;">Period: ${dateRange}</p>` : ""}
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
        content: Buffer.from(pdfBase64, "base64"),
        contentType: "application/pdf",
      },
    ],
  });
}
