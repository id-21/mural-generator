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

  // Check if batch job already exists for this mural (one-to-one relationship)
  const existingJob = await db.batchDescriptionJob.findUnique({
    where: { referenceMuralId: muralId }
  });

  // Delete old job if exists (retry scenario)
  if (existingJob) {
    console.log(`Deleting existing batch job for mural: ${muralId}`);
    await db.batchDescriptionJob.delete({
      where: { id: existingJob.id }
    });
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
