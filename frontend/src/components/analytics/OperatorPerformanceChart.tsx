import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { OperatorPerformanceEntry } from '../../types/analytics.ts';
import { useTheme } from '../../context/ThemeContext.tsx';

interface OperatorPerformanceChartProps {
  operators: OperatorPerformanceEntry[];
}

const OK_COLOR = '#3B82F6';

export default function OperatorPerformanceChart({
  operators,
}: OperatorPerformanceChartProps) {
  if (operators.length === 0) {
    return <p className="text-sm text-gray-400">No operator data available.</p>;
  }

  // Flatten: one bar per operator + stage (only stages with scans)
  const data: { name: string; ok: number; not_ok: number }[] = [];
  operators.forEach((op) => {
    op.stages.forEach((s) => {
      if (s.scan_count > 0) {
        data.push({
          name: `${op.operator_name} - ${s.stage_name}`,
          ok: s.ok_count,
          not_ok: s.not_ok_count,
        });
      }
    });
  });

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#f0f0f0';
  const tickColor = isDark ? '#9CA3AF' : '#666';

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">No operator scan data available.</p>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-4">Operator Performance</h3>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} interval={0} angle={-40} textAnchor="end" height={160} />
          <YAxis tick={{ fontSize: 12, fill: tickColor }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#1F2937' : '#fff',
              border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              borderRadius: '8px',
              color: isDark ? '#E5E7EB' : '#111',
            }}
          />
          <Bar dataKey="ok" name="OK" fill={OK_COLOR} stackId="a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
