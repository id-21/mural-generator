'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface ReferenceMural {
  id: string;
  collectionName: string;
  designName: string;
  colorVariant: string | null;
  fileName: string;
}

interface GeneratedMural {
  id: string;
  referenceMuralId: string;
  prompt: string;
  isCustomPrompt: boolean;
  localFilePath: string;
  fileName: string;
  modelUsed: string | null;
  createdAt: string;
}

export default function GeneratePage() {
  const searchParams = useSearchParams();
  const muralIdFromUrl = searchParams.get('mural');

  const [selectedMural, setSelectedMural] = useState<ReferenceMural | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isCustomPrompt, setIsCustomPrompt] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedMetadata, setGeneratedMetadata] = useState<any>(null);
  const [previouslyGenerated, setPreviouslyGenerated] = useState<GeneratedMural[]>([]);
  const [modalImage, setModalImage] = useState<GeneratedMural | null>(null);

  // Load reference mural from URL param
  useEffect(() => {
    if (muralIdFromUrl) {
      loadReferenceMural(muralIdFromUrl);
    }
  }, [muralIdFromUrl]);

  // Load previously generated when mural is selected
  useEffect(() => {
    if (selectedMural) {
      loadPreviouslyGenerated();
    }
  }, [selectedMural]);

  async function loadReferenceMural(id: string) {
    try {
      const res = await fetch(`/api/reference-murals`);
      const data = await res.json();
      const mural = data.murals.find((m: ReferenceMural) => m.id === id);
      if (mural) {
        setSelectedMural(mural);
      }
    } catch (error) {
      console.error('Failed to load reference mural:', error);
    }
  }

  async function loadPreviouslyGenerated() {
    if (!selectedMural) return;

    try {
      const res = await fetch(`/api/generated-murals?referenceMuralId=${selectedMural.id}&limit=20`);
      const data = await res.json();
      setPreviouslyGenerated(data.generatedMurals || []);
    } catch (error) {
      console.error('Failed to load previously generated murals:', error);
    }
  }

  async function handleAnalyze() {
    if (!selectedMural) return;

    setAnalyzing(true);
    setIsCustomPrompt(false);

    try {
      const res = await fetch('/api/analyze-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceMuralId: selectedMural.id }),
      });

      const data = await res.json();
      if (data.success) {
        setPrompt(data.analysis.suggestedPrompt);
        alert('Prompt analyzed! You can edit it before generating.');
      } else {
        alert('Failed to analyze: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Check console.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    if (!selectedMural || !prompt) return;

    setGenerating(true);
    setGeneratedImage(null);
    setGeneratedMetadata(null);

    try {
      const res = await fetch('/api/generate-mural', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceMuralId: selectedMural.id,
          prompt,
          isCustomPrompt,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setGeneratedImage(data.generatedMural.previewBase64);
        setGeneratedMetadata({
          prompt: data.generatedMural.prompt,
          createdAt: data.generatedMural.createdAt,
          modelUsed: data.generatedMural.modelUsed,
          fileName: data.generatedMural.fileName,
        });
        // Reload previously generated list
        loadPreviouslyGenerated();
        alert('Mural generated successfully!\nSaved to: ' + data.generatedMural.localFilePath);
      } else {
        alert('Generation failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Generation failed. Check console.');
    } finally {
      setGenerating(false);
    }
  }

  if (!selectedMural) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No reference mural selected</p>
          <p className="text-gray-400 text-sm mt-2">
            Please select a mural from the <Link href="/browse" className="text-blue-600 hover:underline">browse page</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/browse" className="text-blue-600 hover:underline">
          ← Back to Browse
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">{selectedMural.designName}</h1>
      <p className="text-gray-600 mb-8">
        {selectedMural.collectionName}
        {selectedMural.colorVariant && ` / ${selectedMural.colorVariant}`}
      </p>

      {/* Two-column layout: Reference Image | Controls */}
      <div className="grid grid-cols-2 gap-8 mb-12">
        {/* Left: Reference Image */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Reference Mural</h2>
          <div className="bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={`/api/image?id=${selectedMural.id}`}
              alt={selectedMural.fileName}
              className="w-full"
            />
          </div>
        </div>

        {/* Right: Controls */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Generation Controls</h2>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition"
              >
                {analyzing ? 'Analyzing...' : 'AI Analyze Prompt'}
              </button>
              <button
                onClick={() => {
                  setPrompt('');
                  setIsCustomPrompt(true);
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Write Custom Prompt
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Generation Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setIsCustomPrompt(true);
                }}
                rows={16}
                placeholder="Click 'AI Analyze Prompt' to get a suggested prompt, or write your own..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {isCustomPrompt ? '✏️ Custom prompt' : '🤖 AI-suggested prompt (editable)'}
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !prompt}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition"
            >
              {generating ? 'Generating Mural...' : 'Generate Mural'}
            </button>
          </div>
        </div>
      </div>

      {/* Current Generated Image Preview */}
      {generatedImage && (
        <div className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Current Generation</h2>
          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
            <img
              src={`data:image/png;base64,${generatedImage}`}
              alt="Generated mural"
              className="w-full"
            />
            {generatedMetadata && (
              <div className="p-6 bg-gray-50 space-y-2">
                <p className="text-sm font-medium text-gray-700">Prompt:</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{generatedMetadata.prompt}</p>
                <div className="pt-2 flex gap-4 text-xs text-gray-500">
                  <span>Generated: {new Date(generatedMetadata.createdAt).toLocaleString()}</span>
                  <span>Model: {generatedMetadata.modelUsed || 'N/A'}</span>
                  <span>File: {generatedMetadata.fileName}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Previously Generated Murals Slider */}
      {previouslyGenerated.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Previously Generated ({previouslyGenerated.length})</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-4 pb-2">
              {previouslyGenerated.map((gen) => (
                <button
                  key={gen.id}
                  onClick={() => setModalImage(gen)}
                  className="flex-shrink-0 w-48 border border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-lg transition cursor-pointer"
                >
                  <div className="aspect-square bg-gray-100">
                    <img
                      src={`/api/image?id=${gen.id}`}
                      alt={gen.fileName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 bg-white">
                    <p className="text-xs text-gray-600 truncate">
                      {new Date(gen.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {gen.isCustomPrompt ? 'Custom' : 'AI-generated'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal for viewing previously generated images */}
      {modalImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setModalImage(null)}
        >
          <div
            className="relative bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalImage(null)}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-75 z-10"
            >
              ✕
            </button>
            <img
              src={`/api/image?id=${modalImage.id}`}
              className="w-full rounded-t-lg"
              alt="Generated mural"
            />
            <div className="p-6 space-y-2">
              <p className="text-sm font-medium text-gray-700">Prompt:</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{modalImage.prompt}</p>
              <div className="pt-2 space-y-1">
                <p className="text-xs text-gray-500">
                  Generated: {new Date(modalImage.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Model: {modalImage.modelUsed || 'N/A'}</p>
                <p className="text-xs text-gray-500">File: {modalImage.fileName}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
