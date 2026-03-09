import { useEffect, useRef, useState } from 'react';
import { useWebSocketSubscribe } from '../context/WebSocketContext.tsx';
import {
  getDashboard,
  getOperatorPerformance,
  getOperatorStageMatrix,
} from '../services/analytics.ts';
import type {
  DashboardData,
  OperatorPerformanceEntry,
  OperatorMatrixRow,
} from '../types/analytics.ts';
import ProductionProgressChart from '../components/analytics/ProductionProgressChart.tsx';
import QualityStatsChart from '../components/analytics/QualityStatsChart.tsx';
import OperatorPerformanceChart from '../components/analytics/OperatorPerformanceChart.tsx';
import OperatorStageMatrixTable from '../components/analytics/OperatorStageMatrixTable.tsx';
import CelebrationOverlay from '../components/analytics/CelebrationOverlay.tsx';
import ExportPanel from '../components/analytics/ExportPanel.tsx';
import AIChatWidget from '../components/analytics/AIChatWidget.tsx';

const REFRESH_INTERVAL = 30_000;

export default function AnalyticsPage() {
  const subscribe = useWebSocketSubscribe();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [operators, setOperators] = useState<OperatorPerformanceEntry[]>([]);
  const [matrix, setMatrix] = useState<OperatorMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const prevTargetStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        const [dashData, opData, matrixData] = await Promise.all([
          getDashboard(),
          getOperatorPerformance(),
          getOperatorStageMatrix(),
        ]);
        if (cancelled) return;

        // Detect target completion transition
        const prev = prevTargetStatusRef.current;
        if (prev && prev !== 'completed' && dashData.production_progress.target_status === 'completed') {
          setShowCelebration(true);
        }
        prevTargetStatusRef.current = dashData.production_progress.target_status;

        setDashboard(dashData);
        setOperators(opData.operators);
        setMatrix(matrixData.matrix);
        setError(null);
      } catch {
        if (!cancelled) setError('Failed to load analytics data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    const timer = setInterval(fetchAll, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Refresh on WebSocket events
  useEffect(() => {
    const unsub1 = subscribe('progress_updated', () => {
      getDashboard().then(setDashboard).catch(() => {});
    });
    const unsub2 = subscribe('scan_created', () => {
      Promise.all([getDashboard(), getOperatorPerformance(), getOperatorStageMatrix()])
        .then(([d, o, m]) => {
          setDashboard(d);
          setOperators(o.operators);
          setMatrix(m.matrix);
        })
        .catch(() => {});
    });
    return () => { unsub1(); unsub2(); };
  }, [subscribe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error || 'No data available.'}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Analytics Dashboard</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">Auto-refreshes every 30s</span>
      </div>

      {/* AI Chat Widget */}
      <AIChatWidget />

      {/* Row 1: Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-3xl font-bold text-primary">{dashboard.today_unique_count}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unique Assemblies Today</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{dashboard.quality_stats.total_scans}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Scans</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className={`text-3xl font-bold ${
            dashboard.quality_stats.ok_percentage >= 95 ? 'text-green-600' : 'text-orange-600'
          }`}>
            {dashboard.quality_stats.ok_percentage.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Overall OK Rate</p>
        </div>
      </div>

      {/* Row 2: Production progress */}
      <div className="mb-6">
        <ProductionProgressChart
          stages={dashboard.production_progress.stages}
          targetStatus={dashboard.production_progress.target_status}
        />
      </div>

      {/* Row 3: Quality stats */}
      <div className="mb-6">
        <QualityStatsChart stats={dashboard.quality_stats} />
      </div>

      {/* Row 3: Operator performance */}
      <div className="mb-6">
        <OperatorPerformanceChart operators={operators} />
      </div>

      {/* Row 4: Operator x Stage matrix (full width) */}
      <div className="mb-6">
        <OperatorStageMatrixTable matrix={matrix} />
      </div>

      {/* Row 5: Export panel */}
      <div className="mb-6">
        <ExportPanel />
      </div>

      {showCelebration && (
        <CelebrationOverlay onDismiss={() => setShowCelebration(false)} />
      )}
    </div>
  );
}
