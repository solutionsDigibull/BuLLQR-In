import { useState, useEffect } from 'react';
import { listSopFiles, getSopFileUrl } from '../../services/config.ts';
import type { SopFile } from '../../types/config.ts';

interface SopViewerModalProps {
  stageId: string;
  stageName: string;
  initialFileId?: string;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SopViewerModal({ stageId, stageName, initialFileId, onClose }: SopViewerModalProps) {
  const [files, setFiles] = useState<SopFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFile, setActiveFile] = useState<SopFile | null>(null);

  useEffect(() => {
    listSopFiles(stageId)
      .then((data) => {
        setFiles(data);
        if (initialFileId) {
          const match = data.find((f) => f.id === initialFileId);
          if (match) setActiveFile(match);
        }
      })
      .catch(() => setError('Failed to load SOP files'))
      .finally(() => setLoading(false));
  }, [stageId, initialFileId]);

  function renderFilePreview(file: SopFile) {
    const url = getSopFileUrl(stageId, file.id);
    const mime = file.mime_type;

    if (mime.startsWith('image/')) {
      return (
        <img
          src={url}
          alt={file.original_filename}
          className="max-w-full max-h-[60vh] object-contain rounded"
        />
      );
    }
    if (mime.startsWith('video/')) {
      return (
        <video
          controls
          src={url}
          className="max-w-full max-h-[60vh] rounded"
        >
          Your browser does not support video playback.
        </video>
      );
    }
    if (mime === 'application/pdf' || mime.startsWith('text/')) {
      return (
        <iframe
          src={url}
          title={file.original_filename}
          className="w-full h-[60vh] rounded border border-gray-200 dark:border-gray-600"
        />
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <a
          href={url}
          download={file.original_filename}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark text-sm"
        >
          Download {file.original_filename}
        </a>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">SOP — {stageName}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Standard Operating Procedure</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* File list sidebar */}
          <div className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-3 space-y-1">
            {loading && <p className="text-sm text-gray-400 px-2 py-4">Loading...</p>}
            {error && <p className="text-sm text-red-500 px-2 py-4">{error}</p>}
            {!loading && !error && files.length === 0 && (
              <p className="text-sm text-gray-400 px-2 py-4">No SOP files attached.</p>
            )}
            {files.map((f) => {
              const isActive = activeFile?.id === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFile(f)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary/10 dark:bg-primary/20 text-primary'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <p className="text-xs font-medium truncate">{f.original_filename}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatFileSize(f.file_size)}</p>
                </button>
              );
            })}
          </div>

          {/* Preview area */}
          <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
            {activeFile ? (
              renderFilePreview(activeFile)
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-3">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <p className="text-sm">Select a file to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
