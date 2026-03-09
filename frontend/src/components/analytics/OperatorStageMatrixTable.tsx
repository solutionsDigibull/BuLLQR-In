import type { StageMetrics } from '../../types/analytics.ts';

interface MatrixRow {
  operator_name: string;
  station_id: string;
  [stageKey: string]: string | StageMetrics;
}

interface OperatorStageMatrixTableProps {
  matrix: MatrixRow[];
}

function isStageMetrics(value: unknown): value is StageMetrics {
  return (
    typeof value === 'object' &&
    value !== null &&
    'scan_count' in value &&
    typeof (value as StageMetrics).scan_count === 'number'
  );
}

function renderCell(metrics: StageMetrics | undefined) {
  if (!metrics || metrics.scan_count === 0) {
    return <span className="text-gray-300">&mdash;</span>;
  }
  return (
    <div className="text-center">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{metrics.scan_count}</span>
      <div className="text-xs mt-0.5">
        <span className="text-green-600">{metrics.ok_count}</span>
        {' / '}
        <span className="text-red-600">{metrics.not_ok_count}</span>
      </div>
      <div className="text-xs text-gray-400">{metrics.ok_percentage.toFixed(0)}%</div>
    </div>
  );
}

function deriveStageKeys(matrix: MatrixRow[]): { key: string; label: string }[] {
  if (matrix.length === 0) return [];
  const first = matrix[0];
  return Object.keys(first)
    .filter((k) => k !== 'operator_name' && k !== 'station_id' && isStageMetrics(first[k]))
    .map((k) => ({
      key: k,
      label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
}

export default function OperatorStageMatrixTable({
  matrix,
}: OperatorStageMatrixTableProps) {
  if (matrix.length === 0) {
    return <p className="text-sm text-gray-400">No matrix data available.</p>;
  }

  const stages = deriveStageKeys(matrix);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">Operator &times; Stage Matrix</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              <th className="px-4 py-2 text-left">Operator</th>
              {stages.map((s) => (
                <th key={s.key} className="px-3 py-2 text-center">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {matrix.map((row) => (
              <tr key={`${row.operator_name}-${row.station_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-2 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  {row.operator_name}
                  {row.station_id && (
                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({row.station_id})</span>
                  )}
                </td>
                {stages.map((s) => (
                  <td key={s.key} className="px-3 py-2">
                    {renderCell(row[s.key] as StageMetrics | undefined)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
