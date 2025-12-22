// API route to serve local images
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const muralId = searchParams.get('id');

    if (!muralId) {
      return NextResponse.json(
        { error: 'Mural ID is required' },
        { status: 400 }
      );
    }

    // Try to get mural from ReferenceMural table first
    let mural = await db.referenceMural.findUnique({
      where: { id: muralId },
    });

    let filePath = mural?.localFilePath;
    let fileName = mural?.fileName;

    // If not found, try GeneratedMural table
    if (!filePath) {
      const generated = await db.generatedMural.findUnique({
        where: { id: muralId },
      });
      filePath = generated?.localFilePath;
      fileName = generated?.fileName;
    }

    if (!filePath || !fileName) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Read image file
    const imageBuffer = await readFile(filePath);

    // Determine content type from file extension
    const ext = fileName.toLowerCase().split('.').pop();
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    // Return image
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json(
      { error: 'Failed to load image' },
      { status: 500 }
    );
  }
}
