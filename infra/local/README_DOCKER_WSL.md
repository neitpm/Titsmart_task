# HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG MICROSERVICES (DOCKER QUA WSL)

Tài liệu này hướng dẫn các thao tác khởi chạy, kiểm tra healthcheck và debug toàn bộ 10 microservices và database local bằng Docker trên môi trường WSL.

---

## 1. YÊU CẦU TIỀN ĐỀ
- Windows 10/11 có cài đặt WSL 2.
- Docker Desktop đã bật tính năng **Use the WSL 2 based engine** và kích hoạt tích hợp với bản phân phối WSL hiện hành (Ubuntu).

---

## 2. CÁC LỆNH KHỞI CHẠY BẰNG WSL

Mở PowerShell hoặc terminal WSL:

```bash
# 1. Truy cập thư mục dự án
cd "d:\HỆ THỐNG QUẢN LÝ CÔNG VIỆC-web-app-titsmart"

# Hoặc trong WSL:
# cd /mnt/d/HỆ\ THỐNG\ QUẢN\ LÝ\ CÔNG\ VIỆC-web-app-titsmart

# 2. Khởi chạy toàn bộ 10 Microservices và Database local ở chế độ ngầm
wsl bash -c "cd '/mnt/d/HỆ THỐNG QUẢN LÝ CÔNG VIỆC-web-app-titsmart' && docker compose -f docker-compose.local.yml up -d"

# 3. Kiểm tra trạng thái tất cả containers và healthcheck
wsl docker compose -f docker-compose.local.yml ps

# 4. Xem log tập trung hoặc log của từng service
wsl docker compose -f docker-compose.local.yml logs -f api-gateway
wsl docker compose -f docker-compose.local.yml logs -f auth-service

# 5. Dừng hệ thống khi không sử dụng (dữ liệu vẫn được giữ trong volume workcore_local_pgdata)
wsl docker compose -f docker-compose.local.yml down
```

---

## 3. DANH SÁCH CỔNG VÀ ENDPOINT KIỂM TRA HEALTHCHECK

Sau khi các service khởi chạy, bạn có thể gọi curl hoặc mở trình duyệt để kiểm tra:

| Service | Port | Endpoint Healthcheck | Lệnh kiểm tra nhanh |
| :--- | :--- | :--- | :--- |
| **API Gateway** | 9000 | `http://localhost:9000/health` | `curl http://localhost:9000/health` |
| **Auth Service** | 9001 | `http://localhost:9001/health` | `curl http://localhost:9001/health` |
| **Tenant Service** | 9002 | `http://localhost:9002/health` | `curl http://localhost:9002/health` |
| **Entitlement Service** | 9003 | `http://localhost:9003/health` | `curl http://localhost:9003/health` |
| **Project Service** | 9004 | `http://localhost:9004/health` | `curl http://localhost:9004/health` |
| **Task Service** | 9005 | `http://localhost:9005/health` | `curl http://localhost:9005/health` |
| **Finance Service** | 9006 | `http://localhost:9006/health` | `curl http://localhost:9006/health` |
| **HR Service** | 9007 | `http://localhost:9007/health` | `curl http://localhost:9007/health` |
| **Document Service** | 9008 | `http://localhost:9008/health` | `curl http://localhost:9008/health` |
| **Notification Service** | 9009 | `http://localhost:9009/health` | `curl http://localhost:9009/health` |
| **PostgreSQL Database** | 54322 | Cổng PostgreSQL | `psql -h localhost -p 54322 -U postgres -d postgres` |

---

## 4. QUY TRÌNH THỬ NGHIỆM ĐỊNH TUYẾN QUA GATEWAY
Thử gửi request từ Gateway đến các downstream service có kèm Tenant Header:

```bash
# Định tuyến đến Project Service kèm định danh Tenant
curl -H "x-company-id: 00000000-0000-0000-0000-000000000001" http://localhost:9000/api/v1/projects

# Định tuyến đến Task Service
curl -H "x-company-id: 00000000-0000-0000-0000-000000000001" http://localhost:9000/api/v1/tasks
```
