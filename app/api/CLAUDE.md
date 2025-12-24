<system_context>
Next.js 13+ App Router API routes for the mural generator application. Provides REST endpoints for importing reference murals, generating new murals via Gemini AI, chat-based prompt refinement, and serving/listing mural images from local filesystem.
</system_context>

<file_map>
## FILE MAP
- `import/route.ts` - POST imports reference murals from filesystem; GET returns import stats
- `reference-murals/route.ts` - GET lists reference murals with optional collection/design filters
- `generated-murals/route.ts` - GET lists generated murals with optional reference filter and limit
- `generate-mural/` - POST generates new mural (see [generate-mural/CLAUDE.md](generate-mural/CLAUDE.md))
- `chat-refine-prompt/route.ts` - POST for chat-based prompt refinement (initial analysis + iterative refinement)
- `batch-descriptions/` - Batch artistic description generation via Gemini Batch API (see [batch-descriptions/CLAUDE.md](batch-descriptions/CLAUDE.md))
- `image/route.ts` - GET serves local images by mural ID (checks both reference and generated tables)
</file_map>

<patterns>
## PATTERNS

### API Route Convention (Next.js App Router)
All routes use `route.ts` files with named HTTP method exports:
- `export async function GET(request: NextRequest)` - Read operations
- `export async function POST(request: NextRequest)` - Write/action operations
Example: [reference-murals/route.ts:5](reference-murals/route.ts#L5)

### Standard Response Shape
Success: `{success: true, ...data}` or just `{...data}`
Error: `{error: string, details?: string}` with appropriate status code (400/404/500)
Example: [generate-mural/route.ts:85-92](generate-mural/route.ts#L85-L92)

### Query Parameter Parsing
Use `request.nextUrl.searchParams` for GET route filters:
```typescript
const searchParams = request.nextUrl.searchParams;
const filter = searchParams.get('filterName');
```
Example: [reference-murals/route.ts:7-9](reference-murals/route.ts#L7-L9)

### JSON Body Parsing
Use `await request.json()` for POST route payloads:
```typescript
const { field1, field2 } = await request.json();
```
Example: [generate-mural/route.ts:13](generate-mural/route.ts#L13)

### Database Queries
All routes use `@/lib/db` (Prisma client) for database operations.
Common patterns:
- `findUnique()` for single record by ID
- `findMany()` with `where`, `orderBy`, `include` for lists
- `create()` with `data` and optional `include` for inserts
Example: [reference-murals/route.ts:21-28](reference-murals/route.ts#L21-L28)

### Error Handling
All routes wrapped in try/catch returning 500 on error:
```typescript
try {
  // route logic
} catch (error) {
  console.error('Error message:', error);
  return NextResponse.json({ error: 'Message' }, { status: 500 });
}
```
Example: [image/route.ts:56-62](image/route.ts#L56-L62)
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Environment variables** - Routes depend on `REFERENCE_MURALS_PATH`, `GENERATED_MURALS_OUTPUT_PATH`, `GEMINI_API_KEY`
- **Local filesystem** - Images stored locally, NOT in public folder; served via `/api/image?id={muralId}`
- **Database schema** - Two main tables: `referenceMural` (imported images) and `generatedMural` (AI-generated, FK to reference)
- **Business logic separation** - Routes are thin wrappers; heavy logic lives in `@/lib/features/mural-generator/`
- **No authentication** - All routes currently public (add auth middleware if deploying)
- **Image caching** - `/api/image` sets 1-year cache headers for immutable images ([image/route.ts:53](image/route.ts#L53))
</critical_notes>

<endpoints_summary>
## ENDPOINTS SUMMARY

**Import & List:**
- `POST /api/import` - Import reference murals from `REFERENCE_MURALS_PATH`
- `GET /api/import` - Get import statistics
- `GET /api/reference-murals?collection=X&design=Y` - List/filter reference murals
- `GET /api/generated-murals?referenceMuralId=X&limit=N` - List generated murals

**Generation:**
- `POST /api/generate-mural` - Generate new mural (see child CLAUDE.md)
- `POST /api/chat-refine-prompt` - Chat-based prompt refinement

**Batch Descriptions (Gemini Batch API):**
- `POST /api/batch-descriptions/start` - Create batch jobs for all murals without descriptions
- `GET /api/batch-descriptions/poll` - Poll pending/running batch jobs and update status
- `POST /api/batch-descriptions/process` - Parse completed jobs and save descriptions (manual trigger)
- `POST /api/batch-descriptions/test-one` - Test endpoint - create batch job for 1 mural
- `GET /api/batch-descriptions/check-orphaned` - Debug endpoint - check orphaned Gemini batch jobs

**Serving:**
- `GET /api/image?id={muralId}` - Serve image file from filesystem
</endpoints_summary>

<paved_path>
## PAVED PATH

### Adding a New API Route
1. Create `app/api/{feature}/route.ts`
2. Export named HTTP method functions (GET, POST, etc.)
3. Use `NextRequest`, `NextResponse` types from 'next/server'
4. Parse request: `searchParams` for GET, `await request.json()` for POST
5. Validate inputs → return 400 if missing required fields
6. Import business logic from `@/lib/features/{feature}/`
7. Use `@/lib/db` for database operations
8. Wrap in try/catch → return 500 with error details
9. Return standardized JSON response

### Testing Routes Locally
Use `curl` or tools like Postman/Insomnia:
```bash
# GET with query params
curl "http://localhost:3000/api/reference-murals?collection=modern"

# POST with JSON body
curl -X POST http://localhost:3000/api/generate-mural \
  -H "Content-Type: application/json" \
  -d '{"referenceMuralId": "123", "prompt": "..."}'
```
</paved_path>
