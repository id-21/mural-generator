// POST /api/batch-descriptions/test-one
// Test endpoint - creates batch job for just ONE mural
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createBatchJobForMuralUnified } from '@/lib/features/mural-generator/batch-descriptions';

export async function POST(request: NextRequest) {
  try {
    // Find ONE mural without description
    const mural = await db.referenceMural.findFirst({
      where: { 
        artisticDescription: null,
        batchDescriptionJob: null  // No batch job exists
      }
    });


    if (!mural) {
      return NextResponse.json({ error: 'No murals without descriptions found' }, { status: 404 });
    }

    const batchJobId = await createBatchJobForMuralUnified(mural.id);

    return NextResponse.json({
      message: `Created batch job for 1 mural`,
      muralId: mural.id,
      collectionName: mural.collectionName,
      designName: mural.designName,
      batchJobId
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
