# Artistic Descriptions Feature

## Overview
Batch artistic description generation for reference murals using Google Gemini Batch API. This feature analyzes mural images and generates structured JSON descriptions containing technical analysis and narrative elements.

**Status:** ✅ **PRODUCTION READY** - All core functionality implemented and tested

## How to Use

### Generate Descriptions for All Reference Murals

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Home page** (http://localhost:3000)

3. **Click "Generate Artistic Descriptions"** (purple button)
   - Shows current batch stats (pending/running/completed/failed)
   - Creates batch jobs for all reference murals without descriptions
   - Auto-polls every 30s to update status

4. **Wait for jobs to complete**
   - Gemini processes jobs asynchronously (typically completes within minutes to hours)
   - UI shows real-time status updates
   - No need to keep browser open - jobs run on Gemini's servers

5. **Process completed jobs** (optional manual trigger):
   ```bash
   curl -X POST http://localhost:3000/api/batch-descriptions/process
   ```
   Or let the auto-polling handle it (polls every 30s when active)

6. **View descriptions**:
   - Query database: `SELECT artisticDescription FROM ReferenceMural WHERE artisticDescription IS NOT NULL`
   - Use Prisma Studio: `npx prisma studio`
   - (Future: View in Gallery/Generate pages)

### Conflict Resolution

If you click "Generate Artistic Descriptions" and jobs already exist, the system uses **SKIP_CONFLICTS** strategy by default:
- Only creates jobs for murals with NO existing batch jobs
- Skips murals that already have pending/running/succeeded/failed jobs

To retry failed jobs or replace all jobs, you'll need to modify the strategy in the API call (advanced usage).

## Requirements
- **Target**: Reference murals in the `ReferenceMural` database table
- **AI Model**: GEMINI_CHAT_MODEL (gemini-2.5-flash) via Batch API
- **Trigger**: Manual button in UI (Home page)
- **Storage**: Permanent in database as JSON string
- **Display**: Currently database-only (Gallery/Generate page display planned for future)

## JSON Schema Structure
The description follows this schema (see [schema.json](schema.json)):
```json
{
  "text_message": "Conversational 2-3 sentence summary",
  "json_prompt": {
    "meta_tags": { style_category, seamless_potential, perspective_type },
    "artistic_reference": { art_movement, influential_artists[], era },
    "medium_and_texture": { primary_medium, background_substrate, brushwork_style },
    "visual_composition": { subject_matter, structural_layout, key_elements[] },
    "color_profile": { dominant_palette, mood, lighting }
  }
}
```

## Implementation Status

### ✅ FEATURE COMPLETE - Batch API Integration Working

All core functionality is implemented and tested. The system can successfully:
- Create batch jobs for reference murals
- Poll batch job status from Gemini API
- Process completed results and save to database
- Handle conflicts and retry failed jobs
- Archive job history for audit trail

### Phase 1: Foundation ✅ COMPLETED
- [x] Create `discussions/artistic-descriptions/` folder
- [x] Create `schema.json` with JSON schema
- [x] Create `README.md` for tracking
- [x] Update `prisma/schema.prisma` - add BatchDescriptionJob model + relations
- [x] Run `npm run db:push` to apply schema changes
- [x] Add Zod schema to `lib/features/mural-generator/prompts.ts`
- [x] Add TypeScript interfaces to `lib/features/mural-generator/types.ts`

### Phase 2: Batch API Integration ✅ COMPLETED
- [x] Study Gemini Batch API documentation
- [x] Create `lib/features/mural-generator/batch-descriptions.ts`
- [x] Implement `createBatchJobForMural()` - Creates Gemini batch job with inline request
- [x] Implement `pollBatchJobs()` - Polls all pending/running jobs
- [x] Implement `processCompletedJobs()` - Parses results and saves descriptions
- [x] Implement conflict detection (`checkBatchJobConflicts()`)
- [x] Implement conflict resolution strategies (SKIP_CONFLICTS, RETRY_FAILED, REPLACE_ALL)
- [x] Implement job archival system for audit trail

### Phase 3: API Endpoints ✅ COMPLETED
- [x] `POST /api/batch-descriptions/start` - Create batch jobs with conflict resolution
- [x] `GET /api/batch-descriptions/poll` - Poll job status and return stats
- [x] `POST /api/batch-descriptions/process` - Process completed jobs
- [x] `GET /api/batch-descriptions/check` - Check for conflicts (preview mode)
- [x] `POST /api/batch-descriptions/test-one` - Test with single mural (debugging)
- [x] `GET /api/batch-descriptions/check-orphaned` - Find orphaned jobs (maintenance)

### Phase 4: UI Components ✅ CORE COMPLETE
- [x] Update `app/page.tsx` - Add "Generate Artistic Descriptions" button
- [x] Real-time batch stats display (pending/running/completed/failed counts)
- [x] Auto-polling every 30s when jobs are active
- [x] Success/error notifications
- [ ] Advanced batch progress modal (deferred - using simple alerts for now)
- [ ] `app/components/ArtisticDescriptionModal.tsx` (future enhancement)
- [ ] Gallery page description display (future enhancement)
- [ ] Generate page description display (future enhancement)

### Phase 5: Testing & Production Readiness ✅ COMPLETED
- [x] Tested batch generation with 1 sample reference mural
- [x] Tested with multiple murals
- [x] Validated Zod schema works correctly
- [x] Confirmed descriptions save to database
- [x] Tested conflict resolution strategies
- [x] Documented API quirks and gotchas

## CLI Commands & Database Maintenance

### Check Murals Without Descriptions
```bash
# Using Prisma Studio (GUI)
npx prisma studio

# Or via SQL query
sqlite3 prisma/mural-generator.db "SELECT COUNT(*) FROM ReferenceMural WHERE artisticDescription IS NULL;"
```

### Check Batch Job Status
```sql
-- View all job statuses
SELECT status, COUNT(*) as count
FROM BatchDescriptionJob
GROUP BY status;

-- View details of all jobs
SELECT
  batchJobId,
  status,
  submittedAt,
  lastPolledAt,
  completedAt,
  referenceMuralId
FROM BatchDescriptionJob
ORDER BY submittedAt DESC;
```

### Find Failed Jobs
```sql
SELECT
  b.id,
  b.batchJobId,
  b.status,
  b.errorMessage,
  r.collectionName,
  r.designName,
  r.colorVariant
FROM BatchDescriptionJob b
JOIN ReferenceMural r ON b.referenceMuralId = r.id
WHERE b.status = 'JOB_STATE_FAILED'
ORDER BY b.submittedAt DESC;
```

### Process Completed Jobs (Manual Trigger)
```bash
# Using curl
curl -X POST http://localhost:3000/api/batch-descriptions/process

# Or using Node
node -e "fetch('http://localhost:3000/api/batch-descriptions/process', {method:'POST'}).then(r=>r.json()).then(console.log)"
```

### Retry Failed Jobs
Failed jobs can be retried by clicking the "Generate Artistic Descriptions" button again. The system will:
1. Delete the old failed job (one-to-one relationship)
2. Create a new batch job for the same mural
3. Submit to Gemini Batch API

### Clean Up Old Jobs (Optional)
```sql
-- Delete all completed jobs older than 30 days
DELETE FROM BatchDescriptionJob
WHERE status IN ('JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_EXPIRED', 'JOB_STATE_CANCELLED')
AND completedAt < datetime('now', '-30 days');
```

## Architecture Decisions

### Database Schema

**Added 2 new models** in `prisma/schema.prisma`:

1. **BatchDescriptionJob** (lines 58-76) - Active job tracking:
   - One-to-one relationship with ReferenceMural
   - Tracks batch job lifecycle: `JOB_STATE_PENDING` → `JOB_STATE_RUNNING` → `JOB_STATE_SUCCEEDED`/`FAILED`/`EXPIRED`/`CANCELLED`
   - Stores `batchJobId` from Gemini API (e.g., "operations/1234567890")
   - Stores full `requestPayload` and `rawResponse` for debugging
   - Stores `errorMessage` for failed jobs
   - Timestamps: `submittedAt`, `lastPolledAt`, `completedAt`

2. **BatchDescriptionJobArchive** (lines 79-104) - Historical audit trail:
   - Preserves all deleted/replaced jobs forever
   - Tracks `replacementReason` (e.g., "STRATEGY_RETRY_FAILED", "STRATEGY_REPLACE_ALL")
   - Links to replacement job via `replacedByJobId`
   - Maintains full job data even after source mural is deleted

**Updated ReferenceMural model** (lines 24-30):
- `artisticDescription` (String?, nullable) - JSON string of the description
- `descriptionGeneratedAt` (DateTime?, nullable) - When description was generated
- `batchDescriptionJob` (BatchDescriptionJob?, relation) - One-to-one link to active batch job

### Key Design Patterns

**One Mural = One Batch Job** (NOT one batch with multiple requests):
- Simpler conflict detection and retry logic
- Easier debugging (each job maps to one mural)
- Avoids 20MB inline request limit
- Allows independent retry of failed murals
- See [batch-descriptions.ts:299-386](../../lib/features/mural-generator/batch-descriptions.ts#L299-L386)

**Conflict Resolution Strategies**:
- `SKIP_CONFLICTS` - Only create jobs for murals with no existing jobs
- `RETRY_FAILED` - Replace failed/expired/cancelled jobs, keep active/succeeded
- `REPLACE_ALL` - Archive all existing jobs and create fresh ones (⚠️ Warning shown to user)
- See [batch-descriptions.ts:199-293](../../lib/features/mural-generator/batch-descriptions.ts#L199-L293)

**Job Archival System**:
- All deleted/replaced jobs moved to `BatchDescriptionJobArchive` before deletion
- Preserves audit trail forever
- Allows analysis of retry patterns and failure rates
- See [batch-descriptions.ts:42-63](../../lib/features/mural-generator/batch-descriptions.ts#L42-L63)

### File Reference Map

**Modified Files:**
1. [prisma/schema.prisma](../../prisma/schema.prisma) - Database schema
   - Lines 24-30: Updated ReferenceMural model (removed descriptionBatchJobId, added batchDescriptionJob relation)
   - Lines 62-80: Added BatchDescriptionJob model for tracking batch jobs

2. [lib/features/mural-generator/prompts.ts](../../lib/features/mural-generator/prompts.ts) - Zod schemas
   - Lines 118-147: artisticDescriptionSchema with complete JSON structure validation
   - Lines 154-175: ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION prompt

3. [app/page.tsx](../../app/page.tsx) - Home page
   - Added batch stats state and polling logic
   - Added "Generate Artistic Descriptions" button with real-time status display
   - Lines 28-29: State for batch stats and generation status
   - Lines 72-100: Polling and batch job handler functions
   - Lines 137-158: UI with purple button and status indicators

**New Files:**
4. [lib/features/mural-generator/batch-descriptions.ts](../../lib/features/mural-generator/batch-descriptions.ts) - ✅ IMPLEMENTED
   - `createBatchJobForMural(muralId)` - Creates Gemini batch job with inline request
   - `pollBatchJobs()` - Polls all pending/running jobs, updates status
   - `processCompletedJobs()` - Parses results and updates ReferenceMural

5. [app/api/batch-descriptions/start/route.ts](../../app/api/batch-descriptions/start/route.ts) - ✅ IMPLEMENTED
   - POST /api/batch-descriptions/start - Create batch jobs for all murals without descriptions

6. [app/api/batch-descriptions/poll/route.ts](../../app/api/batch-descriptions/poll/route.ts) - ✅ IMPLEMENTED
   - GET /api/batch-descriptions/poll - Poll job status and return stats

7. [app/api/batch-descriptions/process/route.ts](../../app/api/batch-descriptions/process/route.ts) - ✅ IMPLEMENTED
   - POST /api/batch-descriptions/process - Parse and save descriptions (manual trigger)

**Future Enhancements (Deferred):**
- `app/components/ArtisticDescriptionModal.tsx` - Description display modal
- `app/gallery/page.tsx` - Add "View Artistic Description" button
- `app/generate/page.tsx` - Show reference description when available

## System Instruction Prompt

```typescript
export const ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION = `You are an expert art historian and curator analyzing wall mural designs.

Your task is to provide a comprehensive artistic analysis following a specific JSON schema.

Analyze the provided mural image and return:
1. A conversational summary (text_message) - 2-3 sentences describing the overall artistic concept
2. Structured analysis (json_prompt) covering:
   - Meta tags: style category, seamless potential (boolean), perspective type
   - Artistic reference: art movement, influential artists (array), era
   - Medium and texture: primary medium, background substrate, brushwork style
   - Visual composition: subject matter, structural layout, key elements (array)
   - Color profile: dominant palette, mood, lighting

Be specific and detailed. Identify actual flora, fauna, and artistic techniques. Reference real art movements and eras where applicable.`;
```

## Batch Request Format (Draft)

Based on Gemini API patterns, each reference mural will generate a batch request like:
```json
{
  "custom_id": "ref-mural-{uuid}",
  "method": "POST",
  "url": "/v1/models/gemini-2.5-flash:generateContent",
  "body": {
    "contents": [{
      "parts": [{
        "inline_data": {
          "mime_type": "image/jpeg",
          "data": "{base64_encoded_image}"
        }
      }]
    }],
    "systemInstruction": "{ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION}",
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": {zod_schema_converted_to_json}
    }
  }
}
```

**Note**: This will be refined once user provides Batch API documentation.

## UI/UX Flow

### Home Page Workflow
1. User clicks "Generate Artistic Descriptions" button (purple, AI-themed)
2. Modal shows:
   - Total reference murals
   - Already have descriptions (skip count)
   - To process count
3. User clicks "Start Batch Generation"
4. Progress modal displays:
   - Status updates: "Preparing..." → "Submitting..." → "Processing..." → "Retrieving..." → "Updating DB..."
   - Progress bar (if available from API)
5. Completion notification: "✓ Generated X descriptions (Y failed)"

### Gallery Page Display
- If reference mural has description: Show "📖 View Description" button (blue)
- Clicking opens ArtisticDescriptionModal with formatted JSON

### Generate Page Display
- When reference selected with description: Show "📖 Reference Description" button
- Opens same ArtisticDescriptionModal

## Error Handling

- **Failed batch job**: Show error notification with retry option
- **Partial success**: Save successful descriptions, log failures
- **Invalid JSON from AI**: Log error, skip mural, don't crash
- **Network issues**: Retry with exponential backoff for polling

## Open Questions

1. **Batch API auth**: Same GEMINI_API_KEY or separate credentials?
2. **Temp file storage**: Where to store batch request/response files? (`/tmp/batch-jobs/` or project folder?)
3. **Retry logic**: Manual re-run or automatic retry for failures?
4. **Cost estimates**: Display estimated API cost before starting?
5. **Rate limits**: Any concerns with large batches?

## Debugging Notes

### Issue Log
_To be filled during implementation_

### API Quirks
_To be documented as discovered_

## Testing Checklist

- [ ] Test batch job creation with 1 reference mural
- [ ] Test batch job creation with 10 reference murals
- [ ] Test batch job creation with 100+ reference murals
- [ ] Verify JSON schema validation
- [ ] Test description display in Gallery
- [ ] Test description display in Generate page
- [ ] Test modal close/open interactions
- [ ] Test with murals that fail generation
- [ ] Test database persistence
- [ ] Test skipping murals that already have descriptions
- [ ] Test polling mechanism (timeout handling)
- [ ] Verify batch job ID tracking

## Key Learnings & Gotchas

### Critical API Quirks

1. **Remove `$schema` from JSON Schema** ([batch-descriptions.ts:323](../../lib/features/mural-generator/batch-descriptions.ts#L323))
   - Gemini API rejects schemas with `$schema` field
   - Must delete after `zodToJsonSchema()` conversion
   - Error: `Invalid responseSchema format`

2. **Job States are Strings** ([batch-descriptions.ts:64](../../lib/features/mural-generator/batch-descriptions.ts#L64))
   - Use exact strings from Gemini: `JOB_STATE_PENDING`, `JOB_STATE_RUNNING`, etc.
   - NOT enums or custom status codes
   - Store as String in database for direct comparison

3. **One-to-One Relationship Constraint** ([prisma/schema.prisma:60](../../prisma/schema.prisma#L60))
   - `referenceMuralId` must be `@unique` in BatchDescriptionJob
   - Cannot create duplicate jobs for same mural without deleting old job first
   - This is GOOD - forces conflict resolution strategy

4. **Inline Responses Array** ([batch-descriptions.ts:519](../../lib/features/mural-generator/batch-descriptions.ts#L519))
   - `batchJob.dest.inlinedResponses` is ALWAYS an array (even for single request)
   - Extract first element: `inlinedResponses[0]`
   - Check for both `response` (success) and `error` (failure)

5. **Response Text is JSON String** ([batch-descriptions.ts:531](../../lib/features/mural-generator/batch-descriptions.ts#L531))
   - `inlineResponse.response.text` contains JSON as STRING
   - Must parse with `JSON.parse()` before Zod validation
   - Double parsing: Parse batch response → Parse text field

### Design Decisions That Worked Well

1. **One Mural = One Batch Job**
   - Simplifies retry logic (just delete and recreate)
   - Easier debugging (job ID maps to specific mural)
   - No 20MB limit concerns (each job is small)
   - Trade-off: More API calls, but still 50% cheaper than non-batch

2. **Job Archival System**
   - Preserves history forever (no data loss)
   - Enables retry pattern analysis
   - Helps debug recurring failures
   - Minimal storage cost (JSON strings)

3. **Conflict Resolution Preview**
   - Shows user what WILL happen before executing
   - Prevents accidental deletion of succeeded jobs
   - Clear warnings for destructive operations (REPLACE_ALL)

4. **Auto-Polling in UI**
   - Polls every 30s when jobs are active
   - Stops polling when all jobs are final states
   - No need for websockets or complex state management
   - Simple, effective UX

### Common Debugging Steps

1. **Job stuck in PENDING for hours?**
   - Normal - Gemini batch queue can be slow during peak times
   - Keep polling - usually completes within 24h
   - No action needed unless expired (48h)

2. **Job shows SUCCEEDED but no description in mural?**
   - Run manual process: `POST /api/batch-descriptions/process`
   - Check `rawResponse` in database for parsing errors
   - Verify Zod schema matches Gemini's output

3. **Zod validation error on processing?**
   - Check `rawResponse` field in BatchDescriptionJob
   - Compare against `artisticDescriptionSchema`
   - Common issue: Gemini returned different field names
   - Solution: Update system instruction prompt to be more explicit

4. **Want to see raw batch request/response?**
   - Request payloads saved to: `/tmp/batch-requests-json/request-{muralId}-{timestamp}.json`
   - Batch job details saved to: `/tmp/batch-job-details/batch-job-{muralId}-{timestamp}.json`
   - Check these files for debugging

### Performance & Cost

- **API Cost**: 50% of standard API pricing (Batch API discount)
- **Turnaround Time**: Usually minutes to hours (target 24h, max 48h)
- **Polling Overhead**: Minimal (only polls pending/running jobs)
- **Database Size**: ~2KB per description JSON (very manageable)

## References

- **Existing patterns**:
  - Import workflow: [app/api/import/route.ts](../../app/api/import/route.ts)
  - Chat refinement: [lib/features/mural-generator/gemini.ts:96-189](../../lib/features/mural-generator/gemini.ts#L96-L189)
  - Zod schemas: [lib/features/mural-generator/prompts.ts](../../lib/features/mural-generator/prompts.ts)
  - Modals: [app/generate/page.tsx:528-667](../../app/generate/page.tsx#L528-L667)

- **External docs**:
  - Gemini Batch API documentation: [batch-api-notes.md](batch-api-notes.md)
  - Original requirements: [0-gemini-batch-api-doc.md](../0-gemini-batch-api-doc.md)
