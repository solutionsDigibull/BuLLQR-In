import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import type { ReworkCost } from '../../types/config.ts';
import { listReworkCosts, updateReworkCost } from '../../services/config.ts';

export default function ReworkCostConfig() {
  const [costs, setCosts] = useState<ReworkCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState('');
  const [editCurrency, setEditCurrency] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listReworkCosts();
        if (!cancelled) {
          setCosts(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Failed to load rework costs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function startEdit(cost: ReworkCost) {
    setEditingId(cost.stage_id);
    setEditCost(cost.cost_per_rework.toString());
    setEditCurrency(cost.currency);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function handleSave(stageId: string) {
    const costValue = parseFloat(editCost);
    if (isNaN(costValue) || costValue < 0) {
      setError('Cost must be a non-negative number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateReworkCost(stageId, {
        cost_per_rework: costValue,
        currency: editCurrency.trim() || undefined,
      });
      setCosts((prev) => prev.map((c) => (c.stage_id === stageId ? updated : c)));
      setEditingId(null);
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.detail || 'Failed to update cost.' : 'Failed to update cost.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Rework Costs</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider dark:bg-gray-700 dark:text-gray-300">
              <th className="px-4 py-3 text-left">Stage</th>
              <th className="px-4 py-3 text-right">Cost per Rework</th>
              <th className="px-4 py-3 text-center">Currency</th>
              <th className="px-4 py-3 text-left">Effective From</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {costs.map((cost) => (
              <tr key={cost.stage_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{cost.stage_name}</td>
                <td className="px-4 py-3 text-right">
                  {editingId === cost.stage_id ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                      autoFocus
                    />
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300">
                      {cost.cost_per_rework.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {editingId === cost.stage_id ? (
                    <input
                      type="text"
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value)}
                      className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                      maxLength={5}
                    />
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">{cost.currency}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                  {new Date(cost.effective_from).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === cost.stage_id ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(cost.stage_id)}
                        disabled={saving}
                        className="text-xs text-primary hover:text-primary-dark font-medium disabled:opacity-60"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(cost)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {costs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No rework cost configuration found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
