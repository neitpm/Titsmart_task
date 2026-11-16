-- ==============================================================================
-- BƯỚC 1: TẠO BẢNG COMPANIES, MODULES VÀ COMPANY_MODULES
-- ==============================================================================

-- 1. Bảng công ty / tenant thuê phần mềm
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50),
    slogan VARCHAR(255),
    logo_url TEXT,
    plan VARCHAR(50) DEFAULT 'standard', -- 'trial', 'standard', 'professional', 'enterprise'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'suspended', 'expired'
    admin_email VARCHAR(255) NOT NULL,
    admin_phone VARCHAR(50),
    max_users INT DEFAULT 20,
    max_storage_gb INT DEFAULT 10,
    start_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng định nghĩa danh mục module hệ thống
CREATE TABLE IF NOT EXISTS public.modules (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_core BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng cấp module cho từng công ty
CREATE TABLE IF NOT EXISTS public.company_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    module_id VARCHAR(50) NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    start_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, module_id)
);

-- ==============================================================================
-- BƯỚC 2: KHỞI TẠO DỮ LIỆU CÔNG TY MẶC ĐỊNH TITSMART VÀ CÁC MODULE
-- ==============================================================================

-- 1. Thêm công ty mặc định TITSMART (sử dụng UUID cố định để dễ mapping)
INSERT INTO public.companies (
    id,
    code,
    name,
    slogan,
    plan,
    status,
    admin_email,
    max_users,
    max_storage_gb
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'TITSMART',
    'CÔNG TY CỔ PHẦN TITSMART',
    'NÂNG TẦM CUỘC SỐNG - HƯỚNG ĐẾN TƯƠNG LAI',
    'enterprise',
    'active',
    'admin@titsmart.vn',
    999,
    100
)
ON CONFLICT (code) DO NOTHING;

-- 2. Đăng ký danh sách module cốt lõi của phần mềm
INSERT INTO public.modules (id, name, description, category, is_core) VALUES
    ('PROJECTS', 'Quản lý Dự án', 'Danh sách dự án, cấu hình thành viên, ngân sách', 'Core', TRUE),
    ('TASKS', 'Quản lý Tiến độ', 'Bảng phân công công việc, WBS, tiến độ thi công', 'Core', TRUE),
    ('MATERIALS', 'Kế hoạch Vật tư', 'Bảng bóc tách khối lượng và chủng loại vật tư', 'Operation', TRUE),
    ('PURCHASING', 'Mua sắm & Đặt hàng', 'Theo dõi đặt hàng, đơn giá, nhà cung cấp, thanh toán mua sắm', 'Operation', FALSE),
    ('EXPENSES', 'Chi phí & Quỹ dự án', 'Quản lý chi phí công trình, văn phòng, duyệt cấp/ứng quỹ', 'Finance', FALSE),
    ('LABOR', 'Lương công nhật', 'Quản lý chấm công và chi trả nhân công nhật tại công trình', 'Finance', FALSE),
    ('INVENTORY', 'Kho Dự án', 'Quản lý xuất nhập tồn vật tư theo kho công trình', 'Operation', FALSE),
    ('DOCUMENTS', 'Hồ sơ pháp lý & Chứng từ', 'Quản lý biên bản nghiệm thu, CO/CQ, hồ sơ dự án', 'Documentation', FALSE),
    ('DIAGRAM', 'Thư viện Sơ đồ kỹ thuật', 'Sơ đồ một sợi trạm biến áp, bản vẽ hoàn công', 'Technical', FALSE),
    ('FIELD_LOGS', 'Nhật ký Hiện trường', 'Hình ảnh thực địa, chấm công GPS, ghi nhận sự cố', 'Operation', FALSE),
    ('PERSONNEL', 'Quản lý Nhân sự', 'Danh sách nhân viên, thông tin liên lạc, cấp bậc', 'HR', FALSE),
    ('ATTENDANCE', 'Chấm công & Nghỉ phép', 'Quy chế nghỉ phép, ngày nghỉ tích lũy, duyệt phép 2 cấp', 'HR', FALSE),
    ('CHAT', 'Nhắn tin Nội bộ', 'Trò chuyện theo dự án, trao đổi công việc theo thời gian thực', 'Communication', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 3. Cấp toàn bộ module cho công ty mặc định TITSMART
INSERT INTO public.company_modules (company_id, module_id, is_enabled)
SELECT '00000000-0000-0000-0000-000000000001', id, TRUE
FROM public.modules
ON CONFLICT (company_id, module_id) DO NOTHING;

-- ==============================================================================
-- BƯỚC 3 & 4: THÊM CỘT COMPANY_ID VÀ GÁN DỮ LIỆU HIỆN TẠI VÀO TITSMART
-- (Không bật RLS ở giai đoạn này - dữ liệu hiển thị an toàn 100%)
-- ==============================================================================

-- 1. Bảng engineers (Nhân sự)
ALTER TABLE public.engineers 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
ADD COLUMN IF NOT EXISTS platform_role VARCHAR(50) DEFAULT 'user',
ADD COLUMN IF NOT EXISTS company_role VARCHAR(50);

-- Gán toàn bộ engineers hiện tại vào TITSMART
UPDATE public.engineers 
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Cập nhật tài khoản admin hệ thống
UPDATE public.engineers 
SET platform_role = 'super_admin', company_role = 'company_admin'
WHERE username = 'admin' OR email = 'admin@titsmart.vn';

-- Cập nhật vai trò công ty cho các tài khoản hiện có
UPDATE public.engineers
SET company_role = CASE
    WHEN LOWER(role) LIKE '%giám đốc%' OR role = 'director' THEN 'director'
    WHEN LOWER(role) LIKE '%quản lý%' OR role = 'pm' THEN 'pm'
    WHEN LOWER(role) LIKE '%kỹ sư%' OR role = 'engineer' THEN 'engineer'
    WHEN LOWER(role) LIKE '%kế toán%' THEN 'accountant'
    ELSE 'staff'
END
WHERE company_role IS NULL;

-- 2. Bảng projects (Dự án)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.projects 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 3. Bảng tasks (Công việc / Tiến độ)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.tasks 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 4. Bảng material_plans (Kế hoạch vật tư)
ALTER TABLE public.material_plans 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.material_plans 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 5. Bảng purchasing_plans (Mua sắm)
ALTER TABLE public.purchasing_plans 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.purchasing_plans 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 6. Bảng expenses (Chi phí & Đề xuất cấp quỹ)
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.expenses 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 7. Bảng labor_payrolls (Lương công nhật)
ALTER TABLE public.labor_payrolls 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.labor_payrolls 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 8. Bảng materials (Kho vật tư)
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.materials 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 9. Bảng field_logs (Nhật ký hiện trường)
ALTER TABLE public.field_logs 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.field_logs 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 10. Bảng document_tracks (Chứng từ / Hồ sơ)
ALTER TABLE public.document_tracks 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.document_tracks 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 11. Bảng activity_logs (Nhật ký hoạt động)
ALTER TABLE public.activity_logs 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.activity_logs 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 12. Bảng notifications (Thông báo)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.notifications 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- 13. Bảng direct_messages (Tin nhắn nội bộ)
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.direct_messages 
SET company_id = '00000000-0000-0000-0000-000000000001' 
WHERE company_id IS NULL;

-- Tạo index để tối ưu tốc độ truy vấn theo công ty
CREATE INDEX IF NOT EXISTS idx_engineers_company_id ON public.engineers(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_material_plans_company_id ON public.material_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_purchasing_plans_company_id ON public.purchasing_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_company_id ON public.company_modules(company_id);
