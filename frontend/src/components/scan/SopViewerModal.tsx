import { useState, useEffect, useRef } from 'react';
import mammoth from 'mammoth';
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

type ModalSize = 'normal' | 'minimized' | 'maximized';

export default function SopViewerModal({ stageId, stageName, initialFileId, onClose }: SopViewerModalProps) {
  const [files, setFiles] = useState<SopFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFile, setActiveFile] = useState<SopFile | null>(null);
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [docxLoading, setDocxLoading] = useState(false);
  const docxCache = useRef<Record<string, string>>({});
  const [modalSize, setModalSize] = useState<ModalSize>('normal');

  function toggleMinimize() {
    setModalSize((s) => (s === 'minimized' ? 'normal' : 'minimized'));
  }
  function toggleMaximize() {
    setModalSize((s) => (s === 'maximized' ? 'normal' : 'maximized'));
  }

  useEffect(() => {
    listSopFiles(stageId)
      .then((data) => {
        setFiles(data);
        if (initialFileId) {
          const match = data.find((f) => f.id === initialFileId);
          if (match) { setActiveFile(match); return; }
        }
        if (data.length > 0) setActiveFile(data[0]);
      })
      .catch(() => setError('Failed to load SOP files'))
      .finally(() => setLoading(false));
  }, [stageId, initialFileId]);

  useEffect(() => {
    if (!activeFile) return;
    const isDocx =
      activeFile.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      activeFile.mime_type === 'application/msword';
    if (!isDocx) { setDocxHtml(''); return; }

    if (docxCache.current[activeFile.id]) {
      setDocxHtml(docxCache.current[activeFile.id]);
      return;
    }

    setDocxLoading(true);
    setDocxHtml('');
    const url = getSopFileUrl(stageId, activeFile.id);
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then(({ value }) => {
        docxCache.current[activeFile.id] = value;
        setDocxHtml(value);
      })
      .catch(() => setDocxHtml('<p style="color:red">Failed to render document.</p>'))
      .finally(() => setDocxLoading(false));
  }, [activeFile, stageId]);

  const isDocxActive =
    !!activeFile &&
    (activeFile.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      activeFile.mime_type === 'application/msword');

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
          className="w-full h-full rounded border border-gray-200 dark:border-gray-600"
        />
      );
    }
    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      if (docxLoading) {
        return (
          <div className="flex items-center justify-center w-full h-full text-gray-400 dark:text-gray-500">
            <p className="text-sm">Loading document…</p>
          </div>
        );
      }
      const srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Calibri, 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #111;
    background: #fff;
    padding: 24px 32px;
    margin: 0;
  }
  h1 { font-size: 16pt; font-weight: bold; margin: 0.8em 0 0.3em; }
  h2 { font-size: 14pt; font-weight: bold; margin: 0.7em 0 0.25em; }
  h3 { font-size: 12pt; font-weight: bold; margin: 0.6em 0 0.2em; }
  h4, h5, h6 { font-size: 11pt; font-weight: bold; margin: 0.5em 0 0.15em; }
  p { margin: 0.3em 0; }
  strong, b { font-weight: bold; }
  em, i { font-style: italic; }
  u { text-decoration: underline; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.6em 0;
    table-layout: fixed;
  }
  td, th {
    border: 1px solid #aaa;
    padding: 5px 8px;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  th {
    background-color: #f0f0f0;
    font-weight: bold;
    text-align: left;
  }
  tr:nth-child(even) td { background-color: #fafafa; }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 6px auto;
  }
  ul, ol { padding-left: 1.5em; margin: 0.3em 0; }
  li { margin: 0.15em 0; }
  a { color: #1a56db; text-decoration: underline; }
</style>
</head>
<body>${docxHtml}</body>
</html>`;
      return (
        <iframe
          srcDoc={srcdoc}
          title={file.original_filename}
          className="w-full h-full"
          sandbox="allow-same-origin"
        />
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-gray-400 dark:text-gray-500">
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">Preview not available for this file type.</p>
      </div>
    );
  }

  const modalClass = modalSize === 'maximized'
    ? 'fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none mx-0'
    : modalSize === 'minimized'
      ? 'w-full max-w-6xl mx-4'
      : 'w-full max-w-6xl mx-4 max-h-[90vh]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white dark:bg-gray-800 shadow-2xl flex flex-col ${modalSize !== 'maximized' ? 'rounded-xl' : ''} ${modalClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">SOP — {stageName}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Standard Operating Procedure</p>
          </div>
          <div className="flex items-center gap-1">
            {/* Minimize */}
            <button
              onClick={toggleMinimize}
              title={modalSize === 'minimized' ? 'Restore' : 'Minimize'}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            {/* Maximize / Restore */}
            <button
              onClick={toggleMaximize}
              title={modalSize === 'maximized' ? 'Restore' : 'Maximize'}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {modalSize === 'maximized' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4m0 0H4m5 0L3 10M15 15v5m0 0h5m-5 0l6-6" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                </svg>
              )}
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              title="Close"
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {modalSize !== 'minimized' && <div className="flex flex-1 overflow-hidden">
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
          <div className={`flex-1 overflow-hidden ${isDocxActive ? '' : 'overflow-auto p-6 flex items-start justify-center'}`}>
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
        </div>}
      </div>
    </div>
  );
}
