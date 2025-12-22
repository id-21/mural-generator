// API route to generate a new mural
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateMural } from '@/lib/features/mural-generator/gemini';
import {
  readImageAsBase64,
  getMimeType,
  saveGeneratedMural,
} from '@/lib/features/mural-generator/storage';

export async function POST(request: NextRequest) {
  try {
    const { referenceMuralId, prompt, isCustomPrompt } = await request.json();

    if (!referenceMuralId || !prompt) {
      return NextResponse.json(
        { error: 'referenceMuralId and prompt are required' },
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

    // Generate new mural with Gemini
    const generatedImageBuffer = await generateMural(
      imageBase64,
      mimeType,
      prompt
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
        prompt,
        isCustomPrompt: isCustomPrompt || false,
        localFilePath: filePath,
        fileName,
        modelUsed: process.env.GEMINI_MODEL || 'gemini-pro-3',
        generationParams: JSON.stringify({
          timestamp: new Date().toISOString(),
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
