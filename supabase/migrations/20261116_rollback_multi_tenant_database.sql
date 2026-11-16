-- ====================================================================
-- ROLLBACK SCRIPT CHO MULTI-TENANT SAAS DATABASE
-- File: 20261116_rollback_multi_tenant_database.sql
-- Mục đích: Khôi phục lại trạng thái ban đầu nếu cần rollback
-- Lưu ý: Chỉ thực thi khi có quyết định hủy bỏ kiến trúc multi-tenant.
-- ====================================================================

-- 1. Xóa các function & trigger mới tạo
DROP FUNCTION IF EXISTS public.get_current_user_company_id() CASCADE;

-- 2. Xóa các bảng cấu hình nội bộ và phân quyền công ty mới tạo
DROP TABLE IF EXISTS public.company_settings CASCADE;
DROP TABLE IF EXISTS public.company_task_statuses CASCADE;
DROP TABLE IF EXISTS public.company_expense_categories CASCADE;
DROP TABLE IF EXISTS public.company_project_categories CASCADE;
DROP TABLE IF EXISTS public.company_branding CASCADE;
DROP TABLE IF EXISTS public.company_users CASCADE;

-- 3. Xóa các index composite theo company_id
DROP INDEX IF EXISTS idx_attendance_logs_company_id;
DROP INDEX IF EXISTS idx_inventory_transactions_company_id;
DROP INDEX IF EXISTS idx_issues_company_id;
DROP INDEX IF EXISTS idx_tasks_company_id;
DROP INDEX IF EXISTS idx_projects_company_id;
DROP INDEX IF EXISTS idx_engineers_company_id;
DROP INDEX IF EXISTS idx_expenses_company_id;
DROP INDEX IF EXISTS idx_material_plans_company_id;
DROP INDEX IF EXISTS idx_materials_company_id;
DROP INDEX IF EXISTS idx_notifications_company_id;
DROP INDEX IF EXISTS idx_activity_logs_company_id;

-- 4. Nếu cần gỡ bỏ cột company_id khỏi các bảng nghiệp vụ (không khuyến khích nếu muốn giữ liên kết):
-- ALTER TABLE public.attendance_logs DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.inventory_transactions DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.issues DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.tasks DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.projects DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.engineers DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.expenses DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.materials DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.material_plans DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.purchasing_plans DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.labor_payrolls DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.field_logs DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.document_tracks DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.notifications DROP COLUMN IF EXISTS company_id;
-- ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS company_id;
