// API route for chat-based prompt refinement
// Handles both initial image analysis and text-only refinement
import { NextRequest, NextResponse } from 'next/server';
import { refinePromptWithChat, refinePromptWithChatUnified } from '@/lib/features/mural-generator/gemini';
import { getReferenceMuralImage } from '@/lib/features/mural-generator/storage';
import { db } from '@/lib/db';
import { UnifiedArtisticPromptInterface } from '@/lib/features/mural-generator/types';

export async function POST(request: NextRequest) {
  try {
    const { chatHistory, userMessage, currentPrompt, currentArtisticPrompt, referenceMuralId, useUnifiedSchema } = await request.json();

    // CASE 1: Initial analysis with image (referenceMuralId provided, empty/no chatHistory)
    if (referenceMuralId && (!chatHistory || chatHistory.length === 0)) {
      console.log('Initial analysis with image for mural:', referenceMuralId);

      // Load the reference image
      const imageData = await getReferenceMuralImage(referenceMuralId);

      const initialMessage = userMessage || "Please analyze this mural image and create a detailed artistic prompt for generating a NEW original mural inspired by its characteristics.";

      // Check if mural already has a stored artistic description (unified format)
      const mural = await db.referenceMural.findUnique({
        where: { id: referenceMuralId },
        select: { artisticDescription: true }
      });

      // If using unified schema OR mural has description, use unified flow
      if (useUnifiedSchema || mural?.artisticDescription) {
        console.log('Using unified schema flow');

        // If mural has stored description, parse it; otherwise analyze image
        let result;

        if (mural?.artisticDescription) {
          // Parse stored description and return it
          const storedDescription = JSON.parse(mural.artisticDescription);
          result = storedDescription;
          console.log('Using stored artistic description');
        } else {
          // Call unified chat API with image (empty history for first message)
          result = await refinePromptWithChatUnified(
            [], // Empty history
            initialMessage,
            {
              mimeType: imageData.mimeType,
              data: imageData.base64Data
            }
          );
        }

        return NextResponse.json({
          success: true,
          conversationalResponse: result.conversationalResponse,
          artisticPromptJson: result.artisticPrompt,
          changesSummary: result.changesSummary,
          // Return the chat history so frontend can initialize properly
          initialChatHistory: [
            {
              role: 'user',
              parts: [
                { text: initialMessage },
                // Don't include image in history - too large
              ]
            },
            {
              role: 'model',
              parts: [{
                text: JSON.stringify({
                  conversationalResponse: result.conversationalResponse,
                  artisticPrompt: result.artisticPrompt,
                  changesSummary: result.changesSummary
                })
              }]
            }
          ]
        });
      }

      // Legacy flow: use old schema
      const result = await refinePromptWithChat(
        [], // Empty history
        initialMessage,
        {
          mimeType: imageData.mimeType,
          data: imageData.base64Data
        }
      );

      return NextResponse.json({
        success: true,
        conversationalResponse: result.conversationalResponse,
        refinedPrompt: result.refinedPrompt,
        changesSummary: result.changesSummary,
        // Return the chat history so frontend can initialize properly
        initialChatHistory: [
          {
            role: 'user',
            parts: [
              { text: initialMessage },
              // Don't include image in history - too large
            ]
          },
          {
            role: 'model',
            parts: [{
              text: JSON.stringify({
                conversationalResponse: result.conversationalResponse,
                refinedPrompt: result.refinedPrompt,
                changesSummary: result.changesSummary
              })
            }]
          }
        ]
      });
    }

    // CASE 2: Text-only refinement (continuing conversation)
    if (!userMessage) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(chatHistory)) {
      return NextResponse.json(
        { error: 'chatHistory must be an array' },
        { status: 400 }
      );
    }

    console.log('Refining prompt with chat, message:', userMessage);

    // If using unified schema or currentArtisticPrompt is provided, use unified flow
    if (useUnifiedSchema || currentArtisticPrompt) {
      console.log('Using unified schema refinement flow');

      const result = await refinePromptWithChatUnified(
        chatHistory,
        userMessage,
        undefined,  // no image
        currentArtisticPrompt  // pass current artistic prompt JSON
      );

      return NextResponse.json({
        success: true,
        conversationalResponse: result.conversationalResponse,
        artisticPromptJson: result.artisticPrompt,
        changesSummary: result.changesSummary,
      });
    }

    // Legacy flow: use old schema
    const result = await refinePromptWithChat(
      chatHistory,
      userMessage,
      undefined,  // no image
      currentPrompt  // pass current prompt
    );

    return NextResponse.json({
      success: true,
      conversationalResponse: result.conversationalResponse,
      refinedPrompt: result.refinedPrompt,
      changesSummary: result.changesSummary,
    });
  } catch (error) {
    console.error('Error in chat refinement:', error);
    return NextResponse.json(
      {
        error: 'Failed to refine prompt',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
