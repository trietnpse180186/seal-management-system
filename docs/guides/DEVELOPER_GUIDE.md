# HƯỚNG DẪN DEV & CẤU HÌNH API - SEAL HACKATHON SYSTEM

Tài liệu này chi tiết các thành phần đã triển khai trong hệ thống Quản lý cuộc thi SEAL Hackathon và hướng dẫn từng bước để lấy các API key cần thiết (GitHub, Google Gemini AI, Email SMTP) để chạy thực tế hệ thống (không dùng Mock).

---

## 1. Tổng quan cấu trúc hệ thống đã xây dựng

Hệ thống được phát triển theo mô hình Client-Server độc lập:

### Backend (server/)
- **Database (Mongoose - 20 Models)**: Được ánh xạ 100% từ file thiết kế [schema.dbml](file:///c:/Users/Triet/MyProject/seal-management-system/docs/database/schema.dbml). Xem chi tiết các model trong thư mục [server/models/](file:///c:/Users/Triet/MyProject/seal-management-system/server/models/).
- **Services (server/services/)**:
  - `emailService.js`: Gửi mail mời & OTP xác nhận.
  - `githubService.js`: Tạo repo Org private & thêm collaborators.
  - `aiService.js`: Dùng Gemini API phân tích commit diff của từng thành viên và gợi ý điểm rubric.
  - `cronService.js`: Quét tự động (mỗi 30p) để kéo commit & kích hoạt AI phân tích.
- **Routes (server/routes/)**: Cung cấp đầy đủ API RESTful cho xác thực (Auth), quản lý Events/Tracks/Rounds/Rubrics, đăng ký đội (Teams), chấm điểm (Grades) và dữ liệu biểu đồ đóng góp (Analytics).

### Frontend Web (client/)
- Sử dụng **Vite + ReactJS + TypeScript + TailwindCSS v4** (thiết kế theo phong cách tối giản Dark Mode & hiệu ứng Glassmorphic cao cấp).
- **Các trang chính**:
  - `Login.tsx`: Đăng nhập & phân quyền động (Mentor, Judge, Coordinator, Candidate).
  - `RegisterTeam.tsx`: Đăng ký đội thi, cấu hình thành viên (email, MSSV, github).
  - `ConfirmInvite.tsx`: Trang xác nhận khi thành viên click từ link email.
  - `AdminDashboard.tsx`: BTC thiết lập học kỳ (Spring/Summer/Fall), đề thi, và rubric chấm điểm.
  - `TeamArea.tsx`: Thí sinh xem repo, nộp link đề tài, xem tiến độ commit.
  - `GradingBoard.tsx`: Giám khảo chấm điểm từng criterion của rubric (hiển thị đề xuất chấm điểm từ AI).
  - `Leaderboard.tsx`: Bảng xếp hạng realtime sau khi khóa điểm vòng thi.

---

## 2. Hướng dẫn lấy API Key và cấu hình File `.env`

Để chạy dự án thực tế, các thành viên cần tạo file `server/.env` dựa trên file mẫu có sẵn. Dưới đây là cách lấy chi tiết từng API:

### 2.1. Cấu hình MongoDB
Mặc định hệ thống kết nối tới database cục bộ.
- Nếu chạy local: `MONGODB_URI=mongodb://127.0.0.1:27017/seal-hackathon`
- Nếu dùng Cloud (MongoDB Atlas): Đăng ký tại [mongodb.com](https://www.mongodb.com/), tạo database và lấy chuỗi kết nối:
  `MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/seal-hackathon`

### 2.2. Lấy GitHub API Token (`GITHUB_TOKEN`)
Hệ thống sử dụng GitHub API để tự động tạo repository riêng tư (private) cho đội thi và thêm các thành viên làm cộng tác viên (collaborators).
1. Truy cập vào GitHub của bạn -> Nhấp vào ảnh đại diện góc phải -> Chọn **Settings**.
2. Cuộn xuống dưới cùng bên trái, chọn **Developer settings**.
3. Chọn **Personal access tokens** -> Chọn **Tokens (classic)**.
4. Chọn **Generate new token** -> **Generate new token (classic)**.
5. Đặt tên (Note) ví dụ: `seal-hackathon-token`.
6. Tích chọn các quyền sau (Bắt buộc):
   - `repo` (Toàn quyền quản lý repo private/public)
   - `admin:org` (Nếu bạn dùng GitHub Organization để tạo repo cho cuộc thi)
7. Cuộn xuống cuối chọn **Generate token**.
8. **Sao chép Token này ngay lập tức** (nó sẽ không hiển thị lại lần sau).
9. Điền vào `.env`:
   ```env
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   GITHUB_ORG=ten-org-github-cua-cuoc-thi # Ví dụ: sealhackathon-2026
   ```

### 2.3. Lấy Google Gemini API Key (`GEMINI_API_KEY`)
Dùng để phân tích patch code diff của commit và đưa ra gợi ý chấm điểm.
1. Truy cập vào trang [Google AI Studio](https://aistudio.google.com/).
2. Đăng nhập bằng tài khoản Google.
3. Chọn nút **Get API key** ở thanh menu bên trái.
4. Chọn **Create API key** -> Chọn **Create API key in new project** hoặc chọn project có sẵn.
5. Sao chép API key được tạo.
6. Điền vào `.env`:
   ```env
   GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 2.4. Cấu hình Email SMTP (`SMTP_USER`, `SMTP_PASS`)
Dùng để gửi email xác nhận tham gia nhóm đến các thành viên. Chúng ta có thể dùng **Gmail** hoặc **Mailtrap** (để test thử nghiệm):

#### Cách dùng Gmail làm SMTP Server:
1. Đăng nhập vào Tài khoản Google -> Truy cập **Quản lý tài khoản Google**.
2. Chọn mục **Bảo mật** (Security) ở menu bên trái.
3. Bật **Xác minh 2 bước** (2-Step Verification) nếu chưa bật.
4. Sau khi bật Xác minh 2 bước, tìm kiếm ô tìm kiếm hoặc vào mục **Mật khẩu ứng dụng** (App passwords).
5. Nhập tên ứng dụng (Ví dụ: `SEAL Hackathon`) -> Chọn **Tạo** (Create).
6. Sao chép mật khẩu ứng dụng gồm 16 ký tự màu vàng.
7. Cấu hình vào `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=email-cua-ban@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx # Mật khẩu ứng dụng 16 ký tự vừa lấy
   ```

#### Cách dùng Mailtrap để kiểm thử (Khuyên dùng khi Dev):
1. Đăng ký tài khoản miễn phí tại [mailtrap.io](https://mailtrap.io/).
2. Vào **Inboxes** -> Chọn **My Inbox** -> Chọn tab **SMTP Settings** -> Chọn **Integrations: Nodemailer**.
3. Sao chép các thông tin `host`, `port`, `user`, `pass` cấu hình vào `.env`:
   ```env
   SMTP_HOST=sandbox.smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_SECURE=false
   SMTP_USER=xxxxxxxxxxxxxx
   SMTP_PASS=xxxxxxxxxxxxxx
   ```

### 2.5. Cấu hình Đăng nhập bằng tài khoản Google (OAuth2)
Hệ thống cho phép đăng nhập và đăng ký trực tiếp bằng tài khoản Google thông qua Google Identity Services.
#### Cách thiết lập client ID trên Google Cloud:
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Tạo một dự án mới (ví dụ: `SEAL Hackathon`).
3. Điều hướng tới **APIs & Services** -> **OAuth consent screen** (Màn hình đồng ý OAuth):
   - Chọn **External** -> Chọn **Create**.
   - Điền thông tin ứng dụng cơ bản (App name, support email, developer email).
   - Chọn **Save and Continue** qua các bước Scopes và Test users.
4. Điều hướng tới **Credentials** -> Chọn **Create Credentials** -> Chọn **OAuth client ID**:
   - Application type: **Web application**.
   - Name: `SEAL Hackathon Client`.
   - **Authorized JavaScript origins**:
     - Thêm `http://localhost:5173` (đối với giao diện Web local).
   - **Authorized redirect URIs**:
     - Thêm `http://localhost:5173` (hoặc domain deploy thực tế).
5. Nhấp **Create**. Copy mã **Client ID** được tạo.
6. Cấu hình Client ID này trong code frontend (Vite) hoặc để hệ thống tự động xác minh trên backend:
   ```env
   # Backend verify
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   ```
*(Lưu ý: Mặc định nếu chạy cục bộ không có Client ID, bạn có thể chuyển sang tab **Mô phỏng (Mock)** trên giao diện đăng nhập để giả lập đăng nhập Google bằng bất kỳ Email nào vô cùng tiện lợi).*

### 2.6. Cấu hình Đăng nhập bằng tài khoản GitHub (OAuth)
Hệ thống hỗ trợ đăng ký và liên kết tài khoản GitHub trực tiếp.
#### Cách thiết lập GitHub OAuth App:
1. Đăng nhập vào GitHub -> Đi tới **Settings** -> **Developer settings** -> **OAuth Apps**.
2. Chọn **Register a new application**:
   - Application name: `SEAL Hackathon System`.
   - Homepage URL: `http://localhost:5173`.
   - **Authorization callback URL**:
     - Thêm `http://localhost:5173/login` (hoặc URL xử lý callback trên web client).
3. Chọn **Register application**.
4. Sao chép **Client ID**.
5. Nhấp **Generate a new client secret** và sao chép mã Client Secret được hiển thị.
6. Sử dụng Client ID và Client Secret này trong luồng OAuth của bạn.
*(Tương tự Google, hệ thống hỗ trợ chế độ **Mô phỏng (Mock)** giúp bạn giả lập đăng nhập bằng tài khoản GitHub nhanh chóng để kiểm thử logic).*

---

## 3. Nội dung File `.env` hoàn chỉnh (`server/.env`)

Hãy tạo file [server/.env](file:///c:/Users/Triet/MyProject/seal-management-system/server/.env) với nội dung mẫu như sau:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/seal-hackathon
JWT_SECRET=supersecretkey123456789!@#

# Cấu hình GitHub API (Không có sẽ tự động dùng Mock Simulator)
GITHUB_TOKEN=ghp_your_github_personal_access_token_here
GITHUB_ORG=sealhackathon-2026

# Cấu hình Google Gemini AI (Không có sẽ tự động dùng Mock Simulator)
GEMINI_API_KEY=your_gemini_api_key_here

# Cấu hình Email SMTP (Không có sẽ tự động dùng Mock Simulator)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=no-reply@sealhackathon.com
```

---

## 4. Hướng dẫn Chạy & Chỉnh sửa dự án cho thành viên khác

### Bước 1: Khởi động MongoDB local
Đảm bảo máy của bạn đã chạy MongoDB Server (hoặc dùng Docker: `docker run -d -p 27017:27017 mongo`).

### Bước 2: Cài đặt & Chạy Server Backend
```bash
cd server
npm install
npm start
```
*Server chạy tại: `http://localhost:5000`*

### Bước 3: Cài đặt & Chạy Client Web Frontend
```bash
cd client
npm install
npm run dev
```
*Trang web chạy tại: `http://localhost:5173`*

### Bước 4: Chạy thử kịch bản Integration Test
Để kiểm tra xem mọi API có hoạt động đúng logic nghiệp vụ hay không:
```bash
cd server
node scenario_test.js
```
*Kịch bản này tự động dọn dẹp DB, tạo dữ liệu giả lập và chạy hết quy trình từ đăng ký đến xếp hạng để đảm bảo hệ thống không bị lỗi.*

### Bước 5: Sử dụng GitNexus để phân tích mã nguồn
Dự án đã được tích hợp GitNexus để tạo chỉ mục code:
- **Kiểm tra độ ảnh hưởng trước khi sửa hàm**: Chạy `npx gitnexus impact -r seal-management-system <ten_ham>` để biết hàm đó được gọi ở đâu và tránh làm hỏng các luồng khác.
- **Kiểm tra trước khi commit**: Chạy `npx gitnexus detect-changes -s all -r seal-management-system` để ánh xạ các file đã sửa với sơ đồ hệ thống.
