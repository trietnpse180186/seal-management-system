# Báo cáo đánh giá & Tối ưu hóa kiến trúc AI và n8n

Tài liệu này phân tích chi tiết về kiến trúc đồng bộ commit, cấu hình n8n, và hướng dẫn cách điều chỉnh tần suất kéo commit tự động của hệ thống.

---

## 1. Phân tích kiến trúc n8n & Node Webhook

### Câu hỏi: "Tại sao Webhook Node không tự trả về JSON trực tiếp mà phải dùng Node 'Respond to Webhook'?"

Trong workflow n8n hiện tại của dự án:
- **Webhook Node** đóng vai trò là cổng đón tiếp nhận các yêu cầu HTTP POST gửi từ backend web.
- **Message a model Node** nhận dữ liệu, gọi mô hình AI để phân tích code diff và rubric chấm điểm.
- **Respond to Webhook Node** nhận kết quả JSON sạch từ AI và đóng kết nối HTTP để gửi trả về cho backend.

Lý do n8n thiết kế tách biệt và không set trả về JSON ngay tại Webhook Node:
1. **Kiểm soát thời gian phản hồi (Synchronous Execution)**: Khi cấu hình `Respond: Using 'Respond to Webhook' Node` trong Webhook Node, n8n sẽ **giữ kết nối HTTP mở** (treo kết nối). Kết nối chỉ đóng khi luồng đi hết toàn bộ các node trung gian và chạm vào node **Respond to Webhook**. Điều này giúp backend của chúng ta nhận về kết quả AI đồng bộ ngay lập tức để lưu vào DB trong cùng một request. Nếu trả về ngay tại Webhook Node, backend sẽ chỉ nhận lại mã 200 trống và không nhận được kết quả AI.
2. **Luồng dữ liệu (Data Flow)**: Dữ liệu ở Webhook Node là dữ liệu **đầu vào** (code diff thô). Lấy phản hồi từ Webhook Node sẽ chỉ gửi trả lại dữ liệu đầu vào. Sử dụng node **Respond to Webhook** ở cuối giống như lệnh `return` ở cuối hàm, giúp gửi lại dữ liệu **đầu ra** (kết quả đã phân tích bởi AI) cho backend.
3. **Ánh xạ thuộc tính**: Cho phép viết Expressions để lọc cấu trúc JSON trả về một cách linh hoạt.

---

## 2. Các điểm nghẽn và giải pháp tối ưu hóa khi chịu tải cao (30 repo)

Khi hệ thống mở rộng lên 30 đội thi (30 repositories chạy đồng thời), kiến trúc hiện tại sẽ gặp các vấn đề sau:

### Điểm nghẽn 1: Lặp tuần tự (Sequential Loop) trong Cron
- **Hiện tại**: Trong `cronService.js`, hàm `syncAllRepositories` duyệt qua 30 repo bằng vòng lặp `for...of` tuần tự. Nếu mỗi repo mất 20 giây để n8n & Gemini xử lý xong, tổng thời gian đồng bộ sẽ kéo dài đến **10 phút**.
- **Giải pháp**: Sử dụng cơ chế kiểm soát xử lý song song có giới hạn (**Controlled Concurrency** - ví dụ: xử lý 3 repo một lúc). Tránh dùng `Promise.all` song song 100% vì sẽ bị GitHub API và Gemini chặn do quá nhiều yêu cầu đồng thời (HTTP 429).

### Điểm nghẽn 2: Dư thừa cuộc gọi GitHub API (Redundant Calls)
- **Hiện tại**: Hàm `syncRepo` gọi `githubService.fetchCommits` (chạy parallel `octokit.repos.getCommit` cho mỗi commit để lấy thống kê additions/deletions). Ngay sau đó, nó gọi `githubService.fetchCommitFiles` (lại gọi `octokit.repos.getCommit` một lần nữa để lấy patch/diff của file).
- **Giải pháp**: Gộp chung hai hàm này lại. Bản thân cuộc gọi `getCommit` của Octokit đã trả về đầy đủ cả số lượng additions/deletions lẫn danh sách file và patch/diff. Việc chỉ gọi 1 lần giúp giảm 50% số lượng request, tăng gấp đôi tốc độ đồng bộ và giảm rủi ro bị khóa API Token.

---

## 3. Hướng dẫn tùy chỉnh thời gian kéo commit tự động

Mặc định, hệ thống được cấu hình kéo commit tự động mỗi **30 phút** qua tác vụ nền (cron job).

### Nơi cấu hình thay đổi thời gian:
Bạn mở file [cronService.js](file:///c:/Users/Triet/MyProject/seal-management-system/server/features/events/cronService.js) tìm đến dòng **76**:

```javascript
  // Schedule to run every 30 minutes: '*/30 * * * *'
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRON] Running scheduled 30-minute GitHub commit sync...');
    try {
      await syncAllRepositories();
    } catch (error) {
      console.error('[CRON ERROR] Failed to sync commits:', error.message);
    }
  });
```

### Các cấu hình mẫu phổ biến (Cron Expression):
Bạn có thể thay thế chuỗi `'*/30 * * * *'` (chạy mỗi 30 phút) bằng các giá trị sau tùy nhu cầu:

* **Mỗi 10 phút**: `'*/10 * * * *'`
* **Mỗi 1 giờ**: `'0 * * * *'`
* **Mỗi 2 giờ**: `'0 */2 * * *'`
* **Mỗi ngày vào lúc 00:00 đêm**: `'0 0 * * *'`
* **Mỗi 1 phút (chỉ dùng để test nhanh)**: `'* * * * *'`
