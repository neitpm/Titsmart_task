# Kiến trúc Platform Admin

Tài liệu này chuyển sơ đồ nghiệp vụ Platform Super Admin thành phạm vi triển khai độc lập. Platform Admin quản lý công ty thuê bao và quyền truy cập; Product App chỉ nhận kết quả phân quyền qua API, không dùng chung database với Platform.

## Luồng tổng thể

```text
Platform Super Admin
        |
        v
Tạo công ty thuê bao
        |
        +--> Thông tin công ty / gói dịch vụ / module được cấp
        +--> Số lượng user / dung lượng / thời hạn thuê bao
        |
        v
Tạo tài khoản Company Admin
        |
        v
Company Admin đăng nhập
        |
        +--> Cấu hình công ty & thương hiệu
        +--> Thêm nhân sự
        +--> Tạo cấp bậc, role và quyền
        +--> Danh mục nội bộ
        +--> Quy trình duyệt cấp quỹ
        +--> Giao diện và thông báo
        |
        v
Người dùng cuối đăng nhập
        |
        v
Hệ thống kiểm tra công ty, tài khoản, module và quyền
        |
        v
Chỉ hiển thị chức năng đã được cấp phép
```

## Phạm vi Platform Super Admin

- Tạo, kích hoạt, khóa và quản lý công ty thuê bao.
- Cấu hình thông tin công ty, gói dịch vụ, module, số lượng user, dung lượng và thời hạn.
- Tạo tài khoản Company Admin thuộc đúng công ty.
- Theo dõi trạng thái công ty và tài khoản.

## Phạm vi Company Admin

- Cấu hình tên, slogan, logo và thông tin liên hệ.
- Thêm, sửa, khóa và cấp tài khoản cho nhân sự của công ty.
- Tạo cấp bậc/chức danh, role và quyền chi tiết.
- Cấu hình danh mục dự án và chi phí nội bộ.
- Cấu hình luồng duyệt cấp quỹ.
- Cấu hình giao diện và thông báo.
- Xem nhật ký hoạt động trong phạm vi công ty.

## Kiểm tra khi người dùng đăng nhập

API phải kiểm tra theo thứ tự:

1. Tài khoản có tồn tại và đang hoạt động không.
2. Tài khoản thuộc công ty nào.
3. Công ty còn hoạt động và còn hạn thuê bao không.
4. Module tương ứng có được cấp cho công ty không.
5. Role của người dùng có quyền thao tác nào.

Kết quả kiểm tra được dùng để tạo session và điều hướng người dùng tới đúng màn hình. Không dựa vào dữ liệu frontend để cấp quyền.

## Ranh giới dữ liệu

| Vùng | Dữ liệu sở hữu | Được phép truy cập |
|---|---|---|
| Platform DB | Công ty, subscription, module, Company Admin, role, audit log | Platform API và Company Admin API |
| Product DB | Dự án, công việc, vật tư, nghiệp vụ đang vận hành | Product App |
| Platform API | Provisioning, entitlement, company settings, people, roles | Frontend Platform/Company |
| Product API | Nghiệp vụ Product | Người dùng Product |

Platform không được chạy migration hoặc ghi trực tiếp vào Product DB. Nếu cần đồng bộ, phải dùng API hoặc một integration contract được duyệt.

## Các module triển khai

1. Công ty & thương hiệu.
2. Nhân sự và tài khoản.
3. Phân quyền & cấp bậc.
4. Danh mục nội bộ.
5. Quy trình duyệt cấp quỹ.
6. Giao diện & điều hướng.
7. Thông báo & nhật ký hoạt động.

Mỗi module đi theo chu trình: migration Platform DB riêng → service → API → guard quyền → UI → test.

## Điều kiện tích hợp

- Platform và Product dùng repository, database, environment và port độc lập.
- Chỉ tích hợp qua API contract; không import trực tiếp bảng hoặc secret của Product.
- Pull request phải chỉ rõ file nào thuộc Platform và endpoint nào được gọi.
- Trước khi tích hợp phải kiểm tra build, migration trên DB Platform local và test phân quyền.
