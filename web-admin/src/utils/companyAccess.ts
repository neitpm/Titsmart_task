import { AuthUser } from '../services/authStore';

export const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Lấy ID công ty hiện tại từ session auth
 */
export const getCurrentCompanyId = (user?: AuthUser | null): string => {
  if (user?.companyId) return user.companyId;
  try {
    const raw = localStorage.getItem('titsmart_auth_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.companyId || parsed.company_id || DEFAULT_COMPANY_ID;
    }
  } catch (e) {
    console.warn('Lỗi đọc session titsmart_auth_session:', e);
  }
  return DEFAULT_COMPANY_ID;
};

/**
 * Kiểm tra xem người dùng có quyền quản trị cấp công ty hay không
 */
export const isCompanyAdmin = (user?: AuthUser | null): boolean => {
  if (!user) return false;
  return user.companyRole === 'company_admin' || user.role === 'admin';
};

/**
 * Kiểm tra xem người dùng có quyền truy cập vào dữ liệu của công ty chỉ định
 */
export const hasCompanyAccess = (user: AuthUser | null | undefined, targetCompanyId?: string | null): boolean => {
  if (!user) return false;
  if (!targetCompanyId) return true;
  const currentCompanyId = getCurrentCompanyId(user);
  return currentCompanyId === targetCompanyId;
};
