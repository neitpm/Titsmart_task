-- ==============================================================================
-- MIGRATION SCRIPT: TOÀN DIỆN BẢO MẬT RPC, TRANSACTION ATOMIC VÀ RLS CHO CẤP QUỸ
-- ==============================================================================

-- 1. BẢO ĐẢM CỘT fund_request_id TRÊN EXPENSES VÀ UNIQUE INDEX CHỐNG NẠP TRÙNG QUỸ
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS fund_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_unique_fund_request_id 
ON public.expenses (fund_request_id) 
WHERE fund_request_id IS NOT NULL AND fund_request_id <> '';

-- 2. HÀM RPC TẠO YÊU CẦU CẤP QUỸ CHÍNH THỨC (CREATE FUND REQUEST RPC)
-- Thay vì để frontend insert tự do vào activity_logs, hàm này kiểm tra auth.uid()
CREATE OR REPLACE FUNCTION public.create_fund_request(
  p_project_code text,
  p_project_name text,
  p_amount numeric,
  p_type text,
  p_purpose text,
  p_needed_date text,
  p_checker_id text DEFAULT NULL,
  p_checker_name text DEFAULT NULL,
  p_checker_title text DEFAULT NULL,
  p_reviewer_id text DEFAULT NULL,
  p_reviewer_name text DEFAULT NULL,
  p_reviewer_title text DEFAULT NULL,
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
  v_user_title text;
  v_initial_status text;
  v_now text;
  v_action jsonb;
  v_history jsonb;
  v_inserted_id uuid;
BEGIN
  -- 1. Lấy auth.uid() từ JWT session Supabase
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Lỗi xác thực: Chưa đăng nhập hoặc phiên làm việc Supabase không hợp lệ.';
  END IF;

  -- 2. Lấy thông tin người tạo từ bảng engineers
  SELECT COALESCE(auth_user_id::text, id::text), name, role, title
  INTO v_user_id, v_user_name, v_user_role, v_user_title
  FROM public.engineers
  WHERE auth_user_id = v_auth_uid OR id::text = v_auth_uid::text
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := v_auth_uid::text;
    v_user_name := 'User ' || substring(v_user_id from 1 for 8);
    v_user_role := 'engineer';
    v_user_title := 'Nhân sự';
  END IF;

  -- 3. Kiểm tra các tham số bắt buộc
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nghiệp vụ: Số tiền đề nghị cấp quỹ phải lớn hơn 0.';
  END IF;
  IF p_purpose IS NULL OR trim(p_purpose) = '' THEN
    RAISE EXCEPTION 'Nghiệp vụ: Mục đích sử dụng không được để trống.';
  END IF;
  IF p_needed_date IS NULL OR trim(p_needed_date) = '' THEN
    RAISE EXCEPTION 'Nghiệp vụ: Ngày cần tiền không được để trống.';
  END IF;
  IF p_reviewer_id IS NULL OR trim(p_reviewer_id) = '' THEN
    RAISE EXCEPTION 'Nghiệp vụ: Bắt buộc phải chọn Người duyệt cuối cùng.';
  END IF;

  -- Người tạo không được tự chọn mình làm người kiểm tra hoặc người duyệt
  IF (p_checker_id IS NOT NULL AND (p_checker_id = v_user_id OR p_checker_id = v_auth_uid::text)) THEN
    RAISE EXCEPTION 'Phân quyền: Bạn không được tự chọn mình làm Người kiểm tra.';
  END IF;
  IF (p_reviewer_id = v_user_id OR p_reviewer_id = v_auth_uid::text) THEN
    RAISE EXCEPTION 'Phân quyền: Bạn không được tự chọn mình làm Người duyệt.';
  END IF;

  v_now := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_initial_status := CASE WHEN (p_checker_id IS NOT NULL AND trim(p_checker_id) <> '') THEN 'PENDING_CHECK' ELSE 'CHECKED_WAITING_APPROVAL' END;

  v_history := jsonb_build_array(
    jsonb_build_object(
      'action', 'TẠO YÊU CẦU',
      'actorId', v_user_id,
      'actorName', v_user_name,
      'actorRole', COALESCE(v_user_title, v_user_role, 'Người tạo'),
      'timestamp', v_now,
      'note', COALESCE(p_note, p_purpose)
    )
  );

  v_action := jsonb_build_object(
    'projectCode', p_project_code,
    'projectName', COALESCE(p_project_name, p_project_code),
    'amount', p_amount,
    'type', COALESCE(p_type, 'Tạm ứng'),
    'purpose', p_purpose,
    'neededDate', p_needed_date,
    'creatorId', v_user_id,
    'creatorName', v_user_name,
    'creatorTitle', COALESCE(v_user_title, v_user_role, 'Nhân sự'),
    'checkerId', COALESCE(p_checker_id, ''),
    'checkerName', COALESCE(p_checker_name, ''),
    'checkerTitle', COALESCE(p_checker_title, ''),
    'reviewerId', p_reviewer_id,
    'reviewerName', COALESCE(p_reviewer_name, ''),
    'reviewerTitle', COALESCE(p_reviewer_title, ''),
    'accountantId', '',
    'accountantName', '',
    'note', COALESCE(p_note, ''),
    'status', v_initial_status,
    'history', v_history,
    'createdAt', v_now
  );

  INSERT INTO public.activity_logs (
    "user",
    project,
    icon,
    action,
    timestamp
  ) VALUES (
    v_user_name,
    COALESCE(p_project_name, p_project_code, 'Cấp quỹ'),
    'FUND_REQUEST',
    v_action::text,
    now()
  )
  RETURNING id INTO v_inserted_id;

  RETURN jsonb_build_object('id', v_inserted_id, 'action', v_action);
END;
$$;

-- 3. HÀM RPC PHÊ DUYỆT CẤP QUỸ & TÍNH NGUYÊN TỬ (ATOMIC TRANSACTION: RPC ĐỔI STATUS + INSERT EXPENSE NẾU COMPLETED)
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
  v_reviewer_id text;
  v_assigned_accountant_id text;
  v_current_status text;
  v_now text;
  v_audit_entry jsonb;
  v_history jsonb;
  v_is_accountant boolean;
  v_has_approve_perm boolean;
  v_has_check_perm boolean;
  v_has_transfer_perm boolean;
  
  -- Biến xác minh Kế toán
  v_target_acc_role text;
  v_target_acc_perms jsonb;
  v_target_is_acc boolean;

  -- Biến nạp quỹ nguyên tử
  v_fund_amount numeric;
  v_project_code text;
  v_purpose text;
  v_needed_date text;
  v_doc_url text;
  v_next_stt int;
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
  -- Nhận diện tài khoản Kế toán: là người có vai trò Kế toán hoặc (chức danh kế toán và không phải Lãnh đạo/Giám đốc/Admin)
  v_is_accountant := lower(COALESCE(v_user_role, '')) LIKE '%kế toán%' 
    OR (v_has_transfer_perm AND NOT v_has_approve_perm AND lower(COALESCE(v_user_role, '')) NOT IN ('admin', 'quản trị viên', 'giám đốc', 'lãnh đạo'));

  -- 3. Khóa và đọc bản ghi yêu cầu cấp quỹ (FOR UPDATE đảm bảo an toàn đồng thời)
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
  v_reviewer_id := COALESCE(v_action->>'reviewerId', '');
  v_assigned_accountant_id := COALESCE(v_action->>'accountantId', '');
  v_current_status := COALESCE(v_action->>'status', 'PENDING_CHECK');
  v_fund_amount := COALESCE((v_action->>'amount')::numeric, 0);
  v_project_code := COALESCE(v_action->>'projectCode', '');
  v_purpose := COALESCE(v_action->>'purpose', '');
  v_needed_date := COALESCE(v_action->>'neededDate', substring(v_now from 1 for 10));
  v_doc_url := COALESCE(p_transfer_doc_url, v_action->>'transferDocUrl', '');

  -- ==============================================================================
  -- 4. KIỂM SOÁT THỨ TỰ CHUYỂN TRẠNG THÁI NGHIÊM NGẶT (FSM STATE TRANSITION)
  -- ==============================================================================
  IF p_target_status = 'CHECKED_WAITING_APPROVAL' THEN
    IF v_current_status NOT IN ('PENDING_CHECK', 'NEED_MORE_INFO') THEN
      RAISE EXCEPTION 'Không thể chuyển sang Đã kiểm tra từ trạng thái hiện tại (%)', v_current_status;
    END IF;
  ELSIF p_target_status = 'NEED_MORE_INFO' THEN
    IF v_current_status NOT IN ('PENDING_CHECK', 'CHECKED_WAITING_APPROVAL') THEN
      RAISE EXCEPTION 'Chỉ có thể yêu cầu bổ sung khi đơn ở bước kiểm tra hoặc chờ duyệt.';
    END IF;
  ELSIF p_target_status = 'REJECTED_BY_CHECKER' THEN
    IF v_current_status NOT IN ('PENDING_CHECK') THEN
      RAISE EXCEPTION 'Người kiểm tra chỉ có thể từ chối khi đơn ở trạng thái Chờ kiểm tra.';
    END IF;
  ELSIF p_target_status = 'APPROVED_WAITING_ACCOUNTING' THEN
    IF v_current_status NOT IN ('CHECKED_WAITING_APPROVAL', 'PENDING_CHECK') THEN
      RAISE EXCEPTION 'Chỉ có thể phê duyệt khi yêu cầu đã được kiểm tra (trạng thái hiện tại: %)', v_current_status;
    END IF;
  ELSIF p_target_status = 'REJECTED' THEN
    IF v_current_status NOT IN ('CHECKED_WAITING_APPROVAL', 'PENDING_CHECK') THEN
      RAISE EXCEPTION 'Lãnh đạo chỉ có thể từ chối khi yêu cầu đang chờ phê duyệt.';
    END IF;
  ELSIF p_target_status = 'ACCOUNTING_PROCESSING' THEN
    IF v_current_status NOT IN ('APPROVED_WAITING_ACCOUNTING', 'APPROVED') THEN
      RAISE EXCEPTION 'Kế toán chỉ có thể tiếp nhận khi yêu cầu đã được Lãnh đạo phê duyệt.';
    END IF;
  ELSIF p_target_status = 'TRANSFERRED_WAITING_CONFIRMATION' THEN
    IF v_current_status NOT IN ('ACCOUNTING_PROCESSING', 'APPROVED_WAITING_ACCOUNTING', 'APPROVED') THEN
      RAISE EXCEPTION 'Chỉ có thể chuyển tiền sau khi yêu cầu đã được duyệt và kế toán tiếp nhận.';
    END IF;
  ELSIF p_target_status = 'COMPLETED' THEN
    IF v_current_status NOT IN ('TRANSFERRED_WAITING_CONFIRMATION') THEN
      RAISE EXCEPTION 'Chỉ có thể xác nhận hoàn tất sau khi Kế toán đã chuyển khoản và gửi UNC.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Trạng thái mục tiêu không hợp lệ: %', p_target_status;
  END IF;

  -- ==============================================================================
  -- 5. KIỂM SOÁT PHÂN QUYỀN THEO TỪNG VAI TRÒ
  -- ==============================================================================

  -- BƯỚC 1: KIỂM TRA (Người kiểm tra)
  IF p_target_status IN ('CHECKED_WAITING_APPROVAL', 'NEED_MORE_INFO', 'REJECTED_BY_CHECKER') THEN
    IF (v_user_id = v_creator_id OR v_auth_uid::text = v_creator_id) THEN
      RAISE EXCEPTION 'Phân quyền: Người tạo đơn không được tự kiểm tra yêu cầu của chính mình.';
    END IF;
    IF (v_user_id <> v_checker_id AND v_auth_uid::text <> v_checker_id) AND NOT v_has_check_perm THEN
      RAISE EXCEPTION 'Phân quyền: Chỉ Người kiểm tra được chỉ định hoặc nhân sự có quyền CHECK_FUND_REQUEST mới được kiểm tra đơn này.';
    END IF;
  END IF;

  -- BƯỚC 2: PHÊ DUYỆT (Lãnh đạo / Người duyệt)
  IF p_target_status IN ('APPROVED_WAITING_ACCOUNTING', 'REJECTED') THEN
    IF (v_user_id = v_creator_id OR v_auth_uid::text = v_creator_id) THEN
      RAISE EXCEPTION 'Phân quyền: Người tạo đơn không được tự phê duyệt yêu cầu của mình.';
    END IF;
    -- Kế toán tuyệt đối không được phê duyệt
    IF v_is_accountant THEN
      RAISE EXCEPTION 'Phân quyền: Tài khoản Kế toán không có quyền phê duyệt cấp quỹ.';
    END IF;
    IF (v_user_id <> v_reviewer_id AND v_auth_uid::text <> v_reviewer_id) AND NOT v_has_approve_perm THEN
      RAISE EXCEPTION 'Phân quyền: Bạn không phải người duyệt được chỉ định hoặc không có quyền APPROVE_FUND_REQUEST.';
    END IF;

    -- XÁC MINH NGƯỜI ĐƯỢC CHỈ ĐỊNH THẬT SỰ LÀ KẾ TOÁN
    IF p_target_status = 'APPROVED_WAITING_ACCOUNTING' THEN
      IF p_accountant_id IS NULL OR trim(p_accountant_id) = '' THEN
        RAISE EXCEPTION 'Nghiệp vụ: Lãnh đạo bắt buộc phải chọn 1 Kế toán xử lý chuyển khoản khi phê duyệt.';
      END IF;

      SELECT role, permissions INTO v_target_acc_role, v_target_acc_perms
      FROM public.engineers
      WHERE id::text = p_accountant_id OR auth_user_id::text = p_accountant_id
      LIMIT 1;

      v_target_acc_perms := COALESCE(v_target_acc_perms, '[]'::jsonb);
      v_target_is_acc := (v_target_acc_perms ? 'PROCESS_FUND_TRANSFER') OR lower(COALESCE(v_target_acc_role, '')) LIKE '%kế toán%';

      IF NOT v_target_is_acc THEN
        RAISE EXCEPTION 'Nghiệp vụ: Nhân sự được chọn (ID: %) không có quyền PROCESS_FUND_TRANSFER hoặc vai trò Kế toán.', p_accountant_id;
      END IF;
    END IF;
  END IF;

  -- BƯỚC 3: KẾ TOÁN XỬ LÝ (Tiếp nhận / Chuyển khoản)
  IF p_target_status IN ('ACCOUNTING_PROCESSING', 'TRANSFERRED_WAITING_CONFIRMATION') THEN
    IF v_assigned_accountant_id <> '' AND (v_user_id <> v_assigned_accountant_id AND v_auth_uid::text <> v_assigned_accountant_id) THEN
      RAISE EXCEPTION 'Phân quyền: Chỉ đích danh Kế toán được chỉ định xử lý mới có quyền thực hiện thao tác này.';
    END IF;
    IF p_target_status = 'TRANSFERRED_WAITING_CONFIRMATION' THEN
      IF p_transfer_doc_url IS NULL OR trim(p_transfer_doc_url) = '' THEN
        RAISE EXCEPTION 'Nghiệp vụ: Kế toán bắt buộc phải tải lên chứng từ Ủy nhiệm chi (UNC) / Bill chuyển tiền.';
      END IF;
      IF p_transfer_amount IS NULL OR p_transfer_amount <= 0 THEN
        RAISE EXCEPTION 'Nghiệp vụ: Bắt buộc nhập số tiền thực chuyển hợp lệ.';
      END IF;
    END IF;
  END IF;

  -- BƯỚC 4: NGƯỜI TẠO XÁC NHẬN NHẬN TIỀN
  -- TUYỆT ĐỐI CHỈ CHÍNH NGƯỜI TẠO ĐƠN (KỂ CẢ ADMIN CŨNG KHÔNG ĐƯỢC XÁC NHẬN THAY)
  IF p_target_status = 'COMPLETED' THEN
    IF (v_user_id <> v_creator_id AND v_auth_uid::text <> v_creator_id) THEN
      RAISE EXCEPTION 'Phân quyền: Chỉ duy nhất Người tạo yêu cầu mới có quyền xác nhận nhận tiền (Không cho phép xác nhận thay).';
    END IF;
  END IF;

  -- ==============================================================================
  -- 6. CẬP NHẬT DỮ LIỆU BẢN GHI ACTIVITY_LOGS
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

  -- Ghi nhận lịch sử audit trail
  v_audit_entry := jsonb_build_object(
    'action', p_target_status,
    'actorId', v_user_id,
    'actorName', v_user_name,
    'actorRole', COALESCE(v_user_role, 'Nhân sự'),
    'timestamp', v_now,
    'note', COALESCE(p_note, 'Cập nhật trạng thái ' || p_target_status)
  );

  v_history := COALESCE(v_action->'history', '[]'::jsonb);
  v_history := v_history || jsonb_build_array(v_audit_entry);
  v_action := jsonb_set(v_action, '{history}', v_history);

  -- Cập nhật vào bảng activity_logs
  UPDATE public.activity_logs
  SET action = v_action::text
  WHERE id = p_request_id;

  -- ==============================================================================
  -- 7. TÍNH NGUYÊN TỬ: KHI COMPLETED -> TỰ ĐỘNG TẠO EXPENSE NẠP QUỸ TRONG CÙNG TRANSACTION
  -- ==============================================================================
  IF p_target_status = 'COMPLETED' THEN
    -- Kiểm tra xem đã có expense nạp quỹ cho fund_request này chưa (chống trùng lặp tuyệt đối)
    IF NOT EXISTS (
      SELECT 1 FROM public.expenses 
      WHERE fund_request_id = p_request_id::text 
         OR (notes LIKE '%[FUND_ID:' || p_request_id::text || ']%')
    ) THEN
      -- Tính STT kế tiếp cho dự án
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
        v_fund_amount,
        '[FUND_ID:' || p_request_id::text || '] Cấp quỹ hoàn tất xác nhận bởi ' || v_user_name || ' lúc ' || v_now,
        v_doc_url,
        p_request_id::text
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('id', p_request_id, 'action', v_action);
END;
$$;

-- 4. CẤU HÌNH QUYỀN THỰC THI CHO HÀM RPC
REVOKE ALL ON FUNCTION public.create_fund_request(text, text, numeric, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_fund_request(text, text, numeric, text, text, text, text, text, text, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.review_fund_request(uuid, text, text, text, numeric, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_fund_request(uuid, text, text, text, numeric, text, text, text, text, text) TO authenticated;

-- 5. BẢO MẬT RLS CHẶN TRỰC TIẾP INSERT/UPDATE VÀO ACTIVITY_LOGS ĐỐI VỚI ICON FUND_REQUEST
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc toàn bộ nhật ký nếu đã đăng nhập
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'activity_logs' 
      AND policyname = 'Allow authenticated read activity_logs'
  ) THEN
    CREATE POLICY "Allow authenticated read activity_logs"
    ON public.activity_logs FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- Chặn người dùng tự ý insert FUND_REQUEST qua direct API (bắt buộc phải qua create_fund_request RPC)
DROP POLICY IF EXISTS "Allow authenticated insert activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow authenticated insert non_fund_request activity_logs" ON public.activity_logs;
CREATE POLICY "Allow authenticated insert non_fund_request activity_logs"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (
  icon <> 'FUND_REQUEST'
);

-- Chặn direct update FUND_REQUEST qua direct API (bắt buộc phải qua review_fund_request RPC)
DROP POLICY IF EXISTS "Allow authenticated update activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow authenticated update non_fund_request activity_logs" ON public.activity_logs;
CREATE POLICY "Allow authenticated update non_fund_request activity_logs"
ON public.activity_logs FOR UPDATE
TO authenticated
USING (
  icon <> 'FUND_REQUEST'
)
WITH CHECK (
  icon <> 'FUND_REQUEST'
);
