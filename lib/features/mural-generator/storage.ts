// Local file storage utilities
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

/**
 * Ensure directory exists, create if not
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Generate filename for generated mural
 * Format: generated-{timestamp}-{colorVariant}.png
 */
export function generateMuralFilename(colorVariant: string | null): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .split('.')[0]; // Format: 2024-12-22-14-30-45

  const variant = colorVariant ? `-${colorVariant}` : '';
  return `generated-${timestamp}${variant}.png`;
}

/**
 * Get output directory path for a generated mural
 * Structure: {basePath}/{collection}/{design}/
 */
export function getOutputDirectory(
  basePath: string,
  collectionName: string,
  designName: string
): string {
  return join(basePath, collectionName, designName);
}

/**
 * Save generated mural image to local filesystem
 * Returns the full path to the saved file
 */
export async function saveGeneratedMural(
  imageData: Buffer,
  basePath: string,
  collectionName: string,
  designName: string,
  colorVariant: string | null
): Promise<{ filePath: string; fileName: string }> {
  // Create directory structure
  const outputDir = getOutputDirectory(basePath, collectionName, designName);
  await ensureDir(outputDir);

  // Generate filename
  const fileName = generateMuralFilename(colorVariant);
  const filePath = join(outputDir, fileName);

  // Write file
  await writeFile(filePath, imageData);

  console.log(`Saved generated mural to: ${filePath}`);

  return { filePath, fileName };
}

/**
 * Read image file as base64 string for Gemini API
 */
export async function readImageAsBase64(filePath: string): Promise<string> {
  const imageBuffer = await readFile(filePath);
  return imageBuffer.toString('base64');
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}
