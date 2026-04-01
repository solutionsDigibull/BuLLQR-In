import { useEffect, useRef, useState } from 'react';
import { useWebSocketSubscribe } from '../context/WebSocketContext.tsx';
import { getDashboard } from '../services/analytics.ts';
import { listProducts } from '../services/config.ts';
import type { DashboardData } from '../types/analytics.ts';
import type { Product } from '../types/config.ts';
import ProductionProgressChart from '../components/analytics/ProductionProgressChart.tsx';
import CelebrationOverlay from '../components/analytics/CelebrationOverlay.tsx';
import ExportPanel from '../components/analytics/ExportPanel.tsx';
import AIChatWidget from '../components/analytics/AIChatWidget.tsx';
import ProductWisePerformance from '../components/analytics/ProductWisePerformance.tsx';

const REFRESH_INTERVAL = 30_000;

export default function AnalyticsPage() {
  const subscribe = useWebSocketSubscribe();

  const todayStr = new Date().toISOString().slice(0, 10);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const prevTargetStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    listProducts().then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        const pid = selectedProductId || undefined;
        const dashData = await getDashboard(pid, selectedDate);
        if (cancelled) return;

        // Detect target completion transition
        const prev = prevTargetStatusRef.current;
        if (prev && prev !== 'completed' && dashData.production_progress.target_status === 'completed') {
          setShowCelebration(true);
        }
        prevTargetStatusRef.current = dashData.production_progress.target_status;

        setDashboard(dashData);
        setError(null);
      } catch {
        if (!cancelled) setError('Failed to load analytics data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    const timer = selectedDate === todayStr ? setInterval(fetchAll, REFRESH_INTERVAL) : null;

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [selectedProductId, selectedDate]);

  // Refresh on WebSocket events (only when viewing today)
  useEffect(() => {
    if (selectedDate !== todayStr) return;
    const pid = selectedProductId || undefined;
    const unsub1 = subscribe('progress_updated', () => {
      getDashboard(pid, selectedDate).then(setDashboard).catch(() => {});
    });
    const unsub2 = subscribe('scan_created', () => {
      getDashboard(pid, selectedDate).then(setDashboard).catch(() => {});
    });
    return () => { unsub1(); unsub2(); };
  }, [subscribe, selectedProductId, selectedDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
        {error || 'No data available.'}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Analytics Dashboard</h2>
        <div className="flex items-center gap-3">
          {selectedDate === todayStr && (
            <span className="text-xs text-gray-400 dark:text-gray-500">Auto-refreshes every 30s</span>
          )}
          <div className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-800 shadow-sm">
            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="text-sm bg-transparent text-gray-700 dark:text-gray-200 outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* AI Chat Widget */}
      <AIChatWidget />

      {/* Product-wise Performance — always visible */}
      <ProductWisePerformance date={selectedDate} />

      {/* Product Filter */}
      <div className="mb-6">
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="block w-full max-w-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.product_code} — {p.product_name}
            </option>
          ))}
        </select>
      </div>

      {/* Product-specific sections — only shown when a product is selected */}
      {selectedProductId ? (
        <>
          {/* Stage-wise OK / NOT OK breakdown */}
          {dashboard.production_progress.stages.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">Stage-wise Quality Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <th className="px-5 py-2">Stage</th>
                      <th className="px-5 py-2 text-center">Total</th>
                      <th className="px-5 py-2 text-center">OK</th>
                      <th className="px-5 py-2 text-center">NOT OK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {[...dashboard.production_progress.stages]
                      .sort((a, b) => a.stage_sequence - b.stage_sequence)
                      .map((stage) => (
                      <tr key={stage.stage_name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-5 py-2 font-medium text-gray-700 dark:text-gray-300">{stage.stage_name}</td>
                        <td className="px-5 py-2 text-center text-gray-800 dark:text-gray-200 font-semibold">{stage.current_count}</td>
                        <td className="px-5 py-2 text-center text-green-600 font-semibold">{stage.ok_count}</td>
                        <td className="px-5 py-2 text-center text-red-600 font-semibold">{stage.not_ok_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Production progress */}
          <div className="mb-6">
            <ProductionProgressChart
              stages={dashboard.production_progress.stages}
              targetStatus={dashboard.production_progress.target_status}
            />
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Select a product to view quality summary, stage details, and production progress.</p>
        </div>
      )}

      {/* Export panel */}
      <div className="mb-6">
        <ExportPanel />
      </div>

      {showCelebration && (
        <CelebrationOverlay onDismiss={() => setShowCelebration(false)} />
      )}
    </div>
  );
}
