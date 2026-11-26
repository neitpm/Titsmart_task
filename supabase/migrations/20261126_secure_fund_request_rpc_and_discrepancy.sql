-- ==============================================================================
-- MIGRATION: 20261126_secure_fund_request_rpc_and_discrepancy.sql
-- Mục đích:
--   1. Chuẩn hóa review_fund_request: Chống thao tác kép, kiểm soát chuyển trạng thái hợp lệ
--   2. Bổ sung trạng thái đối soát: DISCREPANCY_PENDING_REVIEW
--   3. Cho phép phòng Kế toán / Kế toán trưởng xử lý khi không gán đích danh ID
--   4. Đảm bảo tính nhất quán số tiền: Chỉ nạp quỹ khi COMPLETED theo số tiền thực nhận/quyết toán
--   5. BẢO TOÀN DỮ LIỆU: Migration tương thích, không xóa hay làm mất dữ liệu tài chính lịch sử
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.review_fund_request(
  p_request_id uuid,
  p_target_status text,
  p_accountant_id text DEFAULT NULL,
  p_accountant_name text DEFAULT NULL,
  p_transfer_amount numeric DEFAULT NULL,
  p_transfer_date text DEFAULT NULL,
  p_transaction_code text DEFAULT NULL,
  p_transfer_doc_url text DEFAULT NULL,
  p_transfer_note text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid uuid;
  v_user_id text;
  v_user_name text;
  v_user_role text;
  v_perms jsonb;
  v_row record;
  v_action jsonb;
  v_creator_id text;
  v_creator_name text;
  v_checker_id text;
  v_checker_name text;
  v_reviewer_id text;
  v_reviewer_name text;
  v_assigned_accountant_id text;
  v_current_status text;
  v_now text;
  v_audit_entry jsonb;
  v_history jsonb;
  v_is_accountant boolean;
  v_has_approve_perm boolean;
  v_has_check_perm boolean;
  v_has_transfer_perm boolean;
  v_is_director boolean;
  v_is_admin boolean;
  
  -- Biến xác minh Kế toán
  v_target_acc_role text;
  v_target_acc_perms jsonb;
  v_target_is_acc boolean;

  -- Biến nạp quỹ nguyên tử
  v_fund_amount numeric;
  v_actual_transfer numeric;
  v_actual_received numeric;
  v_final_fund_in numeric;
  v_project_code text;
  v_purpose text;
  v_needed_date text;
  v_doc_url text;
  v_next_stt int;

  -- Biến mô tả cho dòng FUND_REQUEST_AUDIT
  v_audit_text text;
  v_audit_badge text := 'bg-slate-50';
  v_audit_color text := 'text-slate-600';
BEGIN
  -- 1. Lấy auth.uid() từ JWT session Supabase
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Lỗi xác thực: Chưa đăng nhập hoặc phiên làm việc Supabase không hợp lệ.';
  END IF;

  -- 2. Lấy thông tin user hiện tại từ bảng engineers
  SELECT COALESCE(auth_user_id::text, id::text), name, role, permissions 
  INTO v_user_id, v_user_name, v_user_role, v_perms
  FROM public.engineers
  WHERE auth_user_id = v_auth_uid OR id::text = v_auth_uid::text
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT COALESCE(e.auth_user_id::text, e.id::text), e.name, e.role, e.permissions
    INTO v_user_id, v_user_name, v_user_role, v_perms
    FROM public.engineers e
    JOIN auth.users u ON (
      (e.email IS NOT NULL AND lower(e.email) = lower(u.email))
      OR (e.username IS NOT NULL AND lower(u.email) = lower(e.username || '@titsmart.vn'))
    )
    WHERE u.id = v_auth_uid
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    v_user_id := v_auth_uid::text;
    v_user_name := 'User ' || substring(v_user_id from 1 for 8);
    v_user_role := 'engineer';
    v_perms := '[]'::jsonb;
  END IF;

  v_perms := COALESCE(v_perms, '[]'::jsonb);
  v_now := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  v_has_approve_perm := (v_perms ? 'APPROVE_FUND_REQUEST');
  v_has_check_perm := (v_perms ? 'CHECK_FUND_REQUEST');
  v_has_transfer_perm := (v_perms ? 'PROCESS_FUND_TRANSFER');
  v_is_director := lower(COALESCE(v_user_role, '')) IN ('director', 'giám đốc', 'tổng giám đốc', 'phó giám đốc');
  v_is_admin := lower(COALESCE(v_user_role, '')) IN ('admin', 'quản trị viên', 'systemadmin') OR v_is_director;
  v_is_accountant := lower(COALESCE(v_user_role, '')) LIKE '%kế toán%' 
    OR v_has_transfer_perm 
    OR (v_has_transfer_perm AND NOT v_has_approve_perm AND NOT v_is_admin);

  -- 3. Khóa và đọc bản ghi yêu cầu cấp quỹ (FOR UPDATE đảm bảo an toàn đồng thời - chống thao tác kép)
  SELECT id, action INTO v_row
  FROM public.activity_logs
  WHERE id = p_request_id AND icon = 'FUND_REQUEST'
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu cấp quỹ với ID: %', p_request_id;
  END IF;

  v_action := v_row.action::jsonb;
  v_creator_id := COALESCE(v_action->>'creatorId', '');
  v_creator_name := COALESCE(v_action->>'creatorName', '');
  v_checker_id := COALESCE(v_action->>'checkerId', '');
  v_checker_name := COALESCE(v_action->>'checkerName', '');
  v_reviewer_id := COALESCE(v_action->>'reviewerId', '');
  v_reviewer_name := COALESCE(v_action->>'reviewerName', '');
  v_assigned_accountant_id := COALESCE(v_action->>'accountantId', '');
  v_current_status := COALESCE(v_action->>'status', 'PENDING_CHECK');
  v_fund_amount := COALESCE((v_action->>'amount')::numeric, 0);
  v_actual_transfer := COALESCE((v_action->>'actualTransferAmount')::numeric, v_fund_amount);
  v_project_code := COALESCE(v_action->>'projectCode', '');
  v_purpose := COALESCE(v_action->>'purpose', '');
  v_needed_date := COALESCE(v_action->>'neededDate', substring(v_now from 1 for 10));
  v_doc_url := COALESCE(p_transfer_doc_url, v_action->>'transferDocUrl', '');

  -- 4. BẢO VỆ CHỐNG THAO TÁC TRÊN ĐƠN ĐÃ HOÀN TẤT HOẶC ĐÃ HỦY
  IF v_current_status = 'COMPLETED' AND p_target_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Nghiệp vụ: Yêu cầu cấp quỹ này đã Hoàn tất nạp quỹ, không thể đổi trạng thái!';
  END IF;
  IF v_current_status IN ('REJECTED', 'CANCELLED', 'REJECTED_BY_CHECKER') THEN
    RAISE EXCEPTION 'Nghiệp vụ: Yêu cầu cấp quỹ đã bị từ chối hoặc đã hủy, không thể thao tác tiếp!';
  END IF;

  -- ==============================================================================
  -- 5. KIỂM SOÁT THỨ TỰ CHUYỂN TRẠNG THÁI NGHIÊM NGẶT (FSM STATE TRANSITION)
  -- ==============================================================================
  IF p_target_status = 'CHECKED_WAITING_APPROVAL' THEN
    IF v_current_status NOT IN ('PENDING_CHECK', 'NEED_MORE_INFO') THEN
      RAISE EXCEPTION 'Không thể chuyển sang Đã kiểm tra từ trạng thái hiện tại (%)', v_current_status;
    END IF;
    v_audit_text := 'Người kiểm tra xác nhận đã kiểm tra yêu cầu (' || to_char(v_fund_amount, 'FM999,999,999,999') || ' đ): ' || COALESCE(p_note, 'Hồ sơ hợp lệ');
    v_audit_badge := 'bg-amber-50';
    v_audit_color := 'text-amber-600';

  ELSIF p_target_status = 'NEED_MORE_INFO' THEN
    IF v_current_status NOT IN ('PENDING_CHECK', 'CHECKED_WAITING_APPROVAL') THEN
      RAISE EXCEPTION 'Chỉ có thể yêu cầu bổ sung khi đơn ở bước kiểm tra hoặc chờ duyệt.';
    END IF;
    v_audit_text := 'Yêu cầu bổ sung hồ sơ cấp quỹ: ' || COALESCE(p_note, 'Vui lòng bổ sung thêm thông tin');
    v_audit_badge := 'bg-cyan-50';
    v_audit_color := 'text-cyan-600';

  ELSIF p_target_status = 'REJECTED_BY_CHECKER' THEN
    IF v_current_status NOT IN ('PENDING_CHECK') THEN
      RAISE EXCEPTION 'Người kiểm tra chỉ có thể từ chối khi đơn ở trạng thái Chờ kiểm tra.';
    END IF;
    v_audit_text := 'Người kiểm tra từ chối yêu cầu cấp quỹ: ' || COALESCE(p_note, 'Không hợp lệ');
    v_audit_badge := 'bg-rose-50';
    v_audit_color := 'text-rose-600';

  ELSIF p_target_status = 'APPROVED_WAITING_ACCOUNTING' THEN
    IF v_current_status NOT IN ('CHECKED_WAITING_APPROVAL', 'PENDING_CHECK') THEN
      RAISE EXCEPTION 'Chỉ có thể phê duyệt khi yêu cầu đã được kiểm tra (trạng thái hiện tại: %)', v_current_status;
    END IF;
    v_audit_text := 'Lãnh đạo phê duyệt cấp quỹ ' || to_char(v_fund_amount, 'FM999,999,999,999') || ' đ, chuyển Kế toán: ' || COALESCE(p_accountant_name, 'Bộ phận Kế toán');
    v_audit_badge := 'bg-blue-50';
    v_audit_color := 'text-blue-600';

  ELSIF p_target_status = 'REJECTED' THEN
    IF v_current_status NOT IN ('CHECKED_WAITING_APPROVAL', 'PENDING_CHECK') THEN
      RAISE EXCEPTION 'Lãnh đạo chỉ có thể từ chối khi yêu cầu đang chờ phê duyệt.';
    END IF;
    v_audit_text := 'Lãnh đạo từ chối yêu cầu cấp quỹ: ' || COALESCE(p_note, 'Không được phê duyệt');
    v_audit_badge := 'bg-rose-50';
    v_audit_color := 'text-rose-600';

  ELSIF p_target_status = 'ACCOUNTING_PROCESSING' THEN
    IF v_current_status NOT IN ('APPROVED_WAITING_ACCOUNTING', 'APPROVED', 'DISCREPANCY_PENDING_REVIEW') THEN
      RAISE EXCEPTION 'Kế toán chỉ có thể tiếp nhận khi yêu cầu đã được Lãnh đạo phê duyệt (Trạng thái hiện tại: %).', v_current_status;
    END IF;
    v_audit_text := 'Kế toán tiếp nhận xử lý hồ sơ chuyển khoản cấp quỹ ' || to_char(v_fund_amount, 'FM999,999,999,999') || ' đ';
    v_audit_badge := 'bg-amber-50';
    v_audit_color := 'text-amber-600';

  ELSIF p_target_status = 'TRANSFERRED_WAITING_CONFIRMATION' THEN
    IF v_current_status NOT IN ('ACCOUNTING_PROCESSING', 'APPROVED_WAITING_ACCOUNTING', 'APPROVED', 'DISCREPANCY_PENDING_REVIEW') THEN
      RAISE EXCEPTION 'Chỉ có thể chuyển tiền sau khi yêu cầu đã được duyệt hoặc đang trong quá trình chuyển tiền.';
    END IF;
    v_audit_text := 'Kế toán đã chuyển khoản ' || to_char(COALESCE(p_transfer_amount, v_fund_amount), 'FM999,999,999,999') || ' đ (Mã GD: ' || COALESCE(p_transaction_code, 'N/A') || ') & đính kèm UNC';
    v_audit_badge := 'bg-purple-50';
    v_audit_color := 'text-purple-600';

  ELSIF p_target_status = 'DISCREPANCY_PENDING_REVIEW' THEN
    IF v_current_status NOT IN ('TRANSFERRED_WAITING_CONFIRMATION') THEN
      RAISE EXCEPTION 'Chỉ có thể mở đối soát chênh lệch sau khi Kế toán đã thực hiện chuyển tiền.';
    END IF;
    v_audit_text := 'CẢNH BÁO ĐỐI SOÁT: Người nhận phản hồi nhận thiếu hoặc chưa nhận được tiền: ' || COALESCE(p_note, 'Chưa rõ nguyên nhân');
    v_audit_badge := 'bg-amber-50';
    v_audit_color := 'text-amber-700';

  ELSIF p_target_status = 'COMPLETED' THEN
    IF v_current_status NOT IN ('TRANSFERRED_WAITING_CONFIRMATION', 'DISCREPANCY_PENDING_REVIEW') THEN
      RAISE EXCEPTION 'Chỉ có thể xác nhận hoàn tất sau khi Kế toán đã chuyển khoản và đối soát xong.';
    END IF;
    v_audit_text := 'Người tạo đã xác nhận nhận tiền cấp quỹ. Nạp quỹ dự án hoàn tất!';
    v_audit_badge := 'bg-emerald-50';
    v_audit_color := 'text-emerald-600';

  ELSE
    RAISE EXCEPTION 'Trạng thái mục tiêu không hợp lệ: %', p_target_status;
  END IF;

  -- ==============================================================================
  -- 6. KIỂM SOÁT PHÂN QUYỀN VAI TRÒ
  -- ==============================================================================
  -- BƯỚC 1: KIỂM TRA
  IF p_target_status IN ('CHECKED_WAITING_APPROVAL', 'NEED_MORE_INFO', 'REJECTED_BY_CHECKER') THEN
    IF (v_user_id = v_creator_id OR v_auth_uid::text = v_creator_id) THEN
      RAISE EXCEPTION 'Phân quyền: Người tạo đơn không được tự kiểm tra yêu cầu của chính mình.';
    END IF;
  END IF;

  -- BƯỚC 2: PHÊ DUYỆT
  IF p_target_status IN ('APPROVED_WAITING_ACCOUNTING', 'REJECTED') THEN
    IF (v_user_id = v_creator_id OR v_auth_uid::text = v_creator_id) THEN
      RAISE EXCEPTION 'Phân quyền: Người tạo đơn không được tự phê duyệt yêu cầu của mình.';
    END IF;
  END IF;

  -- BƯỚC 3: KẾ TOÁN XỬ LÝ (Tiếp nhận / Chuyển khoản)
  -- Cho phép Kế toán trưởng / nhân sự có vai trò Kế toán hoặc quyền transfer xử lý
  IF p_target_status IN ('ACCOUNTING_PROCESSING', 'TRANSFERRED_WAITING_CONFIRMATION') THEN
    IF NOT v_is_accountant AND NOT v_has_transfer_perm AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Phân quyền: Bạn cần có quyền chuyển tiền hoặc vai trò Kế toán để thực hiện thao tác này.';
    END IF;

    IF p_target_status = 'TRANSFERRED_WAITING_CONFIRMATION' THEN
      IF p_transfer_doc_url IS NULL OR trim(p_transfer_doc_url) = '' THEN
        RAISE EXCEPTION 'Nghiệp vụ: Kế toán bắt buộc phải tải lên chứng từ Ủy nhiệm chi (UNC) / Giấy biên nhận.';
      END IF;
      IF p_transfer_amount IS NULL OR p_transfer_amount <= 0 THEN
        p_transfer_amount := v_fund_amount;
      END IF;
    END IF;
  END IF;

  -- BƯỚC 4: XÁC NHẬN NHẬN TIỀN / MỞ ĐỐI SOÁT
  IF p_target_status IN ('COMPLETED', 'DISCREPANCY_PENDING_REVIEW') THEN
    IF (v_user_id <> v_creator_id AND v_auth_uid::text <> v_creator_id AND NOT v_is_admin) THEN
      RAISE EXCEPTION 'Phân quyền: Chỉ duy nhất Người tạo yêu cầu mới có quyền xác nhận kết quả nhận tiền.';
    END IF;
  END IF;

  -- ==============================================================================
  -- 7. CẬP NHẬT DỮ LIỆU BẢN GHI FUND_REQUEST
  -- ==============================================================================
  v_action := jsonb_set(v_action, '{status}', to_jsonb(p_target_status));
  v_action := jsonb_set(v_action, '{updatedAt}', to_jsonb(v_now));

  IF p_accountant_id IS NOT NULL AND trim(p_accountant_id) <> '' THEN
    v_action := jsonb_set(v_action, '{accountantId}', to_jsonb(p_accountant_id));
    v_action := jsonb_set(v_action, '{accountantName}', to_jsonb(COALESCE(p_accountant_name, 'Kế toán')));
  END IF;

  IF p_transfer_amount IS NOT NULL THEN
    v_action := jsonb_set(v_action, '{actualTransferAmount}', to_jsonb(p_transfer_amount));
  END IF;
  IF p_transfer_date IS NOT NULL AND trim(p_transfer_date) <> '' THEN
    v_action := jsonb_set(v_action, '{transferDate}', to_jsonb(p_transfer_date));
  END IF;
  IF p_transaction_code IS NOT NULL AND trim(p_transaction_code) <> '' THEN
    v_action := jsonb_set(v_action, '{transactionCode}', to_jsonb(p_transaction_code));
  END IF;
  IF p_transfer_doc_url IS NOT NULL AND trim(p_transfer_doc_url) <> '' THEN
    v_action := jsonb_set(v_action, '{transferDocUrl}', to_jsonb(p_transfer_doc_url));
  END IF;
  IF p_transfer_note IS NOT NULL AND trim(p_transfer_note) <> '' THEN
    v_action := jsonb_set(v_action, '{transferNote}', to_jsonb(p_transfer_note));
  END IF;

  -- Ghi nhận lịch sử audit trail vào JSON của đơn
  v_audit_entry := jsonb_build_object(
    'action', p_target_status,
    'actorId', v_user_id,
    'actorName', v_user_name,
    'actorRole', COALESCE(v_user_role, 'Nhân sự'),
    'timestamp', v_now,
    'note', COALESCE(p_note, 'Cập nhật trạng thái ' || p_target_status),
    'attachmentUrl', p_transfer_doc_url
  );

  v_history := COALESCE(v_action->'history', '[]'::jsonb);
  v_history := v_history || jsonb_build_array(v_audit_entry);
  v_action := jsonb_set(v_action, '{history}', v_history);

  UPDATE public.activity_logs
  SET action = v_action::text
  WHERE id = p_request_id;

  -- 8. GHI AUDIT BẤT BIẾN: icon = 'FUND_REQUEST_AUDIT'
  INSERT INTO public.activity_logs (
    "user",
    project,
    icon,
    action,
    timestamp,
    badge_bg,
    icon_color
  ) VALUES (
    v_user_name,
    COALESCE(v_project_code, 'COMPANY'),
    'FUND_REQUEST_AUDIT',
    v_audit_text,
    now(),
    v_audit_badge,
    v_audit_color
  );

  -- 9. TÍNH NGUYÊN TỬ & NHẤT QUÁN SỐ TIỀN: CHỈ NẠP QUỸ KHI COMPLETED THEO SỐ THỰC CHỐT
  IF p_target_status = 'COMPLETED' THEN
    -- Xác định số tiền thực sự nạp vào quỹ (ưu tiên số thực nhận, nếu không có thì lấy số thực chuyển)
    v_actual_received := COALESCE((v_action->>'actualReceivedAmount')::numeric, 0);
    IF v_actual_received > 0 THEN
      v_final_fund_in := v_actual_received;
    ELSE
      v_final_fund_in := COALESCE(p_transfer_amount, v_actual_transfer, v_fund_amount);
    END IF;

    -- Kiểm tra chống nạp quỹ trùng lặp
    IF NOT EXISTS (
      SELECT 1 FROM public.expenses 
      WHERE fund_request_id = p_request_id::text 
         OR (notes LIKE '%[FUND_ID:' || p_request_id::text || ']%')
    ) THEN
      SELECT COALESCE(MAX(CASE WHEN stt ~ '^[0-9]+$' THEN stt::int ELSE 0 END), 0) + 1
      INTO v_next_stt
      FROM public.expenses
      WHERE project_code = v_project_code;

      INSERT INTO public.expenses (
        project_code,
        stt,
        date,
        spender_name,
        content,
        description,
        unit,
        quantity,
        unit_price,
        tax_amount,
        total_amount,
        income_amount,
        notes,
        invoice_url,
        fund_request_id
      ) VALUES (
        v_project_code,
        v_next_stt::text,
        v_needed_date::date,
        v_creator_name,
        'Cấp quỹ',
        'Cấp quỹ hoàn tất: ' || v_purpose,
        'đợt',
        1,
        0,
        0,
        0,
        v_final_fund_in,
        '[FUND_ID:' || p_request_id::text || '] Cấp quỹ hoàn tất theo số thực nhận: ' || to_char(v_final_fund_in, 'FM999,999,999,999') || ' đ. Xác nhận bởi ' || v_user_name || ' lúc ' || v_now,
        v_doc_url,
        p_request_id::text
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('id', p_request_id, 'action', v_action);
END;
$$;
