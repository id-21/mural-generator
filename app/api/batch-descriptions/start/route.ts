// POST /api/batch-descriptions/start
// Create batch jobs for all murals without artistic descriptions
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createBatchJobForMural } from '@/lib/features/mural-generator/batch-descriptions';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting batch description generation...');

    // Check if any jobs are already in progress
    const inProgressJobs = await db.batchDescriptionJob.findMany({
      where: {
        status: {
          in: ['JOB_STATE_PENDING', 'JOB_STATE_RUNNING']
        }
      }
    });

    if (inProgressJobs.length > 0) {
      return NextResponse.json(
        {
          error: 'Batch jobs already in progress',
          pendingCount: inProgressJobs.length
        },
        { status: 400 }
      );
    }

    // Find all murals without artistic descriptions
    const muralsWithoutDescriptions = await db.referenceMural.findMany({
      where: {
        artisticDescription: null
      },
      select: {
        id: true,
        collectionName: true,
        designName: true,
        colorVariant: true
      }
    });

    console.log(`Found ${muralsWithoutDescriptions.length} murals without descriptions`);

    if (muralsWithoutDescriptions.length === 0) {
      return NextResponse.json({
        message: 'All murals already have descriptions',
        jobsCreated: 0,
        totalMurals: 0
      });
    }

    // Create batch job for each mural
    const jobIds: string[] = [];
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const mural of muralsWithoutDescriptions) {
      try {
        const batchJobId = await createBatchJobForMural(mural.id);
        jobIds.push(batchJobId);
        successCount++;
        console.log(`Created batch job for ${mural.collectionName}/${mural.designName}/${mural.colorVariant || 'default'}`);
      } catch (error) {
        failCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to create job for mural ${mural.id}: ${errorMsg}`);
        console.error(`Error creating batch job for mural ${mural.id}:`, error);
      }
    }

    console.log(`Batch job creation complete: ${successCount} succeeded, ${failCount} failed`);

    return NextResponse.json({
      message: `Created ${successCount} batch jobs`,
      jobsCreated: successCount,
      totalMurals: muralsWithoutDescriptions.length,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined
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
