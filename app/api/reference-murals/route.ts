// API route to list and filter reference murals
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get('collection');
    const design = searchParams.get('design');

    const where: any = {};

    if (collection) {
      where.collectionName = collection;
    }

    if (design) {
      where.designName = design;
    }

    const murals = await db.referenceMural.findMany({
      where,
      orderBy: [
        { collectionName: 'asc' },
        { designName: 'asc' },
        { colorVariant: 'asc' },
      ],
    });

    // Get unique collections and designs for filters
    const collections = await db.referenceMural.findMany({
      distinct: ['collectionName'],
      select: { collectionName: true },
      orderBy: { collectionName: 'asc' },
    });

    const designs = await db.referenceMural.findMany({
      distinct: ['designName'],
      select: { designName: true },
      where: collection ? { collectionName: collection } : undefined,
      orderBy: { designName: 'asc' },
    });

    return NextResponse.json({
      murals,
      filters: {
        collections: collections.map((c) => c.collectionName),
        designs: designs.map((d) => d.designName),
      },
    });
  } catch (error) {
    console.error('Error fetching reference murals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reference murals' },
      { status: 500 }
    );
  }
}
