import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Fetch all sub-brands in a single query
    const subBrands = await db.subBrand.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        brandId: true,
      },
    });

    return NextResponse.json({
      subBrands,
      total: subBrands.length,
    });
  } catch (error) {
    console.error("Error fetching sub-brands:", error);
    return NextResponse.json(
      { error: "Failed to fetch sub-brands" },
      { status: 500 }
    );
  }
}
