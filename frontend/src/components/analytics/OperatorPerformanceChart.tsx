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

interface OperatorPerformanceChartProps {
  operators: OperatorPerformanceEntry[];
}

const OK_COLOR = '#2196F3';

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

  if (data.length === 0) {
    return <p className="text-sm text-gray-400">No operator scan data available.</p>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-4">Operator Performance</h3>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-40} textAnchor="end" height={160} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="ok" name="OK" fill={OK_COLOR} stackId="a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
