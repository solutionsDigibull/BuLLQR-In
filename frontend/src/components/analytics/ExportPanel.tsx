import { useState } from 'react';
import { isAxiosError } from 'axios';
import { downloadReport } from '../../services/analytics.ts';

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ExportPanel() {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(todayDate);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!startDate || !endDate) return;
    if (startDate > endDate) {
      setError('Start date must be before end date.');
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      await downloadReport('combined', startDate, endDate);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) {
        setError(err.response.data?.detail || 'Invalid date range.');
      } else {
        setError('Failed to download report.');
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-4">Export Reports</h3>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label htmlFor="export-start" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Start Date
          </label>
          <input
            id="export-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="export-end" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            End Date
          </label>
          <input
            id="export-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          {downloading ? 'Downloading...' : 'Download Report (.xlsx)'}
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        Timestamps in exported files are converted to IST (12-hour format). Max range: 90 days.
      </p>
    </div>
  );
}
