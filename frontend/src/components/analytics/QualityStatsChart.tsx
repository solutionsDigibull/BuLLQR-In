import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { QualityStats } from '../../types/analytics.ts';

interface QualityStatsChartProps {
  stats: QualityStats;
}

const OK_COLOR = '#4CAF50';
const NOK_COLOR = '#F44336';

export default function QualityStatsChart({ stats }: QualityStatsChartProps) {
  if (stats.total_scans === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-4">Quality Statistics</h3>
        <p className="text-sm text-gray-400">No scan data available.</p>
      </div>
    );
  }

  const data = [
    { name: 'OK', value: stats.ok_count, pct: stats.ok_percentage },
    { name: 'NOT OK', value: stats.not_ok_count, pct: stats.not_ok_percentage },
  ];
  const COLORS = [OK_COLOR, NOK_COLOR];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-2">Quality Statistics</h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width="50%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_entry, index) => (
                <Cell key={index} fill={COLORS[index]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number | undefined) => value ?? 0} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.total_scans}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Scans</p>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-lg font-semibold text-green-600">
                {stats.ok_percentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">OK ({stats.ok_count})</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-red-600">
                {stats.not_ok_percentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">NOT OK ({stats.not_ok_count})</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
