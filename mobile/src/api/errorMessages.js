/**
 * Error Dictionary - Từ điển lỗi tập trung
 * Ánh xạ HTTP Status Code và Custom Error Codes thành câu thông báo tiếng Việt thân thiện.
 */
const errorMessages = {
  // --- HTTP Status Codes ---
  400: 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin nhập vào.',
  401: 'Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện hành động này.',
  404: 'Tài nguyên yêu cầu không tồn tại trên hệ thống.',
  408: 'Thời gian kết nối máy chủ quá hạn. Vui lòng thử lại.',
  409: 'Dữ liệu này đã tồn tại trên hệ thống (Trùng lặp dữ liệu).',
  422: 'Dữ liệu nhập vào không hợp lệ hoặc không đúng định dạng.',
  429: 'Yêu cầu quá tải. Vui lòng thử lại sau ít phút.',
  500: 'Hệ thống đang gặp sự cố kỹ thuật. Vui lòng thử lại sau.',
  502: 'Cổng kết nối máy chủ đang bị gián đoạn.',
  503: 'Dịch vụ hiện tại không khả dụng. Máy chủ đang bảo trì.',

  // --- Mất kết nối mạng ---
  NETWORK_ERROR: 'Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối mạng của thiết bị.',

  // --- Lỗi mặc định ---
  DEFAULT_ERROR: 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.',

  // --- Ánh xạ các lỗi nghiệp vụ Backend cụ thể (Ví dụ) ---
  'User already exists': 'Tài khoản với email này đã tồn tại trên hệ thống.',
  'Invalid credentials': 'Tài khoản hoặc mật khẩu không chính xác.',
  'Token expired': 'Mã xác thực đã hết hạn.',
  'Email not verified': 'Email của bạn chưa được xác thực. Vui lòng kiểm tra hộp thư.'
};

export default errorMessages;
