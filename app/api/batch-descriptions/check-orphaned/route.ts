// GET /api/batch-descriptions/check-orphaned
// Check status of orphaned Gemini batch jobs (jobs created but not in DB)
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // The 2 orphaned job IDs from the saved files
    const orphanedJobs = [
      { id: 'batches/2k4w1s92ai754rh89lu2r245x3xd8hw31mkr', timestamp: '2025-12-24T06:32:09Z' },
      { id: 'batches/szktmnwr86zwaqilq7yycj5y5uxy0hr2lax8', timestamp: '2025-12-24T07:01:58Z' }
    ];

    const results = [];

    for (const job of orphanedJobs) {
      try {
        const batchJob = await ai.batches.get({ name: job.id });

        results.push({
          jobId: job.id,
          submittedAt: job.timestamp,
          currentStatus: batchJob.state,
          createdTime: batchJob.createTime,
          updatedTime: batchJob.updateTime,
          model: batchJob.model,
          canRecover: batchJob.state === 'JOB_STATE_SUCCEEDED',
          fullResponse: batchJob
        });
      } catch (error) {
        results.push({
          jobId: job.id,
          submittedAt: job.timestamp,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRecover: false
        });
      }
    }

    const summary = {
      totalOrphanedJobs: orphanedJobs.length,
      succeeded: results.filter(r => r.currentStatus === 'JOB_STATE_SUCCEEDED').length,
      failed: results.filter(r => r.currentStatus === 'JOB_STATE_FAILED').length,
      expired: results.filter(r => r.currentStatus === 'JOB_STATE_EXPIRED').length,
      pending: results.filter(r => r.currentStatus === 'JOB_STATE_PENDING').length,
      errors: results.filter(r => r.error).length,
      recoverable: results.filter(r => r.canRecover).length
    };

    return NextResponse.json({
      summary,
      jobs: results,
      recommendation: summary.recoverable > 0
        ? 'Some jobs succeeded! Consider modifying schema to track them and retrieve results.'
        : 'No recoverable jobs. You can safely ignore these orphaned jobs.'
    });

  } catch (error) {
    console.error('Error checking orphaned jobs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
