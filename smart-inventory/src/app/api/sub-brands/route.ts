import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPermission } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('masters_items', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const brandId = searchParams.get('brandId');
    // Optional pagination - if not provided, returns all (backward compatible)
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : null;

    const activeOnly = searchParams.get('activeOnly') === 'true';
    const where: any = {};
    if (search) where.name = { contains: search };
    if (brandId) where.brandId = brandId;
    if (activeOnly) where.isActive = true;

    // Use parallel queries for efficiency
    const [subBrands, total] = await Promise.all([
      db.subBrand.findMany({
        where,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          brandId: true,
          discountPercent: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
        },
        ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
      db.subBrand.count({ where }),
    ]);

    return NextResponse.json({
      subBrands,
      total,
      ...(page && limit ? {
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      } : {}),
    });
  } catch (error) {
    console.error("Error fetching sub-brands:", error);
    return NextResponse.json(
      { error: "Failed to fetch sub-brands" },
      { status: 500 }
    );
  }
}
