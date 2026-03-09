import api from './api.ts';

export interface RejectedCable {
  scan_id: string;
  work_order_id: string;
  work_order_code: string;
  serial_number: string | null;
  stage_name: string;
  stage_id: string;
  operator_name: string;
  quality_status: string;
  scan_timestamp: string;
  rework_detail: string | null;
  rework_copq_cost: number | null;
  rework_applied_by: string | null;
  rework_date: string | null;
  rework_history_id: string | null;
  rework_notes: string | null;
}

export interface COPQStageDetail {
  stage_name: string;
  rejection_count: number;
  reworked_count: number;
  total_copq_cost: number;
  rework_details: { rework_detail: string; count: number; total_cost: number }[];
}

export interface COPQSummary {
  total_rejected: number;
  total_reworked: number;
  total_copq_cost: number;
  by_stage: COPQStageDetail[];
  date_range: { start_date: string | null; end_date: string | null };
}

export async function getRejectedCables(params: {
  page?: number;
  per_page?: number;
  start_date?: string;
  end_date?: string;
  no_rework_only?: boolean;
}): Promise<{ items: RejectedCable[]; total: number; page: number; per_page: number }> {
  const response = await api.get('/scan/rejected-cables', { params });
  return response.data;
}

export async function applyRework(data: {
  scan_record_id: string;
  work_order_id: string;
  rework_config_id: string;
  applied_by: string;
  notes?: string;
}): Promise<unknown> {
  const response = await api.post('/scan/apply-rework', data);
  return response.data;
}

export async function updateReworkType(
  reworkId: string,
  reworkConfigId: string,
  appliedBy: string,
  notes?: string,
): Promise<unknown> {
  const response = await api.put(`/scan/rework-history/${reworkId}`, null, {
    params: { rework_config_id: reworkConfigId, applied_by: appliedBy, notes },
  });
  return response.data;
}

export interface ReworkHistoryEntry {
  id: string;
  rework_detail: string;
  copq_cost: number;
  applied_by: string;
  rework_date: string | null;
  notes: string | null;
  is_active: boolean;
}

export async function getReworkHistoryForScan(scanRecordId: string): Promise<ReworkHistoryEntry[]> {
  const response = await api.get<ReworkHistoryEntry[]>(`/scan/rework-history-for-scan/${scanRecordId}`);
  return response.data;
}

export async function getCOPQSummary(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<COPQSummary> {
  const response = await api.get<COPQSummary>('/scan/copq-summary', { params });
  return response.data;
}
