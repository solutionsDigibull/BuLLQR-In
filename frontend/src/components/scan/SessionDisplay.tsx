import { useRef, useEffect } from 'react';
import type { ScanRecord } from '../../types/scan.ts';
import { formatISTTime } from '../../utils/timezone.ts';

interface SessionDisplayProps {
  scans: ScanRecord[];
  highlightIds?: Set<string>;
  totalCount?: number;
}

function statusBadge(status: string) {
  const isOk = status === 'ok' || status === 'ok_update';
  const label = status.replace(/_/g, ' ').toUpperCase();
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
        isOk
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {label}
    </span>
  );
}

export default function SessionDisplay({ scans, highlightIds, totalCount }: SessionDisplayProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new scans arrive
  useEffect(() => {
    if (highlightIds && highlightIds.size > 0 && tableRef.current) {
      tableRef.current.scrollTop = 0;
    }
  }, [highlightIds]);

  if (scans.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-2">Recent Scans</h3>
        <p className="text-sm text-gray-400">No scans in this session yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">
          Recent Scans
          <span className="ml-2 text-xs text-gray-400 font-normal">Last {scans.length}</span>
        </h3>
      </div>
      <div ref={tableRef} className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Work Order</th>
              <th className="px-4 py-2">Stage</th>
              <th className="px-4 py-2">Operator</th>
              <th className="px-4 py-2">Supervisor</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">FA</th>
              <th className="px-4 py-2">Time (IST)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {scans.map((scan, index) => (
              <tr
                key={scan.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  highlightIds?.has(scan.id) ? 'animate-scan-highlight' : ''
                }`}
              >
                <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">
                  {String((totalCount ?? scans.length) - index).padStart(5, '0')}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                  {scan.work_order_code}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{scan.stage_name}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{scan.operator_name}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{scan.supervisor_name || '—'}</td>
                <td className="px-4 py-2">{statusBadge(scan.quality_status)}</td>
                <td className="px-4 py-2 text-center">
                  {scan.is_first_article ? (
                    <span className="text-primary font-semibold text-xs" title="First Article">
                      {scan.quality_inspector_name || 'FA'}
                    </span>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {formatISTTime(scan.scan_timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
