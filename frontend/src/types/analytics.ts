export interface StageProgress {
  stage_name: string;
  stage_sequence: number;
  current_count: number;
  target_count: number;
  ok_count: number;
  not_ok_count: number;
  progress_percentage: number;
}

export interface ProductionProgress {
  stages: StageProgress[];
  target_status: 'not_set' | 'in_progress' | 'completed';
  target_completion_percentage: number;
}

export interface StageMetrics {
  scan_count: number;
  ok_count: number;
  not_ok_count: number;
  ok_percentage: number;
}

export interface OperatorStageEntry {
  stage_name: string;
  scan_count: number;
  ok_count: number;
  not_ok_count: number;
  ok_percentage: number;
}

export interface OperatorPerformanceEntry {
  operator_name: string;
  station_id: string;
  display_name: string;
  stages: OperatorStageEntry[];
}

export interface OperatorPerformance {
  operators: OperatorPerformanceEntry[];
}

export interface OperatorMatrixRow {
  operator_name: string;
  station_id: string;
  [stageKey: string]: string | StageMetrics;
}

export interface OperatorStageMatrix {
  matrix: OperatorMatrixRow[];
}

export interface QualityStatsByStage {
  stage_name: string;
  total: number;
  ok: number;
  not_ok: number;
  ok_percentage: number;
}

export interface QualityStats {
  total_scans: number;
  ok_count: number;
  not_ok_count: number;
  ok_percentage: number;
  not_ok_percentage: number;
  by_stage?: QualityStatsByStage[];
}

export interface COPQByStage {
  stage_name: string;
  rework_count: number;
  total_cost: number;
  avg_cost_per_rework: number;
}

export interface COPQSummary {
  total_copq: number;
  currency: string;
  rework_count: number;
  by_stage?: COPQByStage[];
  date_range?: {
    start_date: string;
    end_date: string;
  };
}

export interface DashboardData {
  production_progress: ProductionProgress;
  quality_stats: QualityStats;
  copq_summary: COPQSummary;
  today_unique_count: number;
}
