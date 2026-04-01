import { useState, useEffect, useRef } from 'react';
import type { ProductionStage } from '../../types/scan.ts';
import type { SopFile } from '../../types/config.ts';
import { listSopFiles } from '../../services/config.ts';

interface StageSelectorProps {
  stages: ProductionStage[];
  selectedStageId: string;
  onChange: (stageId: string) => void;
  onMandatoryChange?: (stageId: string, isMandatory: boolean) => void;
  onViewSop?: (stageId: string, fileId: string) => void;
  stageDefectCounts?: Record<string, number>;
  disabled?: boolean;
  loading?: boolean;
}

function getFileCategory(mime: string): 'image' | 'video' | 'document' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
}

const CATEGORY_LABEL: Record<string, string> = {
  image: 'Images',
  video: 'Videos',
  document: 'Documents',
};

const CATEGORY_ICON: Record<string, string> = {
  image: '🖼',
  video: '🎬',
  document: '📄',
};

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
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [filesCache, setFilesCache] = useState<Record<string, SopFile[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showDefects, setShowDefects] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    if (openDropdownId) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openDropdownId]);

  async function handleToggleDropdown(e: React.MouseEvent, stageId: string) {
    e.stopPropagation();
    if (openDropdownId === stageId) {
      setOpenDropdownId(null);
      return;
    }
    setOpenDropdownId(stageId);
    if (!filesCache[stageId]) {
      setLoadingId(stageId);
      try {
        const files = await listSopFiles(stageId);
        setFilesCache((prev) => ({ ...prev, [stageId]: files }));
      } catch {
        setFilesCache((prev) => ({ ...prev, [stageId]: [] }));
      } finally {
        setLoadingId(null);
      }
    }
  }

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
      <div className="flex items-center gap-2 mb-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Production Stage
        </label>
        <button
          type="button"
          onClick={() => setShowDefects((v) => !v)}
          title={showDefects ? 'Hide Defects column' : 'Show Defects column'}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5"
        >
          {showDefects ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      <div className="w-full overflow-x-auto" ref={dropdownRef}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 pr-4 whitespace-nowrap">Op No.</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2">Description</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 pl-4 whitespace-nowrap">Mandatory</th>
              {showDefects && (
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 pl-4 whitespace-nowrap">Defects</th>
              )}
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pb-2 pl-4 whitespace-nowrap">SOP</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => {
              const isSelected = selectedStageId === stage.id;
              const isOpen = openDropdownId === stage.id;
              const files = filesCache[stage.id] ?? [];

              // Group files by category
              const grouped: Record<string, SopFile[]> = {};
              files.forEach((f) => {
                const cat = getFileCategory(f.mime_type);
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(f);
              });
              const categoryOrder = ['image', 'video', 'document'] as const;

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
                    <span className={`font-bold text-sm ${isSelected ? 'text-primary' : 'text-blue-500 dark:text-blue-400'}`}>
                      {stage.stage_sequence}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2">
                    <span className={`font-medium ${isSelected ? 'text-primary dark:text-primary' : 'text-gray-800 dark:text-gray-200'}`}>
                      {stage.stage_name}
                    </span>
                    {stage.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stage.description}</p>
                    )}
                  </td>
                  <td className="py-2.5 pl-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                  {showDefects && (
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
                  )}
                  <td className="py-2.5 pl-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {stage.sop_count > 0 ? (
                      <div className="relative inline-block">
                        {/* Dropdown trigger */}
                        <button
                          onClick={(e) => handleToggleDropdown(e, stage.id)}
                          disabled={disabled}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isOpen
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                          }`}
                        >
                          View
                          <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Dropdown panel */}
                        {isOpen && (
                          <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                            {loadingId === stage.id ? (
                              <p className="text-xs text-gray-400 px-4 py-3">Loading...</p>
                            ) : files.length === 0 ? (
                              <p className="text-xs text-gray-400 px-4 py-3">No files found.</p>
                            ) : (
                              categoryOrder.map((cat) => {
                                const catFiles = grouped[cat];
                                if (!catFiles || catFiles.length === 0) return null;
                                return (
                                  <div key={cat}>
                                    <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/60 border-b border-gray-100 dark:border-gray-600">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        {CATEGORY_ICON[cat]} {CATEGORY_LABEL[cat]}
                                      </span>
                                    </div>
                                    {catFiles.map((f) => (
                                      <button
                                        key={f.id}
                                        onClick={() => {
                                          setOpenDropdownId(null);
                                          onViewSop && onViewSop(stage.id, f.id);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                                        title={f.original_filename}
                                      >
                                        {f.original_filename}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
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
