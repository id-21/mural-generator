<system_context>
This directory contains the Next.js API route handler for generating new murals using Gemini AI. It orchestrates the full generation pipeline: fetching reference murals from database, calling Gemini API with image+prompt, saving generated images to filesystem, and persisting metadata to database.
</system_context>

<file_map>
## FILE MAP
- `route.ts` - POST endpoint that generates murals via Gemini API
</file_map>

<patterns>
## PATTERNS

### Standard API Route Flow
All API routes in this app follow this pattern (see [route.ts:11-102](route.ts#L11-L102)):
1. Parse JSON request body
2. Validate required parameters (return 400 if missing)
3. Fetch related database records (return 404 if not found)
4. Execute business logic (call external APIs, process data)
5. Save results to database and filesystem
6. Return JSON response with standardized shape: `{success: true, ...data}`
7. Catch all errors and return 500 with `{error, details}`

### Environment Variable Pattern
Required env vars checked at runtime (see [route.ts:49-55](route.ts#L49-L55)):
- `GEMINI_API_KEY` - Used by `@/lib/features/mural-generator/gemini`
- `GEMINI_MODEL` - Optional, defaults to 'gemini-pro-3'
- `GENERATED_MURALS_OUTPUT_PATH` - Required for file storage
</patterns>

<critical_notes>
## CRITICAL NOTES
- **Request shape** - Expects `{referenceMuralId: string, prompt: string, isCustomPrompt?: boolean}`
- **File storage** - Generated murals saved to `{GENERATED_MURALS_OUTPUT_PATH}/{collection}/{design}/{filename}.png`
- **Response includes preview** - Returns base64-encoded preview in response ([route.ts:90](route.ts#L90)), only safe for small images
- **Database cascade** - Generated murals link to reference murals via `referenceMuralId` foreign key
- **Model used tracking** - Stores which Gemini model generated each mural for reproducibility ([route.ts:73](route.ts#L73))
</critical_notes>

<dependencies>
## DEPENDENCIES
- `@/lib/features/mural-generator/gemini` - `generateMural()` function for Gemini API calls
- `@/lib/features/mural-generator/storage` - File I/O utilities for images
- `@/lib/db` - Prisma client for database operations
- Database tables: `referenceMural` (input), `generatedMural` (output)
</dependencies>

<paved_path>
## PAVED PATH
To add a new generation endpoint:
1. Create new route in `app/api/{feature}/route.ts`
2. Follow the standard API route flow pattern above
3. Import business logic from `@/lib/features/{feature}/`
4. Use `@/lib/db` for database operations
5. Return standardized JSON responses
6. Handle all errors with try/catch → 500 response

For chat-based refinement, see sibling endpoint: [../chat-refine-prompt/route.ts](../chat-refine-prompt/route.ts)
</paved_path>
