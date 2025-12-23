# Gemini Batch API - Implementation Reference

## Overview
Quick reference for implementing batch artistic description generation using Google Gemini Batch API with **inline requests** (one mural per batch job approach).

**Source:** [0-gemini-batch-api-doc.md](../0-gemini-batch-api-doc.md)

---

## Quick Workflow

```
1. CREATE batch job (inline request with image + schema)
2. POLL job status every 30s until completed
3. RETRIEVE results from inlinedResponses
4. UPDATE database with description
```

---

## Critical Code Snippets

### 1. Initialize Gemini Client
**Your existing pattern:** [lib/features/mural-generator/gemini.ts:16-28](../../lib/features/mural-generator/gemini.ts#L16-L28)

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

---

### 2. Create Batch Job with Inline Request + Structured Output

**Reference:** Lines 186-265 in [0-gemini-batch-api-doc.md](../0-gemini-batch-api-doc.md)

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';
import { artisticDescriptionSchema, ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION } from './prompts';

// Read image as base64 (existing utility)
const base64Image = await readImageAsBase64(mural.localFilePath);
const mimeType = getMimeType(mural.fileName);

// Create batch job with ONE inline request
const batchJob = await ai.batches.create({
  model: 'gemini-2.5-flash',  // Your GEMINI_CHAT_MODEL
  src: [{  // Array with single request
    contents: [{
      parts: [{
        inlineData: {
          mimeType: mimeType,  // e.g., 'image/jpeg'
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
      responseSchema: zodToJsonSchema(artisticDescriptionSchema) as any
    }
  }],
  config: {
    displayName: `artistic-desc-${mural.id}`
  }
});

console.log('Batch job created:', batchJob.name);
// Save batchJob.name to database
```

**Key points:**
- Use `src` with array of requests (we only have 1)
- Include `systemInstruction` in request `config`
- Use `responseSchema` with Zod schema converted via `zodToJsonSchema()`
- Returns batch job object with `name` property (use for polling)

---

### 3. Poll Job Status

**Reference:** Lines 375-401 in [0-gemini-batch-api-doc.md](../0-gemini-batch-api-doc.md)

```typescript
const completedStates = new Set([
  'JOB_STATE_SUCCEEDED',
  'JOB_STATE_FAILED',
  'JOB_STATE_CANCELLED',
  'JOB_STATE_EXPIRED',
]);

let batchJob;
try {
  batchJob = await ai.batches.get({ name: jobName });

  while (!completedStates.has(batchJob.state)) {
    console.log(`Current state: ${batchJob.state}`);
    // Wait 30 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 30000));
    batchJob = await ai.batches.get({ name: batchJob.name });
  }

  console.log(`Job finished with state: ${batchJob.state}`);

  if (batchJob.state === 'JOB_STATE_FAILED') {
    console.error('Job failed:', batchJob.error);
  }
} catch (error) {
  console.error('Polling error:', error);
}
```

**Job States:**
- `JOB_STATE_PENDING`: Waiting to be processed
- `JOB_STATE_RUNNING`: In progress
- `JOB_STATE_SUCCEEDED`: ✅ Ready to retrieve results
- `JOB_STATE_FAILED`: ❌ Check `batchJob.error`
- `JOB_STATE_CANCELLED`: User cancelled
- `JOB_STATE_EXPIRED`: Took > 48 hours

---

### 4. Retrieve Results (Inline Responses)

**Reference:** Lines 433-448 in [0-gemini-batch-api-doc.md](../0-gemini-batch-api-doc.md)

```typescript
if (batchJob.state === 'JOB_STATE_SUCCEEDED') {
  // For inline requests, results are in inlinedResponses array
  if (batchJob.dest?.inlinedResponses) {
    const inlineResponse = batchJob.dest.inlinedResponses[0];  // Only one item

    if (inlineResponse.response) {
      // Parse JSON response
      const jsonText = inlineResponse.response.text;
      const description = JSON.parse(jsonText);

      // Validate with Zod
      const validatedDescription = artisticDescriptionSchema.parse(description);

      // Save to database
      await prisma.referenceMural.update({
        where: { id: muralId },
        data: {
          artisticDescription: JSON.stringify(validatedDescription),
          descriptionGeneratedAt: new Date()
        }
      });

      console.log('Description saved for mural:', muralId);
    } else if (inlineResponse.error) {
      console.error('Response error:', inlineResponse.error);
      // Log failure, optionally retry
    }
  }
}
```

**Response structure:**
- `batchJob.dest.inlinedResponses[]` - Array of responses (we have 1)
- Each item has `response` (success) or `error` (failure)
- `response.text` contains JSON string matching your schema

---

## Configuration Reference

| Batch API Parameter | Your Value | Source |
|---------------------|------------|--------|
| `model` | `gemini-2.5-flash` | `process.env.GEMINI_CHAT_MODEL` |
| `systemInstruction` | `ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION` | [prompts.ts:154-175](../../lib/features/mural-generator/prompts.ts#L154-L175) |
| `responseSchema` | `artisticDescriptionSchema` converted | [prompts.ts:118-147](../../lib/features/mural-generator/prompts.ts#L118-L147) |
| `responseMimeType` | `'application/json'` | Required for structured output |
| `displayName` | `artistic-desc-${muralId}` | For tracking in logs |

---

## Existing Code Patterns to Reuse

### Reading Images as Base64
**File:** [lib/features/mural-generator/storage.ts:73-76](../../lib/features/mural-generator/storage.ts#L73-L76)

```typescript
import { readImageAsBase64, getMimeType } from '@/lib/features/mural-generator/storage';

const base64Data = await readImageAsBase64(mural.localFilePath);
const mimeType = getMimeType(mural.fileName);  // Returns 'image/jpeg' etc.
```

### Gemini Client Singleton
**File:** [lib/features/mural-generator/gemini.ts:16-28](../../lib/features/mural-generator/gemini.ts#L16-L28)

```typescript
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
```

### Structured Output Pattern
**File:** [lib/features/mural-generator/gemini.ts:138-160](../../lib/features/mural-generator/gemini.ts#L138-L160)

Already using `responseMimeType: 'application/json'` + `responseJsonSchema` in chat refinement - same pattern applies here.

---

## Debugging Guide

### Testing Strategy
1. **Test with 1 mural first**
   ```typescript
   const testMural = await prisma.referenceMural.findFirst({
     where: { artisticDescription: null }
   });
   // Create batch job for this one mural
   // Verify end-to-end flow
   ```

2. **Test with 10 murals** - Check polling efficiency

3. **Scale to all murals** - Monitor for rate limits

### Common Issues

**Issue:** "Empty response from AI model"
- **Cause:** Schema validation failed or response not JSON
- **Debug:** Log `response.text` before parsing
- **Reference:** [gemini.ts:177-179](../../lib/features/mural-generator/gemini.ts#L177-L179)

**Issue:** Batch job stuck in `JOB_STATE_PENDING`
- **Cause:** System load, usually completes within 24h
- **Solution:** Keep polling, check after a few hours

**Issue:** `JOB_STATE_FAILED`
- **Cause:** Invalid image, schema mismatch, or API error
- **Debug:** Check `batchJob.error` for details
- **Solution:** Log error, mark mural as failed, continue with others

### Logging Strategy
```typescript
// Log request payload (useful for debugging)
fs.writeFileSync(
  `batch-request-${muralId}.json`,
  JSON.stringify(requestPayload, null, 2)
);

// Log response
fs.writeFileSync(
  `batch-response-${muralId}.json`,
  JSON.stringify(batchJob, null, 2)
);
```

**Reference:** [gemini.ts:148-171](../../lib/features/mural-generator/gemini.ts#L148-L171) (commented debug code)

---

## Important Gotchas

### 1. Not Idempotent (Line 612)
Creating the same batch request twice = **two separate jobs**
- **Solution:** Check if `descriptionBatchJobId` exists before creating

### 2. Cost Savings (Line 604)
Batch API = **50% of standard API cost**
- Example: 1000 murals × $0.01 standard = $5.00 vs Batch = $2.50

### 3. Turnaround Time (Line 605)
Target: 24 hours, often much faster (minutes to hours)
- **Don't:** Block UI waiting for completion
- **Do:** Poll in background, show progress

### 4. Rate Limits (Line 604)
Docs reference rate limits page but don't specify batch job creation limit
- **Mitigation:** Add delay between job submissions if needed
- **Fallback:** Sequential submission with 100ms delay

### 5. File Size Limit (Line 610)
Inline requests: **< 20MB total** per batch
- Our approach: 1 mural per batch = always under limit ✅

### 6. Job Expiration (Line 369)
Jobs expire after **48 hours** if still pending/running
- **Solution:** Retry expired jobs

---

## API Endpoints Structure

Following existing patterns from [app/api/import/route.ts](../../app/api/import/route.ts):

### POST /api/batch-descriptions/start
- Create batch jobs for all murals without descriptions
- Returns: `{ jobsCreated: number, totalMurals: number }`

### GET /api/batch-descriptions/status
- Poll all pending batch jobs
- Returns: `{ pending: number, completed: number, failed: number }`

### POST /api/batch-descriptions/process
- Retrieve results from completed jobs and update database
- Returns: `{ processed: number, failed: number }`

---

## File Structure Examples

### Batch Job Object (after creation)
```json
{
  "name": "operations/1234567890",
  "displayName": "artistic-desc-abc123-uuid",
  "state": "JOB_STATE_PENDING",
  "createTime": "2025-12-23T10:00:00Z"
}
```

### Batch Job Object (completed)
```json
{
  "name": "operations/1234567890",
  "displayName": "artistic-desc-abc123-uuid",
  "state": "JOB_STATE_SUCCEEDED",
  "dest": {
    "inlinedResponses": [{
      "response": {
        "text": "{\"text_message\":\"...\",\"json_prompt\":{...}}",
        "candidates": [...]
      }
    }]
  },
  "batchStats": {
    "succeededRequestCount": 1,
    "failedRequestCount": 0
  }
}
```

### Error Response
```json
{
  "inlinedResponses": [{
    "error": {
      "code": 400,
      "message": "Invalid request format"
    }
  }]
}
```

---

## Next Steps

When implementing:
1. ✅ Create `lib/features/mural-generator/batch-descriptions.ts`
2. ✅ Add functions: `createBatchJob()`, `pollBatchJob()`, `processResults()`
3. ✅ Create API routes in `app/api/batch-descriptions/`
4. ✅ Add UI button on Home page
5. ✅ Test with 1 mural → 10 murals → all murals

See [README.md](./README.md) for full implementation roadmap.
