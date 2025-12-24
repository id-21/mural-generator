// GET /api/batch-descriptions/check
// Check for existing batch jobs and return conflict summary
import { NextRequest, NextResponse } from 'next/server';
import {
  checkBatchJobConflicts,
  generateResolutionPreview
} from '@/lib/features/mural-generator/batch-descriptions';
import { BatchConflictStrategy } from '@/lib/features/mural-generator/types';

export async function GET(request: NextRequest) {
  try {
    console.log('Checking batch job conflicts...');

    // Get conflict summary
    const conflictSummary = await checkBatchJobConflicts();

    // Generate previews for all three strategies
    const previews = {
      SKIP_CONFLICTS: generateResolutionPreview(conflictSummary, 'SKIP_CONFLICTS'),
      RETRY_FAILED: generateResolutionPreview(conflictSummary, 'RETRY_FAILED'),
      REPLACE_ALL: generateResolutionPreview(conflictSummary, 'REPLACE_ALL')
    };

    return NextResponse.json({
      conflictSummary,
      previews
    });

  } catch (error) {
    console.error('Error checking batch conflicts:', error);
    return NextResponse.json(
      {
        error: 'Failed to check batch job conflicts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
