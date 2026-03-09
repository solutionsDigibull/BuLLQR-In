import type { COPQSummary } from '../../types/analytics.ts';

interface COPQSummaryWidgetProps {
  copq: COPQSummary;
}

export default function COPQSummaryWidget({ copq }: COPQSummaryWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-base font-medium text-gray-700 mb-4">Cost of Poor Quality</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-red-50 rounded-md p-3">
          <p className="text-2xl font-bold text-red-700">
            {copq.currency} {copq.total_copq.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-red-500 mt-0.5">Total COPQ</p>
        </div>
        <div className="bg-orange-50 rounded-md p-3">
          <p className="text-2xl font-bold text-orange-700">{copq.rework_count}</p>
          <p className="text-xs text-orange-500 mt-0.5">Rework Instances</p>
        </div>
      </div>

      {copq.by_stage && copq.by_stage.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">By Stage</p>
          <div className="space-y-2">
            {copq.by_stage.map((stage) => (
              <div key={stage.stage_name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{stage.stage_name}</span>
                <div className="text-right">
                  <span className="font-medium text-gray-700">
                    {copq.currency} {stage.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-gray-400 ml-2 text-xs">({stage.rework_count} reworks)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
