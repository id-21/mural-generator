// Auto-import reference murals from local directory
import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { db } from '@/lib/db';

interface ImportedMural {
  collectionName: string;
  designName: string;
  colorVariant: string | null;
  filePath: string;
  fileName: string;
}

/**
 * Recursively scan directory for -design.jpg files
 * Structure: collection/design/color-variant/*-design.jpg
 */
async function scanDirectory(basePath: string): Promise<ImportedMural[]> {
  const murals: ImportedMural[] = [];

  try {
    const collections = await readdir(basePath);

    for (const collection of collections) {
      // Skip hidden files
      if (collection.startsWith('.')) continue;

      const collectionPath = join(basePath, collection);
      const collectionStat = await stat(collectionPath);

      if (!collectionStat.isDirectory()) continue;

      // Read designs within collection
      const designs = await readdir(collectionPath);

      for (const design of designs) {
        if (design.startsWith('.')) continue;

        const designPath = join(collectionPath, design);
        const designStat = await stat(designPath);

        if (!designStat.isDirectory()) continue;

        // Check for color variants
        const variants = await readdir(designPath);

        for (const variant of variants) {
          if (variant.startsWith('.')) continue;

          const variantPath = join(designPath, variant);
          const variantStat = await stat(variantPath);

          if (!variantStat.isDirectory()) continue;

          // Look for -design.jpg files
          const files = await readdir(variantPath);

          for (const file of files) {
            if (file.endsWith('-design.jpg') || file.endsWith('-design.png')) {
              const filePath = join(variantPath, file);

              murals.push({
                collectionName: collection,
                designName: design,
                colorVariant: variant,
                filePath,
                fileName: file,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error scanning directory:', error);
    throw error;
  }

  return murals;
}

/**
 * Import all reference murals into database
 * Only imports new ones (checks by filePath)
 */
export async function importReferenceMurals(basePath: string): Promise<{
  imported: number;
  skipped: number;
  total: number;
}> {
  console.log('Scanning for reference murals...');
  const murals = await scanDirectory(basePath);
  console.log(`Found ${murals.length} reference mural images`);

  let imported = 0;
  let skipped = 0;

  for (const mural of murals) {
    try {
      // Check if already exists
      const existing = await db.referenceMural.findUnique({
        where: { localFilePath: mural.filePath },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Import new mural
      await db.referenceMural.create({
        data: {
          collectionName: mural.collectionName,
          designName: mural.designName,
          colorVariant: mural.colorVariant,
          localFilePath: mural.filePath,
          fileName: mural.fileName,
        },
      });

      imported++;
    } catch (error) {
      console.error(`Error importing ${mural.filePath}:`, error);
    }
  }

  return {
    imported,
    skipped,
    total: murals.length,
  };
}

/**
 * Get import statistics
 */
export async function getImportStats() {
  const total = await db.referenceMural.count();
  const collections = await db.referenceMural.groupBy({
    by: ['collectionName'],
  });

  return {
    totalMurals: total,
    totalCollections: collections.length,
  };
}
