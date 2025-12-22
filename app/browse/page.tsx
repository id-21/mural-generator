'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ReferenceMural {
  id: string;
  collectionName: string;
  designName: string;
  colorVariant: string | null;
  fileName: string;
}

interface CollectionGroup {
  [designName: string]: ReferenceMural[];
}

interface CollectionData {
  [collectionName: string]: CollectionGroup;
}

export default function BrowsePage() {
  const [murals, setMurals] = useState<ReferenceMural[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMurals();
  }, []);

  async function loadMurals() {
    try {
      setLoading(true);
      const res = await fetch('/api/reference-murals');
      const data = await res.json();
      setMurals(data.murals || []);
    } catch (error) {
      console.error('Failed to load murals:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleCollection(collectionName: string) {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionName)) {
        next.delete(collectionName);
      } else {
        next.add(collectionName);
      }
      return next;
    });
  }

  // Group murals by collection, then by design
  const collectionData: CollectionData = murals.reduce((acc, mural) => {
    if (!acc[mural.collectionName]) {
      acc[mural.collectionName] = {};
    }
    if (!acc[mural.collectionName][mural.designName]) {
      acc[mural.collectionName][mural.designName] = [];
    }
    acc[mural.collectionName][mural.designName].push(mural);
    return acc;
  }, {} as CollectionData);

  const collectionNames = Object.keys(collectionData).sort();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Loading murals...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Browse Reference Library</h1>
          <p className="text-gray-600 mt-2">
            Showing {murals.length} reference murals across {collectionNames.length} collections
          </p>
        </div>
        <Link
          href="/generate"
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition"
        >
          Generate Mural
        </Link>
      </div>

      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>

      {collectionNames.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No reference murals found</p>
          <p className="text-gray-400 text-sm mt-2">Import reference murals from the home page</p>
        </div>
      ) : (
        <div className="space-y-4">
          {collectionNames.map((collectionName) => {
            const isExpanded = expandedCollections.has(collectionName);
            const designs = collectionData[collectionName];
            const designNames = Object.keys(designs).sort();
            const totalVariants = designNames.reduce(
              (sum, design) => sum + designs[design].length,
              0
            );

            return (
              <div key={collectionName} className="bg-white rounded-lg shadow border border-gray-200">
                {/* Collection Header (Clickable) */}
                <button
                  onClick={() => toggleCollection(collectionName)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-gray-800">{collectionName}</span>
                    <span className="text-sm text-gray-500">
                      {designNames.length} designs · {totalVariants} variants
                    </span>
                  </div>
                  <span className="text-gray-500 text-xl">{isExpanded ? '▼' : '▶'}</span>
                </button>

                {/* Collection Content (Collapsible) */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2">
                    {/* Grid of design families - 2 per row */}
                    <div className="grid grid-cols-2 gap-6">
                      {designNames.map((designName) => {
                        const variants = designs[designName];

                        return (
                          <div key={designName} className="border-t border-gray-200 pt-4">
                            <h3 className="text-md font-semibold mb-3 text-gray-700">
                              {designName}
                              <span className="text-sm text-gray-500 ml-2">
                                ({variants.length} variant{variants.length !== 1 ? 's' : ''})
                              </span>
                            </h3>

                            {/* Horizontal slider for variants */}
                            <div className="overflow-x-auto">
                              <div className="flex gap-3 pb-2">
                                {variants.map((mural) => (
                                  <Link
                                    key={mural.id}
                                    href={`/generate?mural=${mural.id}`}
                                    className="flex-shrink-0 w-36 border border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-lg transition"
                                  >
                                    <div className="aspect-square bg-gray-100">
                                      <img
                                        src={`/api/image?id=${mural.id}`}
                                        alt={mural.fileName}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="p-2 bg-white">
                                      <p className="text-xs font-medium truncate">
                                        {mural.colorVariant || 'Default'}
                                      </p>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
