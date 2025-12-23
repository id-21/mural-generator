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

export default function HomePage() {
  const [importStats, setImportStats] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [recentGenerations, setRecentGenerations] = useState<GeneratedMural[]>([]);
  const [batchStats, setBatchStats] = useState({ pending: 0, running: 0, completed: 0, failed: 0, expired: 0, cancelled: 0 });
  const [isGenerating, setIsGenerating] = useState(false);

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
      const res = await fetch('/api/batch-descriptions/start', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        alert(`Created ${data.jobsCreated} batch jobs. Descriptions will generate in background.\n\nCheck back in a few minutes and click "Process Completed Jobs" to save results.`);
        pollBatchJobs();
      } else {
        alert(`Error: ${data.error || 'Failed to create batch jobs'}`);
      }
    } catch (error) {
      console.error('Failed to generate descriptions:', error);
      alert('Failed to create batch jobs. Check console for details.');
    } finally {
      setIsGenerating(false);
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
    </div>
  );
}
