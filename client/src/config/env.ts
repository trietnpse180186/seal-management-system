import { API_BASE_URL } from './api.config';

export const ENV = {
  API_URL: API_BASE_URL,
  IS_PROD: import.meta.env.PROD || import.meta.env.MODE === 'production',
  IS_DEV: import.meta.env.DEV || import.meta.env.MODE === 'development',
} as const;

export default ENV;
