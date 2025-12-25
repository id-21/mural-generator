'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { UnifiedArtisticPromptInterface } from '@/lib/features/mural-generator/types';

interface ReferenceMural {
  id: string;
  collectionName: string;
  designName: string;
  colorVariant: string | null;
  fileName: string;
  artisticDescription: string | null;
}

export default function ReferenceGalleryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialIndex = parseInt(searchParams.get('index') || '0', 10);

  const [murals, setMurals] = useState<ReferenceMural[]>([]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMurals();
  }, []);

  useEffect(() => {
    // Keyboard navigation
    function handleKeyboard(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        navigateToIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < murals.length - 1) {
        navigateToIndex(currentIndex + 1);
      }
    }

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [currentIndex, murals.length]);

  async function loadMurals() {
    try {
      const res = await fetch('/api/reference-murals');
      const data = await res.json();
      setMurals(data.murals || []);
    } catch (error) {
      console.error('Failed to load murals:', error);
    } finally {
      setLoading(false);
    }
  }

  function navigateToIndex(index: number) {
    setCurrentIndex(index);
    router.push(`/reference-gallery?index=${index}`);
  }

  function parseDescription(mural: ReferenceMural): UnifiedArtisticPromptInterface | null {
    if (!mural.artisticDescription) return null;

    try {
      const parsed = JSON.parse(mural.artisticDescription);
      // Check if it's unified format

      // For testing, not checking the JSON Schema match
      return parsed;

      if (parsed.conversationalResponse && parsed.artisticPrompt) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Loading reference murals...</p>
      </div>
    );
  }

  if (murals.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">No reference murals found</p>
          <Link href="/" className="text-blue-400 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const currentMural = murals[currentIndex];
  const description = parseDescription(currentMural);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/browse" className="text-blue-400 hover:underline">
            ← Back to Browse
          </Link>
          <h1 className="text-xl font-semibold">
            Reference Gallery ({currentIndex + 1}/{murals.length})
          </h1>
          <div className="text-sm text-gray-400">
            Use ← → keys to navigate
          </div>
        </div>
      </header>

      {/* Main Content: 70/30 Split */}
      <div className="flex gap-8 p-8 max-w-7xl mx-auto">
        {/* LEFT: Image (70%) */}
        <div className="flex-[7] relative">
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <img
              src={`/api/image?id=${currentMural.id}`}
              alt={currentMural.fileName}
              className="w-full"
            />
          </div>

          {/* Navigation Arrows */}
          <div className="flex justify-between mt-4">
            <button
              onClick={() => navigateToIndex(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition"
            >
              ← Previous
            </button>
            <button
              onClick={() => navigateToIndex(currentIndex + 1)}
              disabled={currentIndex === murals.length - 1}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>

        {/* RIGHT: Metadata (30%) */}
        <div className="flex-[3] bg-gray-800 rounded-lg p-6 overflow-y-auto max-h-[80vh]">
          {/* Collection/Design Info */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">{currentMural.designName}</h2>
            <p className="text-gray-400">{currentMural.collectionName}</p>
            {currentMural.colorVariant && (
              <p className="text-sm text-gray-500 mt-1">{currentMural.colorVariant}</p>
            )}
          </div>

          {/* Artistic Description */}
          {description ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Artistic Analysis</h3>

              {/* Conversational Response */}
              <div className="bg-gray-700 p-4 rounded-lg">
                <p className="text-sm text-gray-200">
                  {description.conversationalResponse}
                </p>
              </div>

              {/* Collapsible JSON Sections */}
              <details className="bg-gray-700 p-3 rounded-lg">
                <summary className="cursor-pointer font-medium text-sm">Meta Tags</summary>
                <pre className="text-xs mt-2 text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(description.artisticPrompt.meta_tags, null, 2)}
                </pre>
              </details>

              <details className="bg-gray-700 p-3 rounded-lg">
                <summary className="cursor-pointer font-medium text-sm">Artistic Reference</summary>
                <pre className="text-xs mt-2 text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(description.artisticPrompt.artistic_reference, null, 2)}
                </pre>
              </details>

              <details className="bg-gray-700 p-3 rounded-lg">
                <summary className="cursor-pointer font-medium text-sm">Medium & Texture</summary>
                <pre className="text-xs mt-2 text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(description.artisticPrompt.medium_and_texture, null, 2)}
                </pre>
              </details>

              <details className="bg-gray-700 p-3 rounded-lg">
                <summary className="cursor-pointer font-medium text-sm">Visual Composition</summary>
                <pre className="text-xs mt-2 text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(description.artisticPrompt.visual_composition, null, 2)}
                </pre>
              </details>

              <details className="bg-gray-700 p-3 rounded-lg">
                <summary className="cursor-pointer font-medium text-sm">Color Profile</summary>
                <pre className="text-xs mt-2 text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(description.artisticPrompt.color_profile, null, 2)}
                </pre>
              </details>

              {/* Generate Button */}
              <Link
                href={`/generate?mural=${currentMural.id}`}
                className="block w-full text-center px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-medium mt-6"
              >
                Generate from This →
              </Link>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <p className="mb-4">No artistic description yet</p>
              <p className="text-sm text-gray-500 mb-6">
                This mural hasn't been analyzed with the unified schema yet.
              </p>
              <Link
                href={`/generate?mural=${currentMural.id}`}
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Analyze & Generate
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
