// API route to analyze reference mural and suggest a prompt
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeReferenceMural } from '@/lib/features/mural-generator/gemini';
import { readImageAsBase64, getMimeType } from '@/lib/features/mural-generator/storage';

export async function POST(request: NextRequest) {
  try {
    const { referenceMuralId } = await request.json();

    if (!referenceMuralId) {
      return NextResponse.json(
        { error: 'referenceMuralId is required' },
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

    console.log(`Analyzing reference mural: ${referenceMural.fileName}`);

    // Read image as base64
    const imageBase64 = await readImageAsBase64(referenceMural.localFilePath);
    const mimeType = getMimeType(referenceMural.fileName);

    // Analyze with Gemini
    const analysis = await analyzeReferenceMural(imageBase64, mimeType);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Error analyzing prompt:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze reference mural',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
