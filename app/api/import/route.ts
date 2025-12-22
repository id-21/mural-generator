// API route to import reference murals from local directory
import { NextResponse } from 'next/server';
import { importReferenceMurals, getImportStats } from '@/lib/features/mural-generator/import';

export async function POST() {
  try {
    const basePath = process.env.REFERENCE_MURALS_PATH;

    if (!basePath) {
      return NextResponse.json(
        { error: 'REFERENCE_MURALS_PATH not configured' },
        { status: 500 }
      );
    }

    const result = await importReferenceMurals(basePath);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import reference murals' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stats = await getImportStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting import stats:', error);
    return NextResponse.json(
      { error: 'Failed to get import stats' },
      { status: 500 }
    );
  }
}
