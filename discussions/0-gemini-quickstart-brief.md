# Gemini API Quick Start Guide

A concise guide for building Gemini-powered JavaScript applications with text generation, image understanding, image generation, and multi-turn conversations.

---

## Setup

### Installation

```bash
npm install @google/genai
```

### API Key

Set your API key as an environment variable (recommended):
```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or get one at [Google AI Studio](https://aistudio.google.com/app/apikey)

### Basic Initialization

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});  // Picks up GEMINI_API_KEY automatically
```

---

## Text Generation

### Simple Text Generation

```javascript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Explain how AI works in a few words",
});
console.log(response.text);
```

### With System Instructions

```javascript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Hello there",
  config: {
    systemInstruction: "You are a cat. Your name is Neko.",
    temperature: 0.1,  // Keep at 1.0 for Gemini 3 models
  },
});
```

---

## Working with Images

### Pass Image as Base64 (Inline Data)

For images under 20MB total request size:

```javascript
import * as fs from "node:fs";

const base64Image = fs.readFileSync("path/to/image.jpg", {
  encoding: "base64"
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image,
      },
    },
    { text: "What's in this image?" },
  ],
});
```

### Upload Image with Files API

For larger files or reusing images:

```javascript
import { createUserContent, createPartFromUri } from "@google/genai";

const uploadedFile = await ai.files.upload({
  file: "path/to/image.jpg",
  config: { mimeType: "image/jpeg" },
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
    "Describe this image in detail.",
  ]),
});
```

### Multiple Images

```javascript
const contents = createUserContent([
  "What's different between these images?",
  createPartFromUri(image1.uri, image1.mimeType),
  { inlineData: { mimeType: "image/png", data: base64Image2 } },
]);

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents,
});
```

---

## Image Generation

### Generate Image from Text

```javascript
import * as fs from "node:fs";

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: "A photorealistic sunset over mountains with a lake in the foreground",
});

for (const part of response.parts) {
  if (part.inlineData) {
    const buffer = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync("generated-image.png", buffer);
    console.log("Image saved");
  }
}
```

### Edit an Existing Image

```javascript
const imageData = fs.readFileSync("original.png");
const base64Image = imageData.toString("base64");

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: [
    { text: "Add a wizard hat to this cat" },
    {
      inlineData: {
        mimeType: "image/png",
        data: base64Image
      }
    },
  ],
});

// Save edited image
for (const part of response.parts) {
  if (part.inlineData) {
    fs.writeFileSync("edited-image.png",
      Buffer.from(part.inlineData.data, "base64")
    );
  }
}
```

### Control Aspect Ratio

```javascript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: "A modern logo design",
  config: {
    imageConfig: {
      aspectRatio: "16:9",  // or "1:1", "3:4", etc.
    },
  },
});
```

---

## Multi-Turn Conversations (Chat)

### Basic Chat

```javascript
const chat = ai.chats.create({
  model: "gemini-2.5-flash",
  history: [
    {
      role: "user",
      parts: [{ text: "Hello, I'm learning about space" }],
    },
    {
      role: "model",
      parts: [{ text: "Great! What would you like to know?" }],
    },
  ],
});

const response1 = await chat.sendMessage({
  message: "How many planets are in our solar system?",
});
console.log(response1.text);

const response2 = await chat.sendMessage({
  message: "Which one is the largest?",
});
console.log(response2.text);
```

### Chat with Streaming

```javascript
const stream = await chat.sendMessageStream({
  message: "Tell me about Mars",
});

for await (const chunk of stream) {
  console.log(chunk.text);
}
```

---

## Key Models

- **gemini-2.5-flash**: Fast, balanced, 1M token context
- **gemini-2.5-pro**: Best for complex reasoning and coding
- **gemini-2.5-flash-image**: For image generation/editing
- **gemini-3-flash**: Latest frontier-class performance

---

## Tips

1. **Images**: Supported formats: PNG, JPEG, WEBP, HEIC, HEIF
2. **Inline vs Upload**: Use inline for <20MB, Files API for larger files
3. **Temperature**: Keep at 1.0 for Gemini 3 models, adjust for older models
4. **Thinking**: Gemini 2.5 models have thinking enabled by default (disable with `thinkingConfig: { thinkingBudget: 0 }`)
5. **Image prompts**: Be descriptive, not just keywords—"A photorealistic portrait of..." works better than "portrait, realistic"

---

## Resources

- [Google AI Studio](https://aistudio.google.com) - Test prompts and manage API keys
- [API Reference](https://ai.google.dev/api)
- [Developer Community](https://discuss.ai.google.dev/c/gemini-api/4)
