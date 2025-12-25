<system_context>
Batch artistic description API endpoints for generating structured AI descriptions of reference murals using Google Gemini Batch API. This feature uses a database-driven approach with separate batch job tracking for robust failure handling and reprocessing.

**UPDATED (2025-12-25):** Now uses unified JSON schema (`unifiedArtisticPromptSchema`) that combines artistic analysis with conversational responses and change tracking. This schema is shared across batch descriptions, chat refinement, and image generation workflows.
</system_context>

<file_map>
## FILE MAP
- `start/route.ts` - POST: Create batch jobs for all murals without descriptions
- `poll/route.ts` - GET: Poll pending/running batch jobs and update status in database
- `process/route.ts` - POST: Parse completed jobs and save descriptions (manual trigger)
- `test-one/route.ts` - POST: Test endpoint - create batch job for just 1 mural
- `check-orphaned/route.ts` - GET: Debug endpoint - check status of orphaned Gemini batch jobs
</file_map>

<patterns>
## PATTERNS

### Architecture Pattern: Database-Driven Batch Processing

**Key principle:** Raw responses saved first, parsing done separately
1. **Create** batch jobs → Store in `BatchDescriptionJob` table
2. **Poll** job status → Update `status`, save `rawResponse` when complete
3. **Process** completed jobs → Parse JSON, validate with Zod, update `ReferenceMural`

**Why this pattern:**
- ✅ No data loss (raw responses always saved before parsing)
- ✅ Reprocess failed parsing without re-calling API
- ✅ Audit trail of all batch attempts
- ✅ Easy debugging via database inspection

### Endpoint Pattern: One Responsibility Per Route

Each endpoint has a single, clear purpose:
- `start/` - Creates jobs only
- `poll/` - Polls and updates status only
- `process/` - Parses and saves only

**Example:** `start/route.ts:59-71`
```typescript
for (const mural of muralsWithoutDescriptions) {
  try {
    const batchJobId = await createBatchJobForMural(mural.id);
    jobIds.push(batchJobId);
    successCount++;
  } catch (error) {
    failCount++;
    errors.push(`Failed to create job for mural ${mural.id}: ${errorMsg}`);
  }
}
```

### Error Handling Pattern

All endpoints use try/catch with structured error responses:
```typescript
try {
  // Business logic
  return NextResponse.json({ success: true, data });
} catch (error) {
  console.error('Error description:', error);
  return NextResponse.json(
    {
      error: 'User-friendly message',
      details: error instanceof Error ? error.message : 'Unknown error'
    },
    { status: 500 }
  );
}
```

**Example:** `poll/route.ts:14-23`

### Business Logic Delegation

Endpoints are thin wrappers - delegate to `lib/features/mural-generator/batch-descriptions.ts`:
- **NEW:** `createBatchJobForMuralUnified(muralId)` - Creates Gemini batch job using unified schema + DB record
- **NEW:** `processCompletedJobsUnified()` - Parses rawResponse using unified schema and updates ReferenceMural
- `pollBatchJobs()` - Polls all pending/running jobs, returns stats (unchanged)
- **DEPRECATED:** `createBatchJobForMural(muralId)` - Legacy function (still functional)
- **DEPRECATED:** `processCompletedJobs()` - Legacy function (still functional)

**Example:** `poll/route.ts:6-13`
```typescript
export async function GET(request: NextRequest) {
  try {
    const stats = await pollBatchJobs();
    return NextResponse.json(stats);
  } catch (error) { /* ... */ }
}
```
</patterns>

<critical_notes>
## CRITICAL NOTES

- **One-to-one relationship:** One `ReferenceMural` = max one `BatchDescriptionJob` (enforced via `@unique` on `referenceMuralId`)
- **Retry logic:** Clicking "Start" again deletes old failed jobs and creates new ones (`batch-descriptions.ts:41-45`)
- **Idempotency:** `start/` endpoint checks for in-progress jobs before creating new ones (`start/route.ts:12-28`)
- **Manual processing:** `process/` endpoint is NOT called automatically - user triggers via CLI or UI button
- **Status values:** Use Gemini's exact strings (`JOB_STATE_PENDING`, `JOB_STATE_RUNNING`, `JOB_STATE_SUCCEEDED`, `JOB_STATE_FAILED`, `JOB_STATE_CANCELLED`, `JOB_STATE_EXPIRED`)
- **Orphaned jobs:** `check-orphaned/` is a debugging endpoint for jobs created outside normal flow - hardcoded job IDs from early testing (`check-orphaned/route.ts:16-19`)

## GOTCHAS

- **Don't auto-process:** Resist temptation to call `process/` automatically after polling - keep it manual for user control
- **Batch job creation rate:** Creating 1000+ jobs in quick succession - unknown if Gemini has rate limits on job creation (not documented)
- **Database writes:** Each poll updates `lastPolledAt` for all pending jobs - could be heavy on large batches
- **Error accumulation:** `start/` endpoint continues creating jobs even if some fail - check `errors` array in response
</critical_notes>

<paved_path>
## PAVED PATH: Adding a New Batch Endpoint

If you need to add functionality (e.g., cancel all jobs, retry failed only):

1. **Create new route file:** `app/api/batch-descriptions/{action}/route.ts`
2. **Add business logic:** In `lib/features/mural-generator/batch-descriptions.ts`
3. **Keep endpoint thin:** Delegate to business logic, handle errors, return JSON
4. **Follow patterns:**
   - Use `NextRequest`/`NextResponse`
   - Try/catch with structured errors
   - Console.log for debugging
   - Return meaningful status codes (400 for validation, 500 for server errors)

**Example:** To add `DELETE /api/batch-descriptions/cancel-all`:
```typescript
// cancel-all/route.ts
import { cancelAllPendingJobs } from '@/lib/features/mural-generator/batch-descriptions';

export async function DELETE(request: NextRequest) {
  try {
    const result = await cancelAllPendingJobs();
    return NextResponse.json({ cancelled: result.count });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to cancel jobs' }, { status: 500 });
  }
}
```

Then implement `cancelAllPendingJobs()` in business logic layer.
</paved_path>

<workflow>
## WORKFLOW: How Endpoints Work Together

### User Flow

1. **User visits Home page**
   - Page load triggers: `GET /api/batch-descriptions/poll` (runs once)
   - UI displays: "150 pending, 800 completed, 50 failed"

2. **User clicks "Generate Artistic Descriptions" button**
   - Frontend: `POST /api/batch-descriptions/start`
   - Backend: Creates batch jobs for all murals without descriptions
   - Response: `{ jobsCreated: 1000, totalMurals: 1000 }`
   - UI: Shows success message, disables button

3. **Background (Gemini API processes jobs)**
   - Jobs complete over minutes/hours (target: 24h, often faster)

4. **User refreshes Home page (or revisits later)**
   - Page load triggers: `GET /api/batch-descriptions/poll`
   - Backend: Checks Gemini API for all pending/running jobs
   - Updates `BatchDescriptionJob` table with status + rawResponse
   - UI: Shows updated stats

5. **User manually triggers processing (via CLI)**
   ```bash
   curl -X POST http://localhost:3000/api/batch-descriptions/process
   ```
   - Backend: Parses `rawResponse` JSON, validates with Zod
   - Updates `ReferenceMural.artisticDescription`
   - Response: `{ processed: 950, failed: 50, errors: [...] }`

### Testing Flow (use `test-one/` endpoint)

```bash
# 1. Create batch job for 1 mural
curl -X POST http://localhost:3000/api/batch-descriptions/test-one

# 2. Wait a few seconds/minutes

# 3. Poll to check status
curl http://localhost:3000/api/batch-descriptions/poll

# 4. When completed, process results
curl -X POST http://localhost:3000/api/batch-descriptions/process
```
</workflow>

<database>
## DATABASE INTERACTION

### Tables Used

**BatchDescriptionJob** (created for this feature)
- Tracks each Gemini batch job attempt
- Stores raw API responses for reprocessing
- One-to-one with ReferenceMural

**ReferenceMural** (updated)
- `artisticDescription` (String?) - Parsed JSON description using unified schema format
  - **NEW FORMAT:** Contains `conversationalResponse`, `artisticPrompt` (nested object), and `changesSummary` (array)
  - **LEGACY FORMAT:** Contains `text_message` and `json_prompt` (still supported)
- `descriptionGeneratedAt` (DateTime?) - When description saved
- `batchDescriptionJob` (relation) - Links to batch job

### Query Patterns

**start/route.ts:31-41** - Find murals without descriptions:
```typescript
const muralsWithoutDescriptions = await db.referenceMural.findMany({
  where: { artisticDescription: null },
  select: { id: true, collectionName: true, designName: true, colorVariant: true }
});
```

**start/route.ts:12-18** - Check for in-progress jobs:
```typescript
const inProgressJobs = await db.batchDescriptionJob.findMany({
  where: {
    status: { in: ['JOB_STATE_PENDING', 'JOB_STATE_RUNNING'] }
  }
});
```

**poll/** - Queries pending jobs (see `batch-descriptions.ts:73-77`)

**process/** - Queries completed jobs with JOIN (see `batch-descriptions.ts:107-119`)
</database>

<api_reference>
## API REFERENCE

### POST /api/batch-descriptions/start
**Purpose:** Create batch jobs for all murals without artistic descriptions

**Request:** None (empty body)

**Response (success):**
```json
{
  "message": "Created 1000 batch jobs",
  "jobsCreated": 1000,
  "totalMurals": 1000,
  "failed": 0
}
```

**Response (in progress):**
```json
{
  "error": "Batch jobs already in progress",
  "pendingCount": 150
}
```

**Response (partial failure):**
```json
{
  "message": "Created 950 batch jobs",
  "jobsCreated": 950,
  "totalMurals": 1000,
  "failed": 50,
  "errors": ["Failed to create job for mural abc-123: Network error", ...]
}
```

---

### GET /api/batch-descriptions/poll
**Purpose:** Poll all pending/running batch jobs and update database

**Request:** None (query params not used)

**Response:**
```json
{
  "pending": 150,
  "running": 50,
  "completed": 800,
  "failed": 0,
  "expired": 0,
  "total": 1000
}
```

**Side effects:**
- Updates `BatchDescriptionJob.status` for all polled jobs
- Updates `BatchDescriptionJob.lastPolledAt`
- Saves `BatchDescriptionJob.rawResponse` for succeeded jobs
- Saves `BatchDescriptionJob.errorMessage` for failed jobs

---

### POST /api/batch-descriptions/process
**Purpose:** Parse completed jobs and save descriptions to ReferenceMural (MANUAL trigger)

**UPDATED:** Now uses `processCompletedJobsUnified()` which validates against unified schema (`unifiedArtisticPromptSchema`)

**Request:** None (empty body)

**Response (success):**
```json
{
  "message": "Processed 800 descriptions, 0 failed",
  "processed": 800,
  "failed": 0
}
```

**Response (with errors):**
```json
{
  "message": "Processed 750 descriptions, 50 failed",
  "processed": 750,
  "failed": 50,
  "errors": [
    "Failed to parse description for mural abc-123: Invalid JSON",
    "Zod validation failed for mural def-456: Missing field 'conversationalResponse'"
  ]
}
```

**Schema Validation:**
- Expects: `conversationalResponse` (string), `artisticPrompt` (object), `changesSummary` (array)
- Legacy format with `text_message` and `json_prompt` will fail validation (use legacy endpoint if needed)

---

### POST /api/batch-descriptions/test-one
**Purpose:** Test endpoint - create batch job for just 1 mural (for debugging)

**UPDATED:** Now uses `createBatchJobForMuralUnified()` which generates unified schema format

**Request:** None

**Response:**
```json
{
  "message": "Created batch job for 1 mural",
  "muralId": "abc-123-uuid",
  "collectionName": "aracne",
  "designName": "daffodils",
  "batchJobId": "batches/xyz789..."
}
```

**Schema Used:** `unifiedArtisticPromptSchema` - returns `conversationalResponse`, `artisticPrompt`, and `changesSummary` (empty array for initial analysis)

---

### GET /api/batch-descriptions/check-orphaned
**Purpose:** Debug endpoint - check status of hardcoded orphaned job IDs from early testing

**Request:** None

**Response:**
```json
{
  "summary": {
    "totalOrphanedJobs": 2,
    "succeeded": 1,
    "failed": 0,
    "expired": 0,
    "pending": 0,
    "errors": 1,
    "recoverable": 1
  },
  "jobs": [
    {
      "jobId": "batches/2k4w1s92ai754...",
      "submittedAt": "2025-12-24T06:32:09Z",
      "currentStatus": "JOB_STATE_SUCCEEDED",
      "canRecover": true,
      "fullResponse": { /* full Gemini response */ }
    }
  ],
  "recommendation": "Some jobs succeeded! Consider modifying schema to track them..."
}
```

**Note:** Hardcoded job IDs at `check-orphaned/route.ts:16-19` - update if checking different orphaned jobs
</api_reference>

<unified_schema_details>
## UNIFIED SCHEMA IMPLEMENTATION

### What Changed (2025-12-25)

**Before:** Two separate schemas
- `artisticDescriptionSchema` - Used for batch descriptions (had `text_message` + `json_prompt`)
- `chatRefinementSchema` - Used for chat refinement (had `conversationalResponse` + `refinedPrompt` string)

**After:** Single unified schema
- `unifiedArtisticPromptSchema` - Used for BOTH batch descriptions and chat refinement
- Structure:
  ```typescript
  {
    conversationalResponse: string,    // Artistic summary OR change explanation
    artisticPrompt: {                  // Structured analysis (same as old json_prompt)
      meta_tags: { style_category, seamless_potential, perspective_type },
      artistic_reference: { art_movement, influential_artists, era },
      medium_and_texture: { primary_medium, background_substrate, brushwork_style },
      visual_composition: { subject_matter, structural_layout, key_elements },
      color_profile: { dominant_palette, mood, lighting }
    },
    changesSummary: string[]           // List of changes (empty for initial analysis)
  }
  ```

### Migration Notes

**Backward compatibility:**
- Legacy endpoints (`createBatchJobForMural`, `processCompletedJobs`) still exist but are deprecated
- New endpoints use unified schema exclusively
- Old database records with `text_message` format will NOT validate with new schema
- Frontend must check schema version when displaying descriptions

**System instructions updated:**
- [UNIFIED_ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION](../../../lib/features/mural-generator/prompts.ts#L180-L203) - For batch analysis
- [UNIFIED_CHAT_REFINEMENT_SYSTEM_INSTRUCTION](../../../lib/features/mural-generator/prompts.ts#L107-L137) - For chat refinement
- [JSON_TO_NARRATIVE_SYSTEM_INSTRUCTION](../../../lib/features/mural-generator/prompts.ts#L142-L165) - For converting JSON to narrative prompts

### Data Flow

```
Reference Image → createBatchJobForMuralUnified() → Gemini Batch API
                                                          ↓
                            Gemini returns unified JSON (conversationalResponse + artisticPrompt + changesSummary)
                                                          ↓
                            processCompletedJobsUnified() validates with Zod
                                                          ↓
                            Store in ReferenceMural.artisticDescription
                                                          ↓
                  User refines via chat → refinePromptWithChatUnified() → Updated JSON
                                                          ↓
                            convertJsonToNarrativePrompt() → Narrative text
                                                          ↓
                                    generateMural() → Final image
```
</unified_schema_details>

<references>
## REFERENCES

- **Business logic:** [lib/features/mural-generator/batch-descriptions.ts](../../../lib/features/mural-generator/batch-descriptions.ts) - Core batch job functions
  - **NEW:** `createBatchJobForMuralUnified()` (lines 392-479)
  - **NEW:** `processCompletedJobsUnified()` (lines 573-659)
- **Unified schema:** [lib/features/mural-generator/prompts.ts](../../../lib/features/mural-generator/prompts.ts#L183-L213) - `unifiedArtisticPromptSchema`
- **Type definitions:** [lib/features/mural-generator/types.ts](../../../lib/features/mural-generator/types.ts#L85-L115) - `UnifiedArtisticPromptInterface`
- **API patterns:** [../import/route.ts](../import/route.ts) - Similar endpoint structure
- **Database schema:** [prisma/schema.prisma](../../../prisma/schema.prisma) - BatchDescriptionJob model
- **Planning docs:** [discussions/artistic-descriptions/](../../../discussions/artistic-descriptions/)
  - `batch-api-notes.md` - Gemini Batch API code snippets
  - `implementation-plan.md` - Full architectural plan
  - `batch-strategy-decision.md` - Why 1 mural = 1 batch job
- **Gemini Batch API docs:** [discussions/0-gemini-batch-api-doc.md](../../../discussions/0-gemini-batch-api-doc.md)
</references>