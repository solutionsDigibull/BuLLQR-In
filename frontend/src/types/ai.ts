export interface AIQueryRequest {
  question: string;
}

export interface AIQueryResponse {
  answer: string;
  context_summary: string;
}
