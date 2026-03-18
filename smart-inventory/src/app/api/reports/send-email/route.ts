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
  if (!pdfBase64) {
    return NextResponse.json({ error: "No report PDF data provided" }, { status: 400 });
  }

  try {
    await sendReportEmail({
      to: emails,
      subject: subject || reportTitle || "Report",
      pdfBase64,
      filename: filename || "report.pdf",
      reportTitle: reportTitle || "Report",
      dateRange,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email send error:", err);
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
