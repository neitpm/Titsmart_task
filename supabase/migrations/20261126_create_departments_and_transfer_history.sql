-- Migration: Hệ thống quản lý Phòng ban (Departments) & Lịch sử luân chuyển nhân sự
-- Ngày tạo: 2026-11-26

-- 1. Bảng phòng ban (departments)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
    manager_name TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index tra cứu phòng ban
CREATE INDEX IF NOT EXISTS idx_departments_code ON public.departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_status ON public.departments(status);

-- 2. Bổ sung liên kết phòng ban vào bảng nhân sự engineers
ALTER TABLE public.engineers
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS department_code TEXT,
    ADD COLUMN IF NOT EXISTS department_name TEXT;

CREATE INDEX IF NOT EXISTS idx_engineers_department_id ON public.engineers(department_id);

-- 3. Bảng lịch sử điều chuyển phòng ban (department_transfer_history)
CREATE TABLE IF NOT EXISTS public.department_transfer_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engineer_id UUID NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
    engineer_name TEXT NOT NULL,
    from_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    from_department_name TEXT,
    to_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    to_department_name TEXT NOT NULL,
    transferred_by_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
    transferred_by_name TEXT,
    transfer_date TIMESTAMPTZ DEFAULT now(),
    reason TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_transfer_eng ON public.department_transfer_history(engineer_id);
CREATE INDEX IF NOT EXISTS idx_dept_transfer_date ON public.department_transfer_history(transfer_date);

-- 4. Tạo phòng ban mặc định: "Chưa phân phòng" để lưu dữ liệu cũ
INSERT INTO public.departments (code, name, description, status, sort_order)
VALUES ('PB-UNASSIGNED', 'Chưa phân phòng', 'Phòng ban mặc định cho nhân sự chưa được phân vào phòng cụ thể', 'ACTIVE', 999)
ON CONFLICT (code) DO NOTHING;

-- Gán các nhân sự hiện chưa có department_id vào phòng Chưa phân phòng
DO $$
DECLARE
    unassigned_id UUID;
BEGIN
    SELECT id INTO unassigned_id FROM public.departments WHERE code = 'PB-UNASSIGNED' LIMIT 1;
    IF unassigned_id IS NOT NULL THEN
        UPDATE public.engineers
        SET department_id = unassigned_id,
            department_code = 'PB-UNASSIGNED',
            department_name = 'Chưa phân phòng'
        WHERE department_id IS NULL;
    END IF;
END $$;
