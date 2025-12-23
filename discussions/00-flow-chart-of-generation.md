# Flow Chart: AI Analyze Prompt - Initial Generation

## Overview
This document traces the complete flow of the "AI Analyze Prompt" button functionality in the mural generator application, from button click to AI response.

---

## Visual Flow Chart

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER INTERACTION                                             │
│ File: app/generate/page.tsx                                     │
├─────────────────────────────────────────────────────────────────┤
│ Line 372: User clicks "AI Analyze Prompt" button               │
│           <button onClick={handleAnalyze} ...>                  │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. BUTTON CLICK HANDLER                                         │
│ File: app/generate/page.tsx                                     │
│ Function: handleAnalyze() (Lines 99-154)                        │
├─────────────────────────────────────────────────────────────────┤
│ Line 102: setAnalyzing(true)                                   │
│ Line 106: setShowChatModal(true) - Opens chat modal            │
│ Line 107: setChatLoading(true)                                 │
│ Line 110: POST request to '/api/chat-refine-prompt'            │
│ Lines 113-116: Body includes:                                  │
│   - referenceMuralId: selectedMural.id                         │
│   - chatHistory: []  // Empty for initial analysis             │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. API ENDPOINT                                                 │
│ File: app/api/chat-refine-prompt/route.ts                      │
│ Function: POST() (Lines 7-99)                                   │
├─────────────────────────────────────────────────────────────────┤
│ Line 12: Checks if referenceMuralId provided AND               │
│          chatHistory is empty (INITIAL ANALYSIS CASE)           │
│ Line 16: const imageData =                                     │
│          await getReferenceMuralImage(referenceMuralId)        │
│ Line 18: const initialMessage = "Please analyze this mural..." │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. IMAGE LOADING                                                │
│ File: lib/features/mural-generator/storage.ts                  │
│ Function: getReferenceMuralImage() (Lines 100-118)             │
├─────────────────────────────────────────────────────────────────┤
│ Lines 105-107: Query database for reference mural              │
│   const mural = db.prepare(                                    │
│     'SELECT * FROM reference_murals WHERE id = ?'              │
│   ).get(referenceMuralId)                                      │
│                                                                 │
│ Line 114: Read file as base64                                  │
│   const base64Data = readImageAsBase64(mural.localFilePath)   │
│   [calls function at lines 73-76]                              │
│                                                                 │
│ Line 115: Get MIME type                                        │
│   const mimeType = getMimeType(mural.fileName)                │
│   [calls function at lines 81-95]                              │
│                                                                 │
│ Returns: { mimeType, base64Data }                             │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. BACK TO API ROUTE                                            │
│ File: app/api/chat-refine-prompt/route.ts                      │
├─────────────────────────────────────────────────────────────────┤
│ Lines 21-28: Call AI function                                  │
│   const result = await refinePromptWithChat(                   │
│     [],                    // empty chat history               │
│     initialMessage,        // analysis request                 │
│     imageData              // { mimeType, base64Data }         │
│   )                                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. AI PROMPT REFINEMENT FUNCTION                                │
│ File: lib/features/mural-generator/gemini.ts                   │
│ Function: refinePromptWithChat() (Lines 138-205)               │
├─────────────────────────────────────────────────────────────────┤
│ Line 144: Initialize Gemini AI client                          │
│   const ai = getGeminiClient()                                 │
│   [singleton pattern, initialized at lines 18-27]              │
│                                                                 │
│ Line 145: Select model                                         │
│   const model = process.env.GEMINI_CHAT_MODEL ||              │
│                 'gemini-2.5-flash'                             │
│                                                                 │
│ Lines 157-176: Build message content                           │
│   - Constructs conversation history array                      │
│   - For initial analysis: includes user message with image     │
│   - Image formatted as inline data:                            │
│     {                                                           │
│       inlineData: {                                            │
│         mimeType: imageData.mimeType,                         │
│         data: imageData.base64Data                            │
│       }                                                         │
│     }                                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. SYSTEM INSTRUCTION LOADING                                   │
│ File: lib/features/mural-generator/prompts.ts                  │
│ Constant: CHAT_REFINEMENT_SYSTEM_INSTRUCTION (Lines 79-102)    │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Dual-mode instruction for AI                          │
│                                                                 │
│ MODE 1 - INITIAL ANALYSIS (when chatHistory empty):            │
│   - Analyze reference mural image thoroughly                   │
│   - Extract: visual elements, artistic style, colors,          │
│     composition, patterns, textures                            │
│   - Generate detailed prompt for NEW original mural            │
│   - Provide friendly explanation (1-3 sentences)               │
│   - Use empty changesSummary: []                               │
│                                                                 │
│ MODE 2 - REFINEMENT (when chatHistory has messages):           │
│   - Modify existing prompt based on user requests              │
│   - Return complete updated prompt                             │
│   - List specific changes in changesSummary                    │
│                                                                 │
│ CRITICAL RULES:                                                 │
│   - Always provide complete detailed prompt                    │
│   - Never return null/undefined for refinedPrompt              │
│   - For casual conversation: return current prompt unchanged   │
│   - Keep prompts detailed for mural generation                 │
│   - Be brief and friendly in conversationalResponse            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. RESPONSE SCHEMA DEFINITION                                   │
│ File: lib/features/mural-generator/prompts.ts                  │
│ Schema: chatRefinementSchema (Lines 107-111)                   │
├─────────────────────────────────────────────────────────────────┤
│ import { z } from 'zod'                                        │
│                                                                 │
│ export const chatRefinementSchema = z.object({                 │
│   conversationalResponse: z.string(),                          │
│     // Friendly explanation, never undefined                   │
│                                                                 │
│   refinedPrompt: z.string(),                                   │
│     // Complete detailed prompt, never null/undefined          │
│                                                                 │
│   changesSummary: z.array(z.string()),                         │
│     // List of changes (empty [] for initial analysis)         │
│ })                                                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. GEMINI API CALL                                              │
│ File: lib/features/mural-generator/gemini.ts                   │
│ Lines 179-187                                                   │
├─────────────────────────────────────────────────────────────────┤
│ const response = await ai.models.generateContent({             │
│   model: 'gemini-2.5-flash',  // or env var                   │
│                                                                 │
│   systemInstruction: CHAT_REFINEMENT_SYSTEM_INSTRUCTION,       │
│     // From prompts.ts lines 79-102                            │
│                                                                 │
│   contents: conversationHistory,                               │
│     // Includes user message with image inline data            │
│                                                                 │
│   config: {                                                     │
│     responseMimeType: 'application/json',                      │
│     responseSchema: zodToJsonSchema(chatRefinementSchema),     │
│       // Enforces structured JSON output                       │
│   }                                                             │
│ })                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. RESPONSE PARSING & VALIDATION                               │
│ File: lib/features/mural-generator/gemini.ts                   │
│ Lines 189-200                                                   │
├─────────────────────────────────────────────────────────────────┤
│ Line 189: Extract text from response                           │
│   const text = response.candidates[0].content.parts[0].text    │
│                                                                 │
│ Line 198: Parse and validate with Zod schema                   │
│   const result = chatRefinementSchema.parse(JSON.parse(text))  │
│                                                                 │
│ Returns ChatRefinementResponse:                                │
│   {                                                             │
│     conversationalResponse: string,  // AI's explanation        │
│     refinedPrompt: string,          // Complete prompt          │
│     changesSummary: string[]        // Empty [] for initial    │
│   }                                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 11. API ROUTE RESPONSE CONSTRUCTION                             │
│ File: app/api/chat-refine-prompt/route.ts                      │
│ Lines 30-55                                                     │
├─────────────────────────────────────────────────────────────────┤
│ return NextResponse.json({                                     │
│   success: true,                                               │
│   conversationalResponse: result.conversationalResponse,       │
│   refinedPrompt: result.refinedPrompt,                         │
│   changesSummary: result.changesSummary,                       │
│                                                                 │
│   initialChatHistory: [                                        │
│     {                                                           │
│       role: 'user',                                            │
│       parts: [{ text: initialMessage }]                        │
│     },                                                          │
│     {                                                           │
│       role: 'model',                                           │
│       parts: [{                                                │
│         text: JSON.stringify({                                 │
│           conversationalResponse,                              │
│           refinedPrompt,                                       │
│           changesSummary                                       │
│         })                                                      │
│       }]                                                        │
│     }                                                           │
│   ]                                                             │
│ })                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 12. FRONTEND RESPONSE HANDLING                                  │
│ File: app/generate/page.tsx                                     │
│ Function: handleAnalyze() success block (Lines 119-143)        │
├─────────────────────────────────────────────────────────────────┤
│ if (data.success) {                                            │
│   Line 122: Set the prompt                                     │
│     setPrompt(data.refinedPrompt)                              │
│                                                                 │
│   Lines 125-130: Set chat history with image ID                │
│     const historyWithImage = data.initialChatHistory.map(      │
│       (msg, idx) =>                                            │
│         idx === 0 && msg.role === 'user'                       │
│           ? { ...msg, imageId: selectedMural.id }              │
│           : msg                                                 │
│     )                                                           │
│     setChatHistory(historyWithImage)                           │
│                                                                 │
│   Lines 132-135: Show success notification                     │
│     setNotification({                                          │
│       type: 'success',                                         │
│       message: 'Prompt analyzed! Continue refining in chat.'   │
│     })                                                          │
│ }                                                               │
│                                                                 │
│ Lines 151-152: Clear loading states                            │
│   setAnalyzing(false)                                          │
│   setChatLoading(false)                                        │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 13. UI UPDATE                                                   │
│ File: app/generate/page.tsx                                     │
├─────────────────────────────────────────────────────────────────┤
│ - Chat modal is already open (from line 106)                   │
│ - Chat history displays in modal (lines 544-583)               │
│   - User message with reference image (lines 545-561)          │
│   - AI response with conversationalResponse (lines 562-582)    │
│ - Prompt textarea updated with refinedPrompt (line 392)        │
│ - Success notification appears (lines 315-338)                 │
│ - User can now continue refining or generate                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### 1. Frontend Component
**File:** `app/generate/page.tsx`
- Button definition: Line 372
- Click handler: Lines 99-154
- UI state management: Lines 30-50
- Chat modal rendering: Lines 521-628

### 2. API Route
**File:** `app/api/chat-refine-prompt/route.ts`
- POST handler: Lines 7-99
- Initial analysis case: Lines 11-56
- Chat refinement case: Lines 58-93

### 3. Storage/Image Module
**File:** `lib/features/mural-generator/storage.ts`
- `getReferenceMuralImage()`: Lines 100-118
- `readImageAsBase64()`: Lines 73-76
- `getMimeType()`: Lines 81-95

### 4. AI Integration
**File:** `lib/features/mural-generator/gemini.ts`
- Gemini client initialization: Lines 18-27
- `refinePromptWithChat()`: Lines 138-205
- API call with structured output: Lines 179-187
- Response parsing: Lines 189-200

### 5. Prompts & Instructions
**File:** `lib/features/mural-generator/prompts.ts`
- `CHAT_REFINEMENT_SYSTEM_INSTRUCTION`: Lines 79-102
- `chatRefinementSchema`: Lines 107-111

### 6. Type Definitions
**File:** `lib/features/mural-generator/types.ts`
- `ChatRefinementResponse` interface
- Related type definitions

---

## Environment Variables Used

1. **GEMINI_API_KEY** - Required for Gemini API authentication
   - Used in: `lib/features/mural-generator/gemini.ts:24`

2. **GEMINI_CHAT_MODEL** - Optional model selection
   - Default: `'gemini-2.5-flash'`
   - Used in: `lib/features/mural-generator/gemini.ts:145`

---

## Data Flow Summary

```
User Input (button click)
    ↓
Frontend State (analyzing, chatLoading, showChatModal)
    ↓
API Request (POST /api/chat-refine-prompt)
    ↓
Database Query (reference_murals table)
    ↓
File System (read image as base64)
    ↓
Gemini API (with image + system instruction + schema)
    ↓
Structured JSON Response (validated by Zod)
    ↓
API Response (with chat history)
    ↓
Frontend State Update (prompt, chatHistory, notification)
    ↓
UI Render (modal with chat, textarea with prompt)
```

---

## Notes

- **Initial Analysis:** Triggered when `chatHistory` is empty
- **Image Handling:** Reference image sent as inline base64 data to Gemini
- **Structured Output:** Uses Zod schema + zodToJsonSchema for type-safe responses
- **Dual Mode:** Same system instruction handles both initial analysis and refinement
- **Chat Modal:** Opens immediately on button click, shows loading state
- **No Code Generation:** This flow only analyzes and creates the prompt; actual mural generation is a separate flow

