'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ReferenceMural {
  id: string;
  collectionName: string;
  designName: string;
  colorVariant: string | null;
  localFilePath: string;
  fileName: string;
  importedAt: Date;
}

interface GeneratedMural {
  id: string;
  referenceMuralId: string;
  fileName: string;
  createdAt: Date;
  referenceMural: ReferenceMural;
}

interface BatchConflictSummary {
  totalMurals: number;
  conflicts: {
    pending: number;
    running: number;
    succeeded: number;
    failed: number;
    expired: number;
    cancelled: number;
  };
}

interface BatchResolutionPreview {
  strategy: 'SKIP_CONFLICTS' | 'RETRY_FAILED' | 'REPLACE_ALL';
  willCreate: number;
  willSkip: number;
  willArchive: number;
  warnings: string[];
}

interface ConflictCheckResult {
  conflictSummary: BatchConflictSummary;
  previews: {
    SKIP_CONFLICTS: BatchResolutionPreview;
    RETRY_FAILED: BatchResolutionPreview;
    REPLACE_ALL: BatchResolutionPreview;
  };
}

export default function HomePage() {
  const [importStats, setImportStats] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [recentGenerations, setRecentGenerations] = useState<GeneratedMural[]>([]);
  const [batchStats, setBatchStats] = useState({ pending: 0, running: 0, completed: 0, failed: 0, expired: 0, cancelled: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictCheckResult | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<'SKIP_CONFLICTS' | 'RETRY_FAILED' | 'REPLACE_ALL'>('RETRY_FAILED');
  const [isApplyingStrategy, setIsApplyingStrategy] = useState(false);

  useEffect(() => {
    loadStats();
    loadRecentGenerations();
    pollBatchJobs();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch('/api/import');
      const data = await res.json();
      setImportStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async function loadRecentGenerations() {
    try {
      const res = await fetch('/api/generated-murals?limit=10');
      const data = await res.json();
      setRecentGenerations(data.generatedMurals || []);
    } catch (error) {
      console.error('Failed to load generations:', error);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const res = await fetch('/api/import', { method: 'POST' });
      const data = await res.json();
      alert(`Import complete!\nImported: ${data.imported}\nSkipped: ${data.skipped}\nTotal: ${data.total}`);
      loadStats();
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Check console for details.');
    } finally {
      setImporting(false);
    }
  }

  async function pollBatchJobs() {
    try {
      const res = await fetch('/api/batch-descriptions/poll');
      const stats = await res.json();
      setBatchStats(stats);
    } catch (error) {
      console.error('Failed to poll batch jobs:', error);
    }
  }

  async function handleGenerateDescriptions() {
    setIsGenerating(true);
    try {
      // Step 1: Check for conflicts
      const res = await fetch('/api/batch-descriptions/check');
      const data = await res.json();

      if (res.ok) {
        const conflictData = data as ConflictCheckResult;
        const totalConflicts = Object.values(conflictData.conflictSummary.conflicts).reduce((a, b) => a + b, 0);

        if (totalConflicts === 0) {
          // No conflicts - proceed directly
          await applyStrategy('SKIP_CONFLICTS'); // Any strategy works when no conflicts
        } else {
          // Show conflict modal for user decision
          setConflictData(conflictData);
          setSelectedStrategy('RETRY_FAILED'); // Default to safe option
          setShowConflictModal(true);
        }
      } else {
        alert(`Error checking conflicts: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to check conflicts:', error);
      alert('Failed to check for existing jobs. Check console for details.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function applyStrategy(strategy: 'SKIP_CONFLICTS' | 'RETRY_FAILED' | 'REPLACE_ALL') {
    setIsApplyingStrategy(true);
    try {
      const res = await fetch('/api/batch-descriptions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy })
      });
      const data = await res.json();

      if (res.ok) {
        alert(
          `Successfully created ${data.jobsCreated} batch jobs!\n` +
          `Skipped: ${data.jobsSkipped}\n` +
          `Archived: ${data.jobsArchived}\n\n` +
          `Jobs will process in background. Click "Process Completed Jobs" later to save results.`
        );
        setShowConflictModal(false);
        pollBatchJobs();
      } else {
        alert(`Error: ${data.error || 'Failed to create batch jobs'}`);
      }
    } catch (error) {
      console.error('Failed to apply strategy:', error);
      alert('Failed to create batch jobs. Check console for details.');
    } finally {
      setIsApplyingStrategy(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Stats Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Library Status</h2>

        {importStats ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Reference Murals</p>
              <p className="text-3xl font-bold text-blue-600">{importStats.totalMurals || 0}</p>
            </div>
            <div>
              <p className="text-gray-600">Collections</p>
              <p className="text-3xl font-bold text-purple-600">{importStats.totalCollections || 0}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Loading stats...</p>
        )}

        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Import Reference Murals'}
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Scans your local directory and imports all -design images
            </p>
          </div>

          <div className="flex-1">
            <button
              onClick={handleGenerateDescriptions}
              disabled={isGenerating || batchStats.pending > 0 || batchStats.running > 0}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Creating Jobs...' : `Generate Artistic Descriptions`}
            </button>
            <p className="text-sm text-gray-500 mt-2">
              {batchStats.pending > 0 || batchStats.running > 0 ? (
                <span className="text-orange-600 font-medium">
                  {batchStats.pending} pending, {batchStats.running} running, {batchStats.completed} completed
                </span>
              ) : batchStats.completed > 0 ? (
                <span className="text-green-600 font-medium">
                  {batchStats.completed} descriptions completed, {batchStats.failed} failed
                </span>
              ) : (
                'AI analyzes murals for better generation prompts'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Generations */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Generations</h2>

        {recentGenerations.length > 0 ? (
          <div className="space-y-3">
            {recentGenerations.map((gen) => (
              <div key={gen.id} className="border-l-4 border-green-500 pl-4 py-2">
                <p className="font-medium">{gen.fileName}</p>
                <p className="text-sm text-gray-600">
                  From: {gen.referenceMural.collectionName} / {gen.referenceMural.designName}
                  {gen.referenceMural.colorVariant && ` / ${gen.referenceMural.colorVariant}`}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(gen.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No generations yet. Create your first mural!</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          href="/browse"
          className="bg-purple-600 text-white rounded-lg p-6 text-center hover:bg-purple-700 transition"
        >
          <h3 className="text-xl font-semibold mb-2">Browse Reference Library</h3>
          <p className="text-purple-100 text-sm">
            Explore your collection of reference murals
          </p>
        </Link>

        <Link
          href="/generate"
          className="bg-green-600 text-white rounded-lg p-6 text-center hover:bg-green-700 transition"
        >
          <h3 className="text-xl font-semibold mb-2">Generate New Mural</h3>
          <p className="text-green-100 text-sm">
            Create AI-generated murals from reference designs
          </p>
        </Link>

        <Link
          href="/gallery"
          className="bg-blue-600 text-white rounded-lg p-6 text-center hover:bg-blue-700 transition"
        >
          <h3 className="text-xl font-semibold mb-2">View Gallery</h3>
          <p className="text-blue-100 text-sm">
            Browse all generated murals
          </p>
        </Link>
      </div>

      {/* Conflict Resolution Modal */}
      {showConflictModal && conflictData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowConflictModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">Resolve Batch Job Conflicts</h2>
              <button
                onClick={() => setShowConflictModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Conflict Summary */}
            <div className="px-6 py-4 border-b bg-gray-50">
              <h3 className="font-semibold mb-2">Existing Jobs Found</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Murals:</span>{' '}
                  <span className="font-semibold">{conflictData.conflictSummary.totalMurals}</span>
                </div>
                <div>
                  <span className="text-gray-600">Pending:</span>{' '}
                  <span className="font-semibold text-yellow-600">{conflictData.conflictSummary.conflicts.pending}</span>
                </div>
                <div>
                  <span className="text-gray-600">Running:</span>{' '}
                  <span className="font-semibold text-blue-600">{conflictData.conflictSummary.conflicts.running}</span>
                </div>
                <div>
                  <span className="text-gray-600">Succeeded:</span>{' '}
                  <span className="font-semibold text-green-600">{conflictData.conflictSummary.conflicts.succeeded}</span>
                </div>
                <div>
                  <span className="text-gray-600">Failed:</span>{' '}
                  <span className="font-semibold text-red-600">{conflictData.conflictSummary.conflicts.failed}</span>
                </div>
                <div>
                  <span className="text-gray-600">Expired/Cancelled:</span>{' '}
                  <span className="font-semibold text-gray-600">
                    {conflictData.conflictSummary.conflicts.expired + conflictData.conflictSummary.conflicts.cancelled}
                  </span>
                </div>
              </div>
            </div>

            {/* Strategy Selection */}
            <div className="px-6 py-4">
              <h3 className="font-semibold mb-4">Choose Resolution Strategy</h3>

              <div className="space-y-3">
                {/* Strategy 1: Skip Conflicts */}
                <label
                  className={`block border rounded-lg p-4 cursor-pointer transition ${
                    selectedStrategy === 'SKIP_CONFLICTS'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-start">
                    <input
                      type="radio"
                      name="strategy"
                      value="SKIP_CONFLICTS"
                      checked={selectedStrategy === 'SKIP_CONFLICTS'}
                      onChange={(e) => setSelectedStrategy(e.target.value as any)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-semibold mb-1">Skip Conflicts (Safest)</div>
                      <div className="text-sm text-gray-600 mb-2">
                        Only create jobs for murals that don't have any existing batch jobs
                      </div>
                      <div className="text-sm bg-white border border-gray-200 rounded p-2">
                        <div>✅ Will create: <strong>{conflictData.previews.SKIP_CONFLICTS.willCreate}</strong> new jobs</div>
                        <div>⏭️ Will skip: <strong>{conflictData.previews.SKIP_CONFLICTS.willSkip}</strong> existing jobs</div>
                        {conflictData.previews.SKIP_CONFLICTS.warnings.length > 0 && (
                          <div className="mt-2 text-orange-600">
                            {conflictData.previews.SKIP_CONFLICTS.warnings.map((w, i) => (
                              <div key={i}>⚠️ {w}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </label>

                {/* Strategy 2: Retry Failed Only (DEFAULT) */}
                <label
                  className={`block border rounded-lg p-4 cursor-pointer transition ${
                    selectedStrategy === 'RETRY_FAILED'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-start">
                    <input
                      type="radio"
                      name="strategy"
                      value="RETRY_FAILED"
                      checked={selectedStrategy === 'RETRY_FAILED'}
                      onChange={(e) => setSelectedStrategy(e.target.value as any)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-semibold mb-1 text-green-700">
                        Retry Failed Only (Recommended) ✨
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        Keep successful and in-progress jobs, only replace failed/expired/cancelled ones
                      </div>
                      <div className="text-sm bg-white border border-gray-200 rounded p-2">
                        <div>✅ Will create: <strong>{conflictData.previews.RETRY_FAILED.willCreate}</strong> new jobs</div>
                        <div>⏭️ Will skip: <strong>{conflictData.previews.RETRY_FAILED.willSkip}</strong> active jobs</div>
                        <div>📦 Will archive: <strong>{conflictData.previews.RETRY_FAILED.willArchive}</strong> failed jobs</div>
                        {conflictData.previews.RETRY_FAILED.warnings.length > 0 && (
                          <div className="mt-2 text-blue-600">
                            {conflictData.previews.RETRY_FAILED.warnings.map((w, i) => (
                              <div key={i}>ℹ️ {w}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </label>

                {/* Strategy 3: Replace All */}
                <label
                  className={`block border rounded-lg p-4 cursor-pointer transition ${
                    selectedStrategy === 'REPLACE_ALL'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-start">
                    <input
                      type="radio"
                      name="strategy"
                      value="REPLACE_ALL"
                      checked={selectedStrategy === 'REPLACE_ALL'}
                      onChange={(e) => setSelectedStrategy(e.target.value as any)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-semibold mb-1 text-red-700">Replace All (Destructive)</div>
                      <div className="text-sm text-gray-600 mb-2">
                        Delete ALL existing jobs and create fresh batch jobs for everything
                      </div>
                      <div className="text-sm bg-white border border-gray-200 rounded p-2">
                        <div>✅ Will create: <strong>{conflictData.previews.REPLACE_ALL.willCreate}</strong> new jobs</div>
                        <div>📦 Will archive: <strong>{conflictData.previews.REPLACE_ALL.willArchive}</strong> existing jobs</div>
                        {conflictData.previews.REPLACE_ALL.warnings.length > 0 && (
                          <div className="mt-2 text-red-600 font-semibold">
                            {conflictData.previews.REPLACE_ALL.warnings.map((w, i) => (
                              <div key={i}>{w}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t px-6 py-4 flex justify-between items-center sticky bottom-0 bg-white">
              <button
                onClick={() => setShowConflictModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                disabled={isApplyingStrategy}
              >
                Cancel
              </button>
              <button
                onClick={() => applyStrategy(selectedStrategy)}
                disabled={isApplyingStrategy}
                className={`px-6 py-2 rounded font-semibold transition ${
                  selectedStrategy === 'REPLACE_ALL'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isApplyingStrategy ? 'Applying...' : `Apply ${selectedStrategy.replace(/_/g, ' ')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
