# SYSTEM-LEVEL HARNESS - HƯỚNG DẪN TÁI SỬ DỤNG

Tài liệu này hướng dẫn cách lập trình viên và các AI Agent sử dụng hoặc nhân bản bộ khung **System-Level Harness** (ở thư mục `server/harness/`) sang bất kỳ dự án AI Agent tự trị nào khác.

---

## 1. Triết lý Vận hành
Bộ khung Harness này được thiết kế tách biệt hoàn toàn **AI Model** (Gemini/Claude) ra khỏi **Hạ tầng Ứng dụng** (Express/React). Bất kỳ Agent nào cắm vào hệ thống đều tuân thủ nguyên tắc:
* Không trực tiếp gọi API ngoài $\rightarrow$ Gọi thông qua **Execution Tools** (`gateway/toolRegistry.js`).
* Không tự viết logic xử lý lỗi $\rightarrow$ Chạy qua **Feedback Loop** (`feedback/resilienceEngine.js`) để tự sửa lỗi JSON và retry.
* Không tự lưu dữ liệu hay tự nhớ $\rightarrow$ Nạp và ghi trạng thái qua **Memory & Context Store** (`memory/contextStore.js`).

---

## 2. Bản đồ 6 Lớp Harness Toàn Cục

1. **boundaries/promptsManager.js** (Ràng buộc & Ranh giới): Quản lý tập trung các tệp prompt và khống chế token size đầu vào (<50,000 ký tự).
2. **gateway/toolRegistry.js** (Công cụ thực thi): Đăng ký các hàm JavaScript dưới dạng API Schema để AI tự chọn gọi khi cần thiết.
3. **guardrails/** (Xác minh & Guardrails):
   * `securityGuard.js`: Lọc Prompt Injection và làm sạch dữ liệu nhạy cảm (API keys).
   * `schemaValidator.js`: Kiểm tra tính hợp lệ của JSON kết quả đầu ra.
4. **memory/contextStore.js** (Quản lý trạng thái): Nạp ngữ cảnh cũ và duy trì trạng thái phiên làm việc của Agent.
5. **feedback/resilienceEngine.js** (Vòng lặp phản hồi): Tự sửa lỗi JSON và retry với exponential backoff.
6. **telemetry/hitlManager.js** (Phê duyệt con người): Checkpoint phê duyệt HITL và lưu log đo lường token/độ trễ.

---

## 3. Cách Tái sử dụng cho Dự án Mới

Nếu bạn muốn tạo một AI Agent mới (ví dụ: Chatbot tư vấn, Agent sinh mã nguồn, v.v.), hãy làm theo 4 bước sau:

### Bước 1: Khai báo Ràng buộc (Lớp 1)
Thêm template prompt mới vào `server/harness/boundaries/promptsManager.js`:
```javascript
promptsRegistry.my_new_agent = (topic) => `
  You are an AI assistant specialized in ${topic}.
  Return response in JSON: { "reply": "fluent Vietnamese" }
`;
```

### Bước 2: Đăng ký Công cụ (Lớp 2)
Nếu Agent cần gửi email hoặc truy cập Database, hãy đăng ký Tool trong `server/harness/gateway/toolRegistry.js`:
```javascript
const emailService = require('../../services/email');

registerTool(
  'sendSystemEmail',
  'Gửi email thông báo cho người dùng.',
  async (args) => await emailService.send(args.to, args.subject, args.body),
  {
    type: 'object',
    properties: {
      to: { type: 'string' },
      subject: { type: 'string' },
      body: { type: 'string' }
    },
    required: ['to', 'subject', 'body']
  }
);
```

### Bước 3: Gọi Model qua Khung Resilience & Guardrail (Lớp 3, 5)
Trong Service của Agent mới, kế thừa trực tiếp các tính năng tự sửa lỗi và validate JSON của Harness:
```javascript
const promptsManager = require('../harness/boundaries/promptsManager');
const schemaValidator = require('../harness/guardrails/schemaValidator');
const resilienceEngine = require('../harness/feedback/resilienceEngine');

async function runNewAgent(topic) {
  const prompt = promptsManager.promptsRegistry.my_new_agent(topic);
  
  // Vòng lặp phản hồi tự sửa lỗi & gọi lại tự động
  const result = await resilienceEngine.executeWithRetry(async () => {
    const rawOutput = await callGeminiAPI(prompt);
    
    // Tự động sửa lỗi JSON
    const fixedJson = resilienceEngine.autoFixJsonString(rawOutput);
    
    // Xác minh schema đầu ra
    schemaValidator.validateSchema(fixedJson, ['reply']);
    return fixedJson;
  }, 'MyNewAgent');
  
  return result;
}
```

### Bước 4: Tích hợp Checkpoint Phê duyệt (Lớp 6)
Nếu Agent thực hiện hành động nhạy cảm, hãy chặn lại và chuyển sang trạng thái chờ duyệt trước khi thực thi:
```javascript
const hitlManager = require('../harness/telemetry/hitlManager');

if (hitlManager.requiresHumanApproval(result)) {
  await hitlManager.markForHumanApproval(analysisId);
  // Dừng lại và chờ tín hiệu 'approved' từ hitlManager.approveReview()
}
```

---

## 4. Công cụ Quản trị CLI (`harness.js`)
Sử dụng file `harness.js` ở thư mục gốc để quản lý phát triển:
* Liệt kê các Tool đã đăng ký: `node harness.js tools:list`
* Kiểm tra hiệu năng AI: `node harness.js telemetry:status`
* Chạy mock sync: `node harness.js test:sync`
