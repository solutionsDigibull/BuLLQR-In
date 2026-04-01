import { useEffect, useState } from 'react';
import { getProductPerformance } from '../../services/analytics.ts';
import type { ProductPerformanceEntry } from '../../types/analytics.ts';

interface Props {
  date?: string;
}

export default function ProductWisePerformance({ date }: Props) {
  const [data, setData] = useState<ProductPerformanceEntry[]>([]);
  const [days, setDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProductPerformance(days, date)
      .then((res) => setData(res.products))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [days, date]);

  function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
    if (trend === 'up') {
      return (
        <span className="inline-flex items-center text-green-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
        </span>
      );
    }
    if (trend === 'down') {
      return (
        <span className="inline-flex items-center text-red-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      );
    }
    return <span className="text-gray-400 dark:text-gray-500 font-bold">—</span>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">Product-wise Performance</h3>
        </div>
        {!date && (
          <button
            onClick={() => setDays((d) => (d === 7 ? 30 : 7))}
            className="text-xs px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {days === 7 ? 'Weekly Average' : 'Monthly Average'}
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No product scan data available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-2">Category</th>
                <th className="px-5 py-2 text-center">Yield Rate</th>
                <th className="px-5 py-2 text-center">Defect Rate</th>
                <th className="px-5 py-2 text-center">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.map((row) => (
                <tr key={row.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{row.product_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{row.product_code}</p>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`font-semibold ${row.yield_rate >= 95 ? 'text-green-500' : row.yield_rate >= 80 ? 'text-orange-500' : 'text-red-500'}`}>
                      {row.total_scans === 0 ? '—' : `${row.yield_rate.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`font-medium ${row.defect_rate > 5 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                      {row.total_scans === 0 ? '—' : `${row.defect_rate.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {row.total_scans === 0 ? (
                      <span className="text-gray-400 dark:text-gray-500 font-bold">—</span>
                    ) : (
                      <TrendIcon trend={row.trend} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
