import { useState } from 'react';
import type { User } from '../../types/auth.ts';
import type { QualityStatus } from '../../types/scan.ts';

interface FirstArticleDialogProps {
  inspectors: User[];
  loadingInspectors: boolean;
  onConfirm: (inspectorId: string, status: QualityStatus) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function FirstArticleDialog({
  inspectors,
  loadingInspectors,
  onConfirm,
  onCancel,
  disabled = false,
}: FirstArticleDialogProps) {
  const [selectedInspector, setSelectedInspector] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">First Article Inspection Required</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            This is the first scan of this work order at this stage. A Quality Inspector must approve.
          </p>
        </div>

        <div className="mb-5">
          <label htmlFor="qi-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quality Inspector
          </label>
          <select
            id="qi-select"
            autoFocus
            value={selectedInspector}
            onChange={(e) => setSelectedInspector(e.target.value)}
            disabled={disabled || loadingInspectors}
            className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-600 cursor-pointer"
          >
            <option value="">
              {loadingInspectors ? 'Loading inspectors...' : 'Select inspector'}
            </option>
            {inspectors.map((qi) => (
              <option key={qi.id} value={qi.id}>
                {qi.full_name}
                {qi.station_id ? ` (${qi.station_id})` : ''}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quality Assessment:</p>
        <div className="flex gap-3 mb-5">
          <button
            type="button"
            onClick={() => onConfirm(selectedInspector, 'ok')}
            disabled={disabled || !selectedInspector}
            className="flex-1 py-3 text-base font-semibold rounded-md bg-success text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedInspector, 'not_ok')}
            disabled={disabled || !selectedInspector}
            className="flex-1 py-3 text-base font-semibold rounded-md bg-danger text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            NOT OK
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
