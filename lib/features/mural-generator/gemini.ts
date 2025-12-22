// Gemini Pro 3 API integration
import { GoogleGenAI } from '@google/genai';
import {
  ANALYZE_REFERENCE_SYSTEM_INSTRUCTION,
  createAnalysisPrompt,
  GENERATE_MURAL_SYSTEM_INSTRUCTION,
  DEFAULT_MURAL_PROMPT,
} from './prompts';
import { PromptAnalysisResult } from './types';

// Singleton Gemini client
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

/**
 * Analyze reference mural and suggest a prompt
 */
export async function analyzeReferenceMural(
  imageBase64: string,
  mimeType: string
): Promise<PromptAnalysisResult> {
  const ai = getGeminiClient();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';

  console.log(`Analyzing reference mural with model: ${model}`);

  try {
    const response = await ai.models.generateContent({
      model,
      systemInstruction: ANALYZE_REFERENCE_SYSTEM_INSTRUCTION,
      contents: [
        { text: createAnalysisPrompt() },
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ],
    });

    // Extract text response
    const textResponse = response.text || '';

    // Parse JSON response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    const result: PromptAnalysisResult = JSON.parse(jsonMatch[0]);
    return result;
  } catch (error) {
    console.error('Error analyzing reference mural:', error);
    throw error;
  }
}

/**
 * Generate a new mural based on reference image and prompt
 */
export async function generateMural(
  referenceImageBase64: string,
  referenceMimeType: string,
  prompt: string
): Promise<Buffer> {
  const ai = getGeminiClient();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';

  console.log(`Generating mural with model: ${model}`);
  console.log(`Prompt: ${prompt.substring(0, 100)}...`);

  try {
    const response = await ai.models.generateContent({
      model,
      systemInstruction: GENERATE_MURAL_SYSTEM_INSTRUCTION,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: referenceMimeType,
            data: referenceImageBase64,
          },
        },
      ],
    });

    // Extract generated image from response
    let buffer: Buffer | null = null;

    // The response structure is: response.candidates[0].content.parts[0].inlineData
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            buffer = Buffer.from(part.inlineData.data, 'base64');
            console.log(`Generated image size: ${buffer.length} bytes`);
            break;
          }
          if (part.text) {
            console.log('Response text:', part.text);
          }
        }
      }
    }

    if (!buffer) {
      console.error('No image found in response');
      throw new Error('No image generated in response');
    }

    return buffer;
  } catch (error) {
    console.error('Error generating mural:', error);
    throw error;
  }
}
