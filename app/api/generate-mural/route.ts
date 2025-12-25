// API route to generate a new mural
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateMural, convertJsonToNarrativePrompt } from '@/lib/features/mural-generator/gemini';
import {
  readImageAsBase64,
  getMimeType,
  saveGeneratedMural,
} from '@/lib/features/mural-generator/storage';
import { UnifiedArtisticPromptInterface } from '@/lib/features/mural-generator/types';

export async function POST(request: NextRequest) {
  try {
    const { referenceMuralId, artisticPromptJson, prompt, isCustomPrompt } = await request.json();

    // Support both old (prompt) and new (artisticPromptJson) formats
    if (!referenceMuralId) {
      return NextResponse.json(
        { error: 'referenceMuralId is required' },
        { status: 400 }
      );
    }

    if (!artisticPromptJson && !prompt) {
      return NextResponse.json(
        { error: 'Either artisticPromptJson or prompt is required' },
        { status: 400 }
      );
    }

    // Get reference mural from database
    const referenceMural = await db.referenceMural.findUnique({
      where: { id: referenceMuralId },
    });

    if (!referenceMural) {
      return NextResponse.json(
        { error: 'Reference mural not found' },
        { status: 404 }
      );
    }

    console.log(`Generating mural from reference: ${referenceMural.fileName}`);
    console.log(`Custom prompt: ${isCustomPrompt}`);

    // Read reference image
    const imageBase64 = await readImageAsBase64(referenceMural.localFilePath);
    const mimeType = getMimeType(referenceMural.fileName);

    // Determine which prompt to use
    let narrativePrompt: string;

    if (artisticPromptJson) {
      // New flow: Convert structured JSON to narrative
      console.log('Converting structured JSON to narrative prompt...');
      narrativePrompt = await convertJsonToNarrativePrompt(artisticPromptJson.artisticPrompt);
      console.log('Narrative prompt generated successfully');
    } else {
      // Legacy flow: Use prompt directly
      console.log('Using legacy prompt flow');
      narrativePrompt = prompt;
    }

    // Generate new mural with Gemini
    const generatedImageBuffer = await generateMural(
      imageBase64,
      mimeType,
      narrativePrompt
    );

    // Save to local filesystem
    const basePath = process.env.GENERATED_MURALS_OUTPUT_PATH;
    if (!basePath) {
      return NextResponse.json(
        { error: 'GENERATED_MURALS_OUTPUT_PATH not configured' },
        { status: 500 }
      );
    }

    const { filePath, fileName } = await saveGeneratedMural(
      generatedImageBuffer,
      basePath,
      referenceMural.collectionName,
      referenceMural.designName,
      referenceMural.colorVariant
    );

    // Save to database
    const generatedMural = await db.generatedMural.create({
      data: {
        referenceMuralId: referenceMural.id,
        prompt: narrativePrompt,  // Store the narrative prompt used for generation
        isCustomPrompt: isCustomPrompt || false,
        localFilePath: filePath,
        fileName,
        modelUsed: process.env.GEMINI_MODEL || 'gemini-pro-3',
        generationParams: JSON.stringify({
          timestamp: new Date().toISOString(),
          // Store original structured JSON if provided
          artisticPromptJson: artisticPromptJson || undefined,
        }),
      },
      include: {
        referenceMural: true,
      },
    });

    console.log(`Saved generated mural: ${fileName}`);

    return NextResponse.json({
      success: true,
      generatedMural: {
        ...generatedMural,
        // Include base64 for preview (small size is OK)
        previewBase64: generatedImageBuffer.toString('base64'),
      },
    });
  } catch (error) {
    console.error('Error generating mural:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate mural',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
