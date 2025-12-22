# Mural Generator

A local Next.js application that uses Gemini Pro 3 to generate AI murals inspired by reference designs.

## Features

- 🎨 **Reference Library**: Import and browse mural designs from your local directory
- 🤖 **AI Analysis**: Let Gemini analyze reference images and suggest generation prompts
- ✏️ **Custom Prompts**: Write your own prompts or edit AI-suggested ones
- 💾 **Local Storage**: All generated murals saved to organized local directories
- 📊 **SQLite Database**: Lightweight local database for tracking generations

## Prerequisites

- Node.js 18+ installed
- Gemini Pro 3 API key
- Reference mural images in a local directory

## Setup

### 1. Configure Environment Variables

Edit `.env.local` with your settings:

```env
# Gemini AI Configuration
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-pro-3  # Or whatever the Gemini Pro 3 model name is

# Local File Paths
REFERENCE_MURALS_PATH=/Users/ishan-aiworkspace/Documents/Coordonne Sitemaps/mural-images
GENERATED_MURALS_OUTPUT_PATH=/Users/ishan-aiworkspace/Documents/Murals Generated - ComfyUI
```

### 2. Install Dependencies

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### 3. Initialize Database

Database is already initialized. If you need to reset it:

```bash
npx prisma db push
npx prisma generate
```

## Usage

### Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Workflow

1. **Import Reference Murals**
   - On the home page, click "Import Reference Murals"
   - This scans your `REFERENCE_MURALS_PATH` directory
   - Imports all files ending with `-design.jpg` or `-design.png`
   - Only imports new files (won't duplicate)

2. **Generate a Mural**
   - Click "Generate New Mural"
   - Select a reference mural from your library
   - Choose between:
     - **AI Analyze Prompt**: Gemini analyzes the image and suggests a prompt
     - **Write Custom Prompt**: Write your own generation prompt
   - Edit the prompt if needed
   - Click "Generate Mural"

3. **View Results**
   - Generated mural appears in the preview
   - Automatically saved to: `{GENERATED_MURALS_OUTPUT_PATH}/{collection}/{design}/generated-{timestamp}-{colorVariant}.png`
   - All generations tracked in the database

## Directory Structure

### Reference Murals Input
```
/Users/ishan-aiworkspace/Documents/Coordonne Sitemaps/mural-images/
├── collection-name/
│   ├── design-name/
│   │   ├── color-variant-1/
│   │   │   ├── design-name-color-variant-1-design.jpg  ← IMPORTED
│   │   │   ├── design-name-color-variant-1-roomshot-01.jpg
│   │   │   └── ...
│   │   └── color-variant-2/
│   │       └── design-name-color-variant-2-design.jpg  ← IMPORTED
│   └── ...
└── ...
```

### Generated Murals Output
```
/Users/ishan-aiworkspace/Documents/Murals Generated - ComfyUI/
├── collection-name/
│   ├── design-name/
│   │   ├── generated-2024-12-22-14-30-45-color-variant-1.png
│   │   ├── generated-2024-12-22-15-20-10-color-variant-2.png
│   │   └── ...
│   └── ...
└── ...
```

## Database

The app uses SQLite (local file database) with Prisma ORM.

- **Database File**: `prisma/mural-generator.db`
- **View Database**: Run `npx prisma studio` to open a visual database browser

### Database Tables

**reference_murals**
- Stores metadata for imported reference images
- Fields: collection, design, color variant, file path

**generated_murals**
- Tracks all generation history
- Fields: reference ID, prompt, output file path, timestamps

## Troubleshooting

### Error: "GEMINI_API_KEY not set"
- Add your Gemini API key to `.env.local`

### Error: "REFERENCE_MURALS_PATH not configured"
- Set the path to your reference images directory in `.env.local`

### No reference murals found
- Click "Import Reference Murals" on the home page
- Check that your directory contains files ending with `-design.jpg`

### Generation fails
- Check that your Gemini API key is valid
- Verify the model name is correct for Gemini Pro 3
- Check console for detailed error messages

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npx prisma studio` - Open database browser
- `npx prisma db push` - Update database schema

## Tech Stack

- **Framework**: Next.js 16
- **Database**: SQLite + Prisma ORM
- **AI**: Gemini Pro 3 (via @google/genai)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Notes

- This is a **local-only** application (no authentication, no cloud services)
- All data stays on your machine
- Reference images are read from their original location (not copied)
- Generated images are saved to your local filesystem
- Database is a single `.db` file in the `prisma/` directory
