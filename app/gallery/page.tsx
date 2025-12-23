'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

interface GeneratedMural {
  id: string;
  referenceMuralId: string;
  prompt: string;
  isCustomPrompt: boolean;
  fileName: string;
  modelUsed: string | null;
  createdAt: string;
  referenceMural: {
    id: string;
    collectionName: string;
    designName: string;
    colorVariant: string | null;
  };
}

export default function GalleryPage() {
  const [murals, setMurals] = useState<GeneratedMural[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Load murals on mount
  useEffect(() => {
    async function loadMurals() {
      try {
        setLoading(true);
        const res = await fetch('/api/generated-murals?limit=1000');
        const data = await res.json();
        setMurals(data.generatedMurals || []);
      } catch (err) {
        console.error('Failed to load murals:', err);
        setError('Failed to load gallery');
      } finally {
        setLoading(false);
      }
    }
    loadMurals();
  }, []);

  // Sync URL to state
  useEffect(() => {
    const urlIndex = parseInt(searchParams.get('index') || '0');
    if (urlIndex >= 0 && urlIndex < murals.length) {
      setCurrentIndex(urlIndex);
    }
  }, [searchParams, murals.length]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, murals.length]);

  // Preload adjacent images
  useEffect(() => {
    if (murals.length === 0) return;
    const preloadIndices = [currentIndex + 1, currentIndex - 1]
      .filter(i => i >= 0 && i < murals.length);
    preloadIndices.forEach(i => {
      const img = new Image();
      img.src = `/api/image?id=${murals[i].id}`;
    });
  }, [currentIndex, murals]);

  // Navigation functions
  function navigateToIndex(newIndex: number) {
    setCurrentIndex(newIndex);
    router.push(`/gallery?index=${newIndex}`, { scroll: false });
  }

  function navigatePrevious() {
    if (currentIndex > 0) navigateToIndex(currentIndex - 1);
  }

  function navigateNext() {
    if (currentIndex < murals.length - 1) navigateToIndex(currentIndex + 1);
  }

  // Memoized current mural
  const currentMural = useMemo(
    () => murals[currentIndex],
    [murals, currentIndex]
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading gallery...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && murals.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">No generated murals yet</p>
          <Link
            href="/generate"
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition inline-block"
          >
            Generate Your First Mural
          </Link>
        </div>
      </div>
    );
  }

  // Main gallery UI
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header with counter */}
      <header className="bg-black bg-opacity-50 p-4 flex justify-between items-center">
        <Link href="/" className="text-blue-400 hover:underline">
          ← Back to Home
        </Link>
        <h1 className="text-xl font-semibold">
          Generated Murals Gallery ({currentIndex + 1} / {murals.length})
        </h1>
        <div className="w-24"></div> {/* Spacer */}
      </header>

      <div className="relative p-8 space-y-8">
        {/* Large mural image */}
        <div className="max-w-5xl mx-auto bg-black rounded-lg overflow-hidden">
          <img
            src={`/api/image?id=${currentMural.id}`}
            alt={currentMural.fileName}
            className="w-full h-auto"
          />
        </div>

        {/* Prompt display */}
        <div className="max-w-5xl mx-auto bg-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Prompt</h3>
          <p className="text-gray-100 whitespace-pre-wrap">{currentMural.prompt}</p>
          <div className="mt-3 text-xs text-gray-400 flex gap-4">
            <span>{currentMural.isCustomPrompt ? 'Custom' : 'AI-generated'}</span>
            <span>Model: {currentMural.modelUsed || 'N/A'}</span>
            <span>{new Date(currentMural.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Reference mural section */}
        <div className="max-w-5xl mx-auto bg-gray-800 rounded-lg p-6 flex items-center gap-4">
          <div className="w-32 h-32 flex-shrink-0 bg-gray-700 rounded overflow-hidden">
            <img
              src={`/api/image?id=${currentMural.referenceMuralId}`}
              alt="Reference mural"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-400 mb-1">Reference Mural</h3>
            <p className="text-white font-medium">
              {currentMural.referenceMural.designName}
            </p>
            <p className="text-gray-400 text-sm">
              {currentMural.referenceMural.collectionName}
              {currentMural.referenceMural.colorVariant &&
                ` / ${currentMural.referenceMural.colorVariant}`}
            </p>
          </div>
          <Link
            href={`/generate?mural=${currentMural.referenceMuralId}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition"
          >
            Generate Similar →
          </Link>
        </div>

        {/* Navigation buttons (absolute positioned) */}
        <button
          onClick={navigatePrevious}
          disabled={currentIndex === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-4 rounded-full hover:bg-opacity-75 disabled:opacity-25 disabled:cursor-not-allowed transition z-10"
          aria-label="Previous mural"
        >
          ←
        </button>

        <button
          onClick={navigateNext}
          disabled={currentIndex === murals.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-4 rounded-full hover:bg-opacity-75 disabled:opacity-25 disabled:cursor-not-allowed transition z-10"
          aria-label="Next mural"
        >
          →
        </button>
      </div>
    </div>
  );
}
