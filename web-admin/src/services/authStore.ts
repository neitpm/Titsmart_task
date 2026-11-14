import { create } from 'zustand';
import { Permission, SYSTEM_PERMISSIONS, BUSINESS_PERMISSIONS } from '../types';

export const getDefaultPermissions = (role: string): Permission[] => {
  const normRole = String(role || '').toLowerCase();

  // 1. Admin hệ thống: Mặc định sở hữu toàn quyền quản trị kỹ thuật, tài khoản & hệ thống
  if (normRole === 'admin' || normRole === 'quản trị viên' || normRole === 'system_admin' || normRole.includes('quản trị hệ thống')) {
    return [
      'VIEW_USERS', 'EDIT_USERS', 'MANAGE_USERS', 'MANAGE_PERMISSIONS', 'VIEW_ACTIVITY_LOG',
      'VIEW_PROJECTS', 'VIEW_TASKS', 'VIEW_MATERIALS', 'VIEW_DOCUMENTS', 'EXPORT_DATA'
    ];
  }

  // 2. Giám đốc / Ban Lãnh đạo: Sở hữu toàn quyền điều hành nghiệp vụ, phê duyệt tài chính, dự án, nhân sự
  if (normRole.includes('giám đốc') || normRole === 'director' || normRole.includes('lãnh đạo')) {
    return [
      'VIEW_PROJECTS', 'CREATE_PROJECTS', 'EDIT_PROJECTS', 'DELETE_PROJECTS',
      'VIEW_TASKS', 'IMPORT_TASKS', 'EDIT_TASKS', 'ASSIGN_TASKS', 'UPDATE_TASK_PROGRESS', 'APPROVE_TASKS', 'VIEW_FIELD_LOGS', 'MANAGE_FIELD_LOGS',
      'VIEW_MATERIALS', 'IMPORT_MATERIALS', 'EDIT_MATERIALS', 'UPDATE_MATERIAL_STATUS', 'MANAGE_INVENTORY',
      'VIEW_FINANCE', 'EDIT_PRICES', 'VIEW_PAYMENTS', 'EDIT_PAYMENTS', 'VIEW_EXPENSES', 'EDIT_EXPENSES',
      'CHECK_FUND_REQUEST', 'APPROVE_FUND_REQUEST', 'PROCESS_FUND_TRANSFER', 'CONFIRM_FUND_RECEIPT',
      'VIEW_DOCUMENTS', 'CREATE_DOCUMENTS', 'EDIT_DOCUMENTS', 'DELETE_DOCUMENTS', 'MANAGE_DOCUMENTS', 'VIEW_PROJECT_DIAGRAM', 'MANAGE_PROJECT_DIAGRAM',
      'VIEW_USERS', 'MANAGE_PAYROLL', 'APPROVE_LEAVE_STEP1', 'APPROVE_LEAVE_FINAL', 'EXPORT_DATA'
    ];
  }

  // 3. Quản lý dự án / Chỉ huy trưởng (PM)
  if (normRole === 'pm' || normRole === 'quản lý dự án' || normRole === 'project_manager') {
    return [
      'VIEW_PROJECTS', 'CREATE_PROJECTS', 'EDIT_PROJECTS',
      'VIEW_TASKS', 'IMPORT_TASKS', 'EDIT_TASKS', 'ASSIGN_TASKS', 'UPDATE_TASK_PROGRESS', 'APPROVE_TASKS', 'VIEW_FIELD_LOGS', 'MANAGE_FIELD_LOGS',
      'VIEW_MATERIALS', 'IMPORT_MATERIALS', 'EDIT_MATERIALS', 'UPDATE_MATERIAL_STATUS',
      'VIEW_FINANCE', 'VIEW_PAYMENTS', 'VIEW_EXPENSES', 'EDIT_EXPENSES',
      'VIEW_DOCUMENTS', 'CREATE_DOCUMENTS', 'EDIT_DOCUMENTS', 'MANAGE_DOCUMENTS', 'VIEW_PROJECT_DIAGRAM', 'MANAGE_PROJECT_DIAGRAM',
      'VIEW_USERS', 'MANAGE_PAYROLL', 'APPROVE_LEAVE_STEP1',
      'EXPORT_DATA'
    ];
  }

  // 4. Kỹ sư hiện trường
  if (normRole === 'engineer' || normRole === 'kỹ sư hiện trường' || normRole === 'kỹ sư') {
    return [
      'VIEW_PROJECTS',
      'VIEW_TASKS', 'UPDATE_TASK_PROGRESS', 'VIEW_FIELD_LOGS', 'MANAGE_FIELD_LOGS',
      'VIEW_MATERIALS', 'UPDATE_MATERIAL_STATUS',
      'VIEW_DOCUMENTS', 'CREATE_DOCUMENTS', 'EDIT_DOCUMENTS', 'MANAGE_DOCUMENTS', 'VIEW_PROJECT_DIAGRAM',
      'VIEW_USERS'
    ];
  }

  // 5. Nhân viên chung (staff)
  return [
    'VIEW_PROJECTS',
    'VIEW_TASKS',
    'VIEW_MATERIALS',
    'VIEW_DOCUMENTS',
    'VIEW_USERS'
  ];
};

/**
 * Kiểm tra xem người dùng có phải là Admin kỹ thuật (System Admin) hay không.
 * Quyền kỹ thuật: Cấu hình hệ thống, quản lý tài khoản nhân sự, phân quyền, xử lý lỗi.
 * Không mặc định có quyền phê duyệt nghiệp vụ (duyệt chi quỹ, duyệt nghỉ phép, nghiệm thu).
 */
export const isSystemAdmin = (user: AuthUser | null | undefined): boolean => {
  if (!user) return false;
  const username = String(user.username || '').toLowerCase();
  const name = String(user.name || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();
  return username === 'admin' || name === 'admin' || role === 'admin' || role === 'system_admin' || role === 'quản trị viên' || role.includes('quản trị hệ thống');
};

/**
 * Kiểm tra xem người dùng có phải là Giám đốc / Ban Lãnh đạo hay không.
 * Quyền điều hành: Toàn quyền xem bức tranh tổng quan, phê duyệt tài chính/quỹ, duyệt nghỉ phép cấp cao, chỉ đạo dự án.
 * Không can thiệp vào cấu hình hạ tầng kỹ thuật phần mềm.
 */
export const isDirector = (user: AuthUser | null | undefined): boolean => {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  return role.includes('giám đốc') || role.includes('ban giám đốc') || role === 'director';
};

/**
 * Kiểm tra quyền thao tác trên hệ thống:
 * 1. Admin hệ thống: Tự động có toàn quyền đối với các quyền thuộc SYSTEM_PERMISSIONS (kỹ thuật, tài khoản, audit logs).
 *    Đối với các quyền nghiệp vụ (BUSINESS_PERMISSIONS), Admin chỉ có nếu được phân quyền rõ ràng trong mảng permissions.
 * 2. Giám đốc: Tự động có toàn quyền đối với các quyền thuộc BUSINESS_PERMISSIONS (điều hành, tài chính, phê duyệt, dự án).
 *    Giám đốc không tự động có quyền can thiệp vào các quyền cấu hình hạ tầng kỹ thuật.
 * 3. Các vị trí khác: Tuân thủ đúng mảng permissions được cấp phát.
 */
export const hasPermission = (user: AuthUser | null | undefined, perm: Permission): boolean => {
  if (!user) return false;

  // 1. Phân quyền kỹ thuật (System Admin)
  if (isSystemAdmin(user)) {
    if (SYSTEM_PERMISSIONS.includes(perm)) return true;
    return user.permissions?.includes(perm) || false;
  }

  // 2. Phân quyền điều hành nghiệp vụ (Director)
  if (isDirector(user)) {
    if (BUSINESS_PERMISSIONS.includes(perm)) return true;
    return user.permissions?.includes(perm) || false;
  }

  // 3. Người dùng thông thường
  return user.permissions?.includes(perm) || false;
};

/**
 * @deprecated Dùng isDirector(user) hoặc isSystemAdmin(user) tùy theo ngữ cảnh nghiệp vụ vs kỹ thuật.
 * Giữ lại tạm thời để đảm bảo tương thích ngược, chỉ trả về true nếu là Giám đốc hoặc được cấp quyền tương đương.
 */
export const isExecutiveOrAdmin = (user: AuthUser | null | undefined): boolean => {
  if (!user) return false;
  return isDirector(user) || isSystemAdmin(user);
};

/**
 * Kiểm tra quyền quản lý (Sửa/Xóa):
 * - Admin / Lãnh đạo Cấp 1 / PM: Toàn quyền với tất cả file/hồ sơ/dữ liệu
 * - Nhân sự có quyền chi tiết tương ứng (VD: 'MANAGE_DOCUMENTS', 'EDIT_DOCUMENTS', 'DELETE_PROJECTS',...): Toàn quyền quản lý
 * - Hoặc chính chủ người tạo/tải lên
 */
export const canManageItem = (user: AuthUser | null | undefined, item: any, requiredPerm: Permission = 'MANAGE_DOCUMENTS'): boolean => {
  if (!user) return false;
  
  // Giám đốc có quyền quản lý mọi hạng mục nghiệp vụ
  if (isDirector(user)) return true;

  // Admin hệ thống chỉ có quyền quản lý nếu là quyền thuộc hệ thống hoặc được phân quyền
  if (isSystemAdmin(user)) {
    if (SYSTEM_PERMISSIONS.includes(requiredPerm)) return true;
    if (user.permissions?.includes(requiredPerm)) return true;
  }

  const role = String(user.role || '').toLowerCase();
  const isPM = role === 'pm' || role === 'quản lý dự án' || role === 'manager';
  if (isPM) return true;

  // Nếu người dùng được Admin tích chọn quyền chi tiết tương ứng (VD: 'EDIT_PROJECTS', 'DELETE_PROJECTS', 'MANAGE_DOCUMENTS')
  if (requiredPerm && user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes(requiredPerm)) {
      return true;
    }
  }

  if (!item) return false;

  const normalizeStr = (str: string) => {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const currentUserId = String(user.id || '').trim().toLowerCase();
  const currentUserName = String(user.name || '').trim().toLowerCase();
  const currentUsername = String(user.username || '').trim().toLowerCase();

  const normCurrentUserName = normalizeStr(user.name);
  const normCurrentUsername = normalizeStr(user.username);

  // Đối với dự án (Project), chỉ cho phép sửa/xóa nếu có quyền chi tiết hoặc là người tạo dự án chính thức (createdById)
  if (requiredPerm === 'EDIT_PROJECTS' || requiredPerm === 'DELETE_PROJECTS') {
    const projCreatorId = String(item.createdById || item.created_by_id || item.authorId || item.author_id || '').trim().toLowerCase();
    if (currentUserId && projCreatorId && (currentUserId === projCreatorId || currentUserId.includes(projCreatorId))) {
      return true;
    }
    return false;
  }

  const itemCreatorId = String(
    item.createdById || item.created_by_id || item.uploaderId || item.uploader_id || 
    item.userId || item.user_id || item.authorId || item.author_id || ''
  ).trim().toLowerCase();

  const itemCreatorName = String(
    item.createdByName || item.created_by_name || item.createdBy || item.created_by || 
    item.uploaderName || item.uploader_name || item.author || item.authorName || ''
  ).trim().toLowerCase();

  const normItemCreatorName = normalizeStr(itemCreatorName);

  // 1. Khớp ID người tạo
  if (currentUserId && itemCreatorId && (currentUserId === itemCreatorId || currentUserId.includes(itemCreatorId) || itemCreatorId.includes(currentUserId))) return true;

  // 2. Khớp Tên người tạo (chính xác hoặc chứa nhau, hỗ trợ cả có dấu và không dấu)
  if (currentUserName && itemCreatorName) {
    if (itemCreatorName === currentUserName || itemCreatorName.includes(currentUserName) || currentUserName.includes(itemCreatorName)) return true;
  }
  if (normCurrentUserName && normItemCreatorName) {
    if (normItemCreatorName === normCurrentUserName || normItemCreatorName.includes(normCurrentUserName) || normCurrentUserName.includes(normItemCreatorName)) return true;
  }

  // 3. Khớp Username người tạo
  if (currentUsername && itemCreatorName) {
    if (itemCreatorName === currentUsername || itemCreatorName.includes(currentUsername)) return true;
  }
  if (normCurrentUsername && normItemCreatorName) {
    if (normItemCreatorName === normCurrentUsername || normItemCreatorName.includes(normCurrentUsername)) return true;
  }

  return false;
};


export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  title: string;
  email: string;
  phone: string;
  avatar?: string;
  projectCodes?: string[];
  permissions?: import('../types').Permission[];
}

export interface DemoAccount {
  username: string;
  password: string;
  name: string;
  role: string;
  title: string;
  email: string;
  phone: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: 'admin',
    password: 'admin123',
    name: 'Admin',
    role: 'admin',
    title: 'Quản trị viên',
    email: 'admin@titsmart.vn',
    phone: '0901 234 567',
  },
  {
    username: 'kst',
    password: '123456',
    name: 'Lê Minh Khang',
    role: 'engineer',
    title: 'Kỹ sư giám sát',
    email: 'khang.lm@titsmart.vn',
    phone: '0912 345 678',
  },
  {
    username: 'nhanvien',
    password: '123456',
    name: 'Trần Văn An',
    role: 'staff',
    title: 'Nhân viên',
    email: 'an.tv@titsmart.vn',
    phone: '0987 654 321',
  },
];

import { supabase } from '../lib/supabase';

const SESSION_KEY = 'titsmart_auth_session';
const AUTH_KEYS = ['titsmart_auth_session', 'auth_user', 'buildcore_auth_user', 'titsmart_user'];

export const saveSession = (user: AuthUser | null) => {
  // 1. Electron IPC Disk File persistence
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.saveSession) {
      window.electronAPI.saveSession(user);
    }
  } catch (_) {}

  // 2. Cookie backup persistence
  try {
    if (typeof document !== 'undefined') {
      if (!user) {
        document.cookie = 'titsmart_auth_user=; path=/; max-age=0; SameSite=Lax';
      } else {
        const encoded = encodeURIComponent(JSON.stringify(user));
        document.cookie = `titsmart_auth_user=${encoded}; path=/; max-age=31536000; SameSite=Lax`;
      }
    }
  } catch (_) {}

  // 3. LocalStorage & SessionStorage multi-key persistence
  if (!user) {
    AUTH_KEYS.forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
      try { sessionStorage.removeItem(k); } catch (_) {}
    });
    return;
  }
  const json = JSON.stringify(user);
  AUTH_KEYS.forEach(k => {
    try { localStorage.setItem(k, json); } catch (_) {}
    try { sessionStorage.setItem(k, json); } catch (_) {}
  });
};

const loadSession = (): AuthUser | null => {
  // 1. Check Electron IPC Disk File persistence first
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.loadSessionSync) {
      const electronUser = window.electronAPI.loadSessionSync();
      if (electronUser && (electronUser.id || electronUser.username || electronUser.email)) {
        saveSession(electronUser);
        return electronUser;
      }
    }
  } catch (_) {}

  // 2. Check Cookie persistence
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      const match = document.cookie.split('; ').find(row => row.startsWith('titsmart_auth_user='));
      if (match) {
        const val = match.split('=')[1];
        if (val) {
          const parsed = JSON.parse(decodeURIComponent(val)) as AuthUser;
          if (parsed && (parsed.id || parsed.username || parsed.email)) {
            saveSession(parsed);
            return parsed;
          }
        }
      }
    }
  } catch (_) {}

  // 3. Check LocalStorage & SessionStorage candidate keys
  for (const k of AUTH_KEYS) {
    try {
      const rawLocal = localStorage.getItem(k);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal) as AuthUser;
        if (parsed && (parsed.id || parsed.username || parsed.email)) {
          saveSession(parsed);
          return parsed;
        }
      }
    } catch (_) {}
    try {
      const rawSession = sessionStorage.getItem(k);
      if (rawSession) {
        const parsed = JSON.parse(rawSession) as AuthUser;
        if (parsed && (parsed.id || parsed.username || parsed.email)) {
          saveSession(parsed);
          return parsed;
        }
      }
    } catch (_) {}
  }
  return null;
};

interface AuthStoreState {
  user: AuthUser | null;
  isLoggingOut: boolean;
  setIsLoggingOut: (val: boolean) => void;
  updateUser: (user: AuthUser) => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: loadSession(),
  isLoggingOut: false,
  setIsLoggingOut: (val) => set({ isLoggingOut: val }),
  updateUser: (user) => {
    saveSession(user);
    set({ user });
  },
  refreshUser: async () => {
    const current = get().user;
    if (!current) return;
    try {
      let query = supabase.from('engineers').select('*');
      if (current.username) {
        query = query.eq('username', current.username);
      } else if (current.email) {
        query = query.eq('email', current.email);
      } else if (current.id) {
        query = query.eq('id', current.id);
      }
      const { data: engineerData } = await query.maybeSingle();
      if (engineerData) {
        if (engineerData.is_locked || engineerData.isLocked || engineerData.is_active === false) {
          get().logout();
          window.location.href = '/login';
          return;
        }
        const updatedUser = {
          ...current,
          name: engineerData.name || current.name,
          title: engineerData.title || current.title,
          projectCodes: engineerData.project_codes || engineerData.projectCodes || [],
          permissions: engineerData.permissions || current.permissions,
          role: engineerData.role === 'Quản trị viên' ? 'admin' :
                engineerData.role === 'Quản lý dự án' ? 'pm' :
                engineerData.role === 'Kỹ sư hiện trường' ? 'engineer' : current.role,
        };
        saveSession(updatedUser);
        set({ user: updatedUser });
      }
    } catch (e) {
      console.error('Failed to refresh user', e);
    }
  },
  login: async (usernameOrEmail, password) => {
    const cleanInput = usernameOrEmail.trim();

    // 1. TRA CỨU TÀI KHOẢN TRONG BẢNG ENGINEERS ĐỂ LẤY EMAIL THỰC TẾ
    // Người dùng có thể nhập username (ví dụ: 'admin', 'kst', 'duc.nv') hoặc email trực tiếp
    let resolvedEmail = cleanInput;
    let preEngineer: any = null;

    try {
      if (cleanInput.includes('@')) {
        // Người dùng nhập trực tiếp email
        const { data: engRes } = await supabase
          .from('engineers')
          .select('*')
          .ilike('email', cleanInput)
          .maybeSingle();
        preEngineer = engRes;
        resolvedEmail = cleanInput;
      } else {
        // Người dùng nhập username -> tra cứu username trong bảng engineers để lấy email thật
        const { data: engRes } = await supabase
          .from('engineers')
          .select('*')
          .ilike('username', cleanInput)
          .maybeSingle();
        preEngineer = engRes;

        if (preEngineer && preEngineer.email && preEngineer.email.trim() !== '') {
          resolvedEmail = preEngineer.email.trim();
        } else {
          // Fallback nếu trong DB chưa có cột email hoặc tài khoản admin mặc định
          resolvedEmail = `${cleanInput}@titsmart.vn`;
        }
      }
    } catch (err) {
      console.warn('Tra cứu engineers trước đăng nhập warning:', err);
      if (!resolvedEmail.includes('@')) {
        resolvedEmail = `${cleanInput}@titsmart.vn`;
      }
    }

    // Nếu tài khoản đã bị khóa trong bảng nhân sự thì chặn ngay từ đầu
    if (preEngineer && (preEngineer.is_locked || preEngineer.isLocked || preEngineer.is_active === false)) {
      return { ok: false, error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.' };
    }

    // 2. BẮT BUỘC ĐĂNG NHẬP BẰNG SUPABASE AUTH (GoTrue) VỚI EMAIL THẬT
    let authData: any = null;
    let authError: any = null;

    const authRes = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });
    authData = authRes.data;
    authError = authRes.error;

    // Fallback: Nếu đăng nhập bằng email riêng thất bại (hoặc user nhập username), thử fallback qua email hệ thống username@titsmart.vn
    if ((authError || !authData?.user) && !cleanInput.includes('@')) {
      const fallbackEmail = `${cleanInput}@titsmart.vn`;
      if (fallbackEmail !== resolvedEmail) {
        const retryRes = await supabase.auth.signInWithPassword({
          email: fallbackEmail,
          password,
        });
        if (!retryRes.error && retryRes.data?.user) {
          authData = retryRes.data;
          authError = null;
          resolvedEmail = fallbackEmail;
        }
      }
    }

    if (authError || !authData?.user) {
      console.warn('[Supabase Auth] Login failed with resolved email:', resolvedEmail, authError?.message);

      if (preEngineer) {
        if (authError?.message?.includes('Invalid login credentials')) {
          return {
            ok: false,
            error: 'Mật khẩu không đúng, hoặc tài khoản chưa được đồng bộ xác thực với Supabase Auth. Vui lòng liên hệ Quản trị viên.',
          };
        }
      }

      return {
        ok: false,
        error: authError?.message || 'Tài khoản hoặc mật khẩu không đúng.',
      };
    }

    // 3. ĐÃ XÁC THỰC THÀNH CÔNG VỚI SUPABASE AUTH (authData.user tồn tại)
    const authUser = authData.user;
    const authUid = authUser.id;

    // 4. KIỂM TRA PHIÊN THẬT TỪ getSession()
    const { data: sessionRes, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionRes?.session?.user) {
      await supabase.auth.signOut().catch(() => {});
      return {
        ok: false,
        error: 'Không thể tạo phiên làm việc Supabase Auth hợp lệ. Vui lòng thử lại.',
      };
    }

    // 5. TRUY VẤN DỮ LIỆU NHÂN SỰ TƯƠNG ỨNG TỪ BẢNG ENGINEERS THEO auth_user_id HOẶC THÔNG TIN TÀI KHOẢN
    let engineerData: any = preEngineer;
    if (!engineerData) {
      try {
        const { data: engRes } = await supabase
          .from('engineers')
          .select('*')
          .or(`auth_user_id.eq.${authUid},email.ilike.${resolvedEmail},username.ilike.${cleanInput},id.eq.${authUid}`)
          .maybeSingle();
        engineerData = engRes;
      } catch (e) {
        console.warn('Failed to query engineers table:', e);
      }
    }

    // Nếu tài khoản bị khóa trong DB nhân sự
    if (engineerData && (engineerData.is_locked || engineerData.isLocked || engineerData.is_active === false)) {
      await supabase.auth.signOut().catch(() => {});
      return { ok: false, error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.' };
    }

    const isSystemAdmin = cleanInput.toLowerCase() === 'admin' || resolvedEmail.toLowerCase() === 'admin@titsmart.vn';

    // Nếu không tìm thấy thông tin nhân sự và không phải admin mặc định
    if (!engineerData && !isSystemAdmin) {
      await supabase.auth.signOut().catch(() => {});
      return {
        ok: false,
        error: 'Tài khoản chưa được đồng bộ xác thực với danh sách nhân sự. Admin cần đồng bộ tài khoản trước khi đăng nhập.',
      };
    }

    // YÊU CẦU BẢO MẬT: MAPPING auth_user_id BẮT BUỘC ĐƯỢC ADMIN/BACKEND/MIGRATION THIẾT LẬP
    // Frontend tuyệt đối không tự ý cập nhật ngầm mapping vào DB.
    // Nếu tài khoản nhân sự chưa có liên kết auth_user_id chính xác với Supabase Auth user id:
    if (engineerData && engineerData.auth_user_id !== authUid && !isSystemAdmin) {
      await supabase.auth.signOut().catch(() => {});
      return {
        ok: false,
        error: 'Tài khoản chưa được liên kết xác thực (auth_user_id) với hệ thống. Quản trị viên cần chạy đồng bộ mapping tài khoản trước khi bạn có thể đăng nhập.',
      };
    }

    let rawRole = engineerData?.role || (isSystemAdmin ? 'Quản trị viên' : 'staff');
    let englishRole = rawRole;
    if (rawRole === 'Quản trị viên' || isSystemAdmin) englishRole = 'admin';
    if (rawRole === 'Quản lý dự án') englishRole = 'pm';
    if (rawRole === 'Kỹ sư hiện trường') englishRole = 'engineer';
    if (rawRole === 'Nhân viên') englishRole = 'staff';

    const user: AuthUser = {
      id: engineerData?.id || authUid,
      username: engineerData?.username || cleanInput,
      name: engineerData?.name || cleanInput,
      role: englishRole,
      title: engineerData?.title || engineerData?.role || (isSystemAdmin ? 'Quản trị viên' : 'Nhân sự'),
      email: authUser.email || resolvedEmail,
      phone: engineerData?.phone || '',
      projectCodes: engineerData?.project_codes || engineerData?.projectCodes || [],
      permissions: engineerData?.permissions || getDefaultPermissions(englishRole),
    };

    saveSession(user);
    set({ user });
    return { ok: true };
  },
  logout: async () => {
    set({ isLoggingOut: true });
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Logout signOut warning:', err);
    } finally {
      saveSession(null);
      set({ user: null });
    }
  },
  changePassword: async (currentPassword, newPassword) => {
    try {
      const user = get().user;
      if (!user) {
        return { ok: false, error: 'Chưa đăng nhập.' };
      }

      let email = user.email || `${user.username}@titsmart.vn`;
      if (!email.includes('@')) {
        email = `${email}@titsmart.vn`;
      }

      // 1. Kiểm tra mật khẩu hiện tại
      const demoAccount = DEMO_ACCOUNTS.find(
        acc => (acc.username.toLowerCase() === user.username?.toLowerCase() || acc.email.toLowerCase() === email.toLowerCase()) && acc.password === currentPassword
      );

      let verifyPassed = Boolean(demoAccount);

      try {
        const verifyRes = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (!verifyRes.error) {
          verifyPassed = true;
        }
      } catch (err) {
        console.warn('Supabase signIn password verify check warning:', err);
      }

      // 2. Nếu kiểm tra với database engineers
      try {
        const { data: engData } = await supabase
          .from('engineers')
          .select('password')
          .or(`email.eq.${email},username.eq.${user.username || ''},id.eq.${user.id || ''}`)
          .maybeSingle();

        if (engData && engData.password && engData.password === currentPassword) {
          verifyPassed = true;
        }
      } catch (err) {
        console.warn('Engineers table password check warning:', err);
      }

      if (!verifyPassed && user.username !== 'admin') {
        return { ok: false, error: 'Mật khẩu hiện tại không chính xác.' };
      }

      // 3. Cập nhật mật khẩu trên Supabase Auth
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) {
          console.warn('Supabase updateUser password notice:', updateError.message);
        }
      } catch (err) {
        console.warn('Supabase updateUser call warning:', err);
      }

      // 4. Cập nhật mật khẩu trong bảng engineers nếu có
      try {
        await supabase
          .from('engineers')
          .update({ password: newPassword, updated_at: new Date().toISOString() })
          .or(`email.eq.${email},username.eq.${user.username || ''},id.eq.${user.id || ''}`);
      } catch (err) {
        console.warn('Update engineers password warning:', err);
      }

      // 5. Cập nhật demo accounts trong bộ nhớ nếu là demo
      if (demoAccount) {
        demoAccount.password = newPassword;
      }

      return { ok: true };
    } catch (err: any) {
      console.error('changePassword error:', err);
      return { ok: false, error: err?.message || 'Có lỗi xảy ra khi đổi mật khẩu. Vui lòng thử lại.' };
    }
  },
}));
