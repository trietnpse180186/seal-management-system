Google Drive Service Account key (KHÔNG commit file JSON lên Git)

1. Google Cloud Console → IAM → Service Accounts
   → drive-upload@dotted-byway-462607-q9.iam.gserviceaccount.com
   → Keys → Add key → JSON → Download

2. Đổi tên file tải về thành:
   google-drive-sa.json

3. Copy vào đúng thư mục này:
   server/secrets/google-drive-sa.json

4. Trong Google Drive: share folder đề cho email service account (quyền Editor).
   Folder phải ở chế độ Restricted (không public link).

5. server/.env:
   GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH=./secrets/google-drive-sa.json

6. Restart server → log phải có:
   [DRIVE] API ready — service account: drive-upload@...

Mỗi dev/BTC cần có file JSON riêng trên máy local (không push lên Git).
