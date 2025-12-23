# Artistic Descriptions Feature

## Overview
Batch artistic description generation for reference murals using Google Gemini Batch API. This feature analyzes mural images and generates structured JSON descriptions containing technical analysis and narrative elements.

## Requirements
- **Target**: Reference murals in the `ReferenceMural` database table
- **AI Model**: GEMINI_CHAT_MODEL (gemini-2.5-flash) via Batch API
- **Trigger**: Manual button in UI (Home page)
- **Storage**: Permanent in database as JSON string
- **Display**: Gallery page, Generate page, and dedicated modal

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

## Implementation Progress

### Phase 1: Foundation ✅ COMPLETED
- [x] Create `discussions/artistic-descriptions/` folder
- [x] Create `schema.json` with JSON schema
- [x] Create `README.md` for tracking
- [x] Update `prisma/schema.prisma` - add description fields (lines 24-27)
- [x] Run `npm run db:push` to apply schema changes
- [x] Add Zod schema to `lib/features/mural-generator/prompts.ts` (lines 118-175)
- [x] Add TypeScript interface to `lib/features/mural-generator/types.ts` (lines 13-15, 50-93)

### Phase 2: Batch API Integration ✅ COMPLETED
- [x] Study Gemini Batch API documentation
- [x] Create `lib/features/mural-generator/batch-descriptions.ts`
- [x] Implement batch job creation logic
- [x] Implement polling mechanism
- [x] Implement result processing and DB updates

### Phase 3: API Endpoints ✅ COMPLETED
- [x] Create `app/api/batch-descriptions/start/route.ts`
- [x] Create `app/api/batch-descriptions/poll/route.ts`
- [x] Create `app/api/batch-descriptions/process/route.ts`

### Phase 4: UI Components ✅ COMPLETED
- [x] Update `app/page.tsx` - add batch generation button with stats
- [ ] Create batch progress modal component (deferred - using simple alerts)
- [ ] Create `app/components/ArtisticDescriptionModal.tsx` (deferred - future enhancement)
- [ ] Update `app/gallery/page.tsx` - add description display (future)
- [ ] Update `app/generate/page.tsx` - add description display (future)

### Phase 5: Testing & Documentation ⏳ IN PROGRESS
- [ ] Test batch generation with 1 sample reference mural
- [ ] Test with 10 murals
- [ ] Document outcomes and learnings
- [ ] Document API quirks or gotchas

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

**Added BatchDescriptionJob model** in `prisma/schema.prisma`:
- One-to-one relationship with ReferenceMural
- Tracks batch job lifecycle (pending → running → succeeded/failed)
- Stores raw response and error messages
- See [prisma/schema.prisma:62-80](../../prisma/schema.prisma#L62-L80)

**Updated ReferenceMural model**:
- `artisticDescription` (String?, nullable) - JSON string of the description
- `descriptionGeneratedAt` (DateTime?, nullable) - When description was generated
- `batchDescriptionJob` (BatchDescriptionJob?, relation) - One-to-one link to batch job

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

## References

- **Existing patterns**:
  - Import workflow: [app/api/import/route.ts](../../app/api/import/route.ts)
  - Chat refinement: [lib/features/mural-generator/gemini.ts:96-189](../../lib/features/mural-generator/gemini.ts#L96-L189)
  - Zod schemas: [lib/features/mural-generator/prompts.ts](../../lib/features/mural-generator/prompts.ts)
  - Modals: [app/generate/page.tsx:528-667](../../app/generate/page.tsx#L528-L667)

- **External docs**:
  - Gemini Batch API: _(to be provided by user)_
  - See: [batch-api-notes.md](batch-api-notes.md) _(to be created)_
