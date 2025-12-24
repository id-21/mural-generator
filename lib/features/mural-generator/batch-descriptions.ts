// Batch artistic description generation using Gemini Batch API
import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { db } from '@/lib/db';
import { readImageAsBase64, getMimeType } from './storage';
import {
  artisticDescriptionSchema,
  ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION,
  ArtisticDescription
} from './prompts';
import {
  BatchConflictStrategy,
  BatchConflictSummary,
  BatchResolutionPreview,
  MuralConflict
} from './types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';

const BATCH_REQ_JSON_TEMP = path.join(process.cwd(), '/tmp/batch-requests-json/');
const BATCH_JOB_DETAILS_TEMP = path.join(process.cwd(), '/tmp/batch-job-details/');

// Singleton Gemini client
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

/**
 * Archive a batch job before deletion
 * Preserves all job data for audit trail
 */
async function archiveBatchJob(
  job: any,
  reason: string,
  replacedByJobId?: string
): Promise<void> {
  await db.batchDescriptionJobArchive.create({
    data: {
      originalJobId: job.id,
      referenceMuralId: job.referenceMuralId,
      batchJobId: job.batchJobId,
      status: job.status,
      submittedAt: job.submittedAt,
      lastPolledAt: job.lastPolledAt,
      completedAt: job.completedAt,
      requestPayload: job.requestPayload,
      rawResponse: job.rawResponse,
      errorMessage: job.errorMessage,
      replacementReason: reason,
      replacedByJobId: replacedByJobId || null
    }
  });
}

/**
 * Check for existing batch jobs across all murals without descriptions
 * Returns conflict summary for user decision
 */
export async function checkBatchJobConflicts(): Promise<BatchConflictSummary> {
  // Find all murals without artistic descriptions
  const muralsWithoutDescriptions = await db.referenceMural.findMany({
    where: {
      artisticDescription: null
    },
    select: {
      id: true,
      collectionName: true,
      designName: true,
      colorVariant: true,
      batchDescriptionJob: {
        select: {
          id: true,
          batchJobId: true,
          status: true,
          submittedAt: true,
          completedAt: true,
          errorMessage: true
        }
      }
    }
  });

  // Build conflict summary
  const conflicts = {
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    expired: 0,
    cancelled: 0
  };

  const murals: MuralConflict[] = muralsWithoutDescriptions.map(mural => {
    const existingJob = mural.batchDescriptionJob;

    if (existingJob) {
      // Count by status
      if (existingJob.status === 'JOB_STATE_PENDING') conflicts.pending++;
      else if (existingJob.status === 'JOB_STATE_RUNNING') conflicts.running++;
      else if (existingJob.status === 'JOB_STATE_SUCCEEDED') conflicts.succeeded++;
      else if (existingJob.status === 'JOB_STATE_FAILED') conflicts.failed++;
      else if (existingJob.status === 'JOB_STATE_EXPIRED') conflicts.expired++;
      else if (existingJob.status === 'JOB_STATE_CANCELLED') conflicts.cancelled++;
    }

    return {
      muralId: mural.id,
      collectionName: mural.collectionName,
      designName: mural.designName,
      colorVariant: mural.colorVariant,
      existingJob: existingJob || null
    };
  });

  return {
    totalMurals: muralsWithoutDescriptions.length,
    conflicts,
    murals
  };
}

/**
 * Generate preview for a specific strategy
 * Shows what will happen if user applies this strategy
 */
export function generateResolutionPreview(
  conflictSummary: BatchConflictSummary,
  strategy: BatchConflictStrategy
): BatchResolutionPreview {
  const { conflicts, murals } = conflictSummary;
  const totalConflicts = Object.values(conflicts).reduce((a, b) => a + b, 0);

  let willCreate = 0;
  let willSkip = 0;
  let willArchive = 0;
  const warnings: string[] = [];

  switch (strategy) {
    case 'SKIP_CONFLICTS':
      willCreate = conflictSummary.totalMurals - totalConflicts;
      willSkip = totalConflicts;
      willArchive = 0;
      if (conflicts.failed > 0 || conflicts.expired > 0 || conflicts.cancelled > 0) {
        warnings.push(
          `${conflicts.failed + conflicts.expired + conflicts.cancelled} failed/expired/cancelled jobs will NOT be retried`
        );
      }
      break;

    case 'RETRY_FAILED':
      const failedCount = conflicts.failed + conflicts.expired + conflicts.cancelled;
      willCreate = (conflictSummary.totalMurals - totalConflicts) + failedCount;
      willSkip = conflicts.pending + conflicts.running + conflicts.succeeded;
      willArchive = failedCount;
      if (conflicts.running > 0) {
        warnings.push(`${conflicts.running} running jobs will continue (not cancelled)`);
      }
      if (conflicts.succeeded > 0) {
        warnings.push(`${conflicts.succeeded} succeeded jobs will be kept (use Process Jobs to save results)`);
      }
      break;

    case 'REPLACE_ALL':
      willCreate = conflictSummary.totalMurals;
      willSkip = 0;
      willArchive = totalConflicts;
      if (conflicts.running > 0) {
        warnings.push(`⚠️ WARNING: ${conflicts.running} running jobs will be CANCELLED and replaced`);
      }
      if (conflicts.succeeded > 0) {
        warnings.push(`⚠️ WARNING: ${conflicts.succeeded} succeeded jobs will be deleted and replaced`);
      }
      break;
  }

  return {
    strategy,
    willCreate,
    willSkip,
    willArchive,
    warnings
  };
}

/**
 * Apply conflict resolution strategy and create batch jobs
 * Archives jobs as needed, respects strategy rules
 */
export async function createBatchJobsWithStrategy(
  strategy: BatchConflictStrategy
): Promise<{
  jobsCreated: number;
  jobsSkipped: number;
  jobsArchived: number;
  errors: string[];
}> {
  console.log(`Applying strategy: ${strategy}`);

  // Get all murals without descriptions
  const muralsWithoutDescriptions = await db.referenceMural.findMany({
    where: {
      artisticDescription: null
    },
    include: {
      batchDescriptionJob: true
    }
  });

  let jobsCreated = 0;
  let jobsSkipped = 0;
  let jobsArchived = 0;
  const errors: string[] = [];

  for (const mural of muralsWithoutDescriptions) {
    const existingJob = mural.batchDescriptionJob;

    try {
      // Determine action based on strategy
      let shouldCreate = false;
      let shouldArchive = false;

      if (!existingJob) {
        // No existing job - always create
        shouldCreate = true;
      } else {
        switch (strategy) {
          case 'SKIP_CONFLICTS':
            // Skip if any job exists
            shouldCreate = false;
            jobsSkipped++;
            break;

          case 'RETRY_FAILED':
            // Only replace failed/expired/cancelled jobs
            const isFailedState = ['JOB_STATE_FAILED', 'JOB_STATE_EXPIRED', 'JOB_STATE_CANCELLED'].includes(existingJob.status);
            shouldCreate = isFailedState;
            shouldArchive = isFailedState;
            if (!isFailedState) {
              jobsSkipped++;
            }
            break;

          case 'REPLACE_ALL':
            // Replace everything
            shouldCreate = true;
            shouldArchive = true;
            break;
        }
      }

      if (shouldArchive && existingJob) {
        // Archive existing job before deletion
        await archiveBatchJob(existingJob, `STRATEGY_${strategy}`);
        jobsArchived++;

        // Delete existing job
        await db.batchDescriptionJob.delete({
          where: { id: existingJob.id }
        });
      }

      if (shouldCreate) {
        // Create new batch job (using existing function)
        await createBatchJobForMural(mural.id);
        jobsCreated++;
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Mural ${mural.id}: ${errorMsg}`);
      console.error(`Error processing mural ${mural.id}:`, error);
    }
  }

  console.log(`Strategy complete: ${jobsCreated} created, ${jobsSkipped} skipped, ${jobsArchived} archived`);

  return {
    jobsCreated,
    jobsSkipped,
    jobsArchived,
    errors
  };
}

/**
 * Create a batch job for generating artistic description for a single mural
 * Uses inline request approach (1 mural = 1 batch job)
 */
export async function createBatchJobForMural(muralId: string): Promise<string> {
  console.log(`Creating batch job for mural: ${muralId}`);

  // Get mural from database
  const mural = await db.referenceMural.findUnique({
    where: { id: muralId }
  });

  if (!mural) {
    throw new Error(`Reference mural not found: ${muralId}`);
  }

  // Read image as base64
  const base64Image = await readImageAsBase64(mural.localFilePath);
  const mimeType = getMimeType(mural.fileName);

  console.log(`Image loaded: ${mural.fileName} (${mimeType})`);

  // Initialize Gemini client
  const ai = getGeminiClient();
  const model = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

  // Convert Zod schema to JSON Schema and remove $schema field
  const jsonSchema = zodToJsonSchema(artisticDescriptionSchema) as any;
  delete jsonSchema.$schema;  // Remove $schema field that Gemini doesn't accept

  // Prepare request payload
  const requestPayload = {
    model,
    src: [{  // Single-item array (one mural)
      contents: [{
        parts: [{
          inlineData: {
            mimeType: mimeType,
            data: base64Image
          }
        }],
        role: 'user'
      }],
      config: {
        systemInstruction: {
          parts: [{ text: ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION }]
        },
        responseMimeType: 'application/json',
        responseSchema: jsonSchema
      }
    }],
    config: {
      displayName: `artistic-desc-${muralId}`
    }
  };

  // Create batch job with inline request
  const batchJob = await ai.batches.create(requestPayload);

  console.log(`Batch job created: ${batchJob.name}`);

  // Save request payload to file for debugging (without polluting console)
  const tmpDir = BATCH_REQ_JSON_TEMP;
  if (!existsSync(tmpDir)) {
    await mkdir(tmpDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const debugFilePath = `${tmpDir}/request-${muralId}-${timestamp}.json`;
  await writeFile(debugFilePath, JSON.stringify(requestPayload, null, 2));
  console.log(`Request payload saved to: ${debugFilePath}`);

  if (!existsSync(BATCH_JOB_DETAILS_TEMP)) {
    await mkdir(BATCH_JOB_DETAILS_TEMP, { recursive: true });
  }

  // Save batch job details to file for debugging
  const batchJobFilePath = `${BATCH_JOB_DETAILS_TEMP}/batch-job-${muralId}-${timestamp}.json`;
  await writeFile(batchJobFilePath, JSON.stringify(batchJob, null, 2));
  console.log(`Batch job details saved to: ${batchJobFilePath}`);

  // Save batch job to database with full request payload
  await db.batchDescriptionJob.create({
    data: {
      referenceMuralId: muralId,
      batchJobId: batchJob.name,
      status: 'JOB_STATE_PENDING',
      requestPayload: JSON.stringify(requestPayload)
    }
  });

  return batchJob.name;
}

/**
 * Poll all pending/running batch jobs and update their status
 */
export async function pollBatchJobs(): Promise<{
  pending: number;
  running: number;
  completed: number;
  failed: number;
  expired: number;
  cancelled: number;
}> {
  console.log('Polling batch jobs...');

  // Query all non-final state jobs
  const jobs = await db.batchDescriptionJob.findMany({
    where: {
      status: {
        in: ['JOB_STATE_PENDING', 'JOB_STATE_RUNNING']
      }
    }
  });

  console.log(`Found ${jobs.length} jobs to poll`);

  const ai = getGeminiClient();
  let pollCount = 0;

  for (const job of jobs) {
    try {
      // Get batch job status from Gemini
      const batchJob = await ai.batches.get({ name: job.batchJobId });

      console.log(`Job ${job.batchJobId}: ${job.status} -> ${batchJob.state}`);

      // Prepare update data
      const updateData: any = {
        status: batchJob.state,
        lastPolledAt: new Date()
      };

      // If completed successfully, save raw response
      if (batchJob.state === 'JOB_STATE_SUCCEEDED') {
        updateData.completedAt = new Date();
        updateData.rawResponse = JSON.stringify(batchJob);
      }

      // If failed, save error message
      if (batchJob.state === 'JOB_STATE_FAILED') {
        updateData.completedAt = new Date();
        updateData.errorMessage = JSON.stringify(batchJob.error || 'Unknown error');
      }

      // If expired or cancelled, mark as completed
      if (batchJob.state === 'JOB_STATE_EXPIRED' || batchJob.state === 'JOB_STATE_CANCELLED') {
        updateData.completedAt = new Date();
      }

      // Update job in database
      await db.batchDescriptionJob.update({
        where: { id: job.id },
        data: updateData
      });

      pollCount++;
    } catch (error) {
      console.error(`Error polling job ${job.batchJobId}:`, error);
      // Continue with other jobs
    }
  }

  console.log(`Polled ${pollCount} jobs`);

  // Get summary stats
  const allJobs = await db.batchDescriptionJob.findMany({
    select: { status: true }
  });

  const stats = {
    pending: allJobs.filter(j => j.status === 'JOB_STATE_PENDING').length,
    running: allJobs.filter(j => j.status === 'JOB_STATE_RUNNING').length,
    completed: allJobs.filter(j => j.status === 'JOB_STATE_SUCCEEDED').length,
    failed: allJobs.filter(j => j.status === 'JOB_STATE_FAILED').length,
    expired: allJobs.filter(j => j.status === 'JOB_STATE_EXPIRED').length,
    cancelled: allJobs.filter(j => j.status === 'JOB_STATE_CANCELLED').length
  };

  console.log('Batch job stats:', stats);

  return stats;
}

/**
 * Process completed batch jobs - parse results and update ReferenceMural
 */
export async function processCompletedJobs(): Promise<{
  processed: number;
  failed: number;
  errors: string[];
}> {
  console.log('Processing completed batch jobs...');

  // Query successful jobs that haven't been processed yet
  const jobs = await db.batchDescriptionJob.findMany({
    where: {
      status: 'JOB_STATE_SUCCEEDED',
      rawResponse: { not: null },
      referenceMural: {
        artisticDescription: null
      }
    },
    include: {
      referenceMural: true
    }
  });

  console.log(`Found ${jobs.length} completed jobs to process`);

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    try {
      // Parse raw response
      const batchJob = JSON.parse(job.rawResponse!);

      // Extract inline response
      if (!batchJob.dest?.inlinedResponses || batchJob.dest.inlinedResponses.length === 0) {
        throw new Error('No inlined responses found in batch job');
      }

      const inlineResponse = batchJob.dest.inlinedResponses[0];

      // Check for response error
      if (inlineResponse.error) {
        throw new Error(`Response error: ${JSON.stringify(inlineResponse.error)}`);
      }

      // Parse JSON response text
      if (!inlineResponse.response?.text) {
        throw new Error('No response text found');
      }

      const descriptionJson = JSON.parse(inlineResponse.response.text);

      // Validate with Zod schema
      const validated: ArtisticDescription = artisticDescriptionSchema.parse(descriptionJson);

      // Update ReferenceMural with description
      await db.referenceMural.update({
        where: { id: job.referenceMuralId },
        data: {
          artisticDescription: JSON.stringify(validated),
          descriptionGeneratedAt: new Date()
        }
      });

      console.log(`Processed description for mural: ${job.referenceMuralId}`);
      processed++;

    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      failed++;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Mural ${job.referenceMuralId}: ${errorMessage}`);

      // Update job with error message
      await db.batchDescriptionJob.update({
        where: { id: job.id },
        data: {
          errorMessage: errorMessage
        }
      });
    }
  }

  console.log(`Processing complete: ${processed} processed, ${failed} failed`);

  return { processed, failed, errors };
}
