<system_context>
Mural Generator - A Next.js web application that uses Google Gemini AI to create original wall mural designs inspired by reference images. Manages local filesystem-based reference libraries, enables conversational AI prompt refinement, generates seamless horizontally-tileable murals, and tracks all generations in a SQLite database.
</system_context>

<architecture>
## SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│ USER INTERFACE (Next.js App Router - Client Components)        │
│ - Home: Import + Stats                                         │
│ - Browse: Collections → Designs → Variants (Accordion)         │
│ - Generate: AI Chat Refinement + Generation Controls           │
│ - Gallery: Keyboard Navigation (Arrow Keys)                    │
└────────────────────┬────────────────────────────────────────────┘
                     │ fetch()
┌────────────────────▼────────────────────────────────────────────┐
│ REST API (Next.js Route Handlers)                              │
│ GET  /api/reference-murals  → List references                  │
│ GET  /api/generated-murals  → List generations                 │
│ POST /api/import            → Import from filesystem           │
│ POST /api/generate-mural    → Create new mural                 │
│ POST /api/chat-refine-prompt → Conversational refinement       │
│ GET  /api/image?id=X        → Serve local images               │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│ BUSINESS LOGIC (lib/features/mural-generator/)                 │
│ - gemini.ts: generateMural(), refinePromptWithChat()           │
│ - storage.ts: File I/O, base64 conversion                      │
│ - prompts.ts: System instructions, Zod schemas                 │
│ - import.ts: Directory scanning, DB insertion                  │
└──────────┬──────────────────────────────┬───────────────────────┘
           │                              │
┌──────────▼────────────┐      ┌──────────▼────────────────────┐
│ PRISMA ORM            │      │ GOOGLE GEMINI API             │
│ - SQLite Database     │      │ - Image Generation            │
│ - ReferenceMural      │      │ - Chat Refinement (JSON mode) │
│ - GeneratedMural      │      │ - Structured Output (Zod)     │
└───────────────────────┘      └───────────────────────────────┘
           │
┌──────────▼────────────────────────────────────────────────────┐
│ LOCAL FILESYSTEM                                              │
│ References: {path}/{collection}/{design}/{variant}/*-design.jpg│
│ Generated:  {path}/{collection}/{design}/generated-*.png     │
└───────────────────────────────────────────────────────────────┘
```

**Tech Stack:**
- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4
- **Database:** Prisma 6 + SQLite
- **AI:** Google Gemini API (@google/genai)
- **Validation:** Zod 3 + zod-to-json-schema
- **Language:** TypeScript 5
</architecture>

<directory_map>
## DIRECTORY STRUCTURE

```
mural-generator/
├── app/                          → UI + API routes (see app/CLAUDE.md)
│   ├── page.tsx                  → Home: stats, import, recent generations
│   ├── browse/page.tsx           → Browse reference library (accordion)
│   ├── generate/page.tsx         → Generation workspace (AI chat modal)
│   ├── gallery/page.tsx          → Full-screen gallery (keyboard nav)
│   ├── layout.tsx                → Root layout with header navigation
│   └── api/                      → REST endpoints (see app/api/CLAUDE.md)
│       ├── import/route.ts       → Import references from filesystem
│       ├── reference-murals/route.ts  → List references
│       ├── generated-murals/route.ts  → List generations
│       ├── generate-mural/       → Generate new mural (see app/api/generate-mural/CLAUDE.md)
│       ├── chat-refine-prompt/route.ts → AI chat refinement
│       └── image/route.ts        → Serve local images
├── lib/
│   ├── db.ts                     → Prisma client singleton
│   └── features/mural-generator/ → Core business logic (see lib/features/mural-generator/CLAUDE.md)
│       ├── gemini.ts             → Gemini API integration
│       ├── storage.ts            → File I/O utilities
│       ├── prompts.ts            → System instructions + Zod schemas
│       ├── import.ts             → Directory scanner + importer
│       └── types.ts              → TypeScript interfaces
├── prisma/
│   ├── schema.prisma             → Database schema (ReferenceMural, GeneratedMural)
│   └── mural-generator.db        → SQLite database (gitignored)
└── public/                       → Static assets (NOT used for murals - see File Storage below)
```
</directory_map>

<environment_setup>
## ENVIRONMENT SETUP

### Required Environment Variables
Create `.env` file in project root:

```bash
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-image          # Optional, for image generation
GEMINI_CHAT_MODEL=gemini-2.5-flash           # Optional, for chat refinement

# Local File Storage Paths (MUST be absolute paths)
REFERENCE_MURALS_PATH=/path/to/reference/murals   # Source directory for import
GENERATED_MURALS_OUTPUT_PATH=/path/to/output      # Destination for generated murals
```

### Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup database:**
   ```bash
   npm run db:generate    # Generate Prisma client
   npm run db:push        # Create SQLite database + tables
   ```

3. **Run development server:**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

4. **Optional - View database:**
   ```bash
   npm run db:studio      # Opens Prisma Studio (DB GUI)
   ```

### File Storage Structure
Reference murals must follow this directory pattern:
```
{REFERENCE_MURALS_PATH}/
└── {collection}/
    └── {design}/
        └── {color-variant}/
            └── *-design.jpg    # Only files ending with -design.jpg/png are imported
```

Generated murals saved as:
```
{GENERATED_MURALS_OUTPUT_PATH}/
└── {collection}/
    └── {design}/
        └── generated-{timestamp}-{variant}.png
```
</environment_setup>

<data_flow>
## DATA FLOW & LIFECYCLE

### End-to-End User Journey

**1. Import References** (Home Page)
- User clicks "Import Reference Murals"
- `POST /api/import` → `importReferenceMurals(basePath)`
- Scans `{REFERENCE_MURALS_PATH}` recursively for `*-design.jpg` files
- Inserts into `ReferenceMural` table (skips duplicates by `localFilePath`)
- Returns: `{imported: N, skipped: M, total: X}`

**2. Browse Library** (Browse Page)
- `GET /api/reference-murals` → Returns all references grouped by collection/design
- UI groups into collapsible accordion: Collection → Designs (2-col grid) → Variants (horizontal scroll)
- Click variant → Navigates to `/generate?mural={id}`

**3. Generate Mural** (Generate Page)
- **Option A: AI Analysis**
  - Click "AI Analyze Prompt" → `POST /api/chat-refine-prompt` (with `referenceMuralId`)
  - Opens chat modal with initial analysis
  - User refines via conversation: "make it more colorful"
  - Each message updates `refinedPrompt` in real-time
- **Option B: Custom Prompt**
  - User writes prompt manually
- Click "Generate Mural"
  - `POST /api/generate-mural` with `{referenceMuralId, prompt, isCustomPrompt}`
  - Calls `generateMural()` → Gemini API returns image buffer
  - Saves PNG to `{GENERATED_MURALS_OUTPUT_PATH}/{collection}/{design}/generated-*.png`
  - Inserts `GeneratedMural` record with FK to `ReferenceMural`
  - Returns base64 preview for instant display

**4. View Gallery** (Gallery Page)
- `GET /api/generated-murals?limit=1000` → Returns all generations with reference metadata
- Full-screen gallery with keyboard navigation (← / → arrows)
- URL syncs: `/gallery?index=N`
- Preloads adjacent images for instant transitions
- Shows prompt, reference thumbnail, metadata

### Cross-System Data Flow
```
Local Filesystem → Import → SQLite (metadata) → Browse → Select Reference
                                                              ↓
                                    User ← Chat Modal ← AI Analysis (Gemini)
                                      ↓
                              Generate Request (prompt + reference image)
                                      ↓
                        Gemini API (Image Generation) → Image Buffer
                                      ↓
                   Save to Filesystem + Insert DB Record → Base64 Preview
                                      ↓
                                   Gallery Display
```
</data_flow>

<database_schema>
## DATABASE SCHEMA

**Location:** `prisma/schema.prisma`
**Database:** SQLite (`prisma/mural-generator.db`)

### Tables

**ReferenceMural** (Source inspiration images)
- `id` (UUID, PK)
- `collectionName` (e.g., "aracne")
- `designName` (e.g., "daffodils")
- `colorVariant` (e.g., "galaxy-azul-oscuro", nullable)
- `localFilePath` (Unique, full path to file)
- `fileName`, `metadata`, `importedAt`
- **Relation:** `generatedMurals[]` (one-to-many)

**GeneratedMural** (AI-generated outputs)
- `id` (UUID, PK)
- `referenceMuralId` (FK → ReferenceMural, CASCADE delete)
- `prompt`, `isCustomPrompt` (boolean)
- `localFilePath`, `fileName`
- `modelUsed` (e.g., "gemini-2.5-flash-image")
- `generationParams` (JSON string)
- `createdAt`
- **Relation:** `referenceMural` (many-to-one)

### Migrations
This project uses Prisma's `db push` (prototype mode):
```bash
npm run db:push    # Apply schema changes to SQLite
```
For production, use migrations: `prisma migrate dev`
</database_schema>

<navigation_guide>
## NAVIGATION GUIDE - "WHERE TO FIND X"

**Looking for...**
- **UI/UX patterns, page components** → [app/CLAUDE.md](app/CLAUDE.md)
- **API endpoint specs, request/response shapes** → [app/api/CLAUDE.md](app/api/CLAUDE.md)
- **Generate mural endpoint details** → [app/api/generate-mural/CLAUDE.md](app/api/generate-mural/CLAUDE.md)
- **Gemini API integration, prompts, Zod schemas** → [lib/features/mural-generator/CLAUDE.md](lib/features/mural-generator/CLAUDE.md)
- **Database schema** → This file (Database Schema section)
- **Environment variables** → This file (Environment Setup section)
- **System architecture** → This file (Architecture section)

**Quick Reference:**
- Chat refinement flow → [app/generate/page.tsx:99-154](app/generate/page.tsx#L99-L154) + [lib/features/mural-generator/gemini.ts:96-189](lib/features/mural-generator/gemini.ts#L96-L189)
- Import workflow → [app/api/import/route.ts](app/api/import/route.ts) + [lib/features/mural-generator/import.ts](lib/features/mural-generator/import.ts)
- Prompt templates → [lib/features/mural-generator/prompts.ts](lib/features/mural-generator/prompts.ts)
</navigation_guide>

<critical_notes>
## CRITICAL NOTES

- **Local-first architecture** - All images stored on local filesystem, NOT in cloud/CDN
- **No authentication** - Designed for trusted local environment (add auth for production deployment)
- **SQLite limitations** - Not suitable for concurrent writes; consider PostgreSQL for production
- **Seamless tiling requirement** - All prompts emphasize horizontal repeatability for wall murals
- **Base64 previews** - Only safe for small images; large previews can cause memory issues
- **File paths must be absolute** - Relative paths in env vars will fail
- **Import is idempotent** - Checks `localFilePath` uniqueness to avoid duplicates
</critical_notes>

<development_workflow>
## ADDING A NEW FEATURE

To add a feature that touches multiple layers:

1. **Define types** in `lib/features/mural-generator/types.ts`
2. **Add business logic** in `lib/features/mural-generator/{feature}.ts`
3. **Create API route** in `app/api/{feature}/route.ts` (follow patterns in [app/api/CLAUDE.md](app/api/CLAUDE.md))
4. **Build UI** in `app/{feature}/page.tsx` (follow patterns in [app/CLAUDE.md](app/CLAUDE.md))
5. **Update database** if needed:
   - Modify `prisma/schema.prisma`
   - Run `npm run db:push`
6. **Add navigation** link to `app/layout.tsx` header if new page

**Example:** Adding export feature
- Business logic: `lib/features/export/generator.ts`
- API: `app/api/export/route.ts` (POST with mural IDs)
- UI: Button in gallery page → Downloads ZIP
</development_workflow>
