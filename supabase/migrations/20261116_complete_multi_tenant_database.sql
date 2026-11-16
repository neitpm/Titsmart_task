-- ==============================================================================
-- WORKCORE MULTI-TENANT ARCHITECTURE DATABASE MIGRATION SCRIPT
-- TARGET: LOCAL SUPABASE DEVELOPMENT DATABASE
-- PHẠM VI: CÔ LẬP TOÀN DIỆN CÁC DOANH NGHIỆP THEO COMPANY_ID
-- ==============================================================================

-- 1. Đảm bảo extension UUID có sẵn
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- PHẦN 1: BẢNG CÔNG TY & GÓI DỊCH VỤ (COMPANIES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50),
    slogan VARCHAR(255),
    logo_url TEXT,
    hotline VARCHAR(50),
    address TEXT,
    plan VARCHAR(50) DEFAULT 'standard', -- 'trial', 'standard', 'professional', 'enterprise'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'suspended', 'expired'
    admin_email VARCHAR(255) NOT NULL,
    admin_phone VARCHAR(50),
    max_users INT DEFAULT 25,
    max_storage_gb INT DEFAULT 20,
    start_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PHẦN 2: BẢNG THÀNH VIÊN CÔNG TY (COMPANY_USERS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.company_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID, -- Khóa ngoại trỏ tới auth.users hoặc engineers.id
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    company_role VARCHAR(50) DEFAULT 'staff', -- 'company_admin', 'staff'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'locked', 'invited'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, email)
);

-- ==============================================================================
-- PHẦN 3: BẢNG MODULES & CẤP PHÉP (MODULES, COMPANY_MODULES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.modules (
    id VARCHAR(50) PRIMARY KEY,
    key VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    is_core BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    module_id VARCHAR(50) NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    is_enabled BOOLEAN DEFAULT TRUE, -- Giữ cả 2 trường để tương thích ngược
    starts_at DATE DEFAULT CURRENT_DATE,
    expires_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, module_id)
);

-- ==============================================================================
-- PHẦN 4: CÁC BẢNG CẤU HÌNH NỘI BỘ RIÊNG BIỆT CỦA CÔNG TY
-- ==============================================================================

-- 4.1 Thương hiệu nội bộ của từng công ty
CREATE TABLE IF NOT EXISTS public.company_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_slogan VARCHAR(255),
    company_logo TEXT,
    hotline VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.2 Danh mục loại dự án nội bộ của từng công ty
CREATE TABLE IF NOT EXISTS public.company_project_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- 4.3 Danh mục trạng thái công việc nội bộ của từng công ty
CREATE TABLE IF NOT EXISTS public.company_task_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color_code VARCHAR(50) DEFAULT '#3b82f6',
    is_completed_status BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- 4.4 Danh mục chi phí nội bộ của từng công ty
CREATE TABLE IF NOT EXISTS public.company_expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- 4.5 Cài đặt quy trình & tiện ích nội bộ của từng công ty
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    allow_direct_fund_approval BOOLEAN DEFAULT FALSE,
    allow_dual_checker_reviewer BOOLEAN DEFAULT FALSE,
    default_accountant_id UUID,
    default_accountant_name VARCHAR(255),
    updated_by VARCHAR(100),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PHẦN 5: KHỞI TẠO CÔNG TY MẶC ĐỊNH & MODULES CHUẨN
-- ==============================================================================

-- 5.1 Tạo tenant mặc định (TITSMART) nếu chưa có
INSERT INTO public.companies (
    id, code, name, slogan, plan, status, admin_email, max_users, max_storage_gb
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'DEFAULT',
    'CÔNG TY CỔ PHẦN TITSMART',
    'NÂNG TẦM CUỘC SỐNG - HƯỚNG ĐẾN TƯƠNG LAI',
    'enterprise',
    'active',
    'admin@titsmart.vn',
    999,
    100
) ON CONFLICT (code) DO NOTHING;

-- Đồng bộ ID mặc định cho code TITSMART nếu đã tồn tại
UPDATE public.companies 
SET code = 'TITSMART' 
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 5.2 Khởi tạo danh mục 13 Modules chuẩn
INSERT INTO public.modules (id, key, name, description, category, is_active, is_core) VALUES
    ('PROJECTS', 'projects', 'Quản lý Dự án', 'Danh mục dự án, thông tin hợp đồng và ngân sách', 'Core', TRUE, TRUE),
    ('TASKS', 'tasks', 'Quản lý Tiến độ', 'Phân công công việc, WBS, tiến độ và giao việc', 'Core', TRUE, TRUE),
    ('MATERIALS', 'materials', 'Kế hoạch Vật tư', 'Bảng bóc tách khối lượng vật tư và nhu cầu thi công', 'Supply', TRUE, FALSE),
    ('PURCHASING', 'purchasing', 'Mua sắm & Đặt hàng', 'Theo dõi đặt hàng, đơn vị cung cấp và giao nhận', 'Supply', TRUE, FALSE),
    ('EXPENSES', 'expenses', 'Chi phí & Tạm ứng', 'Quản lý phiếu chi, hoàn ứng công trình', 'Finance', TRUE, FALSE),
    ('FUND_REQUEST', 'fund_request', 'Duyệt cấp quỹ', 'Quy trình kiểm tra, phê duyệt và chi tiền đa cấp', 'Finance', TRUE, FALSE),
    ('LABOR_PAYROLL', 'labor_payroll', 'Nhân công thuê ngoài', 'Bảng thanh toán tiền công thợ và chấm công nhật', 'Finance', TRUE, FALSE),
    ('FIELD_LOGS', 'field_logs', 'Nhật ký Hiện trường', 'Nhật ký thi công, thời tiết, nhân lực và sự cố công trình', 'Operations', TRUE, FALSE),
    ('DOCUMENTS', 'documents', 'Hồ sơ & Luân chuyển', 'Theo dõi chuyển giao chứng từ, hợp đồng và hóa đơn', 'Operations', TRUE, FALSE),
    ('INVENTORY', 'inventory', 'Quản lý Kho', 'Xuất nhập tồn kho vật tư và công cụ dụng cụ', 'Supply', TRUE, FALSE),
    ('ATTENDANCE', 'attendance', 'Chấm công & Nghỉ phép', 'Chấm công GPS, đơn xin nghỉ phép và phê duyệt', 'HR', TRUE, FALSE),
    ('REPORTS', 'reports', 'Báo cáo Quản trị', 'Phân tích dòng tiền, tiến độ và hiệu suất thi công', 'Analytics', TRUE, FALSE),
    ('SETTINGS', 'settings', 'Cài đặt Nội bộ', 'Cấu hình công ty, thương hiệu và phân quyền', 'Core', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
    key = EXCLUDED.key,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    is_core = EXCLUDED.is_core;

-- 5.3 Cấp toàn bộ modules cho công ty mặc định
INSERT INTO public.company_modules (company_id, module_id, enabled, is_enabled)
SELECT '00000000-0000-0000-0000-000000000001', id, TRUE, TRUE
FROM public.modules
ON CONFLICT (company_id, module_id) DO NOTHING;

-- 5.4 Khởi tạo danh mục nội bộ mặc định cho công ty mặc định
INSERT INTO public.company_project_categories (company_id, name, sort_order) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Xây dựng Dân dụng', 1),
    ('00000000-0000-0000-0000-000000000001', 'Cơ điện M&E', 2),
    ('00000000-0000-0000-0000-000000000001', 'Hạ tầng Giao thông', 3),
    ('00000000-0000-0000-0000-000000000001', 'Nội thất & Hoàn thiện', 4)
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO public.company_expense_categories (company_id, name, sort_order) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Vật tư / Thiết bị', 1),
    ('00000000-0000-0000-0000-000000000001', 'TT Tiền công thợ', 2),
    ('00000000-0000-0000-0000-000000000001', 'Ăn uống / Tiếp khách', 3),
    ('00000000-0000-0000-0000-000000000001', 'Xăng xe / Đi lại', 4),
    ('00000000-0000-0000-0000-000000000001', 'Văn phòng phẩm', 5)
ON CONFLICT (company_id, name) DO NOTHING;

-- ==============================================================================
-- PHẦN 6: GÁN VÀ BACKFILL COMPANY_ID VÀO CÁC BẢNG NGHIỆP VỤ CÒN LẠI
-- ==============================================================================

-- 6.1 Bảng attendance_logs (Chấm công)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_logs' AND column_name = 'company_id') THEN
        ALTER TABLE public.attendance_logs ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;
UPDATE public.attendance_logs SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- 6.2 Bảng inventory_transactions (Giao dịch kho)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_transactions' AND column_name = 'company_id') THEN
        ALTER TABLE public.inventory_transactions ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;
UPDATE public.inventory_transactions SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- 6.3 Bảng issues (Sự cố hiện trường)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'company_id') THEN
        ALTER TABLE public.issues ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;
UPDATE public.issues SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- 6.4 Đồng bộ company_users từ bảng engineers
INSERT INTO public.company_users (company_id, user_id, email, username, company_role, status)
SELECT 
    COALESCE(company_id, '00000000-0000-0000-0000-000000000001'),
    id,
    COALESCE(NULLIF(email, ''), username || '@titsmart.vn'),
    username,
    COALESCE(company_role, CASE WHEN role = 'admin' THEN 'company_admin' ELSE 'staff' END),
    CASE WHEN is_active = FALSE THEN 'locked' ELSE 'active' END
FROM public.engineers
WHERE email IS NOT NULL AND email != ''
ON CONFLICT (company_id, email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    company_role = EXCLUDED.company_role,
    status = EXCLUDED.status;

-- ==============================================================================
-- PHẦN 7: TẠO INDEXES TỐI ƯU TRUY VẤN THEO COMPANY_ID
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_companies_code ON public.companies(code);
CREATE INDEX IF NOT EXISTS idx_company_users_comp_email ON public.company_users(company_id, email);
CREATE INDEX IF NOT EXISTS idx_company_modules_lookup ON public.company_modules(company_id, module_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_comp ON public.attendance_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_trans_comp ON public.inventory_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_issues_comp ON public.issues(company_id);
CREATE INDEX IF NOT EXISTS idx_engineers_comp ON public.engineers(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_comp ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_comp ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_comp ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_comp ON public.activity_logs(company_id);

-- ==============================================================================
-- PHẦN 8: HƯỚNG DẪN / HÀM HELPER HỖ TRỢ ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Hàm lấy company_id của user hiện tại từ JWT hoặc profile
CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS UUID AS $$
DECLARE
    cid UUID;
BEGIN
    -- 1. Ưu tiên đọc từ app_metadata trong JWT token
    cid := NULLIF((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'company_id'), '')::UUID;
    IF cid IS NOT NULL THEN
        RETURN cid;
    END IF;

    -- 2. Đọc từ bảng engineers nếu user đã xác thực qua auth.uid()
    SELECT company_id INTO cid FROM public.engineers WHERE auth_user_id = auth.uid() LIMIT 1;
    IF cid IS NOT NULL THEN
        RETURN cid;
    END IF;

    -- 3. Mặc định fallback về tenant TITSMART an toàn
    RETURN '00000000-0000-0000-0000-000000000001'::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
