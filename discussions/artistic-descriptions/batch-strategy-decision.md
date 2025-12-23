# Batch Strategy Decision

## Chosen Approach: One Mural Per Batch Job

**Decision Date:** 2025-12-23

### Strategy
- **1 reference mural = 1 batch job** with inline request
- Each batch job contains exactly ONE request for ONE mural
- For 1000 murals → 1000 separate batch jobs

### Rationale
1. **Simplicity**: No need to manage JSONL file creation/parsing
2. **Easy mapping**: `ReferenceMural.descriptionBatchJobId` directly maps to Gemini batch job ID
3. **Granular retry**: Failed jobs can be retried per-mural without affecting others
4. **Cost savings**: Still get 50% savings vs regular API (Batch API benefit)
5. **No chunking logic**: Avoid complexity of grouping murals into batches

### Trade-offs Accepted
- **Polling overhead**: Need to poll up to 1000 jobs vs ~50 chunked jobs
- **Unknown rate limits**: Gemini docs don't specify limit on batch job creation count
- **API design intent**: Batch API designed for bulk requests, not individual wrapping

### Implementation Details

**Batch Job Creation:**
```typescript
// For each mural without description
const batchJob = await ai.batches.create({
  model: 'gemini-2.5-flash',
  src: [{  // Single-item array
    contents: [{
      parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }],
      role: 'user'
    }],
    config: {
      systemInstruction: { parts: [{ text: ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION }] },
      responseMimeType: 'application/json',
      responseSchema: artisticDescriptionSchemaJSON
    }
  }],
  config: { displayName: `mural-${muralId}` }
});

// Save batch job ID to database
await prisma.referenceMural.update({
  where: { id: muralId },
  data: { descriptionBatchJobId: batchJob.name }
});
```

**Polling:**
```typescript
// Get all murals with pending batch jobs
const pendingMurals = await prisma.referenceMural.findMany({
  where: {
    descriptionBatchJobId: { not: null },
    artisticDescription: null  // Not yet processed
  }
});

// Poll each batch job
for (const mural of pendingMurals) {
  const batchJob = await ai.batches.get({ name: mural.descriptionBatchJobId });

  if (batchJob.state === 'JOB_STATE_SUCCEEDED') {
    const response = batchJob.dest.inlinedResponses[0];  // Only one response
    const description = JSON.parse(response.response.text);

    // Update database
    await prisma.referenceMural.update({
      where: { id: mural.id },
      data: {
        artisticDescription: JSON.stringify(description),
        descriptionGeneratedAt: new Date()
      }
    });
  }
}
```

### Database Schema
Already implemented in `prisma/schema.prisma`:
- `artisticDescription`: JSON string of the description
- `descriptionGeneratedAt`: Timestamp when generated
- `descriptionBatchJobId`: Gemini batch job ID for tracking/polling

### Risk Mitigation
If we hit rate limits on batch job creation:
- Implement sequential submission with delays (e.g., 100ms between jobs)
- Add exponential backoff retry logic
- Split into smaller batches if necessary (fallback plan)

### Success Criteria
- ✅ All murals get descriptions (or explicit failure logged)
- ✅ 50% cost savings vs individual API calls
- ✅ Simple codebase without complex chunking logic
- ✅ Easy debugging: one batch job = one mural
