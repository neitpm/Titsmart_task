# QUYỀN SỞ HỮU DỮ LIỆU (DATA OWNERSHIP MATRIX)

Tài liệu này xác định nguyên tắc sở hữu dữ liệu duy nhất (Single Data Ownership) cho từng bảng trong cơ sở dữ liệu PostgreSQL của WorkCore.

---

## 1. NGUYÊN TẮC BẮT BUỘC
1. **Một bảng - Một Chủ sở hữu (Single Owner)**:
   - Mỗi bảng dữ liệu chỉ được sở hữu và ghi trực tiếp (`INSERT`, `UPDATE`, `DELETE`) bởi **duy nhất một microservice**.
   - Các service khác nếu muốn đọc dữ liệu phải gọi qua REST API của Service sở hữu hoặc tiêu thụ Domain Events do Service đó phát ra.
2. **Tenant Isolation bắt buộc**:
   - Tất cả các bảng dữ liệu nghiệp vụ (trừ bảng danh mục hệ thống toàn cục như `modules`) đều bắt buộc phải có trường `company_id uuid NOT NULL`.
   - Mọi câu truy vấn bắt buộc phải kèm theo điều kiện lọc: `WHERE company_id = :current_company_id`.
3. **Mô hình Database Phase 1 & 2**:
   - Sử dụng **Shared Database Local** trên Docker WSL nhưng tách bạch ranh giới sở hữu logic để đảm bảo quá trình di chuyển không bị đứt gãy. Khi quy mô lớn hơn ở các giai đoạn sau, từng cụm bảng có thể được di chuyển sang database riêng (Database-per-Service) một cách liền mạch.

---

## 2. MA TRẬN PHÂN CHIA SỞ HỮU BẢNG

| Microservice | Bảng dữ liệu sở hữu | Quyền hạn | Mục đích sử dụng | Bắt buộc `company_id` |
| :--- | :--- | :--- | :--- | :--- |
| **tenant-service** | `companies` | Read/Write/Delete | Lưu trữ hồ sơ, trạng thái, gói cước, hạn mức của các công ty | Khóa chính `id` là ID công ty |
| | `company_branding` | Read/Write | Cấu hình thương hiệu, logo, slogan, hotline, địa chỉ | Có (`company_id`) |
| | `company_users` | Read/Write/Delete | Danh sách người dùng liên kết với từng công ty | Có (`company_id`) |
| | `company_settings` | Read/Write | Cài đặt nội bộ công ty | Có (`company_id`) |
| **entitlement-service** | `modules` | Read/Write (Admin) | Danh mục các module chức năng toàn hệ thống | Không (Bảng toàn cục) |
| | `company_modules` | Read/Write/Delete | Trạng thái kích hoạt và thời hạn module theo từng công ty | Có (`company_id`) |
| **auth-service** | `auth.users` (hoặc bảng identity nội bộ) | Read/Write | Tài khoản người dùng, email, mật khẩu mã hóa (hash), token | Liên kết qua `user_id` |
| **hr-service** | `engineers` | Read/Write/Delete | Hồ sơ kỹ sư, nhân sự, chức vụ, vai trò, số điện thoại | Có (`company_id`) |
| | `attendance_logs` | Read/Write | Nhật ký chấm công, định vị GPS, thời gian ra vào ca | Có (`company_id`) |
| **project-service** | `projects` | Read/Write/Delete | Thông tin dự án, mã công trình, chủ đầu tư, giá trị | Có (`company_id`) |
| | `project_members` | Read/Write/Delete | Thành viên phân bổ vào từng dự án cụ thể | Tham chiếu qua `project_id` |
| | `company_project_categories` | Read/Write/Delete | Danh mục phân loại loại hình dự án nội bộ | Có (`company_id`) |
| **task-service** | `tasks` | Read/Write/Delete | Bảng phân rã công việc WBS, giao việc, tiến độ, nghiệm thu | Có (`company_id`) |
| | `company_task_statuses` | Read/Write/Delete | Trạng thái công việc tùy biến theo quy trình công ty | Có (`company_id`) |
| | `field_logs` | Read/Write/Delete | Nhật ký công trường hàng ngày gắn liền với tiến độ | Có (`company_id`) |
| | `issues` | Read/Write/Delete | Các vướng mắc hiện trường phát sinh cần xử lý | Có (`company_id`) |
| **finance-service** | `expenses` | Read/Write/Delete | Chi phí dự án, đề xuất tạm ứng, yêu cầu cấp quỹ | Có (`company_id`) |
| | `company_expense_categories` | Read/Write/Delete | Danh mục các khoản mục chi phí nội bộ | Có (`company_id`) |
| | `material_plans` | Read/Write/Delete | Kế hoạch dự trù vật tư kèm định mức ngân sách | Có (`company_id`) |
| | `purchasing_plans` | Read/Write/Delete | Kế hoạch mua sắm vật tư theo ngân sách đã duyệt | Có (`company_id`) |
| | `labor_payrolls` | Read/Write/Delete | Bảng thanh toán lương/khoán nhân công công trường | Có (`company_id`) |
| **document-service** | `document_tracks` | Read/Write/Delete | Theo dõi hồ sơ nghiệm thu, bản vẽ, tài liệu pháp lý | Có (`company_id`) |
| | `materials` (tài liệu vật tư) | Read/Write/Delete | Hồ sơ chứng chỉ chất lượng xuất xưởng vật tư | Có (`company_id`) |
| **notification-service** | `notifications` | Read/Write/Delete | Thông báo chuông cho người dùng trong ứng dụng | Có (`company_id`) |
| | `activity_logs` | Insert/Read | Nhật ký thao tác và audit trail của hệ thống | Có (`company_id`) |

---

## 3. CƠ CHẾ ĐỌC VÀ TRUY VẤN DỮ LIỆU LIÊN SERVICE (CROSS-SERVICE QUERIES)
- **Tình huống 1: Task Service cần hiển thị tên Dự án**:
  - Không JOIN trực tiếp sang bảng `projects`.
  - Task Service lưu giữ `project_code` hoặc `project_name` dưới dạng snapshot (denormalized) hoặc gọi API `GET /projects/:id` của Project Service.
- **Tình huống 2: Finance Service cần kiểm tra người duyệt**:
  - Finance Service gọi API `GET /hr/engineers/:id` hoặc trích xuất thông tin người duyệt đã được Gateway đóng dấu vào Header `x-user-id` và `x-user-name`.
- **Tình huống 3: API Gateway kiểm tra quyền truy cập module**:
  - Khi Client gửi request tới `/api/v1/projects/*`, Gateway gọi hàm kiểm tra nhanh với Entitlement Service:
    `hasCompanyModule(company_id, 'PROJECT_MANAGEMENT')`.
