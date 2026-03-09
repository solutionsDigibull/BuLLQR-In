import { useState, useEffect } from 'react';
import { getTodayTarget, setTodayTarget, completeTarget } from '../../services/config.ts';
import type { ProductionTargetItem } from '../../types/config.ts';

export default function ProductionTargetPanel() {
  const [target, setTarget] = useState<ProductionTargetItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { loadTarget(); }, []);

  async function loadTarget() {
    try {
      const t = await getTodayTarget();
      setTarget(t);
      if (t) setQuantity(String(t.target_quantity));
    } catch {
      setError('Failed to load target');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetTarget(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (!qty || qty < 1) { setError('Enter a valid quantity'); return; }
    setError('');
    setSaving(true);
    try {
      const t = await setTodayTarget(qty);
      setTarget(t);
      setMessage('Target set successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to set target');
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!confirm('Mark today\'s target as completed?')) return;
    setSaving(true);
    try {
      await completeTarget();
      await loadTarget();
      setMessage('Target marked as completed');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to complete target');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading target...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded text-sm">{error}
          <button onClick={() => setError('')} className="ml-2 text-red-500">&times;</button>
        </div>
      )}
      {message && <div className="bg-green-50 text-green-700 px-4 py-2 rounded text-sm">{message}</div>}

      <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">Daily Production Target</h3>

      {target && (
        <div className="bg-white border rounded-md p-4 space-y-2 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Date:</span>
            <span className="font-medium">{target.target_date}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Target Quantity:</span>
            <span className="font-mono font-semibold text-lg">{target.target_quantity}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Status:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${target.is_completed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {target.is_completed ? 'Completed' : 'In Progress'}
            </span>
          </div>
          {target.completed_at && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Completed At:</span>
              <span>{new Date(target.completed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}</span>
            </div>
          )}
          {!target.is_completed && (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="mt-2 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Completing...' : 'Mark as Completed'}
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSetTarget} className="bg-gray-50 border rounded-md p-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {target ? 'Update Today\'s Target' : 'Set Today\'s Target'}
        </p>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Target Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 500"
              required
              className="border rounded px-3 py-1.5 text-sm w-40 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
            />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary-dark disabled:opacity-50">
            {saving ? 'Saving...' : 'Set Target'}
          </button>
        </div>
      </form>
    </div>
  );
}
