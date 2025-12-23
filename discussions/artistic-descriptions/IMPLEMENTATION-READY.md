# Ready for Implementation: Batch Artistic Descriptions

## Context for New Session

This document provides everything needed to implement the batch artistic descriptions feature. All planning is complete - ready to execute.

---

## What We're Building

A batch artistic description generation system that:
- Uses Google Gemini Batch API to analyze reference mural images
- Generates structured JSON descriptions (artistic analysis)
- Stores them in the database for use in the mural generation workflow
- Uses a database-driven approach for robust failure handling

**Key Architecture Decision:** 1 mural = 1 batch job (not chunked batches)

---

## Implementation Plan Location

**Full execution plan:** `/Users/ishan-aiworkspace/.claude/plans/concurrent-crunching-bird.md`

This plan contains:
- Phase-by-phase implementation steps
- Code snippets with file references
- Database schema changes
- API endpoint specifications
- UI component updates
- Testing strategy

---

## Key Reference Documents

1. **[batch-api-notes.md](batch-api-notes.md)** - Code snippets and Gemini Batch API reference
2. **[batch-strategy-decision.md](batch-strategy-decision.md)** - Why we chose 1 mural per batch
3. **[implementation-plan.md](implementation-plan.md)** - Detailed architectural plan
4. **[0-gemini-batch-api-doc.md](../0-gemini-batch-api-doc.md)** - Full Gemini Batch API docs
5. **[README.md](README.md)** - Feature overview and progress tracking

---

## Database Schema (Phase 1)

### New Table: `BatchDescriptionJob`

```prisma
model BatchDescriptionJob {
  id                String    @id @default(uuid())
  referenceMuralId  String    @unique  // One-to-one relationship
  referenceMural    ReferenceMural @relation(fields: [referenceMuralId], references: [id], onDelete: Cascade)

  batchJobId        String    @unique  // Gemini batch job ID
  status            String    // JOB_STATE_PENDING, JOB_STATE_RUNNING, JOB_STATE_SUCCEEDED, etc.

  submittedAt       DateTime  @default(now())
  lastPolledAt      DateTime?
  completedAt       DateTime?

  rawResponse       String?   // Full JSON from Gemini (unparsed)
  errorMessage      String?   // Error details if failed

  @@index([status])
  @@index([submittedAt])
}
```

### Update `ReferenceMural`

- Remove: `descriptionBatchJobId` field
- Add: `batchDescriptionJob BatchDescriptionJob?` relation (one-to-one)
- Keep: `artisticDescription` and `descriptionGeneratedAt`

**Run after schema update:**
```bash
npm run db:push
```

---

## Implementation Phases

### Phase 1: Database Schema ✅ (Planned)
- Update `prisma/schema.prisma`
- Run `npm run db:push`

### Phase 2: Core Business Logic
**Create:** `lib/features/mural-generator/batch-descriptions.ts`

Three main functions:
1. `createBatchJobForMural(muralId: string)` - Create Gemini batch job, save to DB
2. `pollBatchJobs()` - Poll all pending/running jobs, update status
3. `processCompletedJobs()` - Parse successful jobs, save descriptions

**Reference patterns:**
- Gemini client: [lib/features/mural-generator/gemini.ts:16-28](../../lib/features/mural-generator/gemini.ts#L16-L28)
- Image utilities: [lib/features/mural-generator/storage.ts:73-95](../../lib/features/mural-generator/storage.ts#L73-L95)
- Code snippets: [batch-api-notes.md](batch-api-notes.md)

### Phase 3: API Endpoints
**Create:**
1. `app/api/batch-descriptions/start/route.ts` - POST: Create batch jobs
2. `app/api/batch-descriptions/poll/route.ts` - GET: Poll job status
3. `app/api/batch-descriptions/process/route.ts` - POST: Parse and save (manual trigger)

**Pattern:** Follow [app/api/import/route.ts](../../app/api/import/route.ts)

### Phase 4: UI Updates
**Update:** `app/page.tsx`

- Add "Generate Artistic Descriptions" button (near Import button)
- Add `useEffect` to poll on page load
- Display batch stats (pending, completed, failed)
- Disable button if jobs are pending/running

### Phase 5: Documentation
**Update:** `discussions/artistic-descriptions/README.md`

Add CLI commands section for:
- Checking murals without descriptions
- Checking batch job status
- Processing completed jobs (manual trigger)
- Retrying failed jobs

---

## Key Implementation Details

### Workflow

1. **User clicks "Generate Artistic Descriptions" button**
   - Creates batch jobs for all murals without descriptions
   - One Gemini batch job per mural (inline request)
   - Saves `BatchDescriptionJob` record with status = 'JOB_STATE_PENDING'

2. **Page load polls job status**
   - Calls `GET /api/batch-descriptions/poll`
   - Updates job status in database
   - Saves `rawResponse` for successful jobs
   - Displays stats on home page

3. **User manually triggers processing** (via CLI)
   - Calls `POST /api/batch-descriptions/process`
   - Parses `rawResponse` JSON
   - Validates with Zod schema
   - Updates `ReferenceMural.artisticDescription`

### Batch Job Creation (Critical Code)

```typescript
// From batch-api-notes.md
const batchJob = await ai.batches.create({
  model: 'gemini-2.5-flash',
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
      responseSchema: zodToJsonSchema(artisticDescriptionSchema) as any
    }
  }],
  config: {
    displayName: `artistic-desc-${muralId}`
  }
});

// Save to database
await prisma.batchDescriptionJob.create({
  data: {
    referenceMuralId: muralId,
    batchJobId: batchJob.name,
    status: 'JOB_STATE_PENDING'
  }
});
```

### Polling Logic

```typescript
// Poll all pending/running jobs
const jobs = await prisma.batchDescriptionJob.findMany({
  where: {
    status: { in: ['JOB_STATE_PENDING', 'JOB_STATE_RUNNING'] }
  }
});

for (const job of jobs) {
  const batchJob = await ai.batches.get({ name: job.batchJobId });

  await prisma.batchDescriptionJob.update({
    where: { id: job.id },
    data: {
      status: batchJob.state,
      lastPolledAt: new Date(),
      ...(batchJob.state === 'JOB_STATE_SUCCEEDED' && {
        completedAt: new Date(),
        rawResponse: JSON.stringify(batchJob)
      }),
      ...(batchJob.state === 'JOB_STATE_FAILED' && {
        errorMessage: JSON.stringify(batchJob.error)
      })
    }
  });
}
```

### Processing Results

```typescript
const jobs = await prisma.batchDescriptionJob.findMany({
  where: {
    status: 'JOB_STATE_SUCCEEDED',
    rawResponse: { not: null },
    referenceMural: {
      artisticDescription: null
    }
  },
  include: { referenceMural: true }
});

for (const job of jobs) {
  const batchJob = JSON.parse(job.rawResponse!);
  const response = batchJob.dest.inlinedResponses[0];

  if (response.response) {
    const description = JSON.parse(response.response.text);
    const validated = artisticDescriptionSchema.parse(description);

    await prisma.referenceMural.update({
      where: { id: job.referenceMuralId },
      data: {
        artisticDescription: JSON.stringify(validated),
        descriptionGeneratedAt: new Date()
      }
    });
  }
}
```

---

## Key Decisions (Already Made)

✅ **Batching:** 1 mural = 1 batch job (not chunked)
✅ **Database:** One-to-one relationship (delete old job on retry)
✅ **Polling:** Once per page load (not continuous)
✅ **Parsing:** Manual trigger via CLI or API endpoint
✅ **Status:** Use Gemini's exact strings (JOB_STATE_SUCCEEDED, etc.)
✅ **UI:** Fire-and-forget with stats display
✅ **Button:** Disabled if jobs pending/running

---

## Testing Strategy

1. **Test with 1 mural** - Verify end-to-end flow
2. **Test with 10 murals** - Check polling and processing
3. **Test edge cases** - Failed jobs, invalid images, network errors

---

## CLI Commands (To be added to README.md)

```bash
# Check murals without descriptions
npx prisma studio
# Or SQL: SELECT COUNT(*) FROM ReferenceMural WHERE artisticDescription IS NULL;

# Check batch job status
# SQL: SELECT status, COUNT(*) FROM BatchDescriptionJob GROUP BY status;

# Process completed jobs (manual trigger)
curl -X POST http://localhost:3000/api/batch-descriptions/process

# Retry failed jobs
# Just click "Generate Artistic Descriptions" button again
# Old failed jobs will be deleted automatically (one-to-one relationship)
```

---

## Environment Variables (Already Set)

```bash
GEMINI_API_KEY=...
GEMINI_CHAT_MODEL=gemini-2.5-flash  # Used for batch descriptions
```

---

## Existing Code to Reuse

- **Gemini client:** [lib/features/mural-generator/gemini.ts:16-28](../../lib/features/mural-generator/gemini.ts#L16-L28)
- **Image reading:** [lib/features/mural-generator/storage.ts:73-76](../../lib/features/mural-generator/storage.ts#L73-L76)
- **Zod schema:** [lib/features/mural-generator/prompts.ts:118-175](../../lib/features/mural-generator/prompts.ts#L118-L175)
- **API pattern:** [app/api/import/route.ts](../../app/api/import/route.ts)

---

## Files to Create

1. `lib/features/mural-generator/batch-descriptions.ts` - NEW
2. `app/api/batch-descriptions/start/route.ts` - NEW
3. `app/api/batch-descriptions/poll/route.ts` - NEW
4. `app/api/batch-descriptions/process/route.ts` - NEW

## Files to Modify

1. `prisma/schema.prisma` - Add BatchDescriptionJob, update ReferenceMural
2. `app/page.tsx` - Add button + polling logic
3. `discussions/artistic-descriptions/README.md` - Add CLI commands

---

## Prompt for New Session

```
I need to implement the batch artistic descriptions feature for my mural generator app.

All planning is complete. Please read:
1. /Users/ishan-aiworkspace/.claude/plans/concurrent-crunching-bird.md (main execution plan)
2. discussions/artistic-descriptions/IMPLEMENTATION-READY.md (this file)
3. discussions/artistic-descriptions/batch-api-notes.md (code snippets reference)

Follow the plan step-by-step:
- Phase 1: Update database schema
- Phase 2: Implement batch-descriptions.ts
- Phase 3: Create API endpoints
- Phase 4: Update UI (app/page.tsx)
- Phase 5: Update documentation

Test with 1 mural first, then scale up.

Let's start with Phase 1: updating the Prisma schema.
```

---

## Success Criteria

✅ Database schema updated with BatchDescriptionJob table
✅ Batch jobs created for all murals without descriptions
✅ Polling updates job status accurately
✅ Completed jobs parsed and saved to ReferenceMural
✅ Failed jobs logged with error details
✅ UI button shows count and disables during processing
✅ CLI commands documented

---

**Ready to implement! Start a new session with the prompt above.**
