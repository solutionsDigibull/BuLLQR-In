import type { StageProgress } from '../../types/analytics.ts';

interface StageProgressBarsProps {
  stages: StageProgress[];
  targetStatus: string;
  loading?: boolean;
}

export default function StageProgressBars({
  stages,
  targetStatus,
  loading = false,
}: StageProgressBarsProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-3">Production Progress</h3>
        <p className="text-sm text-gray-400">Loading progress...</p>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-3">Production Progress</h3>
        <p className="text-sm text-gray-400">No progress data available.</p>
      </div>
    );
  }

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
            Target: {targetStatus === 'completed' ? 'Completed' : 'In Progress'}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {stages.map((stage) => {
          const pct = Math.min(stage.progress_percentage, 100);
          const hasTarget = stage.target_count > 0;

          return (
            <div key={stage.stage_name}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {stage.stage_sequence}. {stage.stage_name}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-xs tabular-nums">
                  {stage.current_count}
                  {hasTarget ? ` / ${stage.target_count}` : ''}
                  {stage.not_ok_count > 0 && (
                    <span className="text-danger ml-1">
                      ({stage.not_ok_count} NOK)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                {hasTarget ? (
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct >= 100 ? 'bg-success' : 'bg-primary'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                ) : (
                  <div
                    className="h-full rounded-full bg-gray-300"
                    style={{ width: stage.current_count > 0 ? '100%' : '0%' }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
