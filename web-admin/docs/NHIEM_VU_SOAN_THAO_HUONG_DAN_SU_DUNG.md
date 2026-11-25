# KẾ HOẠCH & YÊU CẦU BÀN GIAO NHIỆM VỤ SOẠN THẢO TÀI LIỆU HƯỚNG DẪN SỬ DỤNG TITSMART

---

## ⚠️ NGUYÊN TẮC BẮT BUỘC & AN TOÀN DỮ LIỆU (QUAN TRỌNG HÀNG ĐẦU)

### 1. Môi trường xác nhận duy nhất: PRODUCT CLOUD
- **Chỉ sử dụng Product Cloud với dữ liệu production thực tế.** 
- **Tuyệt đối KHÔNG dùng `localhost`**, không dùng môi trường dev/local, không dùng Supabase local CLI (`127.0.0.1:54323`), không dùng ảnh chụp cũ hoặc dữ liệu giả lập.
- Trước khi thực hiện và chụp ảnh, phải xác nhận ứng dụng đang kết nối chuẩn xác vào **Cloud Supabase** của hệ thống Product.

### 2. Chế độ trải nghiệm an toàn trên Production (Read-Only Safety Rule)
- **Chỉ xem, tìm kiếm, lọc và chụp ảnh màn hình.**
- **TUYỆT ĐỐI KHÔNG** tạo mới, chỉnh sửa, xóa dữ liệu thật trên Production.
- **TUYỆT ĐỐI KHÔNG** bấm duyệt yêu cầu, không bấm chấm công thật, không gửi thông báo thật, không thay đổi trạng thái công việc/dự án/vật tư.
- Nếu cần chụp giao diện form nhập liệu (modal tạo mới/chỉnh sửa): **Chỉ mở form để quan sát, chụp ảnh các trường thông tin rồi bấm nút "Hủy / Đóng"**, tuyệt đối không bấm "Lưu / Gửi / Xác nhận".
- **Bảo mật tuyệt đối:** Không ghi thông tin đăng nhập (tên đăng nhập, mật khẩu, token), thông tin cá nhân nhạy cảm vào tài liệu, chú thích ảnh, file log hay commit git.

### 3. Nguyên tắc nội dung chuẩn & Xử lý tính năng chưa hoàn thiện
- Toàn bộ file tài liệu cũ (`HUONG_DAN_SU_DUNG_TITSMART.md`), kho ảnh cũ trong `docs/images/`, và script chụp ảnh cũ **CHỈ LÀ THAM KHẢO KỸ THUẬT, CÓ THỂ ĐÃ CŨ HOẶC SAI**.
- **Ứng dụng đang chạy thực tế trên Product Cloud là nguồn xác nhận duy nhất.**
- Nếu tài liệu cũ có điểm khác với app Product: **BỎ NỘI DUNG CŨ**, chụp ảnh mới và ghi chính xác theo app thực tế hiện tại.
- **Về chức năng "Yêu cầu thanh toán":** Xác nhận thực tế trên Product Cloud xem chức năng Yêu cầu thanh toán đã tồn tại và đang hoạt động đến đâu. Nếu chưa có hoặc chưa hoàn thiện, ghi rõ là **"đang phát triển"**; tuyệt đối **không tự viết hướng dẫn luồng dự kiến**.
- Bất kỳ tính năng hoặc tab nào chưa hoàn thiện đều phải ghi rõ **"đang phát triển"**, không đưa thành chức năng chính thức.
- Script chụp ảnh nếu tái sử dụng phải kiểm tra chạy đúng; toàn bộ ảnh đầu ra phải được **mắt người kiểm tra thủ công** trước khi chèn vào file Word.

---

## I. MỤC TIÊU CÔNG VIỆC
- Trải nghiệm và khảo sát toàn bộ app TITSMART trực tiếp trên **Product Cloud**.
- Chụp ảnh màn hình thực tế theo các bước quan sát và vận hành chuẩn.
- Soạn thảo bộ tài liệu Word chuyên nghiệp (`.docx` & `.pdf`) hướng dẫn sử dụng TITSMART chi tiết từ bước cài đặt/đăng nhập đến toàn bộ nghiệp vụ thực tế.

---

## II. XÁC MINH THEO VAI TRÒ (ROLE-BASED VERIFICATION)
- **Chỉ thực hiện đăng nhập và xác minh các vai trò nếu đã được cấp tài khoản Production tương ứng** (Nhân viên, Quản lý dự án/PM, Kế toán/Thủ quỹ, Giám đốc/Admin).
- **Nếu chưa có đủ tài khoản production tương ứng:** Phải lập danh sách riêng các phần/tab **"Chưa xác minh theo vai trò"**, tuyệt đối **không tự suy diễn** quyền hạn hay giao diện của vai trò đó.

---

## III. BỐ CỤC CHI TIẾT FILE DOCX

### Phần 1: Giới thiệu hệ thống TITSMART
- Mục đích và đối tượng sử dụng.
- Nền tảng hỗ trợ: Web App, Desktop (Windows), Mobile App (Android/iOS).
- Quy ước chung: Ý nghĩa hệ thống màu sắc, badge trạng thái, icon cảnh báo.

### Phần 2: Cài đặt và Đăng nhập
- Hướng dẫn cài đặt ứng dụng Desktop / Mobile.
- Đăng nhập hệ thống, đổi mật khẩu, bảo mật tài khoản.
- Cập nhật hồ sơ cá nhân, ảnh đại diện, số điện thoại khẩn cấp.
- Cài đặt hiển thị giao diện và nhận thông báo.

### Phần 3: Điều hướng và Thiết lập chung
- Thanh Menu chính (Sidebar) và các khu vực chức năng đã có trên Product.
- Công cụ tìm kiếm nhanh, bộ lọc nâng cao, các chế độ xem (Bảng / Lưới / Biểu đồ).
- Trung tâm thông báo (Notification Center), Nhật ký hoạt động.

### Phần 4: Hướng dẫn chi tiết từng Tab nghiệp vụ (Theo thực tế Product)
1. **Tổng quan (Dashboard):** Các chỉ số KPI, biểu đồ tiến độ, chi phí, danh sách việc cần xử lý.
2. **Dự án:**
   - Danh sách dự án, bộ lọc trạng thái.
   - Chi tiết dự án, tiến độ tổng hợp, phân bổ nhân sự.
   - Kế hoạch dự án (Work Plan).
3. **Công việc:**
   - Công việc dự án, công việc phát sinh.
   - Tab "Việc của tôi" (phân biệt việc đảm nhiệm vs việc theo dõi).
   - Kế hoạch công việc.
4. **Lịch & Kế hoạch:** Lịch làm việc cá nhân, lịch dự án; lọc theo mốc thời gian.
5. **Vật tư & Chi phí:**
   - Đặt hàng & Mua sắm vật tư.
   - Chứng từ chi phí.
   - **Yêu cầu thanh toán:** Ghi nhận chính xác hiện trạng trên Product Cloud. Nếu đang phát triển hoặc chưa có trên Product, ghi rõ **"đang phát triển"**, không tự vẽ luồng giả định.
   - Theo dõi & Lịch sử thanh toán.
   - Chi phí thực tế & Cấp quỹ.
6. **Quản lý Hồ sơ:**
   - Hồ sơ đầu vào (chứng từ nhà cung cấp/thầu phụ để công ty thanh toán).
   - Hồ sơ đầu ra (hồ sơ nghiệm thu để khách hàng/chủ đầu tư thanh toán cho công ty).
   - Quản lý cấp công ty và cấp từng dự án.
7. **Quản lý Kho:** Danh mục vật tư, tồn kho, xem phiếu nhập kho, xuất kho.
8. **Hiện trường:** Nhật ký thi công hiện trường, hình ảnh, thời tiết, nhân lực tại công trường.
9. **Chấm công & Tiền lương:**
   - Màn hình chấm công, danh sách điểm danh.
   - Đơn xin nghỉ phép, giải trình chấm công/bù công.
   - Tổng hợp bảng công, bảng tính lương cá nhân.
10. **Nhân sự:** Danh sách nhân sự, hồ sơ nhân viên, phân quyền chức danh.
11. **Hợp đồng:** Danh sách hợp đồng khách hàng, hợp đồng thầu phụ/NCC.
12. **Nhật ký hệ thống:** Tra cứu audit log thao tác của người dùng.
13. **Cài đặt hệ thống & Tài khoản:** Thiết lập tham số hệ thống và thông tin tài khoản.

### Phần 5: Các quy trình vận hành mẫu (Chỉ viết các quy trình đã kiểm chứng trên Product)
- Quy trình Dự án & Tiến độ.
- Quy trình Chấm công & Bảng công.
- Quy trình Mua sắm & Ghi nhận chi phí.
- Quy trình Hồ sơ đầu vào & Hồ sơ đầu ra.
*(Quy trình nào chưa hoàn thiện trên Product phải gắn nhãn "Đang phát triển" kèm mô tả hiện trạng thực tế)*.

### Phần 6: Phân quyền & Ma trận trách nhiệm (RACI)
- Ma trận hiển thị và quyền hạn theo các tài khoản thực tế đã được cung cấp để kiểm tra.
- Các mục chưa có tài khoản kiểm chứng phải liệt kê vào danh sách chờ xác minh, không tự suy diễn.

### Phần 7: Xử lý sự cố thường gặp (Troubleshooting)
- Không tải được dữ liệu / Mất kết nối Internet.
- Không nhận được thông báo thời gian thực.
- Bị báo "Không có quyền thao tác".
- Dữ liệu hiển thị chưa đồng bộ giữa ứng dụng Web và Mobile.

---

## IV. TIÊU CHUẨN BÀN GIAO SẢN PHẨM
1. **File `HUONG_DAN_SU_DUNG_TITSMART.docx`** hoàn chỉnh, định dạng chuẩn (Arial/Calibri), có mục lục tự động, chú thích ảnh đầy đủ.
2. **File `HUONG_DAN_SU_DUNG_TITSMART.pdf`** xuất từ file Word để kiểm tra bố cục in ấn.
3. **Thư mục ảnh `docs/images/`** chứa toàn bộ ảnh chụp mới từ Product Cloud, đúng giao diện hiện hành.
4. **Bảng Checklist xác nhận:** 
   - Danh sách các màn hình/tính năng **Đã xác nhận trên Product Cloud**.
   - Danh sách các chức năng/vai trò **Chưa thể xác nhận (do thiếu tài khoản hoặc đang phát triển)**.
