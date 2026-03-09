import { useState, useEffect } from 'react';
import { listReworkConfigs, createReworkConfig, updateReworkConfig, deleteReworkConfig } from '../../services/config.ts';
import type { ReworkConfigItem, ReworkConfigCreate } from '../../types/config.ts';

export default function ReworkConfigManagement() {
  const [configs, setConfigs] = useState<ReworkConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReworkConfigCreate>({ rework_detail: '', copq_cost: 0, description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConfigs(); }, []);

  async function loadConfigs() {
    try {
      const data = await listReworkConfigs();
      setConfigs(data);
    } catch {
      setError('Failed to load rework configs');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await updateReworkConfig(editingId, form);
      } else {
        await createReworkConfig(form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ rework_detail: '', copq_cost: 0, description: '' });
      await loadConfigs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Deactivate this rework type?')) return;
    try {
      await deleteReworkConfig(id);
      await loadConfigs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to deactivate');
    }
  }

  async function handleReactivate(id: string) {
    try {
      await updateReworkConfig(id, { is_active: true });
      await loadConfigs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reactivate');
    }
  }

  function startEdit(rc: ReworkConfigItem) {
    setEditingId(rc.id);
    setForm({ rework_detail: rc.rework_detail, copq_cost: rc.copq_cost, description: rc.description || '' });
    setShowForm(true);
  }

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading rework configs...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded text-sm">{error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-800">&times;</button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">Rework Types</h3>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ rework_detail: '', copq_cost: 0, description: '' }); }}
          className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary-dark"
        >
          + Add Rework Type
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-md p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rework Detail</label>
              <input
                value={form.rework_detail}
                onChange={(e) => setForm({ ...form, rework_detail: e.target.value })}
                required
                className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">COPQ Cost</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.copq_cost}
                onChange={(e) => setForm({ ...form, copq_cost: parseFloat(e.target.value) || 0 })}
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
            <th className="px-4 py-2">Rework Detail</th>
            <th className="px-4 py-2">COPQ Cost</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Active</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {configs.map((rc) => (
            <tr key={rc.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${!rc.is_active ? 'opacity-50' : ''}`}>
              <td className="px-4 py-2 font-medium">{rc.rework_detail}</td>
              <td className="px-4 py-2 font-mono">{rc.copq_cost.toFixed(2)}</td>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{rc.description || '—'}</td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${rc.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {rc.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-2 space-x-2">
                <button onClick={() => startEdit(rc)} className="text-primary hover:underline text-xs">Edit</button>
                {rc.is_active ? (
                  <button onClick={() => handleDeactivate(rc.id)} className="text-red-500 hover:underline text-xs">Deactivate</button>
                ) : (
                  <button onClick={() => handleReactivate(rc.id)} className="text-green-600 hover:underline text-xs">Reactivate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
