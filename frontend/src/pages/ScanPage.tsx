import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useWebSocketSubscribe } from '../context/WebSocketContext.tsx';
import BarcodeInput from '../components/scan/BarcodeInput.tsx';
import StageSelector from '../components/scan/StageSelector.tsx';
import FirstArticleDialog from '../components/scan/FirstArticleDialog.tsx';
import ScanFeedback from '../components/scan/ScanFeedback.tsx';
import SessionDisplay from '../components/scan/SessionDisplay.tsx';
import SopViewerModal from '../components/scan/SopViewerModal.tsx';
import * as scanService from '../services/scan.ts';
import { listProducts, getProductStages, setProductStages } from '../services/config.ts';
import { formatIST } from '../utils/timezone.ts';
import type {
  ProductionStage,
  QualityStatus,
  ScanRecord,
  ScanResponse,
  ApiErrorResponse,
} from '../types/scan.ts';
import type { User } from '../types/auth.ts';
import type { Product } from '../types/config.ts';
import { isAxiosError } from 'axios';

type ScanFlowState =
  | 'idle'
  | 'first_article'
  | 'submitting';

const HIGHLIGHT_DURATION_MS = 2500;

export default function ScanPage() {
  const { user } = useAuth();
  const subscribe = useWebSocketSubscribe();

  // Product state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState('');
  // Per-product today's scan count: { productId -> count }
  const [productTodayCounts, setProductTodayCounts] = useState<Record<string, number>>({});

  // Setup state
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [selectedStageId, setSelectedStageId] = useState('');
  // Per-stage defect (not_ok) count for today: { stageId -> count }
  const [stageDefectCounts, setStageDefectCounts] = useState<Record<string, number>>({});

  // Operator state
  const [operators, setOperators] = useState<User[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(true);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');

  // Supervisor state
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

  // Quality Inspector state (persistent dropdown)
  const [qiList, setQiList] = useState<User[]>([]);
  const [qiLoading, setQiLoading] = useState(true);
  const [selectedQiId, setSelectedQiId] = useState('');

  // Quality Status (selected before scanning)
  const [selectedQualityStatus, setSelectedQualityStatus] = useState<QualityStatus>('ok');

  // First article status per stage (for today)
  const [firstArticleStages, setFirstArticleStages] = useState<
    Map<string, boolean>
  >(new Map());
  const [firstArticleNotice, setFirstArticleNotice] = useState('');

  // Barcode state
  const [barcodeValue, setBarcodeValue] = useState('');
  const [barcodeError, setBarcodeError] = useState('');

  // Flow state
  const [flowState, setFlowState] = useState<ScanFlowState>('idle');
  const [scannedBarcode, setScannedBarcode] = useState('');

  // First article state
  const [inspectors, setInspectors] = useState<User[]>([]);
  const [inspectorsLoading, setInspectorsLoading] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning' | null;
    message: string;
  }>({ type: null, message: '' });

  // SOP viewer state
  const [sopViewState, setSopViewState] = useState<{ stageId: string; fileId?: string } | null>(null);

  // Session state
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [stageTotalCount, setStageTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const highlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const selectedStageIdRef = useRef(selectedStageId);

  // Load products and today's per-product counts on mount
  useEffect(() => {
    let cancelled = false;
    listProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    scanService.getProductsTodayCounts()
      .then((data) => {
        if (!cancelled) {
          const map: Record<string, number> = {};
          data.counts.forEach((c) => { map[c.product_id] = c.count; });
          setProductTodayCounts(map);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load stages and defect counts when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setStages([]);
      setSelectedStageId('');
      setStagesLoading(false);
      setStageDefectCounts({});
      return;
    }
    let cancelled = false;
    setStagesLoading(true);
    setSelectedStageId('');
    getProductStages(selectedProductId)
      .then((data) => {
        if (!cancelled) setStages(data);
      })
      .catch(() => {
        if (!cancelled) setStages([]);
      })
      .finally(() => {
        if (!cancelled) setStagesLoading(false);
      });
    scanService.getStageDefectCounts(selectedProductId)
      .then((data) => {
        if (!cancelled) {
          const map: Record<string, number> = {};
          data.counts.forEach((c) => { map[c.stage_id] = c.defect_count; });
          setStageDefectCounts(map);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedProductId]);

  // Load operators, supervisors, QIs on mount
  useEffect(() => {
    let cancelled = false;

    scanService
      .getOperatorsByRole('operator')
      .then((data) => {
        if (!cancelled) setOperators(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOperatorsLoading(false);
      });

    scanService
      .getOperatorsByRole('supervisor')
      .then((data) => {
        if (!cancelled) setSupervisors(data);
      })
      .catch(() => {});

    scanService
      .getOperatorsByRole('quality_inspector')
      .then((data) => {
        if (!cancelled) setQiList(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setQiLoading(false);
      });

    // Load first article status for today
    scanService
      .getFirstArticleStatus()
      .then((data) => {
        if (!cancelled) {
          const map = new Map<string, boolean>();
          data.stages.forEach((s) => map.set(s.stage_id, s.first_article_completed));
          setFirstArticleStages(map);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // Load session data when selected stage or product changes
  useEffect(() => {
    if (!selectedStageId) {
      setRecentScans([]);
      setStageTotalCount(0);
      setTodayCount(0);
      return;
    }
    scanService
      .getLatestScans(30, selectedStageId, selectedProductId || undefined)
      .then((data) => {
        setRecentScans(data.scans);
        setStageTotalCount(data.total_count);
      })
      .catch(() => {});
    scanService
      .getTodayCount(selectedStageId, selectedProductId || undefined)
      .then((data) => setTodayCount(data.unique_work_orders))
      .catch(() => {});
  }, [selectedStageId, selectedProductId]);

  // Keep stage ref in sync for WebSocket callbacks
  useEffect(() => {
    selectedStageIdRef.current = selectedStageId;
  }, [selectedStageId]);

  // Show first-article notice when QI is selected and stage hasn't had first scan today
  useEffect(() => {
    if (!selectedQiId || !selectedStageId) {
      setFirstArticleNotice('');
      return;
    }
    const completed = firstArticleStages.get(selectedStageId);
    if (completed === false) {
      const stage = stages.find((s) => s.id === selectedStageId);
      const stageName = stage ? stage.stage_name : 'this stage';
      setFirstArticleNotice(
        `This will be the first scan for this stage (${stageName}).`,
      );
    } else {
      setFirstArticleNotice('');
    }
  }, [selectedQiId, selectedStageId, firstArticleStages, stages]);

  // Cleanup highlight timers on unmount
  useEffect(() => {
    const timers = highlightTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function addHighlight(scanId: string) {
    setHighlightIds((prev) => new Set(prev).add(scanId));
    const timer = setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev);
        next.delete(scanId);
        return next;
      });
      highlightTimersRef.current.delete(scanId);
    }, HIGHLIGHT_DURATION_MS);
    highlightTimersRef.current.set(scanId, timer);
  }

  // Listen for WebSocket scan events to update session (filtered by selected stage)
  useEffect(() => {
    return subscribe('scan_created', (payload) => {
      const scan = payload as ScanRecord;
      if (scan.stage_id !== selectedStageIdRef.current) return;
      setRecentScans((prev) => [scan, ...prev].slice(0, 30));
      setStageTotalCount((prev) => prev + 1);
      setTodayCount((prev) => prev + 1);
      addHighlight(scan.id);
    });
  }, [subscribe]);

  useEffect(() => {
    return subscribe('scan_updated', (payload) => {
      const scan = payload as ScanRecord;
      if (scan.stage_id !== selectedStageIdRef.current) return;
      setRecentScans((prev) =>
        prev.map((s) => (s.id === scan.id ? scan : s)),
      );
      addHighlight(scan.id);
    });
  }, [subscribe]);

  async function handleMandatoryChange(stageId: string, isMandatory: boolean) {
    const updated = stages.map((s) =>
      s.id === stageId ? { ...s, is_mandatory: isMandatory } : s,
    );
    setStages(updated);
    try {
      await setProductStages(
        selectedProductId,
        updated.map((s) => ({
          stage_id: s.id,
          sequence: s.stage_sequence,
          is_mandatory: s.is_mandatory,
        })),
      );
    } catch {
      // revert on failure
      setStages(stages);
    }
  }

  function resetScanFlow() {
    setFlowState('idle');
    setScannedBarcode('');
    setBarcodeValue('');
    setBarcodeError('');
  }

  async function handleBarcodeScanned(barcode: string) {
    const missing: string[] = [];
    if (!selectedProductId) missing.push('Product');
    if (!selectedStageId) missing.push('Production Stage');
    if (!selectedOperatorId) missing.push('Operator');
    if (!selectedSupervisorId) missing.push('Supervisor');
    if (!selectedQiId) missing.push('Quality Inspector');
    if (missing.length > 0) {
      setBarcodeError(`Please select: ${missing.join(', ')}`);
      return;
    }
    setBarcodeError('');

    // Stage validation — check previous stages are completed in order
    try {
      const validation = await scanService.checkPreviousStage(barcode, selectedStageId, selectedProductId);
      if (!validation.valid) {
        if (validation.missing_stages.length > 0) {
          const missing = validation.missing_stages.map((s) => `${s.stage_name} (Stage ${s.stage_sequence})`).join(', ');
          setFeedback({
            type: 'error',
            message: `Rejected: Complete previous stages first — ${missing}.`,
          });
        } else if (validation.error) {
          setFeedback({
            type: 'error',
            message: `Rejected: ${validation.error}`,
          });
        }
        resetScanFlow();
        return;
      }
    } catch {
      // If validation endpoint fails, backend will still enforce it
    }

    setScannedBarcode(barcode);
    setFeedback({ type: null, message: '' });

    // Auto-submit with the pre-selected quality status
    submitScanDirect(barcode, selectedQualityStatus);
  }

  async function submitScanDirect(
    barcode: string,
    qualityStatus: QualityStatus,
    inspectorId?: string,
  ) {
    if (!user || !selectedStageId || !barcode) return;

    const operatorId = selectedOperatorId;
    const qiId = inspectorId || selectedQiId;

    setFlowState('submitting');
    try {
      const response: ScanResponse = await scanService.processScan({
        barcode,
        stage_id: selectedStageId,
        operator_id: operatorId,
        quality_status: qualityStatus,
        quality_inspector_id: qiId,
        supervisor_id: selectedSupervisorId,
        product_id: selectedProductId,
      });

      setFeedback({
        type: 'success',
        message: `${response.stage_name} — ${response.quality_status.replace(/_/g, ' ').toUpperCase()} ${response.message ? `(${response.message})` : ''}`,
      });
      resetScanFlow();

      // Refresh first article status and per-product counts after successful scan
      scanService
        .getFirstArticleStatus()
        .then((data) => {
          const map = new Map<string, boolean>();
          data.stages.forEach((s) => map.set(s.stage_id, s.first_article_completed));
          setFirstArticleStages(map);
        })
        .catch(() => {});
      scanService
        .getProductsTodayCounts()
        .then((data) => {
          const map: Record<string, number> = {};
          data.counts.forEach((c) => { map[c.product_id] = c.count; });
          setProductTodayCounts(map);
        })
        .catch(() => {});
      scanService.getStageDefectCounts(selectedProductId)
        .then((data) => {
          const map: Record<string, number> = {};
          data.counts.forEach((c) => { map[c.stage_id] = c.defect_count; });
          setStageDefectCounts(map);
        })
        .catch(() => {});
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        const data = err.response.data as ApiErrorResponse;

        if (
          err.response.status === 400 &&
          (data.code === 'FIRST_ARTICLE_REQUIRED' ||
            data.detail?.toLowerCase().includes('first article'))
        ) {
          setFlowState('first_article');
          loadInspectors();
          return;
        }

        setFeedback({ type: 'error', message: data.detail || data.error });
      } else {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Scan failed',
        });
      }
      resetScanFlow();
    }
  }

  async function loadInspectors() {
    setInspectorsLoading(true);
    try {
      const qis = await scanService.getOperatorsByRole('quality_inspector');
      setInspectors(qis);
    } catch {
      setInspectors([]);
    } finally {
      setInspectorsLoading(false);
    }
  }

  function handleFirstArticleConfirm(inspectorId: string, qualityStatus: QualityStatus) {
    submitScanDirect(scannedBarcode, qualityStatus, inspectorId);
  }

  const dismissFeedback = useCallback(() => {
    setFeedback({ type: null, message: '' });
  }, []);

  const isSetupReady = !!selectedProductId && !!selectedStageId && !!selectedOperatorId && !!selectedSupervisorId && !!selectedQiId;
  const showFirstArticle = flowState === 'first_article';
  const isSubmitting = flowState === 'submitting';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Scan</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="bg-primary-light text-primary-dark px-3 py-1 rounded-full font-medium">
            Today: {todayCount} WOs
          </span>
        </div>
      </div>

      <ScanFeedback
        type={feedback.type}
        message={feedback.message}
        onDismiss={dismissFeedback}
      />

      {/* Setup & Input Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-5">

        {/* Top row: Stage (left) + Product Selection (right) */}
        <div className="flex gap-6 items-start">

          {/* LEFT: Production Stage */}
          <div className="flex-1 min-w-0">
            {selectedProductId ? (
              <StageSelector
                stages={stages}
                selectedStageId={selectedStageId}
                onChange={(id) => {
                  setSelectedStageId(id);
                  if (flowState !== 'idle') resetScanFlow();
                }}
                onMandatoryChange={handleMandatoryChange}
                onViewSop={(stageId, fileId) => setSopViewState({ stageId, fileId })}
                stageDefectCounts={stageDefectCounts}
                loading={stagesLoading}
                disabled={isSubmitting}
              />
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Production Stage
                </label>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Select a product to view stages.
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: Product Selection & Targets */}
          <div className="w-72 shrink-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product Selection &amp; Targets
            </label>
            {productsLoading ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Loading products...</p>
            ) : (
              <div className="flex flex-col gap-3">
                {products.map((p) => {
                  const isSelected = selectedProductId === p.id;
                  const scanned = productTodayCounts[p.id] ?? 0;
                  const target = p.production_target;
                  const pct = target && target > 0 ? Math.min(100, Math.round((scanned / target) * 100)) : 0;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(p.id);
                        if (flowState !== 'idle') resetScanFlow();
                      }}
                      disabled={isSubmitting}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-primary bg-primary/5 dark:bg-primary/10'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-primary/50'
                      }`}
                    >
                      {/* Top row: name + count/target */}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className={`block text-sm font-bold ${isSelected ? 'text-primary' : 'text-gray-800 dark:text-gray-100'}`}>
                            {p.product_name}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{p.product_code}</span>
                        </div>
                        {target != null ? (
                          <span className={`text-sm font-semibold tabular-nums ${isSelected ? 'text-primary' : 'text-gray-600 dark:text-gray-300'}`}>
                            {scanned}/{target}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">No target</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {target != null && (
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : isSelected ? 'bg-primary' : 'bg-blue-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Operator, Supervisor, Quality Inspector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          {/* Operator selector */}
          <div>
            <label htmlFor="operator-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Operator
            </label>
            <select
              id="operator-select"
              value={selectedOperatorId}
              onChange={(e) => setSelectedOperatorId(e.target.value)}
              disabled={isSubmitting || operatorsLoading}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-600"
            >
              <option value="">{operatorsLoading ? 'Loading...' : 'Select an operator'}</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Supervisor selector */}
          <div>
            <label htmlFor="supervisor-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Supervisor
            </label>
            <select
              id="supervisor-select"
              value={selectedSupervisorId}
              onChange={(e) => setSelectedSupervisorId(e.target.value)}
              disabled={isSubmitting}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-600"
            >
              <option value="">Select a supervisor</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Quality Inspector selector */}
          <div>
            <label htmlFor="qi-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quality Inspector
            </label>
            <select
              id="qi-select"
              value={selectedQiId}
              onChange={(e) => setSelectedQiId(e.target.value)}
              disabled={isSubmitting || qiLoading}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-600"
            >
              <option value="">{qiLoading ? 'Loading...' : 'Select an inspector'}</option>
              {qiList.map((qi) => (
                <option key={qi.id} value={qi.id}>
                  {qi.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* First article notice */}
        {firstArticleNotice && (
          <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-4 py-2.5 rounded-md">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {firstArticleNotice}
          </div>
        )}
      </div>

      {/* Scan Input + Quality Control */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: Scan Input */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <div className="flex flex-col items-center gap-2 mb-2">
            <svg className="w-12 h-12 text-primary opacity-70" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm0 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75-9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zm0 9.75h.75v.75h-.75v-.75zm9.75-9.75h.75v.75h-.75v-.75zm-9 3.75h3v3h-3v-3zm9 0h3v3h-3v-3zm-9 6h3v3h-3v-3zm6-6h.75v.75H15v-.75zm0 3h.75v.75H15v-.75zm0 3h.75v.75H15v-.75zm3-6h.75v.75h-.75v-.75zm0 3h.75v.75h-.75v-.75zm0 3h.75v.75h-.75v-.75z" />
            </svg>
            <span className="text-sm font-semibold tracking-widest uppercase text-primary">Scan Here</span>
          </div>

          <BarcodeInput
            value={barcodeValue}
            onChange={setBarcodeValue}
            onScan={handleBarcodeScanned}
            disabled={!isSetupReady || isSubmitting || flowState !== 'idle'}
            error={barcodeError}
          />

          {scannedBarcode && flowState !== 'idle' && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md">
              <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{scannedBarcode}</span>
              <button
                type="button"
                onClick={resetScanFlow}
                disabled={isSubmitting}
                className="ml-auto text-xs text-gray-400 hover:text-danger transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {isSubmitting && (
            <p className="text-center text-sm text-gray-500 py-2">Processing scan...</p>
          )}
        </div>

        {/* Right: Quality Control */}
        <div className="lg:w-72 bg-gray-900 dark:bg-gray-950 rounded-lg border border-gray-700 p-4 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-sm font-semibold text-white tracking-wide">Quality Control</span>
          </div>

          {/* 2×2 button grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* OKAY */}
            <button
              type="button"
              onClick={() => setSelectedQualityStatus('ok')}
              disabled={isSubmitting}
              className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-md border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedQualityStatus === 'ok'
                  ? 'bg-green-700 border-green-400 ring-2 ring-green-400'
                  : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span className="text-xs font-semibold text-white tracking-wider">OKAY</span>
            </button>

            {/* NOT OKAY */}
            <button
              type="button"
              onClick={() => setSelectedQualityStatus('not_ok')}
              disabled={isSubmitting}
              className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-md border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedQualityStatus === 'not_ok'
                  ? 'bg-red-700 border-red-400 ring-2 ring-red-400'
                  : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-xs font-semibold text-white tracking-wider">NOT OKAY</span>
            </button>

            {/* OKAY UPDATE */}
            <button
              type="button"
              onClick={() => setSelectedQualityStatus('ok_update')}
              disabled={isSubmitting}
              className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-md border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedQualityStatus === 'ok_update'
                  ? 'bg-blue-700 border-blue-400 ring-2 ring-blue-400'
                  : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span className="text-xs font-semibold text-white tracking-wider">OKAY UPD</span>
            </button>

            {/* NOT OKAY UPDATE */}
            <button
              type="button"
              onClick={() => setSelectedQualityStatus('not_ok_update')}
              disabled={isSubmitting}
              className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-md border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedQualityStatus === 'not_ok_update'
                  ? 'bg-orange-700 border-orange-400 ring-2 ring-orange-400'
                  : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span className="text-xs font-semibold text-white tracking-wider">NOT OK UPD</span>
            </button>
          </div>

          {/* Footer info */}
          <div className="mt-auto border-t border-gray-700 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400 font-medium tracking-wider uppercase">Approved By</span>
              <span className="text-white font-mono text-right truncate max-w-[120px]">
                {supervisors.find((s) => s.id === selectedSupervisorId)?.full_name ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 font-medium tracking-wider uppercase">Timestamp</span>
              <span className="text-white font-mono text-right">
                {recentScans[0]?.scan_timestamp ? formatIST(recentScans[0].scan_timestamp) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {showFirstArticle && (
        <FirstArticleDialog
          inspectors={inspectors}
          loadingInspectors={inspectorsLoading}
          onConfirm={handleFirstArticleConfirm}
          onCancel={resetScanFlow}
          disabled={isSubmitting}
        />
      )}

      {/* Recent Scans */}
      <SessionDisplay scans={recentScans} highlightIds={highlightIds} totalCount={stageTotalCount} />

      {/* SOP Viewer Modal */}
      {sopViewState && (
        <SopViewerModal
          stageId={sopViewState.stageId}
          stageName={stages.find((s) => s.id === sopViewState.stageId)?.stage_name ?? ''}
          initialFileId={sopViewState.fileId}
          onClose={() => setSopViewState(null)}
        />
      )}
    </div>
  );
}
