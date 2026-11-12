-- =========================================================================
-- MIGRATION: THÊM CÁC TRƯỜNG VÀ RÀNG BUỘC ĐỒNG BỘ AUTH CHO BẢNG ENGINEERS
-- =========================================================================

-- 1. Thêm các cột phục vụ quản lý trạng thái tài khoản Auth
ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'NOT_CREATED',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- 2. Thêm ràng buộc kiểm tra giá trị account_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_engineers_account_status'
  ) THEN
    ALTER TABLE public.engineers
      ADD CONSTRAINT chk_engineers_account_status
      CHECK (account_status IN ('NOT_CREATED', 'INVITED', 'ACTIVE', 'DISABLED', 'SYNC_ERROR'));
  END IF;
END $$;

-- 3. Đánh index & Unique index an toàn (cho phép null với các bản ghi chưa có email/auth_user_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_engineers_username_lower
  ON public.engineers (LOWER(TRIM(username)))
  WHERE username IS NOT NULL AND TRIM(username) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_engineers_email_lower
  ON public.engineers (LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_engineers_auth_user_id
  ON public.engineers (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 4. Cập nhật trạng thái cho các bản ghi hiện tại
UPDATE public.engineers
SET account_status = 'ACTIVE', is_active = true
WHERE auth_user_id IS NOT NULL;

UPDATE public.engineers
SET account_status = 'NOT_CREATED', is_active = true
WHERE auth_user_id IS NULL AND (account_status IS NULL OR account_status = 'NOT_CREATED');

-- 5. Cho phép trigger và RLS cập nhật an toàn
NOTIFY pgrst, 'reload schema';
