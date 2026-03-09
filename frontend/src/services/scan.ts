import api from './api.ts';
import type {
  ScanRequest,
  ScanResponse,
  ScanRecord,
  QualityUpdateRequest,
  ProductionStage,
} from '../types/scan.ts';
import type { User } from '../types/auth.ts';

export async function processScan(request: ScanRequest): Promise<ScanResponse> {
  const response = await api.post<ScanResponse>('/scan', request);
  return response.data;
}

export async function updateQualityStatus(
  scanId: string,
  request: QualityUpdateRequest,
): Promise<ScanRecord> {
  const response = await api.put<ScanRecord>(`/scan/${scanId}/quality`, request);
  return response.data;
}

export async function getLatestScans(
  limit: number = 10,
  stageId?: string,
): Promise<{ scans: ScanRecord[]; total_count: number }> {
  const params: Record<string, unknown> = { limit };
  if (stageId) params.stage_id = stageId;
  const response = await api.get<{ scans: ScanRecord[]; total_count: number }>(
    '/session/latest',
    { params },
  );
  return response.data;
}

export async function getTodayCount(stageId?: string): Promise<{
  unique_work_orders: number;
  date: string;
}> {
  const params: Record<string, unknown> = {};
  if (stageId) params.stage_id = stageId;
  const response = await api.get<{ unique_work_orders: number; date: string }>(
    '/session/today-count',
    { params },
  );
  return response.data;
}

export async function getStages(): Promise<ProductionStage[]> {
  const response = await api.get<{ stages: ProductionStage[] }>('/config/stages');
  return response.data.stages;
}

export async function getOperatorsByRole(role: string): Promise<User[]> {
  const response = await api.get<{ operators: User[] }>('/config/operators', {
    params: { role, is_active: true },
  });
  return response.data.operators;
}

export async function checkPreviousStage(
  barcode: string,
  stageId: string,
  productId?: string,
): Promise<{ valid: boolean; missing_stages: { stage_name: string; stage_sequence: number }[] }> {
  const response = await api.get<{
    valid: boolean;
    missing_stages: { stage_name: string; stage_sequence: number }[];
  }>('/scan/check-previous-stage', { params: { barcode, stage_id: stageId, product_id: productId } });
  return response.data;
}

export async function getFirstArticleStatus(
  targetDate?: string,
): Promise<{
  date: string;
  stages: {
    stage_id: string;
    stage_name: string;
    stage_sequence: number;
    first_article_completed: boolean;
    completed_at: string | null;
  }[];
}> {
  const response = await api.get('/scan/first-article-status', {
    params: targetDate ? { target_date: targetDate } : {},
  });
  return response.data;
}
