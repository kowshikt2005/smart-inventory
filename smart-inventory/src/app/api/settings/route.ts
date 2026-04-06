import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/api-auth";

// GET /api/settings - Get all settings or a specific setting by key
export async function GET(request: NextRequest) {
  try {
    const { error } = await checkPermission('settings', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      const setting = await db.appSetting.findUnique({
        where: { key },
      });

      if (!setting) {
        return NextResponse.json(
          { error: `Setting '${key}' not found` },
          { status: 404 }
        );
      }

      return NextResponse.json(setting);
    }

    const settings = await db.appSetting.findMany({
      orderBy: { key: "asc" },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// Allowlist of valid setting keys
const ALLOWED_SETTING_KEYS = new Set([
  'negative_billing',
  'invoice_roundoff_mode',
  'stock_scan_time',
  'company_name',
  'company_address',
  'company_city',
  'company_state',
  'company_pincode',
  'company_phone',
  'company_email',
  'company_gstin',
  'company_pan',
  'company_msme',
  'company_fssai',
]);

// PUT /api/settings - Update a setting
export async function PUT(request: NextRequest) {
  try {
    const { error } = await checkPermission('settings', 'edit');
    if (error) return error;

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Key and value are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_SETTING_KEYS.has(key)) {
      return NextResponse.json(
        { error: `Invalid setting key: '${key}'` },
        { status: 400 }
      );
    }

    const setting = await db.appSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: {
        key,
        value: String(value),
        label: body.label || key,
      },
    });

    return NextResponse.json(setting);
  } catch (error) {
    console.error("Error updating setting:", error);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    );
  }
}
