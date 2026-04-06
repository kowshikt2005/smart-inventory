import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuth } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const { error } = await checkAuth();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');

    if (!entityType) {
      return NextResponse.json({ error: 'entityType is required' }, { status: 400 });
    }

    const mappings = await db.importMapping.findMany({
      where: { entityType },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error('Error fetching import mappings:', error);
    return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error: postErr } = await checkAuth();
    if (postErr) return postErr;

    const body = await request.json();
    const { entityType, name, mapping } = body;

    if (!entityType || !name || !mapping) {
      return NextResponse.json({ error: 'entityType, name, and mapping are required' }, { status: 400 });
    }

    const created = await db.importMapping.create({
      data: { entityType, name, mapping },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A mapping with this name already exists for this entity type' }, { status: 409 });
    }
    console.error('Error creating import mapping:', error);
    return NextResponse.json({ error: 'Failed to create mapping' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error: putErr } = await checkAuth();
    if (putErr) return putErr;

    const body = await request.json();
    const { id, name, mapping } = body;

    if (!id || !mapping) {
      return NextResponse.json({ error: 'id and mapping are required' }, { status: 400 });
    }

    const updated = await db.importMapping.update({
      where: { id },
      data: { ...(name && { name }), mapping },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating import mapping:', error);
    return NextResponse.json({ error: 'Failed to update mapping' }, { status: 500 });
  }
}
