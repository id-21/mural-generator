# Artistic Descriptions - Implementation Plan

## Overview
Implement batch artistic description generation using Google Gemini Batch API with a database-driven approach for robust failure handling and reprocessing.

**Strategy:** 1 reference mural = 1 batch job (inline request)

---

## Database Architecture

### New Table: `BatchDescriptionJob`

Purpose: Track all batch job attempts separately from the reference mural data for easier debugging, reprocessing, and audit trail.

```prisma
model BatchDescriptionJob {
  id                String    @id @default(uuid())
  referenceMuralId  String
  referenceMural    ReferenceMural @relation(fields: [referenceMuralId], references: [id], onDelete: Cascade)

  batchJobId        String    @unique  // Gemini API batch job ID (from batchJob.name)
  status            String              // JOB_STATE_PENDING, JOB_STATE_RUNNING, JOB_STATE_SUCCEEDED, etc.

  submittedAt       DateTime  @default(now())
  lastPolledAt      DateTime?
  completedAt       DateTime?

  rawResponse       String?   // Full JSON response from Gemini (unparsed), stored as text
  errorMessage      String?   // If failed, store error details

  @@index([referenceMuralId])
  @@index([status])
  @@index([submittedAt])
}
```

### Modified: `ReferenceMural` Table

**Keep existing fields:**
- `artisticDescription` (String?) - Parsed and validated JSON description
- `descriptionGeneratedAt` (DateTime?) - When description was successfully saved

**Remove:**
- ~~`descriptionBatchJobId`~~ - No longer needed (replaced by BatchDescriptionJob table)

**Add relation:**
```prisma
model ReferenceMural {
  // ... existing fields
  artisticDescription      String?
  descriptionGeneratedAt   DateTime?

  // New relation
  batchDescriptionJobs     BatchDescriptionJob[]
}
```

---

## Workflow

### 1. Batch Job Creation (POST /api/batch-descriptions/start)

**Trigger:** User clicks "Generate Artistic Descriptions" button on Home page

**Logic:**
```typescript
1. Query ReferenceMural WHERE artisticDescription IS NULL
2. For each mural:
   a. Read image as base64
   b. Create Gemini batch job (inline request)
   c. Insert BatchDescriptionJob record:
      - referenceMuralId: mural.id
      - batchJobId: batchJob.name (from Gemini response)
      - status: 'JOB_STATE_PENDING'
      - submittedAt: now()
3. Return: { jobsCreated: number }
```

**Button behavior:**
- Disable if any `BatchDescriptionJob` with status IN (PENDING, RUNNING) exists
- Show count: "Generate Descriptions (N murals)"

### 2. Polling (GET /api/batch-descriptions/poll)

**Trigger:** Automatically on Home page load (runs once per page load)

**Logic:**
```typescript
1. Query BatchDescriptionJob WHERE status IN ('JOB_STATE_PENDING', 'JOB_STATE_RUNNING')
2. For each job:
   a. Call ai.batches.get({ name: job.batchJobId })
   b. Update job:
      - status: batchJob.state
      - lastPolledAt: now()
      - If completed: completedAt: now()
      - If SUCCEEDED: rawResponse: JSON.stringify(batchJob)
      - If FAILED: errorMessage: batchJob.error
3. Return stats: { pending: number, running: number, completed: number, failed: number }
```

**Home page updates:**
- Display stats in real-time (e.g., "150 pending, 800 completed, 50 failed")

### 3. Parse & Update (POST /api/batch-descriptions/process)

**Trigger:** Automatically after polling (or manual via CLI)

**Logic:**
```typescript
1. Query BatchDescriptionJob WHERE status = 'JOB_STATE_SUCCEEDED' AND rawResponse IS NOT NULL
2. Query ReferenceMural WHERE id IN (job.referenceMuralId) AND artisticDescription IS NULL
3. For each job:
   a. Parse rawResponse JSON
   b. Extract description from batchJob.dest.inlinedResponses[0].response.text
   c. Validate with artisticDescriptionSchema (Zod)
   d. Update ReferenceMural:
      - artisticDescription: JSON.stringify(validatedDescription)
      - descriptionGeneratedAt: now()
   e. (Optional) Mark job as processed or delete
4. Return: { processed: number, failed: number }
```

**Error handling:**
- If Zod validation fails: Log error, skip mural, continue
- Store validation errors in `BatchDescriptionJob.errorMessage` for debugging

---

## API Endpoints

### POST /api/batch-descriptions/start
- Create batch jobs for all murals without descriptions
- Request: (none)
- Response: `{ jobsCreated: number, totalMurals: number }`

### GET /api/batch-descriptions/poll
- Poll all pending/running batch jobs and update status
- Request: (none)
- Response: `{ pending: number, running: number, completed: number, failed: number, expired: number }`

### POST /api/batch-descriptions/process
- Parse completed jobs and update ReferenceMural table
- Request: (none)
- Response: `{ processed: number, failed: number, errors: string[] }`

---

## UI Changes

### Home Page (`app/page.tsx`)

**Add button:**
- Location: Near "Import Reference Murals" button
- Text: "Generate Artistic Descriptions (N murals)" where N = count of murals without descriptions
- Style: Purple, AI-themed (similar to existing buttons)
- Disabled: If any pending/running batch jobs exist

**On page load:**
1. Call `GET /api/batch-descriptions/poll` (once, not continuously)
2. Update page stats showing batch job status
3. If completed jobs found, call `POST /api/batch-descriptions/process`

**Button click handler:**
```typescript
async function handleGenerateDescriptions() {
  const response = await fetch('/api/batch-descriptions/start', { method: 'POST' });
  const { jobsCreated } = await response.json();

  // Show toast: "Created {jobsCreated} batch jobs. Descriptions will be generated in background."
  // Refresh page to show updated stats
}
```

---

## File Structure

### New Files

**1. `lib/features/mural-generator/batch-descriptions.ts`**
```typescript
// Core batch job logic
export async function createBatchJob(muralId: string): Promise<string>
export async function pollBatchJob(batchJobId: string): Promise<BatchJobStatus>
export async function parseAndSaveDescription(jobId: string): Promise<void>
```

**2. `app/api/batch-descriptions/start/route.ts`**
- POST handler for creating batch jobs

**3. `app/api/batch-descriptions/poll/route.ts`**
- GET handler for polling job status

**4. `app/api/batch-descriptions/process/route.ts`**
- POST handler for parsing and updating descriptions

### Modified Files

**1. `prisma/schema.prisma`**
- Add `BatchDescriptionJob` model
- Add relation to `ReferenceMural`
- Remove `descriptionBatchJobId` from `ReferenceMural`

**2. `app/page.tsx`**
- Add "Generate Artistic Descriptions" button
- Add polling logic on page load
- Display batch job stats

**3. `lib/features/mural-generator/types.ts`**
- Add `BatchDescriptionJob` interface (if needed for type safety)

---

## Database Maintenance

### CLI Commands (add to README.md)

**Check for murals without descriptions:**
```bash
npx prisma studio
# Navigate to ReferenceMural table
# Filter: artisticDescription IS NULL
```

Or via direct query:
```sql
SELECT COUNT(*) FROM ReferenceMural WHERE artisticDescription IS NULL;
```

**Check batch job status:**
```sql
SELECT status, COUNT(*) as count
FROM BatchDescriptionJob
GROUP BY status;
```

**Find failed jobs:**
```sql
SELECT * FROM BatchDescriptionJob
WHERE status = 'JOB_STATE_FAILED'
ORDER BY submittedAt DESC;
```

**Retry failed jobs:**
- Delete old `BatchDescriptionJob` records for failed murals
- Click "Generate Artistic Descriptions" button again

**Clean up old completed jobs (optional):**
```sql
DELETE FROM BatchDescriptionJob
WHERE status = 'JOB_STATE_SUCCEEDED'
AND completedAt < datetime('now', '-30 days');
```

---

## Error Handling & Edge Cases

### Failed Batch Jobs
- Status updated to `JOB_STATE_FAILED`
- Error message saved to `errorMessage` field
- User can retry by deleting failed job record and re-running

### Expired Jobs (> 48 hours)
- Status updated to `JOB_STATE_EXPIRED`
- No results available
- User must retry manually

### Invalid JSON Response
- Caught during parsing step
- Error logged to `BatchDescriptionJob.errorMessage`
- Mural skipped, continues with others

### Network Issues During Polling
- Polling runs once per page load (not continuous)
- If polling fails, user refreshes page to retry
- No automatic retry to avoid hammering API

### Duplicate Job Prevention
- Check if `BatchDescriptionJob` exists with status IN (PENDING, RUNNING) before creating
- Button disabled if any pending jobs exist

---

## Testing Strategy

### Phase 1: Single Mural Test
1. Pick 1 mural without description
2. Create batch job manually via API
3. Verify `BatchDescriptionJob` record created
4. Poll until completed
5. Verify `rawResponse` saved
6. Process and verify `artisticDescription` updated

### Phase 2: Small Batch (10 murals)
1. Click "Generate Artistic Descriptions" button
2. Verify 10 `BatchDescriptionJob` records created
3. Refresh page, verify polling updates status
4. Wait for completion (check via Prisma Studio)
5. Verify all 10 descriptions saved

### Phase 3: Large Batch (100+ murals)
1. Monitor for rate limiting issues
2. Check polling performance
3. Verify no memory issues with large responses

### Edge Cases
- Mural with invalid image file
- Gemini API returns non-JSON response
- Network timeout during batch job creation
- Concurrent button clicks (should be prevented)

---

## Success Criteria

✅ All murals without descriptions get batch jobs created
✅ Polling accurately updates job status
✅ Completed jobs parsed and saved to ReferenceMural
✅ Failed jobs logged with error details for debugging
✅ UI button disabled during active batch processing
✅ 50% cost savings vs individual API calls
✅ No data loss (raw responses always saved before parsing)
✅ Easy reprocessing via database queries

---

## Open Questions

**Answered:**
1. ✅ Button placement: Near Import button
2. ✅ Polling: Once on page load
3. ✅ Failure handling: Database-driven with BatchDescriptionJob table
4. ✅ Progress display: Stats on home page, no modal
5. ✅ CLI commands: Added to discussions/artistic-descriptions/README.md
6. ✅ Batch creation: All at once
7. ✅ Duplicate prevention: Disable button if jobs pending

**To clarify during implementation:**
1. Should we allow multiple `BatchDescriptionJob` records per mural (for retry tracking)?
   - Recommendation: Yes, keep history for audit trail
2. Delete completed jobs after processing or keep forever?
   - Recommendation: Keep for 30 days, then clean up via cron/manual
3. Auto-parse or manual trigger?
   - Recommendation: Auto-parse after polling on home page load

---

## Next Steps

1. Update `prisma/schema.prisma` with new table
2. Run `npm run db:push`
3. Implement `batch-descriptions.ts` core logic
4. Create API endpoints
5. Update Home page UI
6. Test with 1 mural → 10 murals → all murals
7. Document learnings in README.md

See [batch-api-notes.md](batch-api-notes.md) for implementation code snippets.
