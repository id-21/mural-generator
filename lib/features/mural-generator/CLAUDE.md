<system_context>
Core business logic for the mural generation feature. Handles Gemini AI integration (image generation + chat refinement), local filesystem operations (import/save/read images), prompt engineering (system instructions + schemas), and TypeScript type definitions for mural entities.
</system_context>

<file_map>
## FILE MAP
- `gemini.ts` - Gemini API client with 2 functions: `generateMural()` for image generation, `refinePromptWithChat()` for conversational refinement
- `storage.ts` - File I/O utilities for reading/writing images, base64 conversion, MIME type detection, directory structure management
- `prompts.ts` - System instructions, prompt templates, and Zod schemas for Gemini API calls (includes `artisticDescriptionSchema` for batch descriptions)
- `import.ts` - Recursive directory scanner and database importer for reference murals (expects `collection/design/variant/*-design.jpg` structure)
- `batch-descriptions.ts` - Gemini Batch API integration for generating artistic descriptions: `createBatchJobForMural()`, `pollBatchJobs()`, `processCompletedJobs()`
- `types.ts` - TypeScript interfaces for `ReferenceMural`, `GeneratedMural`, `GenerationRequest`, `PromptAnalysisResult`
</file_map>

<patterns>
## PATTERNS

### Gemini API Call Pattern
All Gemini interactions use singleton client + structured requests (see [gemini.ts:17-28](gemini.ts#L17-L28)):
```typescript
const ai = getGeminiClient(); // Singleton, checks GEMINI_API_KEY env var
const response = await ai.models.generateContent({
  model: process.env.GEMINI_MODEL || 'default-model',
  contents: [...],
  config: { systemInstruction: CONSTANT_FROM_PROMPTS_TS }
});
```

### JSON Schema Validation with Zod
Chat refinement and batch descriptions use Zod for runtime validation (see [prompts.ts:107-111](prompts.ts#L107-L111)):
- Define schema: `const schema = z.object({...})`
- Convert to JSON Schema: `zodToJsonSchema(schema)`
- CRITICAL: Delete `$schema` field before sending to Gemini ([batch-descriptions.ts:72-73](batch-descriptions.ts#L72-L73))
- Pass to Gemini: `responseJsonSchema: zodToJsonSchema(schema)`
- Parse response: `schema.parse(JSON.parse(response.text))`

### Batch API Pattern (1 mural = 1 batch job)
Batch artistic descriptions use inline requests (see [batch-descriptions.ts:76-99](batch-descriptions.ts#L76-L99)):
- Request: `{ model, src: [{ contents, config }], config: { displayName } }`
- Response saved to DB as `rawResponse` before parsing ([batch-descriptions.ts:179-182](batch-descriptions.ts#L179-L182))
- Parse separate from API call for reprocessing capability ([batch-descriptions.ts:262-284](batch-descriptions.ts#L262-L284))
- One-to-one relationship enforced: delete old job before creating new ([batch-descriptions.ts:49-59](batch-descriptions.ts#L49-L59))

### File Storage Structure
Generated murals organized by reference metadata ([storage.ts:35-41](storage.ts#L35-L41)):
```
{basePath}/{collectionName}/{designName}/generated-{timestamp}-{colorVariant}.png
```
Reference murals expected structure ([import.ts:16-17](import.ts#L16-L17)):
```
{basePath}/{collection}/{design}/{variant}/*-design.jpg
```

### Base64 Image Handling
Pattern for sending images to Gemini ([gemini.ts:48-55](gemini.ts#L48-L55)):
```typescript
contents: [
  { text: prompt },
  { inlineData: { mimeType: 'image/jpeg', data: base64String } }
]
```
</patterns>

<critical_notes>
## CRITICAL NOTES

- **Singleton Gemini client** - `getGeminiClient()` caches instance, throws if `GEMINI_API_KEY` missing ([gemini.ts:19-27](gemini.ts#L19-L27), [batch-descriptions.ts:21-30](batch-descriptions.ts#L21-L30))
- **Seamless tiling requirement** - All mural prompts emphasize horizontal repeatability ([prompts.ts:58-59](prompts.ts#L58-L59))
- **Two-mode chat system** - Chat refinement handles both initial image analysis (with image) and text-only refinement (without image) ([prompts.ts:83-97](prompts.ts#L83-L97))
- **Import idempotency** - Import checks `localFilePath` uniqueness before inserting ([import.ts:100-108](import.ts#L100-L108))
- **File naming convention** - Only files ending with `-design.jpg` or `-design.png` are imported ([import.ts:59](import.ts#L59))
- **Response extraction** - Generated images extracted from `response.candidates[0].content.parts[].inlineData.data` ([gemini.ts:64-79](gemini.ts#L64-L79))
- **Metadata as JSON** - `generationParams` stored as stringified JSON in database ([storage.ts:20-29](storage.ts#L20-L29) shows timestamp example)
- **Batch API debugging** - Request payloads and job details saved to `/tmp` for debugging ([batch-descriptions.ts:106-124](batch-descriptions.ts#L106-L124))
- **Database-driven batch processing** - Raw responses stored before parsing for reprocessing capability ([batch-descriptions.ts:179-182](batch-descriptions.ts#L179-L182))
- **Status tracking** - Use Gemini's exact status strings (JOB_STATE_PENDING, JOB_STATE_RUNNING, JOB_STATE_SUCCEEDED, etc.) ([batch-descriptions.ts:130](batch-descriptions.ts#L130))
</critical_notes>

<environment_variables>
## ENVIRONMENT VARIABLES
Required by this module:
- `GEMINI_API_KEY` - API key for Google Gemini (required, checked at runtime)
- `GEMINI_MODEL` - Model for image generation (optional, defaults: 'gemini-2.5-flash-image')
- `GEMINI_CHAT_MODEL` - Model for chat refinement (optional, defaults: 'gemini-2.5-flash')
- `REFERENCE_MURALS_PATH` - Source directory for importing reference murals
- `GENERATED_MURALS_OUTPUT_PATH` - Destination directory for saving generated murals
</environment_variables>

<key_functions>
## KEY FUNCTIONS

**Gemini Integration:**
- `generateMural(imageBase64, mimeType, prompt)` → `Promise<Buffer>` - Generate image via Gemini
- `refinePromptWithChat(chatHistory, userMessage, imageData?, currentPrompt?)` → `Promise<ChatRefinementResponse>` - Conversational prompt refinement

**Batch Descriptions (Gemini Batch API):**
- `createBatchJobForMural(muralId)` → `Promise<string>` - Create batch job for 1 mural, returns batchJobId
- `pollBatchJobs()` → `Promise<{pending, running, completed, failed, expired, cancelled}>` - Poll all pending/running jobs
- `processCompletedJobs()` → `Promise<{processed, failed, errors}>` - Parse rawResponse and update ReferenceMural

**File Operations:**
- `saveGeneratedMural(imageData, basePath, collection, design, colorVariant)` → `{filePath, fileName}` - Save generated image
- `readImageAsBase64(filePath)` → `Promise<string>` - Read image as base64
- `getReferenceMuralImage(referenceMuralId)` → `{mimeType, base64Data}` - Fetch reference from DB + filesystem
- `getMimeType(fileName)` → `string` - Determine MIME type from extension

**Import:**
- `importReferenceMurals(basePath)` → `{imported, skipped, total}` - Scan directory + import to DB
- `getImportStats()` → `{totalMurals, totalCollections}` - Get count statistics
</key_functions>

<paved_path>
## PAVED PATH

### Adding a New Gemini Feature
1. Define system instruction constant in `prompts.ts` (see [prompts.ts:7-15](prompts.ts#L7-L15) for example)
2. Create Zod schema if expecting structured JSON response ([prompts.ts:107-111](prompts.ts#L107-L111))
3. Add function to `gemini.ts` following singleton pattern
4. Use `zodToJsonSchema()` for `responseJsonSchema` if structured output needed
5. Parse response with `schema.parse(JSON.parse(response.text))`

### Adding New File Storage Patterns
1. Create utility functions in `storage.ts`
2. Follow existing patterns: async/await, `fs/promises`, descriptive function names
3. Use `ensureDir()` before writing files ([storage.ts:10-14](storage.ts#L10-L14))
4. Return both `filePath` and `fileName` from save operations

### Modifying Prompt Templates
1. Edit constants in `prompts.ts` - all prompt text centralized here
2. Test changes with actual Gemini API calls
3. Consider: DEFAULT_MURAL_PROMPT for generation, CHAT_REFINEMENT_SYSTEM_INSTRUCTION for chat
4. Keep emphasis on seamless tiling and originality
</paved_path>
