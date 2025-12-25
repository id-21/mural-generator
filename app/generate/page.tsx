'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { UnifiedArtisticPromptInterface } from '@/lib/features/mural-generator/types';

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
  const [artisticPromptJson, setArtisticPromptJson] = useState<UnifiedArtisticPromptInterface | null>(null);
  const [narrativePrompt, setNarrativePrompt] = useState<string>('');
  const [isCustomPrompt, setIsCustomPrompt] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedMetadata, setGeneratedMetadata] = useState<any>(null);
  const [previouslyGenerated, setPreviouslyGenerated] = useState<GeneratedMural[]>([]);
  const [modalImage, setModalImage] = useState<GeneratedMural | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'model',
    parts: Array<{text: string}>,
    imageId?: string
  }>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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

    // OPEN THE CHAT MODAL IMMEDIATELY with loading state
    setShowChatModal(true);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat-refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceMuralId: selectedMural.id,
          chatHistory: [],  // Empty for initial analysis
          useUnifiedSchema: true  // Use unified schema
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Set the artistic prompt JSON
        setArtisticPromptJson(data.artisticPromptJson);

        // Attach image ID to first user message in chat history
        const historyWithImage = data.initialChatHistory.map((msg: any, idx: number) =>
          idx === 0 && msg.role === 'user'
            ? { ...msg, imageId: selectedMural.id }
            : msg
        );
        setChatHistory(historyWithImage);

        setNotification({
          type: 'success',
          message: 'Prompt analyzed! You can continue refining in the chat.'
        });
      } else {
        setShowChatModal(false);  // Close on error
        setNotification({
          type: 'error',
          message: 'Failed to analyze: ' + (data.error || 'Unknown error')
        });
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setShowChatModal(false);  // Close on error
      setNotification({
        type: 'error',
        message: 'Analysis failed. Please try again.'
      });
    } finally {
      setAnalyzing(false);
      setChatLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedMural || (!artisticPromptJson && !narrativePrompt)) return;

    setGenerating(true);
    setGeneratedImage(null);
    setGeneratedMetadata(null);

    try {
      const res = await fetch('/api/generate-mural', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceMuralId: selectedMural.id,
          ...(artisticPromptJson ? { artisticPromptJson } : { prompt: narrativePrompt }),
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
        setNotification({
          type: 'success',
          message: 'Mural generated successfully!'
        });
      } else {
        setNotification({
          type: 'error',
          message: 'Generation failed: ' + (data.error || 'Unknown error')
        });
      }
    } catch (error) {
      console.error('Generation failed:', error);
      setNotification({
        type: 'error',
        message: 'Generation failed. Please try again.'
      });
    } finally {
      setGenerating(false);
    }
  }

  // Initialize chat when modal opens (if not already initialized)
  useEffect(() => {
    if (showChatModal && chatHistory.length === 0 && artisticPromptJson) {
      // Fallback: If somehow chat wasn't initialized during analysis, initialize now
      setChatHistory([
        {
          role: 'model',
          parts: [{
            text: JSON.stringify({
              conversationalResponse: "Hi! I can help you refine your mural generation prompt. What changes would you like to make? For example, you could ask me to make it more colorful, add specific elements, change the artistic style, or adjust any other aspect.",
              artisticPrompt: artisticPromptJson,
              changesSummary: []
            })
          }]
        }
      ]);
    }
  }, [showChatModal, artisticPromptJson, chatHistory.length]);

  async function handleChatSend() {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    // Add user message to history
    const newUserMsg = {
      role: 'user' as const,
      parts: [{ text: userMessage }]
    };
    setChatHistory(prev => [...prev, newUserMsg]);

    try {
      const res = await fetch('/api/chat-refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: [...chatHistory, newUserMsg],
          userMessage,
          currentArtisticPrompt: artisticPromptJson?.artisticPrompt,  // Pass current artistic prompt JSON
          useUnifiedSchema: true
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Store the full JSON response from AI
        const aiResponse = {
          conversationalResponse: data.conversationalResponse,
          artisticPrompt: data.artisticPromptJson,
          changesSummary: data.changesSummary,
        };

        // Add AI response to history (store as JSON string)
        setChatHistory(prev => [...prev, {
          role: 'model',
          parts: [{ text: JSON.stringify(aiResponse) }]
        }]);

        // Update artistic prompt JSON
        setArtisticPromptJson(data.artisticPromptJson);
      } else {
        setNotification({
          type: 'error',
          message: 'Chat failed: ' + (data.error || 'Unknown error')
        });
      }
    } catch (error) {
      console.error('Chat failed:', error);
      setNotification({
        type: 'error',
        message: 'Chat failed. Please try again.'
      });
    } finally {
      setChatLoading(false);
    }
  }

  function handleApplyRefinedPrompt() {
    // Prompt is already updated in real-time
    // Just close the modal
    setShowChatModal(false);
    setNotification({
      type: 'success',
      message: 'Refined prompt applied successfully!'
    });
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
      {/* Notification Banner */}
      {notification && (
        <div
          className={`fixed top-4 right-4 max-w-md px-6 py-4 rounded-lg shadow-lg z-50 ${
            notification.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">
              {notification.type === 'success' ? '✓' : '✕'}
            </span>
            <div className="flex-1">
              <p className="font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-white hover:text-gray-200 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
                  setNarrativePrompt('');
                  setArtisticPromptJson(null);
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
                value={isCustomPrompt ? narrativePrompt : "Using AI-generated structured prompt (view in chat modal)"}
                onChange={(e) => {
                  setNarrativePrompt(e.target.value);
                  setIsCustomPrompt(true);
                }}
                disabled={!isCustomPrompt}
                rows={16}
                placeholder="Click 'AI Analyze Prompt' to get a suggested prompt, or write your own..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm resize-none disabled:bg-gray-100 disabled:text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                {isCustomPrompt ? '✏️ Custom prompt' : '🤖 AI-suggested structured prompt'}
              </p>
              {artisticPromptJson && !isCustomPrompt && (
                <button
                  onClick={() => setShowChatModal(true)}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  ✨ Refine with AI Chat
                </button>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || (!artisticPromptJson && !narrativePrompt)}
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

          {/* Link to Gallery */}
          <div className="mt-4 text-center">
            <Link href="/gallery" className="text-blue-600 hover:underline text-sm">
              View in Gallery →
            </Link>
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

      {/* Chat Refinement Modal */}
      {showChatModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setShowChatModal(false)}
        >
          <div
            className="relative bg-white rounded-lg w-full max-w-6xl max-h-[80vh] flex flex-col m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Refine Prompt with AI</h2>
              <button
                onClick={() => setShowChatModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Two-column layout: Chat History | Prompt Preview + Changes */}
            <div className="flex-1 overflow-hidden grid grid-cols-3 gap-0">
              {/* Left Column: Chat History (2/3 width) */}
              <div className="col-span-2 flex flex-col overflow-y-auto p-6 space-y-4 border-r border-gray-200">
                {/* Chat messages */}
                {chatHistory.map((msg, idx) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={idx} className="flex justify-end">
                        <div className="max-w-[80%] rounded-lg p-4 bg-green-600 text-white">
                          {msg.imageId && (
                            <div className="mb-3 rounded overflow-hidden bg-white">
                              <img
                                src={`/api/image?id=${msg.imageId}`}
                                alt="Reference mural"
                                className="w-full max-w-sm"
                              />
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.parts?.[0]?.text || ''}</p>
                        </div>
                      </div>
                    );
                  } else {
                    // Parse JSON from AI response
                    const aiData = JSON.parse(msg.parts[0].text);
                    return (
                      <div key={idx} className="flex justify-start">
                        <div className="max-w-[80%] rounded-lg p-4 bg-gray-100 text-gray-800">
                          <p className="text-sm mb-2">{aiData.conversationalResponse}</p>
                        </div>
                      </div>
                    );
                  }
                })}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-800 rounded-lg p-4">
                      <p className="text-sm">AI is thinking...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: JSON Accordion + Changes Summary (1/3 width) */}
              <div className="col-span-1 flex flex-col bg-gray-50 overflow-hidden">
                {/* JSON Accordion Display (top 65%) */}
                <div className="h-[65%] overflow-y-auto p-4 border-b border-gray-300">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Artistic Prompt</h3>

                  {artisticPromptJson ? (
                    <div className="space-y-2">
                      {/* Meta Tags Section */}
                      <details className="bg-white p-2 rounded border border-gray-200">
                        <summary className="font-medium text-xs cursor-pointer">Meta Tags</summary>
                        <pre className="text-xs mt-2 text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(artisticPromptJson.artisticPrompt.meta_tags, null, 2)}
                        </pre>
                      </details>

                      {/* Artistic Reference Section */}
                      <details className="bg-white p-2 rounded border border-gray-200">
                        <summary className="font-medium text-xs cursor-pointer">Artistic Reference</summary>
                        <pre className="text-xs mt-2 text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(artisticPromptJson.artisticPrompt.artistic_reference, null, 2)}
                        </pre>
                      </details>

                      {/* Medium & Texture Section */}
                      <details className="bg-white p-2 rounded border border-gray-200">
                        <summary className="font-medium text-xs cursor-pointer">Medium & Texture</summary>
                        <pre className="text-xs mt-2 text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(artisticPromptJson.artisticPrompt.medium_and_texture, null, 2)}
                        </pre>
                      </details>

                      {/* Visual Composition Section */}
                      <details className="bg-white p-2 rounded border border-gray-200">
                        <summary className="font-medium text-xs cursor-pointer">Visual Composition</summary>
                        <pre className="text-xs mt-2 text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(artisticPromptJson.artisticPrompt.visual_composition, null, 2)}
                        </pre>
                      </details>

                      {/* Color Profile Section */}
                      <details className="bg-white p-2 rounded border border-gray-200">
                        <summary className="font-medium text-xs cursor-pointer">Color Profile</summary>
                        <pre className="text-xs mt-2 text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(artisticPromptJson.artisticPrompt.color_profile, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No artistic prompt generated yet</p>
                  )}
                </div>

                {/* Changes Summary (bottom 35%) */}
                <div className="h-[35%] overflow-y-auto p-3 bg-blue-50">
                  <h3 className="text-xs font-medium text-gray-700 mb-2">Latest Changes</h3>
                  {(() => {
                    const latestChanges = chatHistory
                      .filter(msg => msg.role === 'model')
                      .map(msg => {
                        try {
                          return JSON.parse(msg.parts[0].text);
                        } catch {
                          return null;
                        }
                      })
                      .filter(Boolean)
                      .reverse()[0]?.changesSummary || [];

                    return latestChanges.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {latestChanges.map((change: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                            {change}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No changes yet</p>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="border-t p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                  placeholder="Ask for changes (e.g., 'Make it more colorful')"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition text-sm"
                >
                  Send
                </button>
              </div>
              <button
                onClick={handleApplyRefinedPrompt}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                Apply Refined Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
