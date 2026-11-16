# PHÂN ĐỊNH RANH GIỚI NGHIỆP VỤ (SERVICE BOUNDARIES)

Tài liệu này xác định các ranh giới Bounded Context (Domain-Driven Design) cho từng Microservice trong hệ thống WorkCore Multi-Tenant SaaS, ngăn ngừa phụ thuộc chéo và dependency vòng.

---

## 1. BẢNG MA TRẬN BOUNDED CONTEXT

```
+-------------------------------------------------------------------------------------------------+
|                                       API GATEWAY                                               |
|           [Authentication Middleware, Tenant Extraction, Module Enforcer, Routing]              |
+-------------------------------------------------------------------------------------------------+
          |                     |                      |                     |
          v                     v                      v                     v
+-------------------+ +-------------------+  +-------------------+ +-------------------+
|   AUTH CONTEXT    | |  TENANT CONTEXT   |  |ENTITLEMENT CONTEXT| |  PROJECT CONTEXT  |
| - Login / Refresh | | - Company Profile |  | - Package Plans   | | - Projects        |
| - User Identity   | | - Company Config  |  | - Company Modules | | - Project Members |
| - Password Hash   | | - Branding        |  | - Feature Flags   | | - Project Category|
+-------------------+ +-------------------+  +-------------------+ +-------------------+
          |                     |                      |                     |
          +---------------------+----------------------+---------------------+
                                |
         +----------------------+----------------------+---------------------+
         |                      |                      |                     |
         v                      v                      v                     v
+-------------------+ +-------------------+  +-------------------+ +-------------------+
|   TASK CONTEXT    | |  FINANCE CONTEXT  |  |    HR CONTEXT     | | DOCUMENT CONTEXT  |
| - Tasks / Subtasks| | - Project Expenses|  | - Staff Profiles  | | - Documents Track |
| - WBS Tree        | | - Fund Requests   |  | - Attendance Logs | | - Project Files   |
| - Task Approvals  | | - Approval Matrix |  | - Leave / Roles   | | - Storage Quota   |
+-------------------+ +-------------------+  +-------------------+ +-------------------+
                                                       |
                                                       v
                                             +-------------------+
                                             |NOTIF. CONTEXT     |
                                             | - In-App Notifs   |
                                             | - Webhook / Alerts|
                                             +-------------------+
```

---

## 2. CHI TIẾT TỪNG SERVICE BOUNDARY

### 2.1 API Gateway
- **Ranh giới**: Điểm tập trung lưu lượng truy cập từ ngoài vào (Single Entry Point).
- **Trách nhiệm**:
  - Chấm dứt kết nối SSL/TLS từ client.
  - Kiểm tra và giải mã JSON Web Token (JWT) từ header `Authorization: Bearer <token>`.
  - Trích xuất thông tin định danh: `user_id`, `company_id`, `company_role`, `platform_role`.
  - Kiểm tra xem công ty có kích hoạt module tương ứng với route đang gọi hay không (thông qua Entitlement Service Cache).
  - Tiêm thông tin xác thực vào header chuyển tiếp:
    - `x-user-id`
    - `x-company-id`
    - `x-company-role`
    - `x-platform-role`
  - Giới hạn tần suất gọi (Rate Limiting) và chống tấn công DoS theo IP/Tenant.
- **Điều cấm**: Không can thiệp xử lý logic nghiệp vụ chi tiết của các downstream service.

---

### 2.2 Auth & Identity Service
- **Ranh giới**: Quản trị tài khoản, định danh người dùng và phiên đăng nhập.
- **Trách nhiệm**:
  - Đăng nhập qua email/username và mật khẩu bảo mật (bcrypt hash).
  - Cấp phát Access Token (JWT ngắn hạn) và Refresh Token (dài hạn).
  - Quản trị mật khẩu, đổi mật khẩu, reset mật khẩu.
  - Cung cấp API xác thực token nội bộ cho API Gateway.
- **Điều cấm**: Không tự ý sửa đổi trạng thái công ty hoặc gói dịch vụ thuê bao.

---

### 2.3 Tenant Service
- **Ranh giới**: Vòng đời của công ty khách hàng (Tenant Lifecycle) và cấu hình nội bộ.
- **Trách nhiệm**:
  - Tạo, cập nhật, tạm ngưng hoặc mở khóa công ty (`companies`).
  - Quản lý thông tin liên hệ, hotline, địa chỉ, logo, slogan (`company_branding`).
  - Quản lý danh sách thành viên trực thuộc công ty (`company_users`).
  - Quản lý thiết lập nội bộ (`company_settings`).
- **Điều cấm**: Không xử lý giao dịch thanh toán hoặc logic tính toán chi phí công trường.

---

### 2.4 Entitlement Service
- **Ranh giới**: Quyền sử dụng tài nguyên và phân bổ gói tính năng phần mềm.
- **Trách nhiệm**:
  - Định nghĩa danh mục các gói thuê bao (Trial, Standard, Professional, Enterprise).
  - Quản lý danh sách module khả dụng (`modules`) và bảng kích hoạt theo công ty (`company_modules`).
  - Kiểm tra điều kiện hiệu lực theo ngày (`start_date`, `expiry_date`) và trạng thái kích hoạt.
  - Cung cấp API kiểm tra nhanh quyền module (`/entitlements/check?module=...`) cho API Gateway.
- **Điều cấm**: Không can thiệp vào phân quyền nghiệp vụ nội bộ (Permission matrix) bên trong từng công ty.

---

### 2.5 Project Service
- **Ranh giới**: Thông tin dự án, cấu trúc công trình và nhân sự dự án.
- **Trách nhiệm**:
  - Quản lý hồ sơ dự án (`projects`): mã dự án, tên, chủ đầu tư, địa điểm, giá trị hợp đồng, thời hạn.
  - Quản lý danh mục loại dự án nội bộ (`company_project_categories`).
  - Quản lý danh sách thành viên tham gia vào dự án (`project_members`).
  - Theo dõi tỷ lệ tiến độ tổng thể của dự án (tính toán dựa trên dữ liệu tóm tắt từ Task Service).
- **Điều cấm**: Không quản lý chi tiết công việc từng ngày hoặc mua sắm vật tư.

---

### 2.6 Task Service
- **Ranh giới**: Tiến độ công việc hiện trường, bảng phân rã WBS và quy trình nghiệm thu.
- **Trách nhiệm**:
  - Quản lý công việc (`tasks`): tên việc, khối lượng, đơn vị tính, người giao, người nhận việc.
  - Quản lý trạng thái công việc (`company_task_statuses`): Chưa làm, Đang làm, Hoàn thành, Trễ hạn, Nghiệm thu.
  - Giao việc, cập nhật tiến độ phần trăm, đính kèm ảnh bằng chứng hiện trường.
  - Quy trình gửi duyệt nghiệm thu công việc và phê duyệt/từ chối của Chỉ huy trưởng.
- **Điều cấm**: Không trực tiếp tạo hoặc duyệt phiếu chi tiền.

---

### 2.7 Finance Service
- **Ranh giới**: Tài chính dự án, dự toán chi phí và luồng phê duyệt cấp quỹ.
- **Trách nhiệm**:
  - Quản lý danh mục chi phí dự án (`company_expense_categories`).
  - Quản lý chi phí và yêu cầu cấp quỹ (`expenses`, `material_plans`, `purchasing_plans`).
  - Thực thi quy trình phê duyệt cấp quỹ nghiêm ngặt theo cấp bậc: Kỹ sư lập đề xuất -> Chỉ huy trưởng kiểm tra -> Kế toán soát xét -> Giám đốc duyệt -> Kế toán chi tiền.
- **Điều cấm**: Không quản lý bảng lương nhân sự toàn công ty.

---

### 2.8 HR Service
- **Ranh giới**: Hồ sơ kỹ sư, phân quyền cấp bậc và điểm danh chấm công.
- **Trách nhiệm**:
  - Quản lý hồ sơ nhân sự kỹ sư (`engineers`): chức danh, số điện thoại, CCCD, thông tin liên hệ khẩn cấp.
  - Quản lý ma trận phân quyền và cấp bậc nội bộ (`permissions`, `company_role`).
  - Quản lý dữ liệu chấm công hiện trường (`attendance_logs`).
- **Điều cấm**: Không cấp phát JWT token (thuộc về Auth Service).

---

### 2.9 Document & Storage Service
- **Ranh giới**: Hồ sơ pháp lý, biên bản nghiệm thu, bản vẽ và tệp đính kèm.
- **Trách nhiệm**:
  - Quản lý danh mục tài liệu theo dõi (`document_tracks`).
  - Quản lý metadata tệp đính kèm (URL, kích thước, định dạng, ngày tải lên).
  - Kiểm tra và thực thi hạn mức dung lượng lưu trữ (`max_storage_gb`) của từng công ty.
- **Điều cấm**: Không tự ý xóa dữ liệu dự án khi xóa file.

---

### 2.10 Notification Service
- **Ranh giới**: Kênh truyền thông, thông báo đẩy và kết nối tin nhắn ngoại vi.
- **Trách nhiệm**:
  - Lưu trữ và phân phối thông báo nội bộ ứng dụng (`notifications`).
  - Đánh dấu đã đọc, xóa thông báo.
  - Gửi thông báo tự động khi có sự kiện từ Event Bus: Giao việc mới, Đơn cấp quỹ chờ duyệt, Cảnh báo trễ hạn.
  - Tích hợp cổng gửi Webhook Telegram / Zalo ZNS khi được cấu hình.
- **Điều cấm**: Không lưu giữ bí mật API keys (Token Bot) ở phía Client App.
