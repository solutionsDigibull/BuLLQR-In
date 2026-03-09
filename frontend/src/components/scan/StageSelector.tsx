import type { ProductionStage } from '../../types/scan.ts';

interface StageSelectorProps {
  stages: ProductionStage[];
  selectedStageId: string;
  onChange: (stageId: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function StageSelector({
  stages,
  selectedStageId,
  onChange,
  disabled = false,
  loading = false,
}: StageSelectorProps) {
  return (
    <div>
      <label htmlFor="stage-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Production Stage
      </label>
      <select
        id="stage-select"
        value={selectedStageId}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed cursor-pointer"
      >
        <option value="">
          {loading ? 'Loading stages...' : 'Select a stage'}
        </option>
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.stage_sequence}. {stage.stage_name}
          </option>
        ))}
      </select>
    </div>
  );
}
