import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { getRejectedCables, applyRework, updateReworkType, getCOPQSummary, getReworkHistoryForScan } from '../services/copq.ts';
import { listReworkCategories } from '../services/config.ts';
import { formatIST } from '../utils/timezone.ts';
import type { RejectedCable, COPQSummary, ReworkHistoryEntry } from '../services/copq.ts';
import type { ReworkCategory } from '../types/config.ts';

type ViewMode = 'browse' | 'summary';

export default function COPQPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ViewMode>('browse');

  // Browse state
  const [cables, setCables] = useState<RejectedCable[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Summary state
  const [summary, setSummary] = useState<COPQSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Rework modal
  const [reworkCategories, setReworkCategories] = useState<ReworkCategory[]>([]);
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [selectedCable, setSelectedCable] = useState<RejectedCable | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [reworkNotes, setReworkNotes] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [reworkHistory, setReworkHistory] = useState<ReworkHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    listReworkCategories(true).then(setReworkCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'browse') loadCables();
    else loadSummary();
  }, [mode, page, startDate, endDate]);

  async function loadCables() {
    setLoading(true);
    try {
      const data = await getRejectedCables({
        page,
        per_page: 20,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setCables(data.items);
      setTotal(data.total);
    } catch {
      setError('Failed to load rejected cables');
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const data = await getCOPQSummary({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setSummary(data);
    } catch {
      setError('Failed to load COPQ summary');
    } finally {
      setSummaryLoading(false);
    }
  }

  function openReworkModal(cable: RejectedCable) {
    setSelectedCable(cable);
    setSelectedConfigId('');
    setReworkNotes('');
    setReworkHistory([]);
    setShowReworkModal(true);

    // Load rework history if this cable already has rework applied
    if (cable.rework_history_id) {
      setHistoryLoading(true);
      getReworkHistoryForScan(cable.scan_id)
        .then((data) => setReworkHistory(data.filter((h) => !h.is_active)))
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    }
  }

  async function handleApplyRework() {
    if (!selectedCable || !selectedConfigId || !user) return;
    setApplying(true);
    setError('');
    try {
      if (selectedCable.rework_history_id) {
        await updateReworkType(selectedCable.rework_history_id, selectedConfigId, user.full_name, reworkNotes || undefined);
      } else {
        await applyRework({
          scan_record_id: selectedCable.scan_id,
          work_order_id: selectedCable.work_order_id,
          rework_config_id: selectedConfigId,
          applied_by: user.full_name,
          notes: reworkNotes || undefined,
        });
      }
      setShowReworkModal(false);
      await loadCables();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to apply rework');
    } finally {
      setApplying(false);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">COPQ Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('browse')}
            className={`px-3 py-1.5 text-sm rounded ${mode === 'browse' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          >
            Rejected Cables
          </button>
          <button
            onClick={() => setMode('summary')}
            className={`px-3 py-1.5 text-sm rounded ${mode === 'summary' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          >
            COPQ Summary
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 px-4 py-2 rounded text-sm">{error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 dark:text-red-400">&times;</button>
        </div>
      )}

      {/* Date filters */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-2 py-1.5 text-sm" />
        </div>
        <button onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
          Clear
        </button>
      </div>

      {/* Browse Mode */}
      {mode === 'browse' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <p className="p-4 text-sm text-gray-500">Loading...</p>
          ) : cables.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No rejected cables found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      <th className="px-3 py-2">Serial</th>
                      <th className="px-3 py-2">Work Order</th>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2">Operator</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Rework</th>
                      <th className="px-3 py-2">COPQ</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {cables.map((c) => (
                      <tr key={c.scan_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">{c.serial_number || '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-800 dark:text-gray-200">{c.work_order_code}</td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{c.stage_name}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.operator_name}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{formatIST(c.scan_timestamp)}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                            {c.quality_status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">{c.rework_detail || <span className="text-gray-300 dark:text-gray-600">None</span>}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">{c.rework_copq_cost != null ? c.rework_copq_cost.toFixed(2) : '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={c.rework_notes || ''}>{c.rework_notes || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => openReworkModal(c)}
                            className="text-primary hover:underline text-xs"
                          >
                            {c.rework_history_id ? 'Change' : 'Apply'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Page {page} of {totalPages} ({total} total)</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 rounded disabled:opacity-50">Prev</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 rounded disabled:opacity-50">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Summary Mode */}
      {mode === 'summary' && (
        <div className="space-y-4">
          {summaryLoading ? (
            <p className="text-sm text-gray-500">Loading summary...</p>
          ) : summary ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{summary.total_rejected}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Rejected</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">{summary.total_reworked}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Reworked</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{summary.total_copq_cost.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total COPQ Cost</p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      <th className="px-4 py-2">Stage</th>
                      <th className="px-4 py-2">Rejections</th>
                      <th className="px-4 py-2">Reworked</th>
                      <th className="px-4 py-2">COPQ Cost</th>
                      <th className="px-4 py-2">Rework Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {summary.by_stage.map((s) => (
                      <tr key={s.stage_name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{s.stage_name}</td>
                        <td className="px-4 py-2 text-red-600 dark:text-red-400">{s.rejection_count}</td>
                        <td className="px-4 py-2 text-orange-600 dark:text-orange-400">{s.reworked_count}</td>
                        <td className="px-4 py-2 font-mono text-gray-800 dark:text-gray-200">{s.total_copq_cost.toFixed(2)}</td>
                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                          {s.rework_details.length > 0
                            ? s.rework_details.map((d) => `${d.rework_detail} (${d.count})`).join(', ')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">No summary data available.</p>
          )}
        </div>
      )}

      {/* Rework Modal */}
      {showReworkModal && selectedCable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {selectedCable.rework_history_id ? 'Change Rework Type' : 'Apply Rework'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              WO: <span className="font-mono">{selectedCable.work_order_code}</span> | Stage: {selectedCable.stage_name}
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Rework Type</label>
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-3 py-2 text-sm"
              >
                <option value="">Select rework type...</option>
                {reworkCategories.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    {cat.rework_configs?.filter((rc) => rc.is_active).map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        {rc.rework_detail} — {rc.copq_cost.toFixed(2)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Notes (optional)</label>
              <textarea
                value={reworkNotes}
                onChange={(e) => setReworkNotes(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-3 py-2 text-sm"
                rows={2}
              />
            </div>

            {/* Rework History */}
            {selectedCable.rework_history_id && (
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">History</label>
                {historyLoading ? (
                  <p className="text-xs text-gray-400">Loading history...</p>
                ) : reworkHistory.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                    {reworkHistory.map((h) => (
                      <div key={h.id} className="px-3 py-2 text-xs">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700 dark:text-gray-200">{h.rework_detail}</span>
                          <span className="text-gray-400">{h.rework_date ? formatIST(h.rework_date) : '—'}</span>
                        </div>
                        <div className="text-gray-500 mt-0.5">
                          By: {h.applied_by} | Cost: {h.copq_cost.toFixed(2)}
                        </div>
                        {h.notes && (
                          <div className="text-gray-400 mt-0.5 italic">Note: {h.notes}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No previous changes.</p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReworkModal(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                Cancel
              </button>
              <button
                onClick={handleApplyRework}
                disabled={!selectedConfigId || applying}
                className="px-4 py-2 bg-primary text-white text-sm rounded hover:bg-primary-dark disabled:opacity-50"
              >
                {applying ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
