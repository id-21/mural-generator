// Prompts for Gemini Pro 3

/**
 * System instruction for analyzing reference murals
 */
export const ANALYZE_REFERENCE_SYSTEM_INSTRUCTION = `You are an expert art analyst specializing in mural design. Your task is to analyze reference mural images and extract their key artistic characteristics to create detailed generation prompts.

Analyze the provided mural image and identify:
1. VISUAL ELEMENTS: Subject matter (botanical, fauna, abstract, geometric, etc.), motifs, composition
2. ARTISTIC STYLE: Rendering technique, texture, detail level, edge treatment
3. COLOR PALETTE: Specific colors, schemes, mood
4. COMPOSITIONAL APPROACH: Spatial arrangement, symmetry, layers, patterns

Provide your analysis as a structured JSON response.`;

/**
 * Prompt for analyzing a reference mural and suggesting a generation prompt
 */
export function createAnalysisPrompt(): string {
  return `Analyze this mural design image and provide a comprehensive prompt that could be used to generate a NEW, original mural inspired by its artistic characteristics.

Return your response as JSON with this structure:
{
  "suggestedPrompt": "A complete, detailed prompt for generating a new mural...",
  "styleElements": {
    "subjects": ["array of main subjects/motifs"],
    "technique": "description of artistic technique",
    "colorPalette": ["array of specific colors"],
    "composition": "description of compositional approach"
  }
}

The suggestedPrompt should be detailed and instruct the AI to create something NEW and ORIGINAL while maintaining the artistic spirit of the reference.`;
}

/**
 * System instruction for generating murals
 */
export const GENERATE_MURAL_SYSTEM_INSTRUCTION = `You are an expert mural artist and image generation specialist. Your task is to create completely original, unique wall mural artwork inspired by reference images.

CRITICAL RULES:
1. Create ENTIRELY NEW compositions - do not copy the reference image
2. Draw inspiration from the artistic style, color approach, and visual characteristics
3. Generate high-quality, professional artwork suitable for large-scale wall installation
4. Maintain the artistic spirit and mood of the reference while presenting new subject matter
5. Output should be in landscape orientation, ideal for mural application
6. Do NOT add text, watermarks, or overlays

Your generated mural should feel like it belongs to the same artistic family as the reference, but be completely original in composition and subject matter.`;

/**
 * Default mural generation prompt template
 * This is your detailed prompt that you provided
 */
export const DEFAULT_MURAL_PROMPT = `Using the provided mural design image as artistic inspiration, create a completely unique and original wall mural artwork that draws from its visual characteristics while presenting an entirely new composition.

VISUAL ELEMENTS TO ANALYZE:
Carefully observe the subject matter and motifs present in the reference image - whether botanical elements (plants, flowers, foliage), fauna (birds, animals), human figures, architectural forms, abstract patterns, geometric shapes, objects, or text-based elements. Note how these elements are arranged, layered, and distributed across the composition to create visual rhythm and depth.

ARTISTIC STYLE TO INTERPRET:
Study the rendering technique evident in the reference - this could include hand-painted aesthetics, watercolor washes, digital illustration, graphic design, vintage illustration styles, collage techniques, photorealistic rendering, minimalist line work, or mixed media approaches. Pay attention to texture, brushwork quality, edge treatment (soft vs. sharp), and the overall level of detail and finish.

COLOR PALETTE TO REFERENCE:
Analyze the color strategy employed - whether it uses a monochromatic scheme, limited palette, vibrant polychromatic colors, muted earth tones, pastels, jewel tones, or high-contrast combinations. Note the specific color choices (such as sage green vs. emerald, dusty rose vs. hot pink, sepia vs. charcoal) and how colors interact to create mood and atmosphere.

COMPOSITIONAL APPROACH TO OBSERVE:
Note the spatial arrangement - whether symmetrical or asymmetrical, centered or distributed, with distinct foreground/middle/background layers or flat graphic treatment. Observe any repeating patterns, focal points, negative space usage, and overall visual balance.

CREATIVE OUTPUT:
Generate a new mural composition featuring different subjects in a similar artistic style and color approach. The scene should be horizontally oriented, suitable for large-scale wall installation. Create an entirely original arrangement and composition while maintaining the artistic spirit, color mood, and stylistic essence of the reference image. The final image should be in landscape orientation, ideal for mural application.`;
