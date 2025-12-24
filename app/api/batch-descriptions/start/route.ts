// POST /api/batch-descriptions/start
// Create batch jobs with conflict resolution strategy
import { NextRequest, NextResponse } from 'next/server';
import { createBatchJobsWithStrategy } from '@/lib/features/mural-generator/batch-descriptions';
import { BatchConflictStrategy } from '@/lib/features/mural-generator/types';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting batch description generation with strategy...');

    // Parse request body
    const body = await request.json();
    const { strategy } = body;

    // Validate strategy
    const validStrategies: BatchConflictStrategy[] = ['SKIP_CONFLICTS', 'RETRY_FAILED', 'REPLACE_ALL'];
    if (!strategy || !validStrategies.includes(strategy)) {
      return NextResponse.json(
        {
          error: 'Invalid strategy',
          details: `Strategy must be one of: ${validStrategies.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Apply strategy and create jobs
    const result = await createBatchJobsWithStrategy(strategy);

    return NextResponse.json({
      message: `Created ${result.jobsCreated} batch jobs using ${strategy} strategy`,
      strategy,
      jobsCreated: result.jobsCreated,
      jobsSkipped: result.jobsSkipped,
      jobsArchived: result.jobsArchived,
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error) {
    console.error('Error starting batch descriptions:', error);
    return NextResponse.json(
      {
        error: 'Failed to start batch description generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
