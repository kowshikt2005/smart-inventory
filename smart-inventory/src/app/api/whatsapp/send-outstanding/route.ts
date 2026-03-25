import { NextResponse } from "next/server";
import { checkPermission } from "@/lib/api-auth";
import { generateOutstandingImage } from "@/lib/report-image";
import { uploadMedia, sendOutstandingToCustomer, normalizePhone } from "@/lib/whatsapp";

interface CustomerPayload {
  name: string;
  phone: string;
  invoices: {
    invoiceNumber: string;
    invoiceDate: string;
    balanceAmount: number;
  }[];
  totalOutstanding: number;
}

export async function POST(request: Request) {
  try {
    const { error } = await checkPermission("reports", "view");
    if (error) return error;

    const body = await request.json();
    const { customers, companyName } = body as {
      customers: CustomerPayload[];
      companyName: string;
    };

    if (!customers?.length) {
      return NextResponse.json({ error: "No customers provided" }, { status: 400 });
    }

    if (!companyName) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const results: {
      name: string;
      phone: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }[] = [];

    for (const customer of customers) {
      try {
        // Validate phone
        const normalized = normalizePhone(customer.phone);
        if (normalized.length < 10) {
          results.push({
            name: customer.name,
            phone: customer.phone,
            success: false,
            error: "Invalid phone number",
          });
          continue;
        }

        // Generate the report image for this customer
        const pngBuffer = await generateOutstandingImage(
          companyName,
          customer.name,
          customer.invoices,
          customer.totalOutstanding
        );

        // Upload image to WhatsApp
        const mediaId = await uploadMedia(pngBuffer);

        // Send via template
        const result = await sendOutstandingToCustomer(
          customer.phone,
          mediaId,
          customer.name,
          customer.totalOutstanding
        );

        results.push({
          name: customer.name,
          phone: customer.phone,
          ...result,
        });
      } catch (err) {
        console.error(`WhatsApp send failed for ${customer.name}:`, err);
        results.push({
          name: customer.name,
          phone: customer.phone,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({ sent, failed, results });
  } catch (err) {
    console.error("WhatsApp send error:", err);
    return NextResponse.json(
      { error: "Failed to send WhatsApp messages" },
      { status: 500 }
    );
  }
}
