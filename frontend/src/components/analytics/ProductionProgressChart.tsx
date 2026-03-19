import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { StageProgress } from '../../types/analytics.ts';
import { useTheme } from '../../context/ThemeContext.tsx';

interface ProductionProgressChartProps {
  stages: StageProgress[];
  targetStatus: string;
}

const PRIMARY = '#3B82F6';
const SUCCESS = '#22C55E';

export default function ProductionProgressChart({
  stages,
  targetStatus,
}: ProductionProgressChartProps) {
  if (stages.length === 0) {
    return <p className="text-sm text-gray-400">No progress data available.</p>;
  }

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#f0f0f0';
  const tickColor = isDark ? '#9CA3AF' : '#666';
  const labelColor = isDark ? '#D1D5DB' : '#555';

  const sortedStages = [...stages].sort((a, b) => a.stage_sequence - b.stage_sequence);

  const data = sortedStages.map((s) => ({
    name: s.stage_name,
    current: s.current_count,
    target: s.target_count,
    label:
      s.target_count > 0
        ? `${s.current_count}/${s.target_count}`
        : String(s.current_count),
    pct: s.progress_percentage,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">Production Progress</h3>
        {targetStatus !== 'not_set' && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              targetStatus === 'completed'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
            }`}
          >
            {targetStatus === 'completed' ? 'Target Completed' : 'Target In Progress'}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 60, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickColor }} interval={0} angle={-35} textAnchor="end" height={80} />
          <YAxis tick={{ fontSize: 12, fill: tickColor }} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#1F2937' : '#fff',
              border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
              borderRadius: '8px',
              color: isDark ? '#E5E7EB' : '#111',
            }}
            formatter={(value?: number, name?: string) => [
              value ?? 0,
              name === 'current' ? 'Current' : 'Target',
            ]}
          />
          <Bar dataKey="current" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.pct >= 100 ? SUCCESS : PRIMARY}
              />
            ))}
            <LabelList
              dataKey="label"
              position="top"
              style={{ fontSize: 11, fill: labelColor }}
              content={({ x, y, width, value, index }: any) => {
                if (data[index]?.current === 0) return null;
                return (
                  <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill={labelColor}>
                    {value}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
