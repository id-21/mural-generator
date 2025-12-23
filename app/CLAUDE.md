<system_context>
Next.js 13+ App Router frontend for the mural generator application. Provides user interface for importing reference murals, browsing collections, generating AI murals with chat-based prompt refinement, and viewing generated results in an immersive gallery. Technical backend details in [api/CLAUDE.md](api/CLAUDE.md) and [../lib/features/mural-generator/CLAUDE.md](../lib/features/mural-generator/CLAUDE.md).
</system_context>

<file_map>
## FILE MAP
- `layout.tsx` - Root layout with header navigation (Browse, Generate, Gallery)
- `page.tsx` - Home page with library stats, import button, recent generations list
- `browse/page.tsx` - Hierarchical browser: collections → designs → color variants (collapsible accordion)
- `generate/page.tsx` - Generation workspace with AI chat refinement modal and previously-generated slider
- `gallery/page.tsx` - Full-screen immersive gallery with keyboard navigation (arrow keys)
- `api/` - REST API routes (see [api/CLAUDE.md](api/CLAUDE.md))
- `globals.css` - Tailwind CSS global styles
</file_map>

<ux_patterns>
## UX PATTERNS

### Navigation Flow
User journey: Home → Browse (select reference) → Generate (refine + create) → Gallery (view all)
- Home provides action cards linking to all main sections ([page.tsx:128-157](page.tsx#L128-L157))
- Each page has breadcrumb "← Back to X" links
- Header navigation persists across all pages ([layout.tsx:29-39](layout.tsx#L29-L39))

### Data Display Hierarchy
Browse page uses 3-level grouping ([browse/page.tsx:57-66](browse/page.tsx#L57-L66)):
1. Collections (collapsible, click to expand/collapse)
2. Designs (2-column grid within collection)
3. Color variants (horizontal scrollable cards)

### Auto-Loading & URL Sync
- Generate page: URL param `?mural=ID` auto-loads reference ([generate/page.tsx:61-65](generate/page.tsx#L61-L65))
- Gallery page: URL param `?index=N` syncs with current mural ([gallery/page.tsx:50-56](gallery/page.tsx#L50-L56))
- Click any reference → navigates to `/generate?mural=ID`

### Notification System
Transient success/error banners with auto-dismiss ([generate/page.tsx:39-58](generate/page.tsx#L39-L58)):
- Fixed top-right position
- Green for success, red for error
- 5-second auto-dismiss + manual close button
- Example: "Mural generated successfully!"

### Modal Patterns
Two modal types in generate page:
1. **Image viewer modal** - Click any previously-generated thumbnail to view full-size with metadata ([generate/page.tsx:492-525](generate/page.tsx#L492-L525))
2. **Chat refinement modal** - Three-column layout: chat history (2/3) | prompt preview + changes (1/3) ([generate/page.tsx:528-667](generate/page.tsx#L528-L667))
</ux_patterns>

<interactive_features>
## INTERACTIVE FEATURES

### AI Chat Refinement (Generate Page)
Conversational prompt refinement with visual feedback ([generate/page.tsx:99-154](generate/page.tsx#L99-L154)):
- Click "AI Analyze Prompt" → Opens chat modal with initial analysis
- Chat history shows reference image in first message ([generate/page.tsx:558-566](generate/page.tsx#L558-L566))
- User can request changes: "make it more colorful", "add tropical plants"
- Right sidebar shows live prompt preview + changes summary
- Press Enter to send message
- "Apply Refined Prompt" button closes modal and applies changes

### Generation Workflow
1. Select reference mural (from browse page or URL)
2. Choose: "AI Analyze Prompt" (opens chat) OR "Write Custom Prompt"
3. Edit prompt in textarea (auto-marks as custom if edited)
4. Click "Generate Mural" → Shows base64 preview immediately
5. Previously-generated horizontal slider updates automatically

### Gallery Keyboard Navigation
Full keyboard support for browsing ([gallery/page.tsx:59-74](gallery/page.tsx#L59-L74)):
- `←` / `→` arrow keys navigate between murals
- URL updates on navigation (shareable links)
- Preloads adjacent images for instant transitions ([gallery/page.tsx:76-85](gallery/page.tsx#L76-L85))
- Displays counter: "3 / 25"

### Collection Accordion (Browse Page)
Interactive expand/collapse ([browse/page.tsx:44-54](browse/page.tsx#L44-L54)):
- Click collection header to toggle
- Shows count: "12 designs · 48 variants"
- Arrow indicator: ▶ (collapsed) / ▼ (expanded)
- State managed with Set for multi-expand support

### Import Workflow (Home Page)
One-click import with progress feedback ([page.tsx:54-67](page.tsx#L54-L67)):
- Button disabled during import
- Alert shows results: "Imported: 25, Skipped: 3, Total: 28"
- Stats refresh automatically after import
</interactive_features>

<ui_components>
## UI COMPONENTS & STYLING

### Color Palette (Tailwind)
- Primary actions: Green (`bg-green-600`) - Generate buttons
- Secondary actions: Purple (`bg-purple-600`) - AI Analyze
- Navigation: Blue (`bg-blue-600`) - Links, refinement
- Neutral: Gray scale for backgrounds, borders
- Status: Green (success), Red (error) notifications

### Layout Patterns
- **Max-width container**: `max-w-7xl mx-auto px-4 py-8` (standard page wrapper)
- **Two-column grids**: Browse (2 designs), Generate (reference | controls)
- **Three-column modal**: Chat refinement (2:1 ratio)
- **Horizontal scrollers**: Variant cards, previously-generated murals

### Image Loading Strategy
- Browse page: Lazy-load thumbnails via `/api/image?id=X`
- Generate page: Base64 preview for current generation (instant display)
- Gallery: Preload adjacent images for smooth navigation
- All images use `object-cover` for consistent aspect ratios

### Responsive Design
- Mobile-first with Tailwind breakpoints
- Grid layouts auto-collapse on mobile
- Horizontal scrollers work on touch devices
- Modal overlays full-screen on mobile
</ui_components>

<state_management>
## STATE MANAGEMENT

### Client-Side State (React useState)
All pages use `'use client'` directive with local state:
- `loading` - Initial data fetch states
- `selectedMural` - Currently active reference (generate page)
- `chatHistory` - Conversation messages for refinement
- `modalImage` - Currently viewing generated mural
- `expandedCollections` - Set<string> for accordion state (browse)
- `currentIndex` - Gallery navigation position

### Data Fetching Pattern
Standard async/await with error handling ([browse/page.tsx:31-42](browse/page.tsx#L31-L42)):
```typescript
async function loadData() {
  try {
    setLoading(true);
    const res = await fetch('/api/endpoint');
    const data = await res.json();
    setState(data.results);
  } catch (error) {
    console.error('Failed:', error);
  } finally {
    setLoading(false);
  }
}
```

### Side Effects (useEffect)
- Auto-load on mount: `useEffect(() => loadData(), [])`
- Auto-load from URL params: `useEffect(() => ..., [searchParams])`
- Keyboard listeners: Add/remove on mount/unmount
- Auto-dismiss notifications: Timer cleanup on unmount
</state_management>

<critical_notes>
## CRITICAL NOTES

- **All pages are client components** - Use `'use client'` directive for interactivity
- **No server-side data fetching** - All API calls from browser (could optimize with Server Components)
- **Chat history format** - AI responses stored as JSON strings, parsed on render ([generate/page.tsx:573](generate/page.tsx#L573))
- **Base64 previews** - Only safe for small images; large previews could cause memory issues
- **No authentication** - App assumes trusted local environment (add auth for production)
- **Image serving via API** - Local files served through `/api/image?id=X`, not public folder
- **Keyboard nav conflicts** - Gallery disables arrow keys when input/textarea focused ([gallery/page.tsx:61-62](gallery/page.tsx#L61-L62))
</critical_notes>

<technical_integration>
## TECHNICAL INTEGRATION

### API Endpoints Used
- `GET /api/import` - Library stats (home page)
- `POST /api/import` - Trigger mural import
- `GET /api/reference-murals` - List all references (browse)
- `GET /api/generated-murals?referenceMuralId=X&limit=N` - Previously generated
- `POST /api/generate-mural` - Create new mural
- `POST /api/chat-refine-prompt` - AI conversation refinement
- `GET /api/image?id=X` - Serve image files

See [api/CLAUDE.md](api/CLAUDE.md) for endpoint details.

### Business Logic Integration
Pages consume functions from `@/lib/features/mural-generator/`:
- `generateMural()` - Called via API route
- `refinePromptWithChat()` - Chat refinement backend
- `importReferenceMurals()` - Import workflow

See [../lib/features/mural-generator/CLAUDE.md](../lib/features/mural-generator/CLAUDE.md) for implementation details.
</technical_integration>

<paved_path>
## PAVED PATH

### Adding a New Page
1. Create `app/new-feature/page.tsx`
2. Add `'use client'` directive at top
3. Follow standard layout: `max-w-7xl mx-auto px-4 py-8`
4. Add breadcrumb link: `<Link href="/">← Back to Home</Link>`
5. Use consistent color scheme (green=action, blue=nav, purple=AI)
6. Add navigation link to `layout.tsx` header if needed

### Adding New Modal
1. Create modal state: `const [showModal, setShowModal] = useState(false)`
2. Use full-screen overlay pattern: `fixed inset-0 bg-black bg-opacity-75 z-50`
3. Stop propagation on modal content: `onClick={(e) => e.stopPropagation()}`
4. Add close button with ✕ icon
5. Example: [generate/page.tsx:528-667](generate/page.tsx#L528-L667)

### Enhancing User Feedback
1. Use notification pattern for success/error states
2. Add loading states with disabled buttons
3. Show skeleton loaders during data fetch
4. Provide empty states with call-to-action
5. Example: [page.tsx:39-58](page.tsx#L39-L58) (notification system)
</paved_path>
