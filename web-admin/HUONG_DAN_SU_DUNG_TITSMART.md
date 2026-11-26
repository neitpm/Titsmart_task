# Hướng dẫn sử dụng TITSMART

Phiên bản tài liệu: 3.8.499 — Cập nhật ngày 25/11/2026

## 1. Tổng quan

TITSMART là ứng dụng quản lý công việc và thi công công trình, hỗ trợ:

- Quản lý dự án và tổng quan công trình.
- Giao việc, công việc phát sinh, tiến độ và kế hoạch làm việc.
- Vật tư, kho, đặt hàng, chi phí, quỹ và thanh toán.
- Nhật ký hiện trường, chấm công và xin nghỉ phép.
- Nhân sự, tài khoản, phân quyền và hồ sơ/dữ liệu dự án.
- Chế độ Web/PWA, ứng dụng Android và ứng dụng Windows Electron.

Ứng dụng có hai địa chỉ thường dùng:

- Supabase Studio (quản trị cơ sở dữ liệu): `http://localhost:54323`
- Ứng dụng TITSMART: `http://localhost:5173/#/login`

## 2. Yêu cầu cài đặt

### Phần mềm bắt buộc

- Windows 10/11 hoặc Windows Server.
- Node.js 20 trở lên.
- npm đi kèm Node.js.
- Google Chrome hoặc Microsoft Edge.
- Docker Desktop nếu chạy cơ sở dữ liệu Supabase ở máy local.
- Supabase CLI nếu cần chạy/reset cơ sở dữ liệu local.

Kiểm tra môi trường:

```powershell
node --version
npm --version
docker --version
npx supabase --version
```

## 3. Cài đặt dự án

Mở PowerShell tại thư mục `web-admin`, sau đó chạy:

```powershell
cd "d:\HỆ THỐNG QUẢN LÝ CÔNG VIỆC-web-app-titsmart\web-admin"
npm install
```

Nếu máy đã có `node_modules` và muốn kiểm tra/cài lại gói đồng bộ khóa phiên bản:

```powershell
npm ci
```

## 4. Khởi động Supabase local

Khởi động Docker Desktop trước.

Nếu dự án đã có cấu hình Supabase CLI:

```powershell
npx supabase start
```

Nếu chưa có dữ liệu mẫu, nạp dữ liệu local bằng script:

```powershell
node scripts/seedLocalSupabase.cjs
```

Sau khi khởi động thành công:

- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://localhost:54323`

## 5. Chạy ứng dụng Web

### Chạy ở chế độ local

```powershell
npm run dev:local
```

Hoặc chạy Web-only ở chế độ local:

```powershell
npm run dev:web:local
```

Mở ứng dụng:

- `http://localhost:5173/#/login`

### Chạy ở chế độ production

```powershell
npm run dev
```

Hoặc:

```powershell
npm run dev:web
```

## 6. Đăng nhập

Màn hình đăng nhập yêu cầu:

1. Tên đăng nhập.
2. Mật khẩu.
3. Nhấn nút **Đăng nhập vào hệ thống**.

Có thể bật/tắt hiển thị mật khẩu bằng biểu tượng con mắt bên phải ô mật khẩu.

Tài khoản mẫu trong mã nguồn:

| Vai trò | Tên đăng nhập | Mật khẩu ban đầu |
|---|---|---|
| Quản trị viên | `admin` | `admin123` |
| Kỹ sư giám sát | `kst` | `123456` |
| Nhân viên | `nhanvien` | `123456` |

Không chia sẻ tài khoản quản trị. Sau khi bàn giao cho người dùng thực tế, quản trị viên nên đổi mật khẩu ngay tại trang Tài khoản.

Lưu ý: tài khoản thực tế phải được tạo bởi quản trị viên và kích hoạt tài khoản Supabase/Auth tương ứng. Tài khoản demo chỉ dùng trong môi trường thử nghiệm.

## 7. Giao diện sau đăng nhập

Sau đăng nhập thành công, ứng dụng chuyển sang màn hình quản lý dự án. Từ thanh bên trái hoặc thanh điều hướng có thể truy cập:

- Dự án & Tổng quan.
- Công việc / Công việc của tôi.
- Kế hoạch làm việc.
- Vật tư & Chi phí.
- Kho dự án.
- Nhân sự.
- Chấm công & Nghỉ phép.
- Nhật ký hiện trường.
- Hồ sơ & tài liệu.
- Lịch sử hoạt động.
- Tài khoản.
- Cài đặt hệ thống.

Các chức năng hiển thị phụ thuộc quyền của tài khoản đăng nhập.

## 8. Quản lý dự án

1. Mở **Dự án** từ thanh điều hướng.
2. Chọn một dự án từ danh sách.
3. Trong trang dự án có các tab:
   - Tổng quan.
   - Tiến độ công việc.
   - Kế hoạch làm việc.
   - Vật tư/Kho.
   - Chi phí kế hoạch.
   - Hồ sơ tài liệu.
   - Sơ đồ/thư viện.

### Tạo dự án mới

1. Mở **Dự án**.
2. Nhấn nút tạo dự án.
3. Nhập mã dự án, tên dự án, địa điểm và chỉ huy trưởng.
4. Nhấn lưu để tạo dự án.

Không nên trùng mã dự án vì mã thường được dùng để liên kết công việc, vật tư, hồ sơ và báo cáo.

## 9. Quản lý công việc

### Tạo công việc trong dự án

1. Mở dự án.
2. Chọn tab **Tiến độ công việc** hoặc **Công việc**.
3. Nhấn **Thêm đầu mục** để tạo mục lớn.
4. Nhấn thêm hạng mục con để nhập STT, tên công việc, khối lượng và đơn vị tính.
5. Lưu thông tin.

Có thể nhập dữ liệu công việc bằng file Excel/CSV nếu file đúng cấu trúc STT, mô tả công việc và khối lượng.

### Giao việc

1. Mở công việc cần giao.
2. Nhấn **Giao việc** hoặc mở biểu tượng phân công.
3. Chọn người đảm nhiệm.
4. Chọn người theo dõi nếu cần.
5. Nhập hạn hoàn thành và ghi chú hướng dẫn.
6. Đính kèm ảnh/tài liệu nếu cần.
7. Nhấn xác nhận giao việc.

Điều kiện giao việc: hạng mục cần đáp ứng điều kiện nghiệp vụ, gồm tình trạng thi công và tình trạng đặt hàng phù hợp.

### Quy trình thực hiện công việc

1. Nhân sự nhận việc.
2. Cập nhật/nắm trạng thái công việc.
3. Nhân sự báo cáo hoàn thành.
4. Người giao hoặc người có quyền nghiệm thu sẽ duyệt hoàn thành.
5. Có thể trao đổi, hỏi thắc mắc hoặc đính kèm tài liệu trong luồng trao đổi công việc.

Trạng thái thường gặp:

- Chưa làm.
- Chờ nhận việc.
- Đang làm.
- Có thắc mắc.
- Chờ nghiệm thu.
- Hoàn thành.

## 10. Công việc phát sinh

Dùng cho công việc giao trực tiếp không phụ thuộc hạng mục thi công trong dự án.

1. Mở **Công việc**.
2. Chọn tab **Phát sinh**.
3. Nhấn **Giao việc**.
4. Chọn dự án hoặc chế độ Nội bộ Công ty.
5. Chọn người nhận và người theo dõi.
6. Nhập deadline, mức ưu tiên và ghi chú.
7. Xác nhận giao việc.

## 11. Kế hoạch làm việc

Mở **Kế hoạch** để xem công việc theo:

- Lịch tháng.
- Lịch tuần.
- Lộ trình/Agenda.

Màu thông báo:

- Hồng/đỏ: công việc quá hạn.
- Vàng: đến hạn trong ngày hoặc sắp đến hạn.
- Xanh: công việc đang được theo dõi/đang thực hiện.
- Xanh lá: công việc đã hoàn thành.

Người dùng có thể đặt số ngày cảnh báo sắp đến hạn trong phần Cài đặt hoặc nút cảnh báo trên màn hình kế hoạch.

## 12. Quản lý vật tư và kho

Mở **Vật tư & Chi phí** hoặc tab **Kho dự án**.

### Nhập kho

1. Chọn tab **Nhập Kho**.
2. Chọn vật tư.
3. Nhập ngày, số lượng, nguồn nhập và ghi chú.
4. Lưu phiếu nhập.

### Xuất kho

1. Chọn tab **Xuất Kho**.
2. Chọn vật tư.
3. Chọn dự án/người nhận.
4. Nhập số lượng, ngày và ghi chú.
5. Lưu phiếu xuất.

Không xuất vượt tồn kho nếu hệ thống có bật cảnh báo tồn kho âm.

### Chuyển kho

1. Chọn vật tư có trong kho.
2. Chọn chức năng chuyển kho.
3. Chọn kho/dự án đích.
4. Nhập số lượng.
5. Xác nhận chuyển.

## 13. Hồ sơ và tài liệu

Trang **Hồ sơ** dùng để theo dõi:

- Số hợp đồng.
- Tên hồ sơ/hợp đồng.
- Công ty/đối tác.
- Người nhận.
- Ngày gửi và ngày nhận.
- Tình trạng ký/nộp.
- Hạn nộp.
- Giá trị hợp đồng.
- Tạm ứng.
- Trạng thái thanh toán.
- Tệp đính kèm.

Hồ sơ có thể nhập bằng Excel nếu dữ liệu có cấu trúc phù hợp.

## 14. Nhật ký hiện trường

1. Mở dự án và chọn **Hiện trường**.
2. Chọn công việc liên quan.
3. Nhấn thêm nhật ký.
4. Chọn ngày thi công thực tế.
5. Ghi nội dung nhật ký.
6. Tải hình ảnh từ máy ảnh hoặc thư viện.
7. Lưu nhật ký.

Chỉ người tạo hoặc người có quyền quản lý mới nên sửa/xóa nhật ký. Mọi thao tác sửa/xóa cần kiểm tra kỹ trước khi xác nhận.

## 15. Chấm công

Mở **Chấm công**.

### Chấm công vào ca

1. Chọn tab **Chấm công**.
2. Nhấn **Chấm công**.
3. Chọn dự án nếu cần.
4. Chụp hoặc tải ảnh hiện trường nếu yêu cầu.
5. Nhập ghi chú nếu cần.
6. Xác nhận chấm công.

### Chấm công bù

1. Chọn tab **Chấm công bù**.
2. Chọn loại: Bù vào ca, Bù ra ca hoặc Bù cả ngày.
3. Chọn ngày cần bù.
4. Nhập giờ vào/ra tương ứng.
5. Chọn dự án.
6. Nhập lý do giải trình.
7. Chọn người duyệt bước 1 và bước 2 nếu hệ thống cho phép.
8. Gửi yêu cầu.

Sau đó:

- Quản lý duyệt bước 1.
- Ban Giám Đốc duyệt bước 2.
- Sau khi hoàn tất, dữ liệu chấm công được cập nhật lại.

## 16. Xin nghỉ phép

1. Mở **Chấm công**.
2. Chọn tab **Xin nghỉ**.
3. Nhấn **Tạo đơn xin nghỉ**.
4. Chọn loại nghỉ và khoảng thời gian.
5. Chọn nghỉ cả ngày hoặc một buổi.
6. Chọn người duyệt nếu cần.
7. Chọn người theo dõi.
8. Nhập lý do.
9. Gửi đơn.

Quy trình duyệt:

- Quản lý duyệt bước 1.
- Ban Giám Đốc duyệt bước 2.
- Hoặc Quản trị viên/Quản trị trực tiếp duyệt tùy cấu hình.

## 17. Nhân sự và phân quyền

Trang **Nhân sự** dành cho quản trị viên và người có quyền quản lý nhân sự.

Các thao tác:

- Thêm nhân sự.
- Cập nhật hồ sơ.
- Gán dự án.
- Gán vai trò/chức danh.
- Phân quyền chi tiết.
- Kích hoạt tài khoản Supabase Auth.
- Khóa/mở khóa tài khoản.
- Xem KPI công việc.
- Giao việc nhanh.

Nên phân quyền theo cấp:

- Cấp 1: Ban Giám Đốc/Lãnh đạo.
- Cấp 2: Quản lý/chỉ huy trưởng.
- Cấp 3: Kỹ sư/nhân viên hiện trường.

## 18. Cài đặt hệ thống

Trang **Cài đặt** cho phép:

- Cập nhật tên công ty và slogan.
- Tải logo doanh nghiệp.
- Cấu hình cấp phân quyền.
- Cấu hình danh mục dự án/chi phí.
- Cài đặt thanh điều hướng.
- Cài đặt thông báo.
- Xem nhật ký hoạt động.
- Đổi mật khẩu.
- Đăng xuất.

Chỉ tài khoản quản trị hoặc nhân sự được cấp quyền mới thấy và thao tác được các mục tương ứng.

## 19. Quản lý tài khoản

Mở **Tài khoản** để:

- Xem thông tin người dùng.
- Đổi mật khẩu.
- Đăng xuất khỏi hệ thống.

Khi đổi mật khẩu cần nhập:

1. Mật khẩu hiện tại.
2. Mật khẩu mới tối thiểu 6 ký tự.
3. Xác nhận mật khẩu mới.

Không dùng lại mật khẩu cũ.

## 20. Thông báo

Ứng dụng hỗ trợ:

- Chuông thông báo trên giao diện.
- Thông báo đẩy web/PWA.
- Thông báo Electron trên Windows.
- Thông báo Android qua Capacitor khi được cấp quyền.
- Tin nhắn/chia sẻ nội bộ.

Nếu không nhận được thông báo:

1. Kiểm tra quyền thông báo của trình duyệt/ứng dụng.
2. Kiểm tra cài đặt thông báo trong trang Cài đặt.
3. Kiểm tra kết nối mạng và Supabase.
4. Đăng nhập lại ứng dụng.

## 21. Build Web sản xuất

```powershell
npm run build
```

Thư mục build sẽ nằm trong `dist`.

## 22. Build ứng dụng Android

```powershell
npm run build:mobile
```

Hoặc môi trường local:

```powershell
npm run build:mobile:local
```

## 23. Build ứng dụng Windows Electron

```powershell
npm run build:electron
```

Hoặc build bằng script ASCII path local:

```powershell
.\build-electron-local.ps1
```

File cài đặt Windows thường được tạo trong thư mục `release`.

## 24. Xử lý lỗi thường gặp

### Không truy cập được ứng dụng 5173

```powershell
npm run dev:local
```

Kiểm tra port đang sử dụng:

```powershell
netstat -ano | findstr :5173
```

### Không truy cập được Supabase 54323

1. Mở Docker Desktop.
2. Chạy `npx supabase start`.
3. Kiểm tra lại `http://localhost:54323`.

### Đăng nhập thất bại

- Kiểm tra đúng tên đăng nhập/mật khẩu.
- Kiểm tra Supabase đang chạy.
- Kiểm tra dữ liệu nhân sự đã nạp/chạy seed.
- Kiểm tra tài khoản Supabase Auth đã được kích hoạt.
- Nếu lỗi mạng, kiểm tra `.env.local` và `.env.development`.

### Chế độ local không kết nối cơ sở dữ liệu

Kiểm tra `.env.local` có chứa:

```text
VITE_SUPABASE_URL=http://127.0.0.1:54321
```

Sau đó chạy lại:

```powershell
npm run dev:local
```

### Trang trắng hoặc ứng dụng crash

1. Mở DevTools bằng `F12`.
2. Xem tab Console để tìm lỗi.
3. Xóa cache/local storage nếu dữ liệu phiên cũ gây xung đột.
4. Tải lại ứng dụng bằng nút **Tải lại ứng dụng** trong Error Boundary.

## 25. Quy trình vận hành đề nghị hàng ngày

1. Quản trị viên đăng nhập và kiểm tra tổng quan dự án.
2. Cập nhật tình trạng công việc và vật tư.
3. Giao việc cho nhân sự.
4. Nhân sự nhận việc và cập nhật tiến độ.
5. Nhân sự gửi nhật ký/ảnh hiện trường.
6. Quản lý theo dõi công việc quá hạn và thắc mắc.
7. Xử lý hồ sơ, chi phí và thanh toán.
8. Nghiệm thu công việc hoàn thành.
9. Xuất báo cáo khi cần.
10. Kiểm tra nhật ký hoạt động khi cần truy vết lịch sử.

## 26. Ghi chú an toàn

- Không lưu mật khẩu quản trị vào tài liệu giao người dùng.
- Không đăng tải key/service role lên mã nguồn công khai.
- Thường xuyên sao lưu cơ sở dữ liệu.
- Kiểm tra quyền trước khi cấp tài khoản.
- Kiểm tra kỹ dữ liệu import Excel trước khi ghi lên hệ thống.
