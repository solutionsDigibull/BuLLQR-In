import api from './api.ts';
import type {
  Product,
  ProductCreate,
  ProductUpdate,
  TargetUpdate,
  ReworkCost,
  ReworkCostUpdate,
  Operator,
  OperatorCreate,
  OperatorUpdate,
  StageCreate,
  StageUpdate,
  ReworkConfigItem,
  ReworkConfigCreate,
  ReworkConfigUpdate,
  ProductionTargetItem,
  SopFile,
} from '../types/config.ts';
import type { ProductionStage } from '../types/scan.ts';

// Products
export async function listProducts(): Promise<Product[]> {
  const response = await api.get<{ products: Product[] }>('/config/products');
  return response.data.products;
}

export async function createProduct(data: ProductCreate): Promise<Product> {
  const response = await api.post<Product>('/config/products', data);
  return response.data;
}

export async function updateProduct(productId: string, data: ProductUpdate): Promise<Product> {
  const response = await api.put<Product>(`/config/products/${productId}`, data);
  return response.data;
}

export async function activateProduct(productId: string): Promise<Product> {
  const response = await api.post<Product>(`/config/products/${productId}/activate`);
  return response.data;
}

export async function setProductionTarget(productId: string, data: TargetUpdate): Promise<Product> {
  const response = await api.put<Product>(`/config/products/${productId}/target`, data);
  return response.data;
}

export async function completeProductionTarget(productId: string): Promise<{ message: string; product: Product }> {
  const response = await api.post<{ message: string; product: Product }>(`/config/products/${productId}/target`);
  return response.data;
}

// Product Stages
export async function setProductStages(
  productId: string,
  stages: { stage_id: string; sequence: number; is_mandatory?: boolean }[],
): Promise<Product> {
  const response = await api.put<Product>(`/config/products/${productId}/stages`, { stages });
  return response.data;
}

export async function getProductStages(productId: string): Promise<ProductionStage[]> {
  const response = await api.get<{ stages: ProductionStage[] }>(`/config/products/${productId}/stages`);
  return response.data.stages;
}

// Rework Costs
export async function listReworkCosts(): Promise<ReworkCost[]> {
  const response = await api.get<{ costs: ReworkCost[] }>('/config/rework-costs');
  return response.data.costs;
}

export async function updateReworkCost(stageId: string, data: ReworkCostUpdate): Promise<ReworkCost> {
  const response = await api.put<ReworkCost>(`/config/rework-costs/${stageId}`, data);
  return response.data;
}

// Operators
export async function listOperators(
  role?: string,
  isActive?: boolean,
): Promise<Operator[]> {
  const params: Record<string, string | boolean> = {};
  if (role) params.role = role;
  if (isActive !== undefined) params.is_active = isActive;
  const response = await api.get<{ operators: Operator[] }>('/config/operators', { params });
  return response.data.operators;
}

export async function createOperator(data: OperatorCreate): Promise<Operator> {
  const response = await api.post<Operator>('/config/operators', data);
  return response.data;
}

export async function updateOperator(operatorId: string, data: OperatorUpdate): Promise<Operator> {
  const response = await api.put<Operator>(`/config/operators/${operatorId}`, data);
  return response.data;
}

export async function deleteOperator(operatorId: string): Promise<void> {
  await api.delete(`/config/operators/${operatorId}`);
}

// Stages CRUD
export async function createStage(data: StageCreate): Promise<ProductionStage> {
  const response = await api.post<ProductionStage>('/config/stages', data);
  return response.data;
}

export async function updateStage(stageId: string, data: StageUpdate): Promise<ProductionStage> {
  const response = await api.put<ProductionStage>(`/config/stages/${stageId}`, data);
  return response.data;
}

export async function deleteStage(stageId: string, force = false): Promise<void> {
  await api.delete(`/config/stages/${stageId}`, { params: { force } });
}

// SOP Files
export async function uploadSopFile(stageId: string, file: File): Promise<SopFile> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<SopFile>(`/config/stages/${stageId}/sop`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function listSopFiles(stageId: string): Promise<SopFile[]> {
  const response = await api.get<{ files: SopFile[] }>(`/config/stages/${stageId}/sop`);
  return response.data.files;
}

export async function deleteSopFile(stageId: string, fileId: string): Promise<void> {
  await api.delete(`/config/stages/${stageId}/sop/${fileId}`);
}

export function getSopFileUrl(stageId: string, fileId: string): string {
  return `/api/v1/config/stages/${stageId}/sop/${fileId}/content`;
}

// Rework Configs
export async function listReworkConfigs(activeOnly = false): Promise<ReworkConfigItem[]> {
  const response = await api.get<{ rework_configs: ReworkConfigItem[] }>('/config/rework-configs', {
    params: { active_only: activeOnly },
  });
  return response.data.rework_configs;
}

export async function createReworkConfig(data: ReworkConfigCreate): Promise<ReworkConfigItem> {
  const response = await api.post<ReworkConfigItem>('/config/rework-configs', data);
  return response.data;
}

export async function updateReworkConfig(configId: string, data: ReworkConfigUpdate): Promise<ReworkConfigItem> {
  const response = await api.put<ReworkConfigItem>(`/config/rework-configs/${configId}`, data);
  return response.data;
}

export async function deleteReworkConfig(configId: string): Promise<void> {
  await api.delete(`/config/rework-configs/${configId}`);
}

// Standalone Production Target
export async function getTodayTarget(): Promise<ProductionTargetItem | null> {
  const response = await api.get<{ target: ProductionTargetItem | null }>('/config/production-target/today');
  return response.data.target;
}

export async function setTodayTarget(targetQuantity: number): Promise<ProductionTargetItem> {
  const response = await api.post<{ target: ProductionTargetItem }>('/config/production-target/today', {
    target_quantity: targetQuantity,
  });
  return response.data.target;
}

export async function completeTarget(): Promise<void> {
  await api.post('/config/production-target/complete');
}

// Export
export async function generateReports(startDate?: string, endDate?: string, productId?: string): Promise<Blob> {
  const params: Record<string, string | undefined> = { start_date: startDate, end_date: endDate };
  if (productId) params.product_id = productId;
  const response = await api.post('/export/generate-reports', null, {
    params,
    responseType: 'blob',
  });
  return response.data;
}

export async function downloadReports(startDate?: string, endDate?: string, productId?: string): Promise<Blob> {
  const params: Record<string, string | undefined> = { start_date: startDate, end_date: endDate };
  if (productId) params.product_id = productId;
  const response = await api.get('/export/download-reports', {
    params,
    responseType: 'blob',
  });
  return response.data;
}
