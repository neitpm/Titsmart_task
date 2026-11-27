# Changelog

## v3.9.18 (2026-11-27)

- Mô-đun Quản lý Hiệu quả Tài chính & Lợi nhuận Dự án (`Hiệu quả tài chính`):
  - Tách bạch rõ 2 lớp: Lợi nhuận Kế hoạch (Dự toán) vs Lợi nhuận Thực tế (Tạm tính).
  - Tách biệt hai chiều phụ lục: Phụ lục đầu ra (tăng/giảm doanh thu CĐT) và Phụ lục đầu vào (tăng/giảm giá vốn mua hàng, nhân công, thầu phụ).
  - Tách bạch rạch ròi giữa Lợi nhuận kế toán và Quản trị dòng tiền (Tiền đã thu - Tiền đã chi).
  - Bổ sung 4 thẻ KPI tài chính cốt lõi: Doanh thu phê duyệt, Tổng giá vốn thực tế, Lợi nhuận tạm tính, Dòng tiền dự án & Công nợ CĐT.
  - Hỗ trợ nút cài đặt nhanh giá trị hợp đồng gốc (HĐ đầu ra) ngay trên thẻ Doanh thu.
  - Chuẩn hóa layout không có margin/padding thừa, tối ưu hóa giao diện sát lề sắc nét.
  - Chuẩn hóa công thức `totalProjectCost` (cộng thêm toàn bộ chi phí nhân công công nhật).
  - Xuất Excel sửa tên cột phản ánh đúng bản chất thanh toán và công nợ NCC.

## v3.9.17 (2026-11-27)

- Khắc phục chấm công trên Desktop / Máy tính bàn không có module GPS:
  - Tự động nhận diện môi trường Desktop / LAN khi gặp lỗi `POSITION_UNAVAILABLE` hoặc `TIMEOUT`.
  - Tự động lấy vị trí qua IP Geolocation hoặc fallback nhanh về vị trí Văn phòng công ty.
  - Bổ sung nút "Dùng vị trí Văn phòng (Desktop)" trực tiếp trong hộp thoại chấm công.
- Ẩn hoàn toàn thẻ hệ thống kỹ thuật `[ASSIGNED_USERS:...]` khỏi lịch sử trao đổi thảo luận và ghi chú công việc.
- Khắc phục lỗi build APK Android trên GitHub Actions (429 Too Many Requests từ Apache Maven):
  - Bổ sung mirror `https://plugins.gradle.org/m2/` và cơ chế auto-retry khi tải dependencies.

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
