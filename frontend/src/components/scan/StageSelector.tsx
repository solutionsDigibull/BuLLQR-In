import type { ProductionStage } from '../../types/scan.ts';

interface StageSelectorProps {
  stages: ProductionStage[];
  selectedStageId: string;
  onChange: (stageId: string) => void;
  onMandatoryChange?: (stageId: string, isMandatory: boolean) => void;
  onViewSop?: (stageId: string) => void;
  stageDefectCounts?: Record<string, number>;
  disabled?: boolean;
  loading?: boolean;
}

export default function StageSelector({
  stages,
  selectedStageId,
  onChange,
  onMandatoryChange,
  onViewSop,
  stageDefectCounts = {},
  disabled = false,
  loading = false,
}: StageSelectorProps) {
  if (loading) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Production Stage
        </label>
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading stages...</p>
      </div>
    );
  }

  if (stages.length === 0) {
    return null;
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Production Stage
      </label>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 pr-4 whitespace-nowrap">Op No.</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2">Description</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 pl-4 whitespace-nowrap">Mandatory</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 pl-4 whitespace-nowrap">Defects</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 pl-4 whitespace-nowrap">SOP</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => {
              const isSelected = selectedStageId === stage.id;
              return (
                <tr
                  key={stage.id}
                  onClick={() => !disabled && onChange(stage.id)}
                  className={`border-b border-gray-100 dark:border-gray-700 transition-colors ${
                    disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  } ${isSelected ? 'bg-primary/10 dark:bg-primary/20' : ''}`}
                >
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    <span
                      className={`font-bold text-sm ${
                        isSelected ? 'text-primary' : 'text-blue-500 dark:text-blue-400'
                      }`}
                    >
                      {stage.stage_sequence}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2">
                    <span
                      className={`font-medium ${
                        isSelected
                          ? 'text-primary dark:text-primary'
                          : 'text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {stage.stage_name}
                    </span>
                    {stage.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stage.description}</p>
                    )}
                  </td>
                  <td
                    className="py-2.5 pl-4 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={stage.is_mandatory ? 'yes' : 'no'}
                      onChange={(e) => {
                        if (onMandatoryChange) {
                          onMandatoryChange(stage.id, e.target.value === 'yes');
                        }
                      }}
                      disabled={disabled}
                      className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed ${
                        stage.is_mandatory
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </td>
                  <td className="py-2.5 pl-4 whitespace-nowrap">
                    {(() => {
                      const defects = stageDefectCounts[stage.id] ?? 0;
                      return defects > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
                          {defects}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                      );
                    })()}
                  </td>
                  <td
                    className="py-2.5 pl-4 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {stage.sop_count > 0 ? (
                      <button
                        onClick={() => onViewSop && onViewSop(stage.id)}
                        className="text-xs font-medium text-blue-500 dark:text-blue-400 hover:underline disabled:opacity-50"
                        disabled={disabled}
                      >
                        View ({stage.sop_count})
                      </button>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
