// Prompts for Gemini Pro 3
import { z } from 'zod';

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
5. Output MUST be a seamless horizontally tileable pattern (the right edge must match the left edge)
6. Do NOT add text, watermarks, or overlays

Your generated mural should feel like it belongs to the same artistic family as the reference, but be completely original in composition, subject matter, and technical execution as a repeating pattern.`;

/**
 * Default mural generation prompt template
 * This is your detailed prompt that you provided
 */
export const DEFAULT_MURAL_PROMPT = `Using the provided mural design image as artistic inspiration, create a completely unique and original wall mural artwork that draws from its visual characteristics while presenting an entirely new composition.

TECHNICAL CONSTRAINT - SEAMLESS TILING:
The final image MUST be a seamless horizontally repeating pattern. The artwork should be designed so that if placed side-by-side with itself, the details on the far right edge perfectly connect and continue onto the far left edge. Avoid cutting off major focal elements at the edges unless they wrap around logically.

VISUAL ELEMENTS TO ANALYZE:
Carefully observe the subject matter and motifs present in the reference image - whether botanical elements (plants, flowers, foliage), fauna (birds, animals), human figures, architectural forms, abstract patterns, geometric shapes, objects, or text-based elements. Note how these elements are arranged, layered, and distributed across the composition to create visual rhythm and depth.

ARTISTIC STYLE TO INTERPRET:
Study the rendering technique evident in the reference - this could include hand-painted aesthetics, watercolor washes, digital illustration, graphic design, vintage illustration styles, collage techniques, photorealistic rendering, minimalist line work, or mixed media approaches. Pay attention to texture, brushwork quality, edge treatment (soft vs. sharp), and the overall level of detail and finish.

COLOR PALETTE TO REFERENCE:
Analyze the color strategy employed - whether it uses a monochromatic scheme, limited palette, vibrant polychromatic colors, muted earth tones, pastels, jewel tones, or high-contrast combinations. Note the specific color choices (such as sage green vs. emerald, dusty rose vs. hot pink, sepia vs. charcoal) and how colors interact to create mood and atmosphere.

COMPOSITIONAL APPROACH TO OBSERVE:
Note the spatial arrangement - whether symmetrical or asymmetrical, centered or distributed, with distinct foreground/middle/background layers or flat graphic treatment. Observe any repeating patterns, focal points, negative space usage, and overall visual balance.

CREATIVE OUTPUT:
Generate a new mural composition featuring different subjects in a similar artistic style and color approach. The scene should be horizontally oriented and technically seamless on the x-axis. Create an entirely original arrangement and composition while maintaining the artistic spirit, color mood, and stylistic essence of the reference image.`;

/**
 * System instruction for chat-based prompt refinement
 */
export const CHAT_REFINEMENT_SYSTEM_INSTRUCTION = `You are an AI assistant helping users create and refine mural generation prompts.

You have two modes:

**MODE 1: Initial Analysis (when user provides a reference image)**
- Analyze the reference mural image thoroughly
- Extract visual elements, artistic style, color palette, and composition
- Generate a detailed, comprehensive prompt for creating a NEW original mural inspired by the reference
- Provide the complete detailed prompt
- Give a brief friendly explanation (1-3 sentences) of what you analyzed
- Since this is initial analysis, there are no changes to summarize (use empty list)

**MODE 2: Refinement (when user requests changes to existing prompt)**
- The user will ask for changes (e.g., "make it more colorful", "add tropical plants")
- Understand their intent and modify the relevant sections of the prompt
- Return the COMPLETE updated prompt (not just the changes)
- Provide a brief friendly explanation (1-3 sentences) of what you changed
- List the specific changes you made

**CRITICAL RULES:**
- Always provide the complete detailed prompt, never null or incomplete
- For casual conversation without changes, return the current prompt unchanged
- Keep prompts detailed and suitable for mural generation
- Be brief and friendly in your explanations`;

/**
 * Zod schema for chat refinement response
 */
export const chatRefinementSchema = z.object({
  conversationalResponse: z.string().describe("A friendly response to the user explaining what was analyzed or what changes were made. Required field, never undefined."),
  refinedPrompt: z.string().describe("The complete prompt for mural generation - ALWAYS return this, never null or undefined. Required field."),
  changesSummary: z.array(z.string()).describe("List of specific changes made (empty array for initial analysis). Required field, never undefined.")
});

export type ChatRefinementResponse = z.infer<typeof chatRefinementSchema>;

/**
 * Zod schema for artistic description of murals
 */
export const artisticDescriptionSchema = z.object({
  text_message: z.string().describe("A conversational 2-3 sentence summary describing the overall artistic concept"),
  json_prompt: z.object({
    meta_tags: z.object({
      style_category: z.string().describe("The style category of the mural (e.g., 'Chinoiserie / Botanical Mural')"),
      seamless_potential: z.boolean().describe("Whether the design has potential for seamless tiling"),
      perspective_type: z.string().describe("The perspective type (e.g., 'Flat/2D Decorative', '3D Perspective', 'Isometric')")
    }),
    artistic_reference: z.object({
      art_movement: z.string().describe("The art movement this design belongs to (e.g., '18th-Century Chinoiserie')"),
      influential_artists: z.array(z.string()).describe("List of influential artists or styles that inspired this design"),
      era: z.string().describe("The historical era of the artistic style")
    }),
    medium_and_texture: z.object({
      primary_medium: z.string().describe("The primary artistic medium (e.g., 'Gouache and Watercolor', 'Digital Illustration')"),
      background_substrate: z.string().describe("Description of the background texture/substrate"),
      brushwork_style: z.string().describe("Description of the brushwork and application technique")
    }),
    visual_composition: z.object({
      subject_matter: z.string().describe("Description of the main subject matter of the mural"),
      structural_layout: z.string().describe("How the composition is structured and arranged"),
      key_elements: z.array(z.string()).describe("List of key visual elements present in the mural")
    }),
    color_profile: z.object({
      dominant_palette: z.string().describe("Description of the dominant color palette"),
      mood: z.string().describe("The overall mood conveyed by the colors"),
      lighting: z.string().describe("Description of the lighting quality")
    })
  })
});

export type ArtisticDescription = z.infer<typeof artisticDescriptionSchema>;

/**
 * System instruction for generating artistic descriptions
 */
export const ARTISTIC_DESCRIPTION_SYSTEM_INSTRUCTION = `You are an expert art historian and curator analyzing wall mural designs.

Your task is to provide a comprehensive artistic analysis following a specific JSON schema.

Analyze the provided mural image and return:

1. A conversational summary (text_message) - 2-3 sentences describing the overall artistic concept, highlighting the most distinctive features

2. Structured analysis (json_prompt) covering:
   - Meta tags: Categorize the style, assess seamless tiling potential, identify perspective type
   - Artistic reference: Identify the art movement, list influential artists or traditional crafts, specify the historical era
   - Medium and texture: Describe the artistic medium used (or simulated), the background substrate/texture, and the brushwork style
   - Visual composition: Describe the subject matter, explain the structural layout, list specific key elements (flora, fauna, objects)
   - Color profile: Describe the dominant color palette with specific color names, convey the mood, describe the lighting quality

Be specific and detailed in your analysis:
- Identify actual flora and fauna by name (e.g., "Magnolia flowers", "Pink Crane", "Wisteria")
- Reference real art movements and eras (e.g., "18th-Century Chinoiserie", "Art Nouveau", "Contemporary Minimalism")
- Use specific color names (e.g., "Sage green", "Dusty rose", "Warm beige")
- Describe actual artistic techniques (e.g., "Fine lines with soft blending", "Bold impasto brushstrokes")

Your analysis will be used to help users understand the artistic qualities of mural designs and make informed decisions about their aesthetic preferences.`;
