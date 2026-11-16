-- ==============================================================================
-- WORKCORE MULTI-TENANT LOCAL SEED DATA (ALIGNED WITH SCHEMA)
-- ==============================================================================

-- 1. Đảm bảo Công ty Mặc định tồn tại đầy đủ thông tin
INSERT INTO public.companies (
  id, code, name, slogan, logo_url, hotline, email, address,
  admin_email, admin_phone, plan, status, max_users, max_storage_gb,
  start_date, expiry_date
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'TITSMART',
  'TITSMART TECHNOLOGY',
  'Tiên phong giải pháp công nghệ',
  '/logo.png',
  '0979.888.643',
  'admin@titsmart.vn',
  'Tòa nhà TITSMART, TP. Hồ Chí Minh',
  'admin@titsmart.vn',
  '0979.888.643',
  'enterprise',
  'active',
  50,
  100,
  CURRENT_DATE,
  '2030-12-31'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slogan = EXCLUDED.slogan,
  hotline = EXCLUDED.hotline,
  address = EXCLUDED.address,
  admin_email = EXCLUDED.admin_email,
  admin_phone = EXCLUDED.admin_phone,
  plan = EXCLUDED.plan,
  status = EXCLUDED.status;

-- Cấu hình branding mặc định
INSERT INTO public.company_branding (
  company_id, company_name, company_slogan, hotline, email, address
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'TITSMART TECHNOLOGY',
  'Tiên phong giải pháp công nghệ',
  '0979.888.643',
  'admin@titsmart.vn',
  'Tòa nhà TITSMART, TP. Hồ Chí Minh'
) ON CONFLICT (company_id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  hotline = EXCLUDED.hotline,
  email = EXCLUDED.email,
  address = EXCLUDED.address;

-- 2. Tạo công ty mẫu thứ 2 (DEMO_CORP) để kiểm tra cách ly dữ liệu
INSERT INTO public.companies (
  id, code, name, slogan, logo_url, hotline, email, address,
  admin_email, admin_phone, plan, status, max_users, max_storage_gb,
  start_date, expiry_date
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'DEMOCORP',
  'TẬP ĐOÀN DEMO VIỆT NAM',
  'Giải pháp xây dựng thông minh',
  '',
  '0912.345.678',
  'admin@democorp.vn',
  '123 Phố Huế, Hà Nội',
  'admin@democorp.vn',
  '0912.345.678',
  'standard',
  'active',
  20,
  20,
  CURRENT_DATE,
  '2028-12-31'
) ON CONFLICT (id) DO NOTHING;

-- Nhân sự mẫu cho DEMO_CORP
INSERT INTO public.engineers (
  id, name, title, username, email, phone, role, company_role, company_id, is_active, account_status
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  'Nguyễn Văn Demo',
  'Giám đốc Dự án',
  'demoadmin',
  'admin@democorp.vn',
  '0912.345.678',
  'admin',
  'company_admin',
  '00000000-0000-0000-0000-000000000002',
  true,
  'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Map vào company_users
INSERT INTO public.company_users (
  company_id, user_id, company_role, status
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'company_admin',
  'active'
) ON CONFLICT DO NOTHING;

-- Dự án mẫu cho DEMO_CORP
INSERT INTO public.projects (
  id, code, name, status, company_id, progress_percent
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  'DA-DEMO-01',
  'Dự án Trụ sở Demo Tower',
  'active',
  '00000000-0000-0000-0000-000000000002',
  25
) ON CONFLICT (id) DO NOTHING;

-- Công việc mẫu cho DEMO_CORP
INSERT INTO public.tasks (
  id, project_code, name, status, priority, company_id
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  'DA-DEMO-01',
  'Khảo sát hiện trạng Demo Tower',
  'Đang làm',
  'High',
  '00000000-0000-0000-0000-000000000002'
) ON CONFLICT (id) DO NOTHING;
