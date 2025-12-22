// API route to list generated murals
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const referenceMuralId = searchParams.get('referenceMuralId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};

    if (referenceMuralId) {
      where.referenceMuralId = referenceMuralId;
    }

    const generatedMurals = await db.generatedMural.findMany({
      where,
      include: {
        referenceMural: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return NextResponse.json({
      generatedMurals,
      total: generatedMurals.length,
    });
  } catch (error) {
    console.error('Error fetching generated murals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generated murals' },
      { status: 500 }
    );
  }
}
