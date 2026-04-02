import { useState, useEffect, useRef } from 'react';
import { getStages } from '../../services/scan.ts';
import { createStage, updateStage, deleteStage, uploadSopFile, listSopFiles, deleteSopFile } from '../../services/config.ts';
import type { ProductionStage } from '../../types/scan.ts';
import type { StageCreate, SopFile } from '../../types/config.ts';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StagesManagement() {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ stage_name: string; description: string }>({ stage_name: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // SOP state
  const [sopFiles, setSopFiles] = useState<Record<string, SopFile[]>>({});
  const [sopExpanded, setSopExpanded] = useState<string | null>(null);
  const [sopUploading, setSopUploading] = useState<Record<string, boolean>>({});
  const [sopDeleting, setSopDeleting] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadStages();
  }, []);

  async function loadStages() {
    try {
      const data = await getStages();
      setStages(data);
    } catch {
      setError('Failed to load stages');
    } finally {
      setLoading(false);
    }
  }

  async function expandSop(stageId: string) {
    if (sopExpanded === stageId) {
      setSopExpanded(null);
      return;
    }
    setSopExpanded(stageId);
    if (!sopFiles[stageId]) {
      try {
        const files = await listSopFiles(stageId);
        setSopFiles((prev) => ({ ...prev, [stageId]: files }));
      } catch {
        // ignore, will show empty
        setSopFiles((prev) => ({ ...prev, [stageId]: [] }));
      }
    }
  }

  async function handleSopUpload(stageId: string, file: File) {
    setSopUploading((prev) => ({ ...prev, [stageId]: true }));
    try {
      const uploaded = await uploadSopFile(stageId, file);
      setSopFiles((prev) => ({
        ...prev,
        [stageId]: [...(prev[stageId] ?? []), uploaded],
      }));
      // Refresh stage list to update sop_count badge
      const updated = await getStages();
      setStages(updated);
    } catch {
      setError('Failed to upload SOP file');
    } finally {
      setSopUploading((prev) => ({ ...prev, [stageId]: false }));
    }
  }

  async function handleSopDelete(stageId: string, fileId: string) {
    if (!confirm('Delete this SOP file?')) return;
    setSopDeleting((prev) => ({ ...prev, [fileId]: true }));
    try {
      await deleteSopFile(stageId, fileId);
      setSopFiles((prev) => ({
        ...prev,
        [stageId]: (prev[stageId] ?? []).filter((f) => f.id !== fileId),
      }));
      const updated = await getStages();
      setStages(updated);
    } catch {
      setError('Failed to delete SOP file');
    } finally {
      setSopDeleting((prev) => ({ ...prev, [fileId]: false }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: StageCreate = {
        stage_name: form.stage_name,
        description: form.description || undefined,
      };
      if (editingId) {
        await updateStage(editingId, { stage_name: form.stage_name, description: form.description || undefined });
      } else {
        await createStage(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ stage_name: '', description: '' });
      await loadStages();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save stage');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, force = false) {
    const msg = force
      ? 'This will permanently delete the stage and ALL related scan records. Continue?'
      : 'Delete this stage? This cannot be undone.';
    if (!confirm(msg)) return;
    try {
      await deleteStage(id, force);
      setError('');
      await loadStages();
    } catch (err: any) {
      const detail: string = err.response?.data?.detail || 'Failed to delete stage';
      if (err.response?.status === 409 && !force) {
        if (confirm(detail + '\n\nDo you want to force delete this stage and all related data?')) {
          return handleDelete(id, true);
        }
      } else {
        setError(detail);
      }
    }
  }

  function startEdit(stage: ProductionStage) {
    setEditingId(stage.id);
    setForm({ stage_name: stage.stage_name, description: stage.description || '' });
    setShowForm(true);
  }

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading stages...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 px-4 py-2 rounded text-sm">{error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 dark:text-red-400 hover:text-red-800">&times;</button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">Production Stages</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stages..."
              className="pl-7 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ stage_name: '', description: '' }); }}
            className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary-dark"
          >
            + Add Stage
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">Stage order is configured per product in the Products tab (Edit Product).</p>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-md p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Stage Name</label>
              <input
                value={form.stage_name}
                onChange={(e) => setForm({ ...form, stage_name: e.target.value })}
                required
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary-dark disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="w-full text-sm border dark:border-gray-700 rounded-md overflow-hidden">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">SOP</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {stages.filter((s) => {
            const q = search.toLowerCase();
            return !q || s.stage_name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
          }).map((s) => (
            <>
              <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{s.stage_name}</td>
                <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{s.description || '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {/* File count badge */}
                    {s.sop_count > 0 && (
                      <span className="inline-flex items-center text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        {s.sop_count} file{s.sop_count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {/* Upload button */}
                    <label className={`cursor-pointer text-xs text-primary dark:text-blue-400 hover:underline ${sopUploading[s.id] ? 'opacity-50 pointer-events-none' : ''}`}>
                      {sopUploading[s.id] ? 'Uploading...' : 'Upload'}
                      <input
                        type="file"
                        className="hidden"
                        accept="text/*,image/*,video/*,.pdf,.doc,.docx"
                        ref={(el) => { fileInputRefs.current[s.id] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleSopUpload(s.id, file);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                    {/* Manage toggle */}
                    {s.sop_count > 0 && (
                      <button
                        onClick={() => expandSop(s.id)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        {sopExpanded === s.id ? 'Hide' : 'Manage'}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 space-x-2">
                  <button onClick={() => startEdit(s)} className="text-primary dark:text-blue-400 hover:underline text-xs">Edit</button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-500 dark:text-red-400 hover:underline text-xs">Delete</button>
                </td>
              </tr>
              {/* Expanded SOP file list */}
              {sopExpanded === s.id && (
                <tr key={`${s.id}-sop`} className="bg-gray-50 dark:bg-gray-750">
                  <td colSpan={4} className="px-6 py-3">
                    {(sopFiles[s.id] ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500">No files yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {(sopFiles[s.id] ?? []).map((f) => (
                          <div key={f.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                            <div>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{f.original_filename}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">({formatFileSize(f.file_size)})</span>
                            </div>
                            <button
                              onClick={() => handleSopDelete(s.id, f.id)}
                              disabled={sopDeleting[f.id]}
                              className="text-xs text-red-500 dark:text-red-400 hover:underline disabled:opacity-50"
                            >
                              {sopDeleting[f.id] ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
