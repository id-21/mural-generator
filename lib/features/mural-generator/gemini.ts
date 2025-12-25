// Gemini Pro 3 API integration
import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ANALYZE_REFERENCE_SYSTEM_INSTRUCTION,
  createAnalysisPrompt,
  GENERATE_MURAL_SYSTEM_INSTRUCTION,
  DEFAULT_MURAL_PROMPT,
  CHAT_REFINEMENT_SYSTEM_INSTRUCTION,
  UNIFIED_CHAT_REFINEMENT_SYSTEM_INSTRUCTION,
  JSON_TO_NARRATIVE_SYSTEM_INSTRUCTION,
  chatRefinementSchema,
  ChatRefinementResponse,
  unifiedArtisticPromptSchema,
  UnifiedArtisticPrompt,
} from './prompts';
import { PromptAnalysisResult, UnifiedArtisticPromptInterface } from './types';
import fs from 'fs';

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
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: referenceMimeType,
            data: referenceImageBase64,
          },
        },
      ],
      config: {
        systemInstruction: GENERATE_MURAL_SYSTEM_INSTRUCTION,
      }
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

/**
 * Convert structured JSON artistic prompt to narrative text prompt
 * Uses AI to create flowing narrative from structured fields
 */
export async function convertJsonToNarrativePrompt(
  artisticPrompt: UnifiedArtisticPromptInterface['artisticPrompt']
): Promise<string> {
  const ai = getGeminiClient();
  const model = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

  console.log('Converting structured JSON to narrative prompt...');

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{
          text: `Convert this structured artistic prompt to a detailed narrative prompt for mural generation:\n\n${JSON.stringify(artisticPrompt, null, 2)}`
        }]
      }],
      config: {
        systemInstruction: JSON_TO_NARRATIVE_SYSTEM_INSTRUCTION,
        // No JSON schema - output is plain text narrative
      }
    });

    const narrativePrompt = response.text || '';

    if (!narrativePrompt || narrativePrompt.trim() === '') {
      throw new Error('Empty narrative prompt generated from JSON');
    }

    console.log('Narrative prompt generated:', narrativePrompt.substring(0, 150) + '...');
    return narrativePrompt;
  } catch (error) {
    console.error('Error converting JSON to narrative:', error);
    throw error;
  }
}

/**
 * Refine a prompt through chat conversation with AI
 * Supports both initial image analysis and text-only refinement
 * @deprecated Use refinePromptWithChatUnified instead
 */
export async function refinePromptWithChat(
  chatHistory: Array<{role: 'user' | 'model', parts: Array<{text?: string, inlineData?: any}>}>,
  userMessage: string,
  imageData?: {mimeType: string, data: string},
  currentPrompt?: string
): Promise<ChatRefinementResponse> {
  const ai = getGeminiClient();
  const model = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

  console.log('Refining prompt with chat, message:', userMessage);
  if (imageData) {
    console.log('Including image in chat (initial analysis mode)');
  }
  if (currentPrompt) {
    console.log('Including current prompt context');
  }

  try {
    // Prepend current prompt to user message if provided (for refinement mode)
    const messageText = currentPrompt
      ? `Current prompt:\n${currentPrompt}\n\nUser request: ${userMessage}`
      : userMessage;

    // Build the conversation history including the new user message
    const contents = [
      ...chatHistory.map(msg => ({
        role: msg.role,
        parts: msg.parts
      })),
      {
        role: 'user' as const,
        parts: imageData
          ? [
              { text: messageText },
              { inlineData: { mimeType: imageData.mimeType, data: imageData.data } }
            ]
          : [{ text: messageText }]
      }
    ];

    // 1. Define the request object explicitly
    const requestPayload = {
      model,
      contents,
      config: {
        responseMimeType: 'application/json',
        systemInstruction: CHAT_REFINEMENT_SYSTEM_INSTRUCTION,
        responseJsonSchema: zodToJsonSchema(chatRefinementSchema) as any,
      },
    };

    // // 2. Write the object to a JSON file (useful for debugging)
    // try {
    //   fs.writeFileSync(
    //     'gemini_request_payload.json',
    //     JSON.stringify(requestPayload, null, 2) // 'null, 2' adds indentation for readability
    //   );
    //   console.log('Request payload saved to gemini_request_payload.json');
    // } catch (error) {
    //   console.error('Failed to save request payload:', error);
    // }

    // 3. Pass the variable to generateContent
    const response = await ai.models.generateContent(requestPayload);

    // // 4. Write the object to a JSON file (useful for debugging)
    // try {
    //   fs.writeFileSync(
    //     'gemini_response.json',
    //     JSON.stringify(response, null, 2) // 'null, 2' adds indentation for readability
    //   );
    //   console.log('Request payload saved to gemini_response.json');
    // } catch (error) {
    //   console.error('Failed to save request payload:', error);
    // }

    const jsonText = response.text || '';
    console.log('Chat response:', jsonText);

    // Validate that we have JSON content before parsing
    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Empty response from AI model - no text content received');
    }

    // Parse and validate JSON response using Zod
    const result = chatRefinementSchema.parse(JSON.parse(jsonText));

    return result;
  } catch (error) {
    console.error('Error refining prompt with chat:', error);
    throw error;
  }
}

/**
 * Refine a structured artistic prompt through chat conversation with AI
 * Supports both initial image analysis and JSON refinement
 * Returns unified structured JSON prompt
 */
export async function refinePromptWithChatUnified(
  chatHistory: Array<{role: 'user' | 'model', parts: Array<{text?: string, inlineData?: any}>}>,
  userMessage: string,
  imageData?: {mimeType: string, data: string},
  currentArtisticPrompt?: UnifiedArtisticPromptInterface['artisticPrompt']
): Promise<UnifiedArtisticPrompt> {
  const ai = getGeminiClient();
  const model = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

  console.log('Refining structured prompt with chat, message:', userMessage);
  if (imageData) {
    console.log('Including image in chat (initial analysis mode)');
  }
  if (currentArtisticPrompt) {
    console.log('Including current artistic prompt JSON context');
  }

  try {
    // Prepend current artistic prompt JSON to user message if provided (for refinement mode)
    const messageText = currentArtisticPrompt
      ? `Current artistic prompt JSON:\n${JSON.stringify(currentArtisticPrompt, null, 2)}\n\nUser request: ${userMessage}`
      : userMessage;

    // Build the conversation history including the new user message
    const contents = [
      ...chatHistory.map(msg => ({
        role: msg.role,
        parts: msg.parts
      })),
      {
        role: 'user' as const,
        parts: imageData
          ? [
              { text: messageText },
              { inlineData: { mimeType: imageData.mimeType, data: imageData.data } }
            ]
          : [{ text: messageText }]
      }
    ];

    const requestPayload = {
      model,
      contents,
      config: {
        responseMimeType: 'application/json',
        systemInstruction: UNIFIED_CHAT_REFINEMENT_SYSTEM_INSTRUCTION,
        responseJsonSchema: zodToJsonSchema(unifiedArtisticPromptSchema) as any,
      },
    };

    const response = await ai.models.generateContent(requestPayload);

    const jsonText = response.text || '';
    console.log('Unified chat response received');

    // Validate that we have JSON content before parsing
    if (!jsonText || jsonText.trim() === '') {
      throw new Error('Empty response from AI model - no text content received');
    }

    // Parse and validate JSON response using Zod
    const result = unifiedArtisticPromptSchema.parse(JSON.parse(jsonText));

    console.log('Changes summary:', result.changesSummary);
    return result;
  } catch (error) {
    console.error('Error refining structured prompt with chat:', error);
    throw error;
  }
}
