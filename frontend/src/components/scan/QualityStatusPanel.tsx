import type { QualityStatus } from '../../types/scan.ts';

interface QualityStatusPanelProps {
  mode: 'normal' | 'update';
  onSelect: (status: QualityStatus) => void;
  disabled?: boolean;
}

export default function QualityStatusPanel({
  mode,
  onSelect,
  disabled = false,
}: QualityStatusPanelProps) {
  if (mode === 'update') {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          This work order was already scanned at this stage. Update quality status:
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onSelect('ok_update')}
            disabled={disabled}
            className="flex-1 py-4 text-lg font-semibold rounded-md border-2 border-success text-success hover:bg-success hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            OK UPDATE
          </button>
          <button
            type="button"
            onClick={() => onSelect('not_ok_update')}
            disabled={disabled}
            className="flex-1 py-4 text-lg font-semibold rounded-md border-2 border-danger text-danger hover:bg-danger hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            NOT OK UPDATE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">Quality Status:</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onSelect('ok')}
          disabled={disabled}
          className="flex-1 py-4 text-lg font-semibold rounded-md bg-success text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          OK
        </button>
        <button
          type="button"
          onClick={() => onSelect('not_ok')}
          disabled={disabled}
          className="flex-1 py-4 text-lg font-semibold rounded-md bg-danger text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          NOT OK
        </button>
      </div>
    </div>
  );
}
