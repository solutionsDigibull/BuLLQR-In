export type QualityStatus = 'ok' | 'not_ok' | 'ok_update' | 'not_ok_update';
export type ScanType = 'normal' | 'first_article' | 'update';

export interface ScanRecord {
  id: string;
  work_order_id: string;
  work_order_code: string;
  serial_number: string;
  stage_id: string;
  stage_name: string;
  operator_id: string;
  operator_name: string;
  station_id: string | null;
  scan_type: ScanType;
  quality_status: QualityStatus;
  is_first_article: boolean;
  supervisor_id: string | null;
  supervisor_name: string | null;
  quality_inspector_id: string | null;
  quality_inspector_name: string | null;
  previous_quality_status: string | null;
  scan_timestamp: string;
  created_at: string;
}

export interface ScanRequest {
  barcode: string;
  stage_id: string;
  operator_id: string;
  quality_status: QualityStatus;
  quality_inspector_id?: string;
  supervisor_id?: string;
  product_id?: string;
}

export interface ScanResponse {
  id: string;
  work_order_id: string;
  serial_number: string;
  work_order_code: string;
  stage_name: string;
  operator_name: string;
  quality_status: string;
  is_first_article: boolean;
  quality_inspector_name: string | null;
  scan_timestamp: string;
  message: string;
}

export interface QualityUpdateRequest {
  new_status: 'ok_update' | 'not_ok_update';
  reason?: string;
}

export interface ProductionStage {
  id: string;
  stage_name: string;
  stage_sequence: number;
  description: string | null;
  is_mandatory: boolean;
}

export interface ApiErrorResponse {
  error: string;
  detail: string;
  code: string;
  timestamp: string;
}
