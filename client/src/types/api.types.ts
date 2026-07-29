export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
