import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import errorMessages from './errorMessages';

// URL mặc định khi test trên máy ảo Android (10.0.2.2 ánh xạ tới localhost của máy chủ dev)
export const DEFAULT_API_URL = 'https://seal-management-system-staging.onrender.com/api';

let currentApiUrl = DEFAULT_API_URL;

const api = axios.create({
  baseURL: currentApiUrl,
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

// Bộ đánh chặn Response để xử lý lỗi tập trung & tự động thử lại khi Server ngủ dậy (Cold-start)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Tự động thử lại tối đa 2 lần nếu gặp lỗi mạng hoặc 502/503/504 (Server Render đang khởi động lại)
    if (config && (!error.response || [502, 503, 504].includes(error.response.status))) {
      config._retryCount = config._retryCount || 0;
      if (config._retryCount < 2) {
        config._retryCount += 1;
        // Đợi 2.5 giây cho Server khởi động xong rồi thử lại request
        await new Promise((resolve) => setTimeout(resolve, 2500));
        return api(config);
      }
    }

    // 1. Tự động dọn dẹp phiên đăng nhập nếu nhận mã 401
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }

    let friendlyMessage = '';

    // 2. Trường hợp mất kết nối Internet hoàn toàn (Không nhận được response)
    if (!error.response) {
      friendlyMessage = errorMessages.NETWORK_ERROR;
    } else {
      const statusCode = error.response.status;
      const responseData = error.response.data;

      // Ưu tiên 1: Lấy tin nhắn lỗi chi tiết tiếng Việt do Backend gửi về
      if (responseData && typeof responseData.message === 'string') {
        friendlyMessage = responseData.message;
      } 
      // Ưu tiên 2: Ánh xạ mã lỗi HTTP thô (400, 403, 409, 500...) qua từ điển Việt hóa
      else {
        friendlyMessage = errorMessages[statusCode] || errorMessages.DEFAULT_ERROR;
      }
    }

    // 3. Ghi đè thông báo lỗi thân thiện vào đối tượng lỗi gốc để tương thích ngược với các màn hình đang đọc error.response.data.message
    error.message = friendlyMessage;
    if (error.response && error.response.data && typeof error.response.data === 'object') {
      error.response.data.message = friendlyMessage;
    }

    return Promise.reject(error);
  }
);

export default api;
