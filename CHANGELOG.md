# Changelog

## v3.9.16 (2026-11-27)

- Quản lý kho, vật tư & tài sản liên kết nhân sự và dự án:
  - Nâng cấp modal Xuất kho: cho phép chọn nhân viên tiếp nhận chịu trách nhiệm từ danh sách công ty.
  - Phân loại tài sản/thiết bị cấp phát (thuộc quyền sở hữu công ty, tạm giao nhân sự/dự án sử dụng).
  - Thêm tab "Cấp phát tài sản" (`/materials?tab=assets`) theo dõi chi tiết thiết bị đang ở đâu, ai chịu trách nhiệm.
  - Bổ sung tính năng "Hoàn trả về kho" (tự động tạo phiếu nhập kho thu hồi) và "Bàn giao nhân sự khác".
  - Hiển thị danh mục tài sản/thiết bị đang nắm giữ và quyền sở hữu trong popup Chi tiết nhân sự (`PersonnelPage`).
- Speed test & verify build thành công.

## v3.9.15 (2026-11-27)

- Fix GPS Check-in trên thiết bị di động (Native APK & Web):
  - Khai báo bổ sung quyền `ACCESS_FINE_LOCATION` và `ACCESS_COARSE_LOCATION` trong `AndroidManifest.xml`.
  - Tích hợp `@capacitor/geolocation` để tự động xin cấp quyền vị trí trên điện thoại và tối ưu hóa thời gian quét định vị.
  - Hỗ trợ cơ chế định vị fallback qua Wi-Fi / mạng di động khi tín hiệu vệ tinh yếu.
- Đóng gói và phát hành phiên bản mới.

## v3.9.12 (2026-11-27)

- GPS diagnostics improvements:
  - Increased timeout to 20 s.
  - Improved fallback handling and error messages.
  - Added guidance for HTTPS requirement on mobile browsers.
- Version bump to 3.9.12.
