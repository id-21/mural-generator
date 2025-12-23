# 🎨 AI Mural Generator

> Create original, seamless wall mural designs using Google Gemini AI, inspired by your reference library.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Gemini](https://img.shields.io/badge/Gemini-AI-orange) ![License](https://img.shields.io/badge/license-ISC-green)

A **local-first** Next.js application that uses AI to generate unique, horizontally-tileable mural artwork. Import your reference designs, refine prompts through conversational AI, and build a gallery of AI-generated variations—all stored locally on your machine.

---

## ✨ Features

- 🖼️ **Reference Library Browser** - Hierarchical collection/design/variant organization with collapsible accordion UI
- 🤖 **AI-Powered Prompt Refinement** - Chat-based interface to iteratively improve generation prompts
- 🎨 **Seamless Mural Generation** - Creates horizontally-tileable patterns suitable for wall installations
- 📸 **Full-Screen Gallery** - Keyboard-navigable (←/→) immersive viewing experience
- 💾 **100% Local Storage** - All images and data stay on your machine (SQLite + filesystem)
- 🔄 **Generation History** - Track every mural with metadata (prompt, model, timestamp)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** installed
- **Google Gemini API key** ([Get one here](https://ai.google.dev/))
- Reference mural images organized in local directories

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/id-21/redesigned-chainsaw.git
   cd mural-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root:
   ```bash
   # Google Gemini API
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-2.5-flash-image             # Optional (default: gemini-2.5-flash-image)
   GEMINI_CHAT_MODEL=gemini-2.5-flash              # Optional (default: gemini-2.5-flash)

   # Local File Paths (use absolute paths)
   REFERENCE_MURALS_PATH=/absolute/path/to/reference/murals
   GENERATED_MURALS_OUTPUT_PATH=/absolute/path/to/output/folder
   ```

4. **Initialize database**
   ```bash
   npm run db:generate    # Generate Prisma client
   npm run db:push        # Create SQLite database + tables
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser 🎉

---

## 📖 Usage Workflow

### 1️⃣ Import Reference Murals

Navigate to the home page and click **"Import Reference Murals"**. The app scans your `REFERENCE_MURALS_PATH` directory for images ending with `-design.jpg` or `-design.png`.

**Expected directory structure:**
```
reference-murals/
├── collection-name/
│   └── design-name/
│       └── color-variant/
│           └── design-name-variant-design.jpg  ← Imported
```

### 2️⃣ Browse Your Library

Click **"Browse Reference Library"** to explore your collections. Collections are organized hierarchically with:
- Collapsible collection sections
- 2-column grid of design families
- Horizontal scrollable color variant thumbnails

Click any variant to proceed to generation.

### 3️⃣ Generate a Mural

**Option A: AI Analyze Prompt** (Recommended)
1. Click **"AI Analyze Prompt"** to open the chat modal
2. Gemini analyzes the reference image and creates a detailed prompt
3. Refine via conversation: *"Make it more colorful"*, *"Add tropical plants"*, etc.
4. Watch the prompt update in real-time on the right sidebar
5. Click **"Apply Refined Prompt"** when satisfied

**Option B: Write Custom Prompt**
1. Click **"Write Custom Prompt"**
2. Enter your own prompt in the textarea
3. Skip the AI analysis entirely

Then click **"Generate Mural"** and wait for the AI to create your design!

### 4️⃣ View in Gallery

Click **"View Gallery"** to browse all generated murals:
- Full-screen immersive layout
- Navigate with **←/→ arrow keys**
- See prompt, reference thumbnail, and metadata
- Click "Generate Similar" to create variations

---

## 📂 File Storage Structure

### Input (Reference Murals)
```
{REFERENCE_MURALS_PATH}/
└── {collection}/
    └── {design}/
        └── {color-variant}/
            └── *-design.jpg    # Only -design.jpg/png files are imported
```

### Output (Generated Murals)
```
{GENERATED_MURALS_OUTPUT_PATH}/
└── {collection}/
    └── {design}/
        └── generated-{timestamp}-{variant}.png
```

**Example:**
```
generated-2024-12-23-14-30-45-galaxy-azul-oscuro.png
```

---

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (localhost:3000) |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Apply schema changes to SQLite |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

---

## 🏗️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library:** [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Database:** [Prisma](https://www.prisma.io/) + SQLite
- **AI Provider:** [Google Gemini API](https://ai.google.dev/) (`@google/genai`)
- **Validation:** [Zod](https://zod.dev/) + `zod-to-json-schema`
- **Language:** [TypeScript 5](https://www.typescriptlang.org/)

---

## 🗂️ Database Schema

The app uses a local SQLite database (`prisma/mural-generator.db`) with two main tables:

**ReferenceMural** - Imported reference images
- `id`, `collectionName`, `designName`, `colorVariant`
- `localFilePath` (unique), `fileName`, `importedAt`

**GeneratedMural** - AI-generated murals
- `id`, `referenceMuralId` (FK), `prompt`, `isCustomPrompt`
- `localFilePath`, `fileName`, `modelUsed`, `createdAt`

View your database with: `npm run db:studio`

---

## 🐛 Troubleshooting

**Error: "GEMINI_API_KEY environment variable is not set"**
- Add `GEMINI_API_KEY=your_key` to your `.env` file

**Error: "REFERENCE_MURALS_PATH not configured"**
- Set absolute path in `.env`: `REFERENCE_MURALS_PATH=/Users/you/path/to/murals`

**No reference murals found after import**
- Ensure files end with `-design.jpg` or `-design.png`
- Check directory structure matches the expected pattern (collection/design/variant)

**Generation fails or returns errors**
- Verify your Gemini API key is valid and has image generation enabled
- Check the console for detailed error messages
- Try with `GEMINI_MODEL=gemini-2.5-flash-image` in `.env`

**Chat refinement not working**
- Ensure `GEMINI_CHAT_MODEL` is set (defaults to `gemini-2.5-flash`)
- Check API quota/rate limits in Google AI Studio

---

## 📚 Developer Documentation

For detailed technical documentation, see **[CLAUDE.md](CLAUDE.md)** which includes:
- System architecture diagrams
- Data flow & lifecycle explanations
- Complete API endpoint specifications
- UI/UX component patterns
- Business logic implementation details
- Step-by-step guides for adding features

**Quick links:**
- [UI/UX Patterns](app/CLAUDE.md)
- [API Routes](app/api/CLAUDE.md)
- [Business Logic](lib/features/mural-generator/CLAUDE.md)

---

## 🔒 Privacy & Security

- **100% Local**: All data (images, database) stays on your machine
- **No Authentication**: Designed for trusted local environment (add auth before deploying publicly)
- **No Cloud Storage**: Images are served from your local filesystem via API routes
- **No Telemetry**: Zero tracking or analytics

---

## 📄 License

ISC License - See [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- Powered by [Google Gemini AI](https://ai.google.dev/)
- Built with [Next.js](https://nextjs.org/) and [Prisma](https://www.prisma.io/)
- UI styled with [Tailwind CSS](https://tailwindcss.com/)

---

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome! Please open an issue or submit a pull request.

---

**Made with ❤️ for mural designers and AI enthusiasts**
