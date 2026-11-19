# He Thong Quan Ly Cong Viec Cong Trinh

Thu muc nay chua ho so khoi dong va cau truc source code de phat trien he thong quan ly tien do cong trinh, vat tu, vuong mac va bao cao hien truong.

## Thanh phan chinh

- `backend/`: API, xac thuc, phan quyen, nghiep vu va bao cao.
- `web-admin/`: giao dien web cho Admin/Manager/Procurement.
- `mobile-app/`: ung dung mobile cho quan ly va nhan vien hien truong.
- `database/`: migration, seed data, tai lieu mo hinh du lieu.
- `docs/`: yeu cau, workflow, API, UI wireframe.
- `import-excel/`: file Excel mau va mapping import du lieu.
- `storage/`: thu muc phuc vu luu file local trong moi truong dev.

File `bang theo doi tien do.xlsx` hien tai duoc xem la du lieu mau de phan tich/import ban dau. He thong that se cho tao du an dong, khong co dinh theo cac sheet trong file.

## Runbook Platform tách biệt

Chỉ chạy trong repo clone Platform này, không chạy trong Product. Dependencies: `cd D:\Titsmart_task-platform-admin; npm install; cd web-admin; npm install`.

Database Supabase local: `cd /mnt/d/Titsmart_task-platform-admin && supabase start && supabase status && supabase db reset`. Không dùng lệnh này trong thư mục Product. Có thể dùng Docker thay thế: `docker compose --env-file .env.docker -f docker-compose.local.yml up -d db`.

API Gateway: `docker compose --env-file .env.docker -f docker-compose.local.yml up -d api-gateway`; kiểm tra `http://127.0.0.1:9000/health`. Các service nội bộ: `docker compose --env-file .env.docker -f docker-compose.local.yml up -d auth-service tenant-service entitlement-service project-service task-service finance-service hr-service document-service notification-service`.

Web Admin: `cd D:\Titsmart_task-platform-admin\web-admin; npm run dev:local`; thường mở `http://localhost:5173`. Build: `npm run build`. Log: `docker compose -f docker-compose.local.yml logs -f api-gateway`.

Dừng riêng Platform: `docker compose -f docker-compose.local.yml down` hoặc `cd /mnt/d/Titsmart_task-platform-admin && supabase stop`.

Port Platform hiện khai báo: Supabase API/DB/Studio/Mailpit `54321/54322/54323/54324`, Gateway `9000`, service nội bộ `9001–9009`, Web Admin `5173`. Nếu Product đang dùng port nào, đổi port Platform trước khi chạy; không dừng Product. `.env.local` chỉ dùng key và database của Platform local, tuyệt đối không dùng `PRODUCT_SUPABASE_*`.

Trước commit: kiểm tra `git status --short --branch`, URL API, database URL và port. Lỗi React `#426` thường do `React.lazy` thiếu `React.Suspense`; bản clone đã thêm fallback loading trong `web-admin/src/App.tsx`, chưa triển khai Production.
