# Hướng dẫn Setup chi tiết — AI Hackathon Auditor

> Tài liệu này hướng dẫn từng bước để triển khai hệ thống từ đầu trên một n8n instance mới.  
> Đọc cùng với `AI-Hackathon-Workflow-Handover.md` để hiểu kiến trúc tổng thể.

---

## Yêu cầu trước khi bắt đầu

| Thành phần | Yêu cầu tối thiểu |
|------------|-------------------|
| n8n | Self-hosted hoặc n8n Cloud, version ≥ 1.30 |
| GitHub | Tài khoản có quyền đọc các repo `SEAL-HACKATHON-SPRING2026/*` |
| Google Cloud | Project có bật Vertex AI API và Firebase Realtime Database |
| Supabase | Project với quyền tạo bảng và RLS có thể cấu hình |

---

## Bước 1 — Chuẩn bị Supabase

### 1.1 Tạo project Supabase
1. Vào [supabase.com](https://supabase.com) → New Project
2. Chọn region gần nhất (Singapore hoặc Tokyo nếu ở VN)
3. Lưu lại: **Project URL** và **Service Role Key** (Settings → API)

### 1.2 Tạo bảng `team_commits`
Vào **SQL Editor** trong Supabase và chạy:

```sql
CREATE TABLE IF NOT EXISTS team_commits (
  id              BIGSERIAL PRIMARY KEY,
  team_id         TEXT NOT NULL,
  commit_sha      TEXT NOT NULL,
  repo_name       TEXT,
  author          TEXT,
  commit_message  TEXT,
  committed_at    TIMESTAMPTZ,
  source          TEXT DEFAULT 'webhook',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_team_commits UNIQUE (team_id, commit_sha)
);

CREATE INDEX IF NOT EXISTS idx_tc_team_id ON team_commits(team_id);
CREATE INDEX IF NOT EXISTS idx_tc_committed_at ON team_commits(committed_at DESC);
```

### 1.3 Tạo bảng `ai_reviews`
```sql
CREATE TABLE IF NOT EXISTS ai_reviews (
  id                  BIGSERIAL PRIMARY KEY,
  team_id             TEXT NOT NULL,
  repo_name           TEXT,
  commit_sha          TEXT NOT NULL,
  review_kind         TEXT NOT NULL,    -- 'per_push' | 'team_aggregate'
  status              TEXT,             -- 'llm_started' | 'done' | 'error'
  push_summary        TEXT,
  rag_level           TEXT,             -- 'Basic' | 'Advanced' | 'Agentic-RAG'
  structured_output   JSONB,
  input_code_length   INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_ai_reviews UNIQUE (team_id, commit_sha, review_kind)
);

CREATE INDEX IF NOT EXISTS idx_ar_team_id ON ai_reviews(team_id);
CREATE INDEX IF NOT EXISTS idx_ar_review_kind ON ai_reviews(review_kind);
CREATE INDEX IF NOT EXISTS idx_ar_status ON ai_reviews(status);
CREATE INDEX IF NOT EXISTS idx_ar_updated_at ON ai_reviews(updated_at DESC);
```

### 1.4 Kiểm tra
```sql
SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name::regclass)) AS size
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('team_commits', 'ai_reviews');
```
Kết quả mong đợi: cả 2 bảng xuất hiện.

### 1.5 Row Level Security (RLS)
Nếu Supabase bật RLS mặc định, n8n dùng **Service Role Key** sẽ bypass RLS — không cần tắt. Tuy nhiên nếu dùng **Anon Key**, phải thêm policy:
```sql
-- Cho phép insert/update/select mọi row (chỉ dùng với service role trong backend)
ALTER TABLE team_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_service ON team_commits USING (true) WITH CHECK (true);
CREATE POLICY allow_all_service ON ai_reviews USING (true) WITH CHECK (true);
```

---

## Bước 2 — Chuẩn bị Google Cloud

### 2.1 Firebase Realtime Database
1. Vào [Firebase Console](https://console.firebase.google.com)
2. Tạo project hoặc dùng project có sẵn
3. Vào **Realtime Database** → Create database
4. Chọn **Asia-Southeast1** (Singapore)
5. Ghi nhớ **Database URL** có dạng: `https://YOUR-PROJECT-rtdb.asia-southeast1.firebasedatabase.app`
6. **Rules:** Đặt rules bảo mật (không để public write):
```json
{
  "rules": {
    "commit": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### 2.2 Tạo Service Account cho Firebase
1. Vào Google Cloud Console → IAM & Admin → Service Accounts
2. Tạo Service Account mới, đặt tên ví dụ: `n8n-firebase-writer`
3. Cấp role: **Firebase Admin** hoặc tối thiểu **Firebase Realtime Database Admin**
4. Tạo Key → JSON → Download file `.json`
5. Lưu file an toàn (sẽ dùng ở Bước 4)

### 2.3 Bật Vertex AI
1. Vào Google Cloud Console → APIs & Services → Enable APIs
2. Tìm và bật: **Vertex AI API**
3. Kiểm tra project đã bật model Gemini: Vertex AI → Model Garden → Gemini
4. Tạo Service Account mới, đặt tên: `n8n-vertex-caller`
5. Cấp role: **Vertex AI User** (`roles/aiplatform.user`)
6. Tạo Key → JSON → Download file `.json`

> **Lưu ý:** Vertex AI và Firebase có thể dùng chung 1 Service Account nếu muốn, nhưng tách riêng an toàn hơn.

---

## Bước 3 — Chuẩn bị GitHub

### 3.1 Tạo Personal Access Token để đọc commit
1. GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
2. Chọn tổ chức `SEAL-HACKATHON-SPRING2026` làm Resource Owner
3. Repository access: All repositories
4. Permissions → Repository permissions → Contents: **Read-only**
5. Generate token → Copy token (chỉ hiển thị 1 lần)

### 3.2 Tạo token để tạo GitHub Issue (có thể dùng chung token trên)
Cần thêm permission:
- Issues: **Read and Write**

Nếu dùng Classic Token (cũ hơn): chọn scope `repo`.

---

## Bước 4 — Tạo Credential trong n8n

Vào **n8n → Settings → Credentials → + Add Credential**

### 4.1 GitHub Bearer Token (đọc commit)
- Loại: **HTTP Bearer Auth** (không phải GitHub Auth)
- Token: Paste GitHub token từ Bước 3.1
- Đặt tên: `GitHub Bearer - SEAL Hackathon`

### 4.2 GitHub API (tạo issue)
- Loại: **GitHub API**
- Access Token: GitHub token từ Bước 3.2
- Đặt tên: `GitHub - HKT Account`

### 4.3 Google Service Account (Firebase)
- Loại: **Google Service Account**  
  _(Nếu không thấy, tìm "Google API" hoặc "Service Account JSON")_
- Upload file `.json` Service Account Firebase từ Bước 2.2
- Đặt tên: `Google SA - Firebase`

### 4.4 Google Service Account (Vertex AI)
- Loại: **Google Service Account** (cùng loại với Firebase)
- Upload file `.json` Service Account Vertex từ Bước 2.3
- Đặt tên: `Google SA - Vertex AI`

### 4.5 Supabase
- Loại: **Supabase**
- Host: URL project Supabase (ví dụ: `https://abcxyz.supabase.co`)
- Service Role Secret: Service Role Key từ Bước 1.1
- Đặt tên: `Supabase - Hackathon`

---

## Bước 5 — Import Workflow vào n8n

### 5.1 Thứ tự import (quan trọng)
Import **theo thứ tự từ trong ra ngoài** — workflow phụ trước, workflow cha sau:

```
1. Import: 3.LLM_Hackathon.json    → ghi lại Workflow ID mới
2. Import: 2.Process_Single_Repo.json → ghi lại Workflow ID mới
3. Import: 1.cron-job.json
```

Vào n8n → Workflows → **Import from file** → chọn file JSON.

### 5.2 Ghi lại Workflow ID sau khi import
Sau khi import mỗi workflow, vào URL của workflow đó:
```
https://your-n8n.com/workflow/WORKFLOW_ID_HERE
```
Ghi lại ID này.

| Workflow | ID sau import |
|----------|--------------|
| LLM - Hackathon | _________________ |
| Process Single Repo | _________________ |
| cron-job | _________________ |

---

## Bước 6 — Map lại Credential và Workflow ID

### 6.1 Workflow: LLM - Hackathon

Mở workflow, lần lượt click từng node và chọn lại credential:

| Node | Credential cần chọn |
|------|---------------------|
| Google Vertex Chat Model | `Google SA - Vertex AI` |
| Create Team Commit Row | `Supabase - Hackathon` |
| Update Team Commit Row | `Supabase - Hackathon` |
| Build Supabase Started Payload → Create... | `Supabase - Hackathon` |
| Create Supabase Review | `Supabase - Hackathon` |
| Update Supabase Error | `Supabase - Hackathon` |
| Update AI Review On Duplicate | `Supabase - Hackathon` |
| Get All Team Commits Agg | `Supabase - Hackathon` |
| Get Prior Push Reviews Agg | `Supabase - Hackathon` |
| Create Supabase Aggregate Review | `Supabase - Hackathon` |
| Update Supabase Aggregate Error | `Supabase - Hackathon` |
| Create an issue | `GitHub - HKT Account` |

### 6.2 Workflow: Process Single Repo

| Node | Credential cần chọn |
|------|---------------------|
| Get repo commit | `GitHub Bearer - SEAL Hackathon` |
| Get commit details | `GitHub Bearer - SEAL Hackathon` |
| INSERT Firebase | `Google SA - Firebase` |

Ngoài ra, cập nhật **Firebase URL** trong node `INSERT Firebase`:
```
https://YOUR-PROJECT-rtdb.asia-southeast1.firebasedatabase.app/commit/{{ $json.firebaseData.commit_sha }}.json
```

Và cập nhật **Vertex AI Project ID** trong node `Google Vertex Chat Model` của Workflow 3:
- Mở node → Project ID → nhập đúng GCP project ID của bạn

### 6.3 Workflow: cron-job

Node **"Call 'Process Single Repo copy'"**:
1. Click vào node
2. Trường "Workflow" → chọn lại "Process Single Repo" (ID đã ghi ở Bước 5.2)

### 6.4 Workflow: Process Single Repo

Node **"Call 'LLM - Hackathon'"**:
1. Click vào node
2. Trường "Workflow" → chọn lại "LLM - Hackathon" (ID đã ghi ở Bước 5.2)

---

## Bước 7 — Sửa node "Create an issue" (tùy chọn)

Node này hiện có lỗi tham chiếu node cũ. Có 2 lựa chọn:

### Lựa chọn A: Vô hiệu hóa (nhanh, an toàn)
- Click vào node "Create an issue"
- Toggle **Disabled** → ON
- Lưu workflow

### Lựa chọn B: Sửa expression
Click node "Create an issue", sửa các field sau:

**Owner field** — sửa từ:
```
={{ $('Webhook').item.json.body.repository.owner.login }}
```
thành:
```
=SEAL-HACKATHON-SPRING2026
```
_(hardcode vì owner luôn là tổ chức này)_

**Repository field** — sửa từ:
```
={{ $('Webhook').item.json.body.repository.name }}
```
thành:
```
={{ $('Build Supabase Payload').item.json.team_id }}
```

**Title field** — sửa:
```
={{ $('Get Commit Info').item.json.team_id }}
```
thành:
```
={{ $('Build Supabase Payload').item.json.team_id }}
```

**Trong Body** — tìm và sửa tất cả `$('git diff summation')` thành `$('Build Supabase Started Payload')` và xóa các expression tham chiếu Webhook/Get Commit Info.

---

## Bước 8 — Cập nhật danh sách repo (nếu cần)

Mở workflow **cron-job** → node **`repo list`** → Edit Code.

Danh sách repo hiện tại (25 repo):
```javascript
const repos = [
  "SEAL-HACKATHON-SPRING2026/NEWBIEs",
  "SEAL-HACKATHON-SPRING2026/VAIK",
  // ... 23 repo khác
];
```

Thêm/xóa repo theo danh sách thực tế của hackathon.

---

## Bước 9 — Test trước khi bật cron

### 9.1 Test Workflow 3 (LLM - Hackathon) độc lập
1. Mở workflow "LLM - Hackathon"
2. Click "Test Workflow" với mock input:
```json
{
  "repo_name": "SEAL-HACKATHON-SPRING2026/NEWBIEs",
  "team_id": "NEWBIEs",
  "commit_sha": "test-sha-001",
  "commit_count": 1,
  "activity_log": "Commit 1 (test001): [Test commit] | Files: test.py",
  "code_changes_detail": "--- a/test.py\n+++ b/test.py\n@@ -0,0 +1,5 @@\n+print('hello RAG')",
  "cron_batch_review": false,
  "batched_commit_shas": ["test-sha-001"],
  "timestamp": "2026-05-21T10:00:00.000Z"
}
```
3. Kiểm tra Supabase: `SELECT * FROM ai_reviews WHERE commit_sha = 'test-sha-001'`

### 9.2 Test toàn bộ pipeline với 1 repo
1. Mở workflow "cron-job"
2. Tạm thời sửa node `repo list` để chỉ trả về 1 repo:
```javascript
return [{ json: { owner: "SEAL-HACKATHON-SPRING2026", repo: "NEWBIEs" } }];
```
3. Click "Test Workflow"
4. Theo dõi execution và kiểm tra:
   - Firebase Console → Realtime Database → `/commit/` có data không?
   - Supabase `team_commits` có row không?
   - Supabase `ai_reviews` có `status='done'` không?
5. Khôi phục node `repo list` về danh sách 25 repo đầy đủ

---

## Bước 10 — Bật hệ thống chạy tự động

### 10.1 Bật Schedule Trigger
1. Mở workflow **cron-job**
2. Click node "Schedule Trigger"
3. Toggle **Disabled** → OFF (bật lên)
4. Lưu workflow

### 10.2 Kích hoạt tất cả workflow
Đảm bảo 3 workflow đều ở trạng thái **Active** (toggle ở góc trên phải):
- `cron-job` → Active
- `Process Single Repo` → Active
- `LLM - Hackathon` → Active

### 10.3 Xác nhận cron đang chạy
Sau 1 giờ, vào n8n → **Executions** → lọc theo workflow "cron-job" → xem log execution mới nhất.

---

## Bước 11 — Giám sát hàng ngày

### Query kiểm tra sức khỏe hệ thống

```sql
-- Tổng quan: mỗi team có bao nhiêu commit và review
SELECT 
  tc.team_id,
  COUNT(DISTINCT tc.commit_sha) AS total_commits,
  COUNT(CASE WHEN ar.review_kind = 'per_push' AND ar.status = 'done' THEN 1 END) AS per_push_ok,
  COUNT(CASE WHEN ar.review_kind = 'per_push' AND ar.status = 'error' THEN 1 END) AS per_push_err,
  COUNT(CASE WHEN ar.review_kind = 'team_aggregate' AND ar.status = 'done' THEN 1 END) AS aggregate_ok,
  MAX(tc.committed_at) AS last_commit_at
FROM team_commits tc
LEFT JOIN ai_reviews ar ON tc.team_id = ar.team_id
GROUP BY tc.team_id
ORDER BY last_commit_at DESC NULLS LAST;

-- Xem lỗi gần nhất
SELECT team_id, commit_sha, review_kind, 
       structured_output->>'error' AS error_msg, 
       updated_at
FROM ai_reviews
WHERE status = 'error'
ORDER BY updated_at DESC
LIMIT 20;

-- RAG level phân bố các team
SELECT rag_level, COUNT(DISTINCT team_id) AS team_count
FROM ai_reviews
WHERE review_kind = 'team_aggregate' AND status = 'done'
GROUP BY rag_level;
```

### Checklist kiểm tra hàng ngày
- [ ] n8n Executions: không có execution nào fail liên tiếp
- [ ] `ai_reviews` WHERE `status='error'`: số lỗi không tăng bất thường
- [ ] Firebase: data mới vào đều theo mỗi giờ
- [ ] Vertex AI quota: theo dõi trên GCP Console → Vertex AI → Quotas

---

## Bước 12 — Xử lý sự cố thường gặp

### Lỗi: "Workflow not found" khi Execute Workflow
**Nguyên nhân:** Workflow ID trong node Execute Workflow không khớp sau khi import.  
**Sửa:** Mở node → chọn lại workflow đúng từ dropdown.

### Lỗi: "Credential not found"
**Nguyên nhân:** Credential ID trong JSON không tồn tại trên instance mới.  
**Sửa:** Vào từng node báo lỗi → chọn lại credential đã tạo ở Bước 4.

### Lỗi: "403 Forbidden" khi gọi GitHub API
**Nguyên nhân:** GitHub token không có quyền đọc repo (private repo cần scope `repo`).  
**Sửa:** Tạo token mới với scope đúng.

### Lỗi: Firebase "Permission denied"
**Nguyên nhân:** Service Account không có quyền write vào Firebase.  
**Sửa:** Vào Firebase Console → Project Settings → Service Accounts → kiểm tra quyền, hoặc tạm thời đặt Firebase Rules mở để debug.

### Lỗi: Supabase INSERT duplicate
**Nguyên nhân:** Commit đã tồn tại trong DB (chạy test 2 lần, hoặc cron trùng).  
**Hành vi mong đợi:** Workflow tự động switch sang UPDATE (logic upsert có sẵn).  
**Nếu vẫn lỗi:** Kiểm tra UNIQUE constraint đã tạo đúng chưa.

### LLM trả về error / JSON không hợp lệ
**Nguyên nhân thường gặp:**
- Vertex AI quota bị vượt (429 Too Many Requests)
- Context window quá lớn (diff quá dài)
- Network timeout

**Sửa:**
- Kiểm tra GCP Console → Vertex AI → Quotas → xin tăng nếu cần
- Giảm `maxLen` trong node "Aggregate batch for LLM" (hiện là 50.000)
- Kiểm tra log lỗi chi tiết trong Supabase: `SELECT structured_output FROM ai_reviews WHERE status='error' LIMIT 5`

### Schedule Trigger không chạy tự động
**Kiểm tra:**
1. Node "Schedule Trigger" có đang bị disabled không?
2. Workflow "cron-job" có đang ở trạng thái Active không?
3. n8n process có đang chạy không? (nếu self-hosted)

---

## Ghi chú bảo mật khi chia sẻ file JSON

Các file workflow JSON của dự án này **không chứa token hay API key thực**. Tuy nhiên có một số thông tin cơ sở hạ tầng cần lưu ý nếu chia sẻ ra ngoài:

| Thông tin | Vị trí | Có cần xóa? |
|-----------|--------|-------------|
| Firebase URL | `2.Process_Single_Repo.json` dòng 123 | Cân nhắc nếu chia sẻ công khai |
| GCP Project ID | `3.LLM_Hackathon.json` dòng 34 | Cân nhắc nếu chia sẻ công khai |
| n8n Instance ID | `meta.instanceId` trong cả 3 file | Không nhạy cảm, có thể giữ |
| Credential ID (nội bộ n8n) | Các field `"id": "..."` trong `credentials` | Không có giá trị bên ngoài n8n instance |
