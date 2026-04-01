import api from './api.ts';
import type {
  ProductionProgress,
  DashboardData,
  OperatorPerformance,
  OperatorStageMatrix,
  QualityStats,
  COPQSummary,
  ProductPerformance,
} from '../types/analytics.ts';

export async function getProductionProgress(): Promise<ProductionProgress> {
  const response = await api.get<ProductionProgress>('/analytics/progress');
  return response.data;
}

export async function getDashboard(productId?: string, date?: string): Promise<DashboardData> {
  const params: Record<string, string> = {};
  if (productId) params.product_id = productId;
  if (date) params.date = date;
  const response = await api.get<DashboardData>('/analytics/dashboard', { params });
  return response.data;
}

export async function getOperatorPerformance(
  days: number = 7,
  todayOnly: boolean = false,
  productId?: string,
): Promise<OperatorPerformance> {
  const params: Record<string, string | number | boolean> = { days, today_only: todayOnly };
  if (productId) params.product_id = productId;
  const response = await api.get<OperatorPerformance>(
    '/analytics/operator-performance',
    { params },
  );
  return response.data;
}

export async function getOperatorStageMatrix(
  days: number = 7,
): Promise<OperatorStageMatrix> {
  const response = await api.get<OperatorStageMatrix>(
    '/analytics/operator-stage-matrix',
    { params: { days } },
  );
  return response.data;
}

export async function getQualityStats(
  days: number = 7,
): Promise<QualityStats> {
  const response = await api.get<QualityStats>(
    '/analytics/quality-stats',
    { params: { days } },
  );
  return response.data;
}

export async function getCOPQ(days: number = 30): Promise<COPQSummary> {
  const response = await api.get<COPQSummary>('/analytics/copq', {
    params: { days },
  });
  return response.data;
}

export async function getProductPerformance(days: number = 7, date?: string): Promise<ProductPerformance> {
  const params: Record<string, string | number> = { days };
  if (date) params.date = date;
  const response = await api.get<ProductPerformance>('/analytics/product-performance', { params });
  return response.data;
}

export async function downloadReport(
  type: 'scans' | 'rework' | 'combined',
  startDate: string,
  endDate: string,
  productId?: string,
): Promise<void> {
  const params: Record<string, string> = { start_date: startDate, end_date: endDate };
  if (productId) params.product_id = productId;
  const response = await api.get(`/analytics/reports/${type}`, {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  let filename: string;
  if (type === 'scans') filename = `scan_records_${startDate}_${endDate}.xlsx`;
  else if (type === 'rework') filename = `rework_history_${startDate}_${endDate}.xlsx`;
  else filename = `production_report_${startDate}_${endDate}.xlsx`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
