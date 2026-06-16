import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URL mặc định khi test trên máy ảo Android (10.0.2.2 ánh xạ tới localhost của máy chủ dev)
export const DEFAULT_API_URL = 'http://10.0.2.2:5000/api';

let currentApiUrl = DEFAULT_API_URL;

const api = axios.create({
  baseURL: currentApiUrl,
  timeout: 10000,
});

// Khởi tạo Base URL từ bộ nhớ máy
export const initApiUrl = async () => {
  try {
    const savedUrl = await AsyncStorage.getItem('api_base_url');
    if (savedUrl) {
      currentApiUrl = savedUrl;
      api.defaults.baseURL = savedUrl;
    }
  } catch (error) {
    console.error('Không tải được api_base_url', error);
  }
  return currentApiUrl;
};

// Cập nhật động Base URL khi chuyển môi trường dev/staging
export const updateBaseUrl = async (newUrl) => {
  try {
    currentApiUrl = newUrl;
    api.defaults.baseURL = newUrl;
    await AsyncStorage.setItem('api_base_url', newUrl);
  } catch (error) {
    console.error('Không lưu được api_base_url mới', error);
  }
};

export const getBaseUrl = () => currentApiUrl;

// Bộ đánh chặn Request để tự động chèn JWT Token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Lỗi khi đọc token từ AsyncStorage', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Bộ đánh chặn Response để xử lý khi token hết hạn (401)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;
