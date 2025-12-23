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
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Set the prompt
        setPrompt(data.refinedPrompt);

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
    if (showChatModal && chatHistory.length === 0 && prompt) {
      // Fallback: If somehow chat wasn't initialized during analysis, initialize now
      setChatHistory([
        {
          role: 'model',
          parts: [{
            text: JSON.stringify({
              conversationalResponse: "Hi! I can help you refine your mural generation prompt. What changes would you like to make? For example, you could ask me to make it more colorful, add specific elements, change the artistic style, or adjust any other aspect.",
              refinedPrompt: prompt,
              changesSummary: []
            })
          }]
        }
      ]);
    }
  }, [showChatModal, prompt, chatHistory.length]);

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
          currentPrompt: prompt  // Pass current prompt
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Store the full JSON response from AI
        const aiResponse = {
          conversationalResponse: data.conversationalResponse,
          refinedPrompt: data.refinedPrompt,
          changesSummary: data.changesSummary,
        };

        // Add AI response to history (store as JSON string)
        setChatHistory(prev => [...prev, {
          role: 'model',
          parts: [{ text: JSON.stringify(aiResponse) }]
        }]);

        // Update prompt with refined version
        setPrompt(data.refinedPrompt);
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
              {prompt && !isCustomPrompt && (
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

      {/* Chat Refinement Modal */}
      {showChatModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setShowChatModal(false)}
        >
          <div
            className="relative bg-white rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col m-4"
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

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                        {aiData.changesSummary && aiData.changesSummary.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-300">
                            <p className="text-xs font-medium text-gray-600 mb-1">Changes made:</p>
                            <ul className="text-xs text-gray-600 list-disc list-inside">
                              {aiData.changesSummary.map((change: string, i: number) => (
                                <li key={i}>{change}</li>
                              ))}
                            </ul>
                          </div>
                        )}
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
