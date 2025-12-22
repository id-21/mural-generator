# Gemini Image Generation - Complete Guide

A comprehensive guide for creating artistic and photorealistic images with Gemini's image generation capabilities.

---

## Technical Configuration

### Model Selection

```javascript
model: "gemini-2.5-flash-image"
```

The specialized model for image generation and editing tasks.

### Aspect Ratio Control

```javascript
config: {
  imageConfig: {
    aspectRatio: "16:9"  // Options: "1:1", "3:4", "4:3", "16:9", "9:16"
  }
}
```

**Use cases:**
- `"1:1"` - Square compositions, social media posts, logos
- `"3:4"` or `"4:3"` - Classic photography, portrait/landscape
- `"16:9"` - Cinematic wide shots, panoramas
- `"9:16"` - Vertical/mobile content, stories

### Response Modalities

```javascript
config: {
  responseModalities: ['Image']  // Image only, no text
}
// Default is ['Text', 'Image'] - returns both
```

Use `['Image']` when you only want visual output without explanatory text.

### System Instructions

```javascript
config: {
  systemInstruction: "You are a master of Art Nouveau design. Every image should embody organic flowing lines, natural motifs, and elegant curves with a vintage aesthetic."
}
```

Guides the overall aesthetic direction across all generations in a session.

### Temperature (for accompanying text)

```javascript
config: {
  temperature: 1.0  // Keep at default for Gemini 2.5+
}
```

Affects text generation, not image generation directly.

### Processing the Response

```javascript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: prompt,
});

for (const part of response.parts) {
  if (part.inlineData) {
    const buffer = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync("output.png", buffer);
  }
  if (part.text) {
    console.log(part.text);  // Optional text explanation
  }
}
```

Images are returned as base64-encoded PNG data in `part.inlineData.data`.

---

## Input Methods

### Text-to-Image

```javascript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: "A serene Japanese garden at dawn...",
});
```

Generate images from text descriptions alone.

### Image + Text (Editing)

```javascript
import * as fs from "node:fs";

const base64Image = fs.readFileSync("input.jpg", { encoding: "base64" });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: [
    { text: "Add cherry blossoms falling in this scene" },
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image
      }
    }
  ],
});
```

Edit existing images by providing image + instructions.

### Multiple Images (Composition/Style Transfer)

```javascript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: [
    { text: "Combine the subject from image 1 with the background from image 2" },
    { inlineData: { mimeType: "image/png", data: base64Image1 } },
    { inlineData: { mimeType: "image/png", data: base64Image2 } }
  ],
});
```

**Limitations:**
- Works best with up to 3 input images
- Total inline data limit: 20MB per request
- For larger files, use Files API instead

### Using Files API for Large Images

```javascript
import { createUserContent, createPartFromUri } from "@google/genai";

const uploadedFile = await ai.files.upload({
  file: "large-reference.jpg",
  config: { mimeType: "image/jpeg" }
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: createUserContent([
    "Transform this into watercolor style",
    createPartFromUri(uploadedFile.uri, uploadedFile.mimeType)
  ]),
});
```

Recommended for files >20MB or when reusing the same image multiple times.

---

## Multi-Turn Iterative Refinement

```javascript
const chat = ai.chats.create({
  model: "gemini-2.5-flash-image",
  history: []
});

// First generation
const gen1 = await chat.sendMessage({
  message: "Create a mystical forest scene with glowing mushrooms"
});

// Refine
const gen2 = await chat.sendMessage({
  message: "Make the lighting warmer and add a deer in the clearing"
});

// Further refine
const gen3 = await chat.sendMessage({
  message: "Change the deer's pose to drinking from a stream"
});
```

Use chat mode for progressive refinement - the model maintains context of previous images.

---

## Image Generation Modes

### Text → Image
Generate new images from descriptions.

### Text + Image → Image (Editing)
- Add/remove elements
- Modify specific parts
- Change colors, lighting, style
- Replace objects

### Multiple Images → Image (Composition)
- Combine subjects from different images
- Apply style from one image to another
- Place logos/elements onto products
- Fashion try-ons

### Interleaved (Text + Images → Images + Text)
Generate multiple related images with explanatory text.

Example: "Generate an illustrated recipe for paella" produces step-by-step images with instructions.

---

## Technical Limitations

**Language Support:**
Best performance in: English, Spanish (Mexico), Japanese, Chinese (Simplified), Hindi

**Input Constraints:**
- Maximum 3 input images for best results
- 20MB total request size for inline data
- Image generation does NOT support audio or video inputs

**Output Behavior:**
- Model may not generate exact number of images requested
- Default output: 1:1 aspect ratio if not specified
- With input image: matches input aspect ratio unless overridden
- All generated images include SynthID watermark

**Regional Restrictions:**
- Uploading images of children not supported in EEA, CH, UK

**Text in Images:**
- For best results: generate text first, then request image with that text
- Model has high-fidelity text rendering capabilities

---

# Descriptive Prompting Best Practices

## The Golden Rule: Narrative Over Keywords

The fundamental principle of Gemini image generation is this: **describe the scene, don't just list keywords.** The model's strength lies in its deep language understanding. A narrative, descriptive paragraph will almost always produce better, more coherent images than a list of disconnected words.

**Bad:** "sunset, mountains, lake, purple, dramatic, 4k"

**Good:** "A dramatic sunset over snow-capped mountains, with a perfectly still alpine lake in the foreground reflecting the vibrant purple and orange sky. The scene captures the last rays of golden light touching the mountain peaks while the valley below falls into soft shadow."

## Hyper-Specificity

The more detail you provide, the more control you have over the output. Don't settle for generic descriptors—be precise and evocative. Instead of "fantasy armor," describe it as "ornate elven plate armor, etched with silver leaf patterns depicting intertwined vines, with a high collar and pauldrons shaped like falcon wings spreading upward." Instead of "old house," write "a weathered Victorian mansion with peeling sage-green paint, broken shutters hanging at odd angles, and wild roses climbing up the sagging front porch."

The model responds well to sensory details, material descriptions, and specific visual references. If you can see it in your mind's eye with clarity, describe it with that same clarity.

## Context and Intent

Always explain the *purpose* and *context* of the image you're creating. The model's understanding of intent will influence its compositional choices, lighting decisions, and overall aesthetic. "Create a logo for a high-end, minimalist skincare brand targeting wellness-conscious millennials" will yield dramatically better results than simply "create a logo." The context tells the model about the intended audience, emotional tone, and design philosophy that should guide the generation.

Similarly, describing the setting and situation helps the model make coherent decisions about all the elements it hasn't been explicitly told about. "A professional headshot for a corporate attorney's LinkedIn profile" immediately suggests formal attire, neutral background, confident posture, and professional lighting—even if you don't specify those elements.

## Art Movements and Style References

When creating artistic pieces, explicitly reference art movements, periods, and specific artists. The model has been trained on art history and understands these references deeply. You can invoke "Impressionism," "Art Nouveau," "Cubist interpretation," "Baroque grandeur," "Minimalist aesthetic," or "Japanese Ukiyo-e woodblock style."

You can also reference specific artists and even specific works: "in the style of Vincent van Gogh's 'Starry Night'" or "Gustav Klimt's golden period aesthetic" or "reminiscent of Edward Hopper's use of light and isolation." These references provide a rich shorthand for entire visual languages—color palettes, brushwork styles, compositional approaches, and emotional tones.

## Visual and Compositional Language

### Camera and Perspective
Borrow from photography and cinematography to control viewpoint and composition. Describe the "shot type"—is it a "wide-angle establishing shot," a "medium close-up," a "macro detail," or an "extreme wide panorama"? Specify the camera angle: "low-angle perspective looking up," "bird's eye view looking down," "eye-level straight-on shot," or "Dutch angle for dramatic tension."

These terms help the model understand spatial relationships and the viewer's position relative to the subject. A low-angle shot makes subjects feel powerful and imposing; a bird's eye view creates pattern and abstraction; a macro shot emphasizes intimate detail.

### Composition Rules
Reference classical composition techniques: "rule of thirds composition with the subject in the right third," "centered symmetrical composition," "dynamic diagonal leading lines," "circular composition drawing the eye inward," or "negative space emphasizing isolation." The model understands these visual grammar rules and can apply them effectively.

### Depth and Focus
Control depth of field with photographic language. "Shallow depth of field with soft bokeh background" creates portrait-style subject isolation. "Everything in sharp focus from foreground to background" works for landscape scenes. "Selective focus on the character's eyes while the rest falls into soft blur" directs viewer attention precisely.

## Lighting and Atmosphere

Lighting is perhaps the single most important element in creating mood and visual interest. Be specific about light quality, direction, color temperature, and atmospheric effects.

### Light Quality and Direction
Describe whether light is "soft and diffused," "hard with sharp shadows," "dappled through leaves," or "dramatic with high contrast." Specify direction: "backlit with a glowing rim light," "side-lit emphasizing texture," "overhead harsh midday light," or "soft light from a window on the left." Golden hour light is warm and nostalgic; blue hour light is cool and melancholic; harsh noon light is stark and revealing.

### Atmospheric Mood
Light creates atmosphere, but you should also describe the emotional quality you're after: "moody and introspective," "bright and optimistic," "eerie and unsettling," "serene and contemplative," "energetic and vibrant," or "dreamlike and ethereal." The model will adjust lighting, color grading, and compositional elements to match these emotional directives.

### Color Temperature and Palette
Be specific about color: "warm palette dominated by ochres, burnt sienna, and golden yellows" or "cool palette of prussian blues, slate grays, and pale lavenders." You can specify color relationships: "complementary colors creating vibrant contrast," "analogous harmony for visual cohesion," "monochromatic scheme with tonal variation." Describe saturation: "highly saturated vibrant colors," "desaturated muted tones," or "black and white with a single accent color."

## Texture and Material Details

Great images have textural richness. Describe surface qualities, materials, and visual techniques. For painting styles, mention "smooth blended gradients," "visible impasto brushstrokes with dimensional texture," "delicate cross-hatching," "loose gestural marks," or "precise stippling dots."

For materials and surfaces, be specific: "weathered copper with green patina," "polished marble with subtle veining," "rough burlap fabric," "glossy enamel finish," or "matte chalky surface." These material descriptions help the model render believable, tactile-feeling surfaces.

## Step-by-Step Instructions for Complex Scenes

When you're creating intricate compositions with multiple elements, break your prompt into sequential steps. This helps the model build the scene layer by layer with proper spatial relationships: "First, create a background of a serene misty forest at dawn with soft blue-gray light filtering through the trees. Then, in the middle ground, add a moss-covered stone altar with ancient carved symbols. Finally, in the foreground, place a single glowing sword standing upright, embedded in the altar stone, with magical runes running along the blade."

This sequential approach helps ensure that background, middle ground, and foreground elements are properly composed and that later elements are integrated into the established scene rather than competing with it.

## Editing-Specific Prompt Patterns

When editing existing images, use clear command language that specifies what should change and what should remain constant.

**Preservation Language:** "Using the provided image, change only the [specific element] to [new element]. Keep everything else in the image exactly the same, preserving the original style, lighting, composition, and all other elements."

**Integration Language:** "Add [element] to the scene. Ensure it matches the existing lighting, shadows, and perspective. The addition should look natural and integrated, not pasted on."

**Replacement Language:** "Replace the [old element] with [new element] while maintaining the same position, scale, and relationship to other objects in the scene."

Be explicit about what stays and what changes. The model is quite capable of selective editing, but it needs clear direction.

## Semantic Positive Framing

Instead of telling the model what *not* to include (negative prompts), describe what you *do* want in positive terms. Rather than "no cars, no people, no buildings," say "an empty, pristine wilderness landscape with untouched natural vegetation and no signs of human presence." This positive framing gives the model clear direction about what to generate rather than what to avoid, which tends to produce more coherent results.

## Iterative Refinement Workflow

Don't expect perfection on the first generation. Embrace the conversational, iterative nature of the model. Generate an initial image, then make targeted adjustments: "That's great, but can you make the lighting a bit warmer?" or "Keep everything the same, but change the character's expression to be more contemplative and introspective" or "Add more texture and detail to the foreground elements."

Small, specific refinements allow you to progressively guide the image toward your vision while building on what's already working. This is especially powerful in chat mode, where the model maintains context across turns.

## Prompt Structure Template

A well-structured prompt typically follows this pattern:

**[Art Style/Movement/Reference]** + **[Subject and Action]** + **[Setting/Environment]** + **[Lighting Description]** + **[Mood/Atmosphere]** + **[Compositional Direction]** + **[Material/Texture Details]** + **[Color Palette]** + **[Technical Specs]**

**Example:**
"A watercolor painting in the style of Winslow Homer, depicting a solitary lighthouse keeper standing on rocky cliffs, gazing out at a stormy sea with massive waves crashing below. The scene is set during a dramatic sunset with breaks in the storm clouds allowing shafts of golden light to illuminate the turbulent water. The mood is contemplative and melancholic, capturing the isolation and majesty of nature. Composed with the lighthouse in the right third of the frame using the rule of thirds, with dramatic diagonal leading lines from the cliff face. The watercolor technique features loose, flowing washes for the sky and sea, with detailed drybrush work on the rocks. The palette is dominated by stormy grays, deep blues, and warm sunset oranges creating dramatic contrast. Horizontal landscape orientation."

Not every prompt needs every element, but this structure ensures you're thinking about all the visual dimensions that contribute to a compelling image.

---

## Common Use Case Templates

### Photorealistic Photography

```
A photorealistic [shot type] of [subject], [action/expression], set in
[environment]. The scene is illuminated by [lighting description], creating
a [mood] atmosphere. Captured with a [camera/lens details], emphasizing
[key textures and details]. [Aspect ratio format].
```

### Artistic/Painterly Works

```
A [art movement/style] [medium] depicting [subject] engaged in [action]
within [setting]. The piece employs [technique details] with [brushwork/mark-making].
The color palette features [colors and relationships]. The composition uses
[compositional approach]. The overall mood is [emotional tone].
```

### Logo/Graphic Design

```
Create a [style] logo for [brand/concept] with the text "[text content]" in
a [font style]. The design should feature [visual elements] and convey
[brand attributes]. Color scheme: [colors]. The design should be [design philosophy].
```

### Product Photography

```
A high-resolution, studio-lit product photograph of [product description]
on a [surface/background]. The lighting is a [lighting setup] to [purpose].
The camera angle is [angle] to showcase [feature]. Ultra-realistic, with
sharp focus on [detail]. [Aspect ratio].
```

### Image Editing - Element Addition

```
Using the provided image of [subject], add [element] to [location].
Ensure the addition [integration requirements—matches lighting, shadows, perspective].
The [element] should [specific details about how it should appear].
```

### Image Editing - Element Replacement

```
Using the provided image, change only the [specific element] to be [new element].
Keep everything else exactly the same, preserving the original style, lighting,
colors, composition, and all other elements unchanged.
```

### Style Transfer

```
Transform the provided photograph of [subject] into the artistic style of
[artist/movement]. Preserve the original composition and subject matter,
but render all elements with [stylistic characteristics—brushwork, color approach,
technique]. The result should embody [aesthetic qualities] while maintaining
recognizable [what to preserve].
```

### Multi-Image Composition

```
Create a new image by combining elements from the provided images. Take the
[element from image 1] and place it [relationship] the [element from image 2].
The final composition should show [scene description]. Ensure lighting and
shadows are adjusted to create a cohesive, realistic integration.
```

---

## Quick Tips Summary

- **Write paragraphs, not lists** - Narrative descriptions produce better results
- **Be hyper-specific** - Detail trumps brevity for visual quality
- **State your intent** - Context helps the model make better aesthetic choices
- **Use art/photo vocabulary** - The model understands technical and artistic terminology
- **Layer in complexity** - Use step-by-step for multi-element scenes
- **Frame positively** - Say what you want, not what you don't want
- **Iterate conversationally** - Refine through multiple turns
- **Specify preservation** - When editing, be explicit about what shouldn't change
- **Control composition** - Use framing, perspective, and layout terminology
- **Describe light thoroughly** - Lighting creates mood and visual interest

---

## Resources

- [Google AI Studio](https://aistudio.google.com) - Test and refine prompts visually
- [Gemini API Reference](https://ai.google.dev/api) - Full technical documentation
- [SynthID Watermarks](https://ai.google.dev/responsible/docs/safeguards/synthid) - About image watermarking
