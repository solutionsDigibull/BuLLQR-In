import api from './api.ts';
import type { AIQueryRequest, AIQueryResponse } from '../types/ai.ts';

export async function askAI(question: string): Promise<AIQueryResponse> {
  const response = await api.post<AIQueryResponse>('/ai/query', {
    question,
  } satisfies AIQueryRequest);
  return response.data;
}
