import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useWebSocketSubscribe } from '../context/WebSocketContext.tsx';
import BarcodeInput from '../components/scan/BarcodeInput.tsx';
import StageSelector from '../components/scan/StageSelector.tsx';
import FirstArticleDialog from '../components/scan/FirstArticleDialog.tsx';
import ScanFeedback from '../components/scan/ScanFeedback.tsx';
import SessionDisplay from '../components/scan/SessionDisplay.tsx';
import * as scanService from '../services/scan.ts';
import { listProducts, getProductStages } from '../services/config.ts';
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

  // Setup state
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [selectedStageId, setSelectedStageId] = useState('');

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

  // Session state
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [stageTotalCount, setStageTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const highlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const selectedStageIdRef = useRef(selectedStageId);

  // Load products on mount
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
    return () => { cancelled = true; };
  }, []);

  // Load stages when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setStages([]);
      setSelectedStageId('');
      setStagesLoading(false);
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

  // Load session data when selected stage changes
  useEffect(() => {
    if (!selectedStageId) {
      setRecentScans([]);
      setStageTotalCount(0);
      setTodayCount(0);
      return;
    }
    scanService
      .getLatestScans(30, selectedStageId)
      .then((data) => {
        setRecentScans(data.scans);
        setStageTotalCount(data.total_count);
      })
      .catch(() => {});
    scanService
      .getTodayCount(selectedStageId)
      .then((data) => setTodayCount(data.unique_work_orders))
      .catch(() => {});
  }, [selectedStageId]);

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
      if (!validation.valid && validation.missing_stages.length > 0) {
        const missing = validation.missing_stages.map((s) => `${s.stage_name} (Stage ${s.stage_sequence})`).join(', ');
        setFeedback({
          type: 'error',
          message: `Rejected: Complete previous stages first — ${missing}.`,
        });
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

      // Refresh first article status after successful scan
      scanService
        .getFirstArticleStatus()
        .then((data) => {
          const map = new Map<string, boolean>();
          data.stages.forEach((s) => map.set(s.stage_id, s.first_article_completed));
          setFirstArticleStages(map);
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
          <span className="text-gray-500 dark:text-gray-400">
            Operator: <strong className="text-gray-800 dark:text-gray-200">{user?.full_name}</strong>
          </span>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        {/* Row 1: Product, Stage, Operator */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Product selector */}
          <div>
            <label htmlFor="product-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product
            </label>
            <select
              id="product-select"
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                if (flowState !== 'idle') resetScanFlow();
              }}
              disabled={isSubmitting || productsLoading}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-600"
            >
              <option value="">{productsLoading ? 'Loading...' : 'Select a product'}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_code} — {p.product_name}
                </option>
              ))}
            </select>
          </div>

          <StageSelector
            stages={stages}
            selectedStageId={selectedStageId}
            onChange={(id) => {
              setSelectedStageId(id);
              if (flowState !== 'idle') resetScanFlow();
            }}
            loading={stagesLoading}
            disabled={isSubmitting}
          />

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
        </div>

        {/* Row 2: Supervisor, Quality Inspector, Quality Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

          {/* Quality Status selector */}
          <div>
            <label htmlFor="quality-status-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quality Status
            </label>
            <select
              id="quality-status-select"
              value={selectedQualityStatus}
              onChange={(e) => setSelectedQualityStatus(e.target.value as QualityStatus)}
              disabled={isSubmitting}
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 dark:disabled:bg-gray-600"
            >
              <option value="ok">OK</option>
              <option value="not_ok">Not OK</option>
              <option value="ok_update">OK Update</option>
              <option value="not_ok_update">Not OK Update</option>
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

      {/* Scan Input Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-3">
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
    </div>
  );
}
