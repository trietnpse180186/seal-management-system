import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import errorMessages from './errorMessages';

// Khởi tạo Axios Client với cấu hình mặc định
const apiClient = axios.create({
  baseURL: 'https://seal-management-system-staging.onrender.com/api',
  timeout: 10000,
});

// Interceptor chèn JWT Token trước khi gửi request
apiClient.interceptors.request.use(
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
  (error) => Promise.reject(error)
);

// Interceptor xử lý Response & lỗi tập trung (Centralized Error Interceptor)
apiClient.interceptors.response.use(
  (response) => {
    // Trả về dữ liệu nếu request thành công
    return response;
  },
  async (error) => {
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

    // 3. Ghi đè thông báo lỗi thân thiện vào đối tượng lỗi gốc để tương thích với cấu trúc Axios chuẩn
    error.message = friendlyMessage;
    if (error.response && error.response.data) {
      error.response.data.message = friendlyMessage;
    }

    return Promise.reject(error);
  }
);

export default apiClient;
