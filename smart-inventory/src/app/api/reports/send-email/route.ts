import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/api-auth";
import { sendReportEmail } from "@/lib/email";

// POST /api/reports/send-email
// Body: { emails, subject, pdfBase64, filename, reportTitle, dateRange? }
export async function POST(req: Request) {
  const { error } = await checkAuth();
  if (error) return error;

  const body = await req.json();
  const { emails, subject, pdfBase64, filename, reportTitle, dateRange } = body;

  if (!emails?.length) {
    return NextResponse.json({ error: "No recipients specified" }, { status: 400 });
  }

  const MAX_RECIPIENTS = 20;
  if (emails.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `Too many recipients. Maximum ${MAX_RECIPIENTS}.` }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmail = emails.find((e: string) => !emailRegex.test(e));
  if (invalidEmail) {
    return NextResponse.json({ error: `Invalid email address: ${invalidEmail}` }, { status: 400 });
  }

  if (!pdfBase64) {
    return NextResponse.json({ error: "No report PDF data provided" }, { status: 400 });
  }

  const result = await sendReportEmail({
    to: emails,
    subject: subject || reportTitle || "Report",
    pdfBase64,
    filename: filename || "report.pdf",
    reportTitle: reportTitle || "Report",
    dateRange,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
