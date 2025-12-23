// GET /api/batch-descriptions/poll
// Poll all pending/running batch jobs and update their status
import { NextRequest, NextResponse } from 'next/server';
import { pollBatchJobs } from '@/lib/features/mural-generator/batch-descriptions';

export async function GET(request: NextRequest) {
  try {
    console.log('Polling batch jobs...');

    const stats = await pollBatchJobs();

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error polling batch jobs:', error);
    return NextResponse.json(
      {
        error: 'Failed to poll batch jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
