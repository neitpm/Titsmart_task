# KIẾN TRÚC MICROSERVICE WORKCORE MULTI-TENANT SAAS

## 1. TỔNG QUAN HỆ THỐNG
WorkCore là nền tảng quản trị công việc và điều hành sản xuất công trường dạng Multi-Tenant SaaS.
Để chuyển đổi an toàn từ kiến trúc Monolith sang Microservices mà không làm gián đoạn nghiệp vụ đang vận hành, hệ thống áp dụng chiến lược **Strangler Fig Pattern**:
- Giữ nguyên các chức năng cốt lõi đang hoạt động ổn định trên Client App.
- Tách dần từng năng lực nghiệp vụ thành các Microservice độc lập.
- Giai đoạn 1: Xây dựng khung kiến trúc (Architecture), phân định ranh giới (Service Boundaries), quyền sở hữu dữ liệu (Data Ownership), tạo các skeleton service, API Gateway và môi trường Docker/WSL local.

---

## 2. KIẾN TRÚC TỔNG THỂ (HIGH-LEVEL ARCHITECTURE)

```
                     +---------------------------------------+
                     |  Client App (Web-Admin, Mobile App)   |
                     +---------------------------------------+
                                         |
                                         | HTTPS / REST
                                         v
                     +---------------------------------------+
                     |         API Gateway (Port 9000)       |
                     |  - JWT Authentication Verification    |
                     |  - Tenant Header Injection            |
                     |  - Entitlement & Module Policy Check  |
                     |  - Rate Limiting & Routing            |
                     +---------------------------------------+
                                         |
         +-------------------------------+-------------------------------+
         |                               |                               |
         v                               v                               v
+------------------+           +--------------------+           +--------------------+
|   Auth Service   |           |   Tenant Service   |           | Entitlement Service|
|   (Port 9001)    |           |    (Port 9002)     |           |    (Port 9003)     |
+------------------+           +--------------------+           +--------------------+
         |                               |                               |
         +-------------------------------+-------------------------------+
                                         |
         +-------------------------------+-------------------------------+
         |               |               |               |               |
         v               v               v               v               v
+----------------+ +------------+ +-------------+ +------------+ +-------------------+
| Project Service| |Task Service| |Finance Serv.| | HR Service | |Doc & Storage Serv.|
|  (Port 9004)   | |(Port 9005) | | (Port 9006) | |(Port 9007) | |    (Port 9008)    |
+----------------+ +------------+ +-------------+ +------------+ +-------------------+
         |               |               |               |               |
         +---------------+---------------+---------------+---------------+
                                         |
                                         v
                         +-------------------------------+
                         |   Notification Service        |
                         |   (Port 9009)                 |
                         +-------------------------------+
                                         |
                                         v
                 +-----------------------------------------------+
                 |        Event Bus / Message Broker             |
                 |  - company.created        - task.assigned     |
                 |  - user.created           - expense.approved  |
                 |  - module.enabled/expired - task.completed    |
                 +-----------------------------------------------+
                                         |
                                         v
                 +-----------------------------------------------+
                 |   Shared Database Local (PostgreSQL Docker)   |
                 |      Separate Schemas / Logical Ownership     |
                 +-----------------------------------------------+
```

---

## 3. DANH SÁCH 10 MICROSERVICES

| STT | Service Name | Port | Nhiệm vụ chính |
| :--- | :--- | :--- | :--- |
| 1 | **api-gateway** | 9000 | Reverse proxy, xác thực JWT, gán `x-company-id`, kiểm tra module quyền, rate limiting |
| 2 | **auth-service** | 9001 | Đăng nhập, cấp phát JWT/Refresh token, quản lý user, mã hóa mật khẩu, RBAC |
| 3 | **tenant-service** | 9002 | Quản lý công ty (tenants), Company Admin, hạn mức user, storage, cấu hình branding |
| 4 | **entitlement-service** | 9003 | Quản lý gói thuê bao (Trial/Standard/Pro/Enterprise), bật/tắt module theo tenant |
| 5 | **project-service** | 9004 | Quản lý dự án, danh mục loại dự án, thành viên dự án, tiến độ tổng thể |
| 6 | **task-service** | 9005 | Quản lý công việc, WBS, giao việc, nhận việc, nghiệm thu, thảo luận tiến độ |
| 7 | **finance-service** | 9006 | Dự toán, kế hoạch chi phí, cấp quỹ, thanh toán, quy trình duyệt quỹ 5 bước |
| 8 | **hr-service** | 9007 | Quản lý kỹ sư/nhân sự, hồ sơ, chấm công hiện trường, nghỉ phép nội bộ |
| 9 | **document-service** | 9008 | Quản lý hồ sơ pháp lý, tài liệu kỹ thuật, upload/download, kiểm soát dung lượng |
| 10 | **notification-service**| 9009 | Chuông thông báo trong app, webhook Telegram/Zalo, email thông báo |

---

## 4. CHIẾN LƯỢC DỮ LIỆU & BẢO VỆ MULTI-TENANT ISOLATION
1. **Mô hình Database trong Phase 1 & 2**:
   - Sử dụng **Shared PostgreSQL Database** chạy trên Docker WSL để tối ưu tài nguyên và dễ dàng di chuyển từ Monolith.
   - Mỗi service sở hữu danh sách bảng riêng biệt (Logical Data Isolation). Service A không được phép thực thi SQL trực tiếp vào bảng của Service B mà phải gọi qua API hoặc lắng nghe Event Bus.
2. **Nguyên tắc cô lập Tenant (Zero-Trust Tenant Isolation)**:
   - **Tất cả các bảng dữ liệu nghiệp vụ bắt buộc phải có cột `company_id`**.
   - API Gateway trích xuất `company_id` từ JWT token đã xác thực và gắn vào HTTP Header `x-company-id`.
   - Các downstream service bắt buộc đọc `company_id` từ context/header này và luôn áp dụng điều kiện `WHERE company_id = ?` trong tất cả các câu truy vấn. Không bao giờ tin tưởng `company_id` do client gửi tự do trong body.
3. **Phân quyền và Vai trò**:
   - Phân định rõ `platform_role` (`super_admin`, `user`) và `company_role` (`company_admin`, `director`, `chief_engineer`, `engineer`, `accountant`).
   - Tuyệt đối không cho phép tài khoản có tên `admin` bypass quyền nếu không có JWT và role hợp lệ.

---

## 5. CƠ CHẾ GIAO TIẾP VÀ EVENT BUS
1. **Giao tiếp đồng bộ (Synchronous)**: RESTful HTTP/JSON (hoặc gRPC cho internal inter-service call).
2. **Giao tiếp bất đồng bộ (Asynchronous Event-Driven)**:
   - Skeleton Event Bus xử lý các sự kiện nghiệp vụ liên miền (Domain Events):
     - `company.created`: Khi tenant mới được tạo -> khởi tạo branding mặc định & cấp module trial.
     - `user.created`: Khi user mới gia nhập -> gửi email kích hoạt và tạo mapping `company_users`.
     - `module.enabled` / `module.expired`: Cập nhật quyền truy cập module của tenant.
     - `task.assigned`: Giao việc -> đẩy thông báo tới `notification-service`.
     - `task.completed`: Báo cáo xong việc -> kích hoạt luồng nghiệm thu.
     - `expense.submitted`: Đơn cấp quỹ được tạo -> đẩy thông báo tới Chỉ huy trưởng/Giám đốc duyệt.
     - `expense.approved`: Duyệt chi -> kích hoạt tạo phiếu chi quỹ.

---

## 6. LỘ TRÌNH TRIỂN KHAI (ROADMAP)
- **Phase 1 (Hiện tại)**: Thiết kế tài liệu kiến trúc, phân chia boundaries, ownership, tạo bộ skeleton service hoàn chỉnh với endpoint `/health`, docker-compose local, cấu hình test chạy độc lập trên Docker WSL.
- **Phase 2**: Hoàn thiện logic nghiệp vụ thực tế cho API Gateway, Auth Service, Tenant Service, Entitlement Service.
- **Phase 3**: Chuyển giao logic Project Service và Task Service, định tuyến Client App qua API Gateway.
- **Phase 4**: Chuyển đổi Finance, HR, Document, Notification; hoàn thiện event bus và telemetry.
