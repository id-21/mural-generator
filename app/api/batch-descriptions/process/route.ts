// POST /api/batch-descriptions/process
// Process completed batch jobs - parse results and update ReferenceMural
// This is a MANUAL trigger endpoint (called via CLI or UI button)
import { NextRequest, NextResponse } from 'next/server';
import { processCompletedJobsUnified } from '@/lib/features/mural-generator/batch-descriptions';

export async function POST(request: NextRequest) {
  try {
    console.log('Processing completed batch jobs...');

    const result = await processCompletedJobsUnified();

    return NextResponse.json({
      message: `Processed ${result.processed} descriptions, ${result.failed} failed`,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error) {
    console.error('Error processing batch jobs:', error);
    return NextResponse.json(
      {
        error: 'Failed to process batch jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
