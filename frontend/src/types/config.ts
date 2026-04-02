export interface Product {
  id: string;
  product_code: string;
  product_name: string;
  is_active: boolean;
  production_target: number | null;
  target_status: 'not_set' | 'in_progress' | 'completed';
  target_set_at: string | null;
  target_completed_at: string | null;
  stage_ids: string[];
  stage_sequences: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  product_code: string;
  product_name: string;
}

export interface ProductUpdate {
  product_code?: string;
  product_name?: string;
}

export interface TargetUpdate {
  production_target: number;
}

export interface ReworkCost {
  id: string;
  stage_id: string;
  stage_name: string;
  cost_per_rework: number;
  currency: string;
  effective_from: string;
  created_at: string;
  updated_at: string;
}

export interface ReworkCostUpdate {
  cost_per_rework: number;
  currency?: string;
}

export interface Operator {
  id: string;
  username: string;
  full_name: string;
  role: 'operator' | 'quality_inspector' | 'supervisor' | 'admin';
  station_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OperatorCreate {
  username: string;
  password: string;
  full_name: string;
  role: 'operator' | 'quality_inspector' | 'supervisor' | 'admin';
  station_id?: string | null;
}

export interface OperatorUpdate {
  username?: string;
  full_name?: string;
  role?: 'operator' | 'quality_inspector' | 'supervisor' | 'admin';
  station_id?: string | null;
  is_active?: boolean;
}

// Stage CRUD
export interface StageCreate {
  stage_name: string;
  stage_sequence?: number;
  description?: string;
}

export interface StageUpdate {
  stage_name?: string;
  stage_sequence?: number;
  description?: string;
}

// Rework Category (Rework Name)
export interface ReworkCategory {
  id: string;
  name: string;
  rework_configs?: ReworkConfigItem[];
  created_at: string;
  updated_at: string;
}

export interface ReworkCategoryCreate {
  name: string;
}

// Rework Config
export interface ReworkConfigItem {
  id: string;
  category_id: string | null;
  rework_detail: string;
  copq_cost: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReworkConfigCreate {
  rework_detail: string;
  copq_cost: number;
  description?: string;
  category_id?: string;
}

export interface ReworkConfigUpdate {
  rework_detail?: string;
  copq_cost?: number;
  description?: string;
  is_active?: boolean;
  category_id?: string;
}

// SOP Files
export interface SopFile {
  id: string;
  stage_id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

// Production Target
export interface ProductionTargetItem {
  id: string;
  target_date: string;
  target_quantity: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
