# 📢 YÊU CẦU TRIỂN KHAI GÓI CHUẨN HÓA NGHIỆP VỤ CẤP QUỸ / THANH TOÁN

**Kính gửi:** Bộ phận Kỹ thuật & Phát triển Hệ thống  
**Nhiệm vụ:** Điều tra lỗi Kế toán trưởng, vá lỗ hổng bảo mật và chuẩn hóa toàn diện luồng nghiệp vụ Cấp quỹ / Thanh toán.

---

## 📌 CHỈ ĐẠO TRIỂN KHAI BẮT BUỘC

> Đề nghị triển khai ngay gói chuẩn hóa nghiệp vụ Cấp quỹ/Thanh toán theo văn bản đã thống nhất.  
>
> Thực hiện trên nhánh riêng, không sửa trực tiếp `main`, không release khi chưa được phê duyệt.  
>
> Lưu ý: migration phải có phương án phục hồi tương thích, không được rollback bằng cách xóa hoặc đảo dữ liệu tài chính đã phát sinh. Trường hợp cần khắc phục dữ liệu phải dùng migration tiếp theo hoặc bút toán điều chỉnh có audit.  
>
> Trước khi code, thực hiện Phần 1 để lấy log thực tế Product Cloud và xác định nguyên nhân lỗi Kế toán trưởng. Sau đó triển khai đầy đủ Phần 2–4, kèm migration SQL, test cases, kết quả phân quyền, bằng chứng chạy Product Cloud và phương án phục hồi.  
>
> Không báo hoàn thành nếu chưa có PR/nhánh, migration, kết quả test và bằng chứng nghiệm thu tương ứng.

---

### PHẦN 1: QUY TRÌNH ĐIỀU TRA LỖI KẾ TOÁN TRƯỞNG (BẮT BUỘC THEO THỨ TỰ)
*Tuyệt đối không suy đoán nguyên nhân khi chưa có dữ liệu thực tế từ Product Cloud:*

1. **Lấy mã phản hồi và thông báo lỗi thực tế từ Product Cloud:**
   - Mở Console / Network tab khi tài khoản Kế toán trưởng thao tác.
   - Ghi nhận chính xác phản hồi HTTP (status code, payload JSON trả về) từ hàm RPC `review_fund_request`.
2. **Kiểm tra dữ liệu thực tế của bản ghi trên Database:**
   - Trạng thái hiện tại của yêu cầu (`status` thực tế trên DB là gì: `APPROVED`, `APPROVED_WAITING_ACCOUNTING` hay trạng thái khác?).
   - Giá trị của trường `accountantId`, `accountantName`, `amount` đề nghị so với `actualTransferAmount` trong payload.
   - Danh sách quyền thực tế (`permissions`), `role`, `title` của tài khoản Kế toán trưởng đang đăng nhập.
3. **Xác định điểm nghẽn:**
   - Làm rõ: Nút thao tác bị ẩn/disable do điều kiện logic trên UI, hay nút vẫn bấm được nhưng khi bấm thì RPC backend từ chối?
4. **Kết luận nguyên nhân dựa trên bằng chứng:**
   - Chỉ đưa ra phương án xử lý sau khi đã có đầy đủ dữ liệu từ 3 bước trên; không suy diễn nguyên nhân chủ quan.

---

### PHẦN 2: GÓI CẢI TIẾN & CHUẨN HÓA BẢO MẬT (TASK BACKLOG BẮT BUỘC)

1. **Gỡ bỏ cơ chế Fallback nguy hiểm:**
   - Xóa bỏ hoàn toàn nhánh fallback tự ý ghi đè/update trực tiếp vào bảng `activity_logs` ở client khi RPC `review_fund_request` trả về lỗi.
   - Mọi thay đổi trạng thái tài chính bắt buộc phải đi qua RPC có kiểm soát bảo mật và validation của Database. Nếu RPC lỗi, bắt buộc hiển thị đúng thông báo lỗi từ server để xử lý.

2. **Bổ sung trạng thái & Quy trình đối soát (Discrepancy Flow):**
   - Bổ sung trạng thái chính thức: `DISCREPANCY_PENDING_REVIEW` (Đang đối soát nhận thiếu / chưa nhận).
   - Khi có chênh lệch, **tuyệt đối không cho yêu cầu chuyển sang "Đã cấp tiền"**. Chỉ được nạp quỹ theo số đã đối soát cuối cùng, có người chịu trách nhiệm và bút toán điều chỉnh rõ ràng.
   - Thiết lập luồng xử lý tiếp theo: Cho phép thực hiện thao tác chuyển bổ sung, hoàn tiền hoặc đóng vụ việc (đối soát hoàn tất).

3. **Cấu hình hạn mức phê duyệt động 3 tầng:**
   Xây dựng bảng tham số cấu hình rõ ràng 3 cấp:
   - **Tầng 1:** Hạn mức chuẩn áp dụng toàn công ty.
   - **Tầng 2:** Ghi đè theo từng dự án / từng quỹ cụ thể.
   - **Tầng 3:** Hạn mức theo vai trò / người được ủy quyền và có thời hạn ủy quyền cụ thể.

4. **Kiểm soát nhập số tiền & Ngăn chặn rủi ro gõ nhầm:**
   - Giữ nguyên cơ chế tự động format số `vi-VN` theo thời gian thực.
   - **Bắt buộc bổ sung dòng hiển thị số tiền bằng chữ (tiếng Việt)** ngay phía dưới ô nhập tiền (nhận diện tức thì giữa 55,5 triệu và 55,5 tỷ).
   - Bổ sung cơ chế cảnh báo số tiền bất thường / vượt ngân sách kế hoạch dự án trước khi người dùng bấm gửi.

---

### PHẦN 3: ĐỐI SOÁT SỐ TIỀN, TÍNH NHẤT QUÁN VÀ AUDIT

- **Phân biệt rõ 4 trường số tiền:** 
  1. `Số tiền đề nghị`
  2. `Số tiền thực chuyển`
  3. `Số tiền thực nhận`
  4. `Số tiền được quyết toán / nạp quỹ`
- **Không được tự động lấy số tiền đề nghị để nạp quỹ** khi số thực chuyển hoặc thực nhận khác số tiền đề nghị.
- Chỉ cho phép hoàn tất sau khi đối soát chốt số tiền cuối cùng; mọi chênh lệch phải có lý do, người xử lý và lịch sử xử lý.
- **RPC backend phải kiểm tra chuyển trạng thái hợp lệ và chống thao tác đồng thời (concurrency control):**
  - Tuyệt đối không cho chuyển tiền hai lần (chống double-transfer / race condition).
  - Không cho xác nhận sau khi yêu cầu đã hoàn tất hoặc đã hủy.
  - Chặn đứng mọi trường hợp người tạo tự kiểm tra hoặc tự duyệt yêu cầu của chính mình.
  - **Lưu ý then chốt về Audit bất biến:** Lịch sử phê duyệt & thay đổi trạng thái tài chính (Ai, lúc nào, từ trạng thái nào sang trạng thái nào, lý do, chứng từ) **bắt buộc phải được đảm bảo bằng ràng buộc ở Database/RPC** (Trigger hoặc bảng Audit độc lập với quyền `APPEND-ONLY`, cấm `UPDATE/DELETE`), tuyệt đối không chỉ dựa vào logic client hay bảng `activity_logs` thông thường.
- **Khi thay đổi số tiền, người nhận, mục đích hoặc dự án sau khi đã duyệt:** Yêu cầu bắt buộc phải bị thu hồi và quay lại luồng phê duyệt từ đầu.

---

### PHẦN 4: TIÊU CHÍ NGHIỆM THU BẮT BUỘC

- **Migration chuẩn & Bảo toàn dữ liệu:** Có migration phiên bản hóa, kế hoạch triển khai, kiểm thử trên môi trường phù hợp và phương án phục hồi tương thích, **không làm mất hoặc đảo sai dữ liệu tài chính đã phát sinh**. Mọi khắc phục sai lệch phải thực hiện bằng migration tiếp theo hoặc bút toán điều chỉnh có audit, tuyệt đối không rollback kiểu xóa dữ liệu sổ sách.
- **Loại bỏ Bypass:** Không còn bất kỳ nhánh client nào cập nhật trực tiếp trạng thái cấp quỹ khi RPC lỗi.
- **Ma trận kiểm thử nghiệp vụ:** Kiểm thử bằng ít nhất các tình huống:
  - Chuyển đủ.
  - Chuyển thiếu.
  - Chưa nhận tiền.
  - Chuyển bổ sung chênh lệch.
  - Chuyển trùng đồng thời (test 2 tab/user cùng bấm lúc chuyển tiền).
  - Hủy yêu cầu.
  - Thay đổi số tiền/thông tin sau khi đã duyệt.
- **Kiểm thử ma trận phân quyền:** Người tạo, người kiểm tra, người duyệt, kế toán/thủ quỹ, cấp quản lý được ủy quyền và admin.
- **Báo cáo kiểm thử minh bạch:** Có log kiểm thử ghi rõ Request ID, trạng thái trước/sau, số tiền đề nghị / thực chuyển / thực nhận / quyết toán; tuyệt đối không đưa dữ liệu nhạy cảm hoặc chứng từ thật vào báo cáo.
- **Đóng gói bàn giao:** Bàn giao PR/nhánh riêng, migration SQL, biên bản test case, ảnh/video luồng chạy kiểm chứng trên Product Cloud và tài liệu phương án phục hồi khi gặp sự cố.
