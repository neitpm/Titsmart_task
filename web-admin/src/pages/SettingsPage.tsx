import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, isSystemAdmin, isExecutiveOrAdmin, hasPermission } from '../services/authStore';
import { useUIStore } from '../services/uiStore';
import { useRoleLevelStore, CustomRoleLevel, DEFAULT_ROLE_LEVELS } from '../services/roleLevelStore';
import { useRealtimeStore } from '../services/realtimeStore';
import { uploadAttachment } from '../utils/fileUploadHelper';
import { Permission } from '../types';
import { ChangePasswordModal } from '../components/common/ChangePasswordModal';
import { Toast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import { registerWebDeviceToken } from '../services/notificationDispatchService';
import { requestSystemNotificationPermission, sendSystemNotification } from '../services/systemNotificationService';
import { exportToStyledExcel } from '../utils/excelExportUtils';

type SettingsTab = 'general' | 'roles' | 'appearance' | 'notifications' | 'activity_logs' | 'account';

const ALL_PERMISSION_GROUPS: {
  title: string;
  items: { key: Permission; label: string }[];
}[] = [
  {
    title: 'Dự án & Tổng quan',
    items: [
      { key: 'VIEW_PROJECTS', label: 'Xem danh sách dự án' },
      { key: 'CREATE_PROJECTS', label: 'Tạo dự án mới' },
      { key: 'EDIT_PROJECTS', label: 'Sửa thông tin dự án' },
      { key: 'DELETE_PROJECTS', label: 'Xóa dự án' },
    ]
  },
  {
    title: 'Tiến độ công việc',
    items: [
      { key: 'VIEW_TASKS', label: 'Xem tiến độ' },
      { key: 'IMPORT_TASKS', label: 'Nhập Excel/OCR' },
      { key: 'EDIT_TASKS', label: 'Thêm/Sửa/Xóa công việc' },
      { key: 'ASSIGN_TASKS', label: 'Giao việc' },
      { key: 'UPDATE_TASK_PROGRESS', label: 'Cập nhật % và Trạng thái' },
      { key: 'APPROVE_TASKS', label: 'Nghiệm thu công việc' },
      { key: 'VIEW_FIELD_LOGS', label: 'Xem nhật ký công trường' },
      { key: 'MANAGE_FIELD_LOGS', label: 'Cập nhật nhật ký công trường' },
    ]
  },
  {
    title: 'Kế hoạch vật tư',
    items: [
      { key: 'VIEW_MATERIALS', label: 'Xem danh sách vật tư' },
      { key: 'IMPORT_MATERIALS', label: 'Nhập Excel vật tư' },
      { key: 'EDIT_MATERIALS', label: 'Sửa/Xóa vật tư' },
      { key: 'UPDATE_MATERIAL_STATUS', label: 'Cập nhật trạng thái' },
      { key: 'MANAGE_INVENTORY', label: 'Nhập/Xuất/Chuyển kho' },
    ]
  },
  {
    title: 'Tài chính & Hợp đồng',
    items: [
      { key: 'VIEW_FINANCE', label: 'Xem bảng giá' },
      { key: 'EDIT_PRICES', label: 'Cập nhật giá, VAT' },
      { key: 'VIEW_PAYMENTS', label: 'Xem Kế hoạch thanh toán' },
      { key: 'EDIT_PAYMENTS', label: 'Cập nhật thanh toán' },
      { key: 'VIEW_EXPENSES', label: 'Xem chi phí công trình' },
      { key: 'EDIT_EXPENSES', label: 'Quản lý chi phí công trình' },
    ]
  },
  {
    title: 'Nhân sự & Hệ thống',
    items: [
      { key: 'VIEW_USERS', label: 'Xem nhân sự' },
      { key: 'EDIT_USERS', label: 'Chỉnh sửa nhân sự' },
      { key: 'MANAGE_USERS', label: 'Quản lý nhân sự' },
      { key: 'MANAGE_PERMISSIONS', label: 'Cấp quyền hệ thống' },
      { key: 'MANAGE_PAYROLL', label: 'Bảng chấm công' },
      { key: 'APPROVE_LEAVE_STEP1', label: 'Duyệt phép Cấp 1' },
      { key: 'APPROVE_LEAVE_FINAL', label: 'Duyệt phép Cấp 2 (Ban GĐ)' },
      { key: 'EXPORT_DATA', label: 'Xuất báo cáo (Excel/PDF)' },
      { key: 'VIEW_ACTIVITY_LOG', label: 'Xem lịch sử hoạt động' },
    ]
  },
  {
    title: 'Hồ sơ & Tài liệu',
    items: [
      { key: 'VIEW_PROJECT_DIAGRAM', label: 'Xem Thư viện' },
      { key: 'MANAGE_PROJECT_DIAGRAM', label: 'Chỉnh sửa Thư viện' },
      { key: 'VIEW_DOCUMENTS', label: 'Xem hồ sơ & chứng từ' },
      { key: 'CREATE_DOCUMENTS', label: 'Thêm mới hồ sơ gửi đi' },
      { key: 'EDIT_DOCUMENTS', label: 'Cập nhật thông tin & tình trạng ký' },
      { key: 'DELETE_DOCUMENTS', label: 'Xóa hồ sơ' },
      { key: 'MANAGE_DOCUMENTS', label: 'Toàn quyền quản lý hồ sơ' },
    ]
  }
];

// Activity log helpers
const parseDateKey = (timestamp: string): string => {
  const value = (timestamp || '').trim();
  if (!value) return 'unknown';
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString().split('T')[0];
  const parts = value.split(' ');
  const datePart = parts.length > 1 ? parts[1] : parts[0];
  const [d, m, y] = datePart.split('/');
  if (y && m && d) return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return 'unknown';
};

const formatDateLabel = (dateKey: string): string => {
  if (dateKey === 'unknown') return 'Không xác định';
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateKey === today) return 'Hôm nay';
  if (dateKey === yesterday) return 'Hôm qua';
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
};

const parseTime = (timestamp: string): string => {
  const value = (timestamp || '').trim();
  if (!value) return '';
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const parts = value.split(' ');
  return parts.length > 1 ? parts[0] : value;
};

const isTechnicalSystemLog = (action?: string): boolean => {
  const text = String(action || '').trim().toLowerCase();
  if (!text.startsWith('{')) return false;
  return (
    text.includes('device_id') ||
    text.includes('push_subscription') ||
    text.includes('user_agent') ||
    text.includes('webdevice_')
  );
};

type ActivityModule = 'all' | 'tasks' | 'attendance' | 'expenses' | 'field_logs' | 'library' | 'inventory' | 'documents';

const getActivityModule = (action?: string): Exclude<ActivityModule, 'all'> => {
  const text = String(action || '').toLowerCase();
  if (text.includes('chấm công') || text.includes('nghỉ phép') || text.includes('vào ca') || text.includes('ra ca')) return 'attendance';
  if (text.includes('chi phí') || text.includes('cấp quỹ') || text.includes('phiếu chi') || text.includes('thanh toán') || text.includes('bảng lương')) return 'expenses';
  if (text.includes('nhật ký hiện trường')) return 'field_logs';
  if (text.includes('thư viện') || text.includes('bản vẽ') || text.includes('hình ảnh thư viện')) return 'library';
  if (text.includes('kho') || text.includes('tồn kho') || text.includes('vật tư')) return 'inventory';
  if (text.includes('hồ sơ') || text.includes('chứng từ') || text.includes('tài liệu')) return 'documents';
  return 'tasks';
};

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  // Cho phép Admin kỹ thuật, Ban Giám đốc hoặc tài khoản có quyền phân quyền truy cập tab Phân quyền & Cấp bậc
  const canManageRoles = isExecutiveOrAdmin(user) || hasPermission(user, 'MANAGE_PERMISSIONS');
  const isAdmin = isSystemAdmin(user) || canManageRoles;
  const canViewLogs = isExecutiveOrAdmin(user) || hasPermission(user, 'VIEW_ACTIVITY_LOG');

  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);

  const handleLogout = async () => {
    setIsConfirmLogoutOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [toastState, setToastState] = useState({ show: false, message: '', type: 'success' as 'success' | 'info' | 'warning' | 'error' });

  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setToastState({ show: true, message, type });
    setTimeout(() => setToastState({ show: false, message: '', type: 'success' }), 3000);
  };

  // UI Store branding & interface
  const {
    companyName,
    companySlogan,
    companyLogo,
    saveBrandingToCloud,
    sidebarShowToggleButton,
    sidebarHoverToExpand,
    setSidebarShowToggleButton,
    setSidebarHoverToExpand,
    showNotificationBell,
    setShowNotificationBell,
    autoShowNotificationPopup,
    setAutoShowNotificationPopup,
    showChatWidget,
    setShowChatWidget,
  } = useUIStore();

  const [inputCompanyName, setInputCompanyName] = useState(companyName || 'TITSMART');
  const [inputCompanySlogan, setInputCompanySlogan] = useState(companySlogan || 'Project Manager');
  const [inputCompanyLogo, setInputCompanyLogo] = useState<string | null>(companyLogo || null);
  const [savingBranding, setSavingBranding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Role Level Store
  const { levels, fetchLevelsFromCloud, addLevel, updateLevel, deleteLevel } = useRoleLevelStore();
  const [activeLevelId, setActiveLevelId] = useState<string>('level1');
  const [isEditingLevel, setIsEditingLevel] = useState(false);
  const [isCreatingLevel, setIsCreatingLevel] = useState(false);

  const [formLevelName, setFormLevelName] = useState('');
  const [formLevelDesc, setFormLevelDesc] = useState('');
  const [formLevelRole, setFormLevelRole] = useState('');
  const [formLevelPerms, setFormLevelPerms] = useState<Permission[]>([]);
  const [savingLevel, setSavingLevel] = useState(false);

  // Password & Push
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isPushRegistered, setIsPushRegistered] = useState<boolean>(() => {
    try {
      return localStorage.getItem('titsmart_push_enabled') === 'true' || (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted');
    } catch {
      return false;
    }
  });
  const [isRegisteringPush, setIsRegisteringPush] = useState(false);

  // Activity Logs Store & State
  const activityLogs = useRealtimeStore(state => state.activityLogs);
  const projects = useRealtimeStore(state => state.projects);
  const fetchActivityLogs = useRealtimeStore(state => state.fetchActivityLogs);

  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logModuleFilter, setLogModuleFilter] = useState<ActivityModule>('all');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [selectedDetailLog, setSelectedDetailLog] = useState<any | null>(null);

  useEffect(() => {
    fetchLevelsFromCloud();
    if (canViewLogs) {
      fetchActivityLogs();
    }
  }, [fetchLevelsFromCloud, canViewLogs]);

  useEffect(() => {
    setInputCompanyName(companyName || 'TITSMART');
    setInputCompanySlogan(companySlogan || 'Project Manager');
    setInputCompanyLogo(companyLogo || null);
  }, [companyName, companySlogan, companyLogo]);

  const currentLevel = levels.find((l) => l.id === activeLevelId) || levels[0] || DEFAULT_ROLE_LEVELS[0];

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      triggerToast('Chỉ Quản trị viên (Admin) mới có quyền đổi logo công ty!', 'warning');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      triggerToast('Ảnh logo không được vượt quá 5MB!', 'warning');
      return;
    }

    try {
      const uploadRes = await uploadAttachment(file, 'company_branding');
      if (uploadRes && uploadRes.url) {
        setInputCompanyLogo(uploadRes.url);
        triggerToast('Tải ảnh logo lên đám mây thành công!', 'success');
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) setInputCompanyLogo(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBranding = async () => {
    if (!isAdmin) {
      triggerToast('Chỉ Quản trị viên mới có quyền cập nhật thông tin thương hiệu!', 'warning');
      return;
    }
    setSavingBranding(true);
    try {
      await saveBrandingToCloud({
        companyName: inputCompanyName.trim() || 'TITSMART',
        companySlogan: inputCompanySlogan.trim() || 'Project Manager',
        companyLogo: inputCompanyLogo,
        updatedBy: user?.username || 'Admin',
      });
      triggerToast('Đã lưu thông tin thương hiệu công ty thành công!', 'success');
    } catch (err: any) {
      triggerToast(`Lỗi khi lưu cài đặt: ${err?.message || err}`, 'error');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleStartCreateLevel = () => {
    setIsCreatingLevel(true);
    setIsEditingLevel(false);
    const nextNum = levels.length + 1;
    setFormLevelName(`Cấp ${nextNum} - `);
    setFormLevelDesc('');
    setFormLevelRole('');
    setFormLevelPerms([
      'VIEW_PROJECTS',
      'VIEW_TASKS', 'UPDATE_TASK_PROGRESS', 'VIEW_FIELD_LOGS', 'MANAGE_FIELD_LOGS',
      'VIEW_MATERIALS', 'UPDATE_MATERIAL_STATUS',
      'VIEW_USERS',
      'VIEW_PROJECT_DIAGRAM', 'VIEW_DOCUMENTS'
    ]);
  };

  const handleStartEditLevel = (lvl: CustomRoleLevel) => {
    setIsCreatingLevel(false);
    setIsEditingLevel(true);
    setFormLevelName(lvl.name);
    setFormLevelDesc(lvl.description || '');
    setFormLevelRole(lvl.defaultRoleName || '');
    setFormLevelPerms([...lvl.permissions]);
  };

  const handleSaveRoleLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLevelName.trim()) return;

    setSavingLevel(true);
    try {
      if (isCreatingLevel) {
        const created = await addLevel({
          name: formLevelName.trim(),
          description: formLevelDesc.trim(),
          defaultRoleName: formLevelRole.trim(),
          permissions: formLevelPerms
        }, user?.username || 'Admin');
        setActiveLevelId(created.id);
        triggerToast(`Đã thêm mới "${created.name}" thành công!`, 'success');
      } else if (isEditingLevel && currentLevel) {
        await updateLevel(currentLevel.id, {
          name: formLevelName.trim(),
          description: formLevelDesc.trim(),
          defaultRoleName: formLevelRole.trim(),
          permissions: formLevelPerms
        }, user?.username || 'Admin');
        triggerToast(`Đã cập nhật cấp "${formLevelName.trim()}" thành công!`, 'success');
      }
      setIsCreatingLevel(false);
      setIsEditingLevel(false);
    } catch (err: any) {
      triggerToast(`Lỗi: ${err.message || err}`, 'error');
    } finally {
      setSavingLevel(false);
    }
  };

  const handleDeleteRoleLevel = async (lvl: CustomRoleLevel) => {
    if (lvl.isBuiltin) {
      triggerToast('Không thể xóa các cấp mặc định của hệ thống.', 'warning');
      return;
    }
    try {
      await deleteLevel(lvl.id, user?.username || 'Admin');
      setActiveLevelId(levels[0]?.id || 'level1');
      triggerToast(`Đã xóa "${lvl.name}"`, 'success');
    } catch (err: any) {
      triggerToast(`Lỗi: ${err.message || err}`, 'error');
    }
  };

  const handleTogglePushNotifications = async (enable: boolean) => {
    if (!enable) {
      setIsPushRegistered(false);
      localStorage.setItem('titsmart_push_enabled', 'false');
      triggerToast('Đã tắt nhận chuông điện thoại khi tắt app trên thiết bị này.', 'info');
      return;
    }

    setIsRegisteringPush(true);
    try {
      await requestSystemNotificationPermission();
      const ok = await registerWebDeviceToken(user?.id, user?.username);
      if (ok) {
        setIsPushRegistered(true);
        localStorage.setItem('titsmart_push_enabled', 'true');
        sendSystemNotification({
          title: 'Đã kích hoạt thông báo đẩy!',
          body: 'Điện thoại của bạn giờ đây sẽ nhận được chuông và thông báo ngay cả khi tắt ứng dụng.',
        });
        triggerToast('Đã kích hoạt chuông điện thoại khi tắt app thành công!', 'success');
      } else {
        triggerToast('Vui lòng cấp quyền thông báo trong Cài đặt của máy!', 'warning');
      }
    } catch {
      triggerToast('Lỗi khi kích hoạt thông báo đẩy!', 'error');
    } finally {
      setIsRegisteringPush(false);
    }
  };

  // Filtered activity logs
  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      if (isTechnicalSystemLog(log.action)) return false;
      if (logModuleFilter !== 'all' && getActivityModule(log.action) !== logModuleFilter) return false;

      const dateKey = parseDateKey(log.timestamp);
      if (logDateFrom && dateKey !== 'unknown' && dateKey < logDateFrom) return false;
      if (logDateTo && dateKey !== 'unknown' && dateKey > logDateTo) return false;

      if (logSearchQuery.trim()) {
        const query = logSearchQuery.toLowerCase();
        const actionMatch = (log.action || '').toLowerCase().includes(query);
        const userMatch = (log.user || '').toLowerCase().includes(query);
        const projectMatch = (log.project || '').toLowerCase().includes(query);
        if (!actionMatch && !userMatch && !projectMatch) return false;
      }
      return true;
    });
  }, [activityLogs, logModuleFilter, logDateFrom, logDateTo, logSearchQuery]);

  const handleExportLogs = async () => {
    if (filteredLogs.length === 0) {
      triggerToast('Không có dữ liệu nhật ký để xuất!', 'warning');
      return;
    }
    const data = filteredLogs.map((log, idx) => ({
      'STT': idx + 1,
      'Thời gian': log.timestamp,
      'Nhân sự thực hiện': log.user || 'Hệ thống',
      'Dự án liên quan': log.project || 'Toàn hệ thống',
      'Hành động chi tiết': log.action || ''
    }));

    await exportToStyledExcel({
      fileName: `Nhat_ky_hoat_dong_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'NhatKy',
      title: 'BÁO CÁO NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG',
      data
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-full bg-slate-50 relative overflow-hidden">
      {/* Top Header Bar synchronized pl-3 */}
      <section className="bg-white border-b border-slate-200 pl-3 pr-14 md:pr-16 h-12 flex items-center shadow-sm shrink-0">
        <h2 className="page-title text-base md:text-lg font-extrabold text-slate-900 border-l-4 border-primary pl-2 uppercase tracking-wide">
          CÀI ĐẶT HỆ THỐNG
        </h2>
      </section>

      {/* Main SaaS Settings Layout (Left Nav + Right Content) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Settings Sidebar */}
        <aside className="w-56 md:w-64 bg-white border-r border-slate-200 p-3 flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                Cấu hình hệ thống
              </div>
              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                    activeTab === 'general'
                      ? 'bg-blue-50 text-primary border border-blue-200/80 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">domain</span>
                  <span>Thông tin & Thương hiệu</span>
                </button>

                {/* Tab Phân quyền & Cấp bậc: Chỉ hiển thị cho Admin / Ban Giám đốc */}
                {canManageRoles && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('roles')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                      activeTab === 'roles'
                        ? 'bg-blue-50 text-primary border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">settings_accessibility</span>
                    <span>Phân quyền & Cấp bậc</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('appearance')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                    activeTab === 'appearance'
                      ? 'bg-blue-50 text-primary border border-blue-200/80 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">palette</span>
                  <span>Giao diện thanh điều hướng</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                    activeTab === 'notifications'
                      ? 'bg-blue-50 text-primary border border-blue-200/80 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">notifications</span>
                  <span>Thông báo & Chuông</span>
                </button>
              </nav>
            </div>

            {/* Dữ liệu & Nhật ký */}
            {canViewLogs && (
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                  Dữ liệu & Giám sát
                </div>
                <nav className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('activity_logs')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                      activeTab === 'activity_logs'
                        ? 'bg-blue-50 text-primary border border-blue-200/80 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">history</span>
                    <span>Nhật ký hoạt động</span>
                  </button>
                </nav>
              </div>
            )}

            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                Tài khoản của bạn
              </div>
              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('account')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                    activeTab === 'account'
                      ? 'bg-blue-50 text-primary border border-blue-200/80 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">account_circle</span>
                  <span>Tài khoản & Mật khẩu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsConfirmLogoutOpen(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all text-left cursor-pointer"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  <span>Đăng xuất</span>
                </button>
              </nav>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500">
            <div className="font-bold text-slate-700">{companyName}</div>
            <div className="text-[10px] text-slate-400 truncate">{companySlogan}</div>
            <div className="mt-1 font-mono text-[10px] text-primary">v{import.meta.env.VITE_APP_VERSION || '3.8.355'}</div>
          </div>
        </aside>

        {/* Right Settings Body */}
        <main className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* TAB 1: THÔNG TIN & THƯƠNG HIỆU */}
            {activeTab === 'general' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">Thông tin chung & Thương hiệu</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tùy chỉnh tên công ty, biểu trưng Logo và slogan hiển thị trên toàn bộ ứng dụng và báo cáo.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Tên công ty / Doanh nghiệp <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={inputCompanyName}
                        onChange={(e) => setInputCompanyName(e.target.value)}
                        placeholder="Ví dụ: TITSMART..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Slogan / Tiêu ngữ công ty
                      </label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={inputCompanySlogan}
                        onChange={(e) => setInputCompanySlogan(e.target.value)}
                        placeholder="Ví dụ: Project Manager..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Logo Preview and Upload */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Logo thương hiệu
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-2 shadow-2xs overflow-hidden shrink-0">
                        <img
                          src={inputCompanyLogo || './logo.png'}
                          alt="Logo Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="space-y-1.5">
                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm text-primary">upload</span>
                              <span>Tải lên logo</span>
                            </button>
                            {inputCompanyLogo && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInputCompanyLogo(null);
                                  triggerToast('Đã khôi phục logo mặc định!', 'info');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                                <span>Khôi phục mặc định</span>
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-[11px] text-slate-400">
                          Định dạng PNG, JPG, SVG trong suốt. Kích thước tối đa 5MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                      <button
                        type="button"
                        disabled={savingBranding}
                        onClick={handleSaveBranding}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-blue-800 disabled:opacity-50 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        {savingBranding ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">save</span>
                        )}
                        <span>{savingBranding ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CẤU HÌNH CẤP PHÂN QUYỀN (Roles & Permissions) */}
            {activeTab === 'roles' && isAdmin && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-extrabold text-slate-900">Phân quyền & Cấp bậc hệ thống</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cấu hình các cấp độ quản trị (Cấp 1, Cấp 2, Kế toán, Kho...) và bộ quyền chi tiết cho từng cấp.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartCreateLevel}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-blue-800 shadow-xs transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Thêm cấp mới</span>
                  </button>
                </div>

                {/* Level Manager Container */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col md:flex-row min-h-[500px]">
                  {/* Left List of Levels */}
                  <div className="w-full md:w-64 border-r border-slate-200 bg-slate-50/70 p-3 space-y-2 shrink-0">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2">
                      Danh mục Cấp độ ({levels.length})
                    </div>
                    <div className="space-y-1.5">
                      {levels.map((lvl) => {
                        const isActive = !isCreatingLevel && lvl.id === activeLevelId;
                        return (
                          <div
                            key={lvl.id}
                            onClick={() => {
                              setIsCreatingLevel(false);
                              setIsEditingLevel(false);
                              setActiveLevelId(lvl.id);
                            }}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all group ${
                              isActive
                                ? 'bg-white border-primary/50 shadow-xs ring-1 ring-primary/20'
                                : 'bg-white/60 hover:bg-white border-slate-200/80 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary' : 'bg-slate-300'}`}></span>
                                  <span className={`text-xs font-bold truncate block ${isActive ? 'text-primary' : 'text-slate-800'}`}>
                                    {lvl.name}
                                  </span>
                                </div>
                                {lvl.defaultRoleName && (
                                  <span className="text-[10px] text-slate-500 font-medium pl-3.5 block truncate">
                                    {lvl.defaultRoleName}
                                  </span>
                                )}
                              </div>
                              {!lvl.isBuiltin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRoleLevel(lvl);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-opacity"
                                  title="Xóa cấp này"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              )}
                            </div>
                            <div className="mt-1 pl-3.5 text-[10px] text-slate-400 font-mono">
                              {lvl.permissions.length} quyền được gán
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Detail / Form */}
                  <div className="flex-1 flex flex-col bg-white overflow-hidden">
                    {isCreatingLevel || isEditingLevel ? (
                      /* EDIT/CREATE FORM */
                      <form onSubmit={handleSaveRoleLevel} className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">
                              {isCreatingLevel ? 'Thêm cấp phân quyền mới' : `Chỉnh sửa: ${currentLevel?.name}`}
                            </h3>
                            <p className="text-xs text-slate-500">Đặt tên cấp và chọn bộ quyền mặc định</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingLevel(false);
                                setIsEditingLevel(false);
                              }}
                              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="submit"
                              disabled={savingLevel || !formLevelName.trim()}
                              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-primary hover:bg-blue-800 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                            >
                              {savingLevel ? 'Đang lưu...' : 'Lưu cấp quyền'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Tên cấp phân quyền <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={formLevelName}
                              onChange={(e) => setFormLevelName(e.target.value)}
                              placeholder="VD: Cấp 4 - Kế toán..."
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Chức danh gợi ý
                            </label>
                            <input
                              type="text"
                              value={formLevelRole}
                              onChange={(e) => setFormLevelRole(e.target.value)}
                              placeholder="VD: Kế toán trưởng, Quản lý kho..."
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Mô tả phạm vi trách nhiệm
                          </label>
                          <input
                            type="text"
                            value={formLevelDesc}
                            onChange={(e) => setFormLevelDesc(e.target.value)}
                            placeholder="VD: Phụ trách hóa đơn, tạm ứng, duyệt quỹ..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>

                        {/* Checklist */}
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-700 uppercase">Quyền hạn thuộc cấp</span>
                            <button
                              type="button"
                              onClick={() => {
                                const allKeys = ALL_PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
                                if (allKeys.every((k) => formLevelPerms.includes(k))) {
                                  setFormLevelPerms([]);
                                } else {
                                  setFormLevelPerms(allKeys);
                                }
                              }}
                              className="text-xs font-bold text-primary hover:underline cursor-pointer"
                            >
                              {ALL_PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key)).every((k) => formLevelPerms.includes(k))
                                ? 'Bỏ chọn tất cả'
                                : 'Chọn tất cả'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {ALL_PERMISSION_GROUPS.map((grp) => (
                              <div key={grp.title} className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1">
                                <div className="text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 pb-1">
                                  {grp.title}
                                </div>
                                {grp.items.map((item) => {
                                  const isChecked = formLevelPerms.includes(item.key);
                                  return (
                                    <label key={item.key} className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none py-0.5">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setFormLevelPerms((prev) =>
                                            prev.includes(item.key) ? prev.filter((p) => p !== item.key) : [...prev, item.key]
                                          );
                                        }}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                      />
                                      <span className={isChecked ? 'font-semibold text-slate-800' : 'text-slate-600'}>
                                        {item.label}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </form>
                    ) : (
                      /* VIEW DETAIL */
                      currentLevel && (
                        <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto custom-scrollbar">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-slate-900">{currentLevel.name}</h3>
                                {currentLevel.isBuiltin && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">
                                    Mặc định
                                  </span>
                                )}
                              </div>
                              {currentLevel.description && (
                                <p className="text-xs text-slate-500 mt-0.5">{currentLevel.description}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStartEditLevel(currentLevel)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm text-primary">edit</span>
                              <span>Chỉnh sửa cấp</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                            <span>
                              Đang kích hoạt: <strong className="text-primary font-mono">{currentLevel.permissions.length}</strong> quyền
                            </span>
                            {currentLevel.defaultRoleName && (
                              <span>
                                Chức danh gợi ý: <strong className="text-slate-800">{currentLevel.defaultRoleName}</strong>
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {ALL_PERMISSION_GROUPS.map((grp) => {
                              const activeInGroup = grp.items.filter((i) => currentLevel.permissions.includes(i.key));
                              return (
                                <div
                                  key={grp.title}
                                  className={`p-3 rounded-xl border ${
                                    activeInGroup.length > 0 ? 'border-blue-100 bg-blue-50/20' : 'border-slate-100 bg-slate-50/30 opacity-60'
                                  } space-y-1`}
                                >
                                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-1 mb-1">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase">{grp.title}</span>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {activeInGroup.length}/{grp.items.length}
                                    </span>
                                  </div>
                                  {grp.items.map((item) => {
                                    const has = currentLevel.permissions.includes(item.key);
                                    return (
                                      <div
                                        key={item.key}
                                        className={`flex items-center gap-1.5 text-xs py-0.5 ${
                                          has ? 'text-slate-800 font-semibold' : 'text-slate-400 line-through'
                                        }`}
                                      >
                                        <span className={`material-symbols-outlined text-xs ${has ? 'text-emerald-600' : 'text-slate-300'}`}>
                                          {has ? 'check_circle' : 'cancel'}
                                        </span>
                                        <span>{item.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GIAO DIỆN THANH ĐIỀU HƯỚNG */}
            {activeTab === 'appearance' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">Giao diện thanh điều hướng</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tùy chỉnh hành vi hiển thị và tương tác của thanh menu bên trái màn hình.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl text-slate-600">side_navigation</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Chế độ thanh điều hướng (Desktop)</span>
                        <span className="text-[11px] text-slate-500">
                          {sidebarShowToggleButton
                            ? 'Đang ghim: Giữ nguyên độ rộng cố định trên màn hình máy tính.'
                            : 'Đang rê chuột: Tự động bung rộng khi rê chuột vào thanh menu.'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSidebarShowToggleButton(true);
                          setSidebarHoverToExpand(false);
                          triggerToast('Đã chuyển thanh điều hướng sang chế độ Ghim cố định', 'success');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          sidebarShowToggleButton ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Ghim
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSidebarHoverToExpand(true);
                          setSidebarShowToggleButton(false);
                          triggerToast('Đã chuyển thanh điều hướng sang chế độ Rê chuột bung menu', 'success');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          sidebarHoverToExpand ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Rê chuột
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: THÔNG BÁO & CHUÔNG */}
            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">Thông báo & Chuông điện thoại</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cấu hình nhận chuông cuộc gọi/công việc mới khi tắt ứng dụng và các tiện ích chuông trên app.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
                  {/* Row 1: Push Notifications */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl text-slate-600">notifications_active</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Chuông điện thoại khi tắt ứng dụng</span>
                        <span className="text-[11px] text-slate-500">Điện thoại vẫn đổ chuông khi có việc mới ngay cả khi tắt màn hình</span>
                      </div>
                    </div>
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePushNotifications(true)}
                        disabled={isRegisteringPush}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          isPushRegistered ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {isRegisteringPush ? '...' : 'Bật'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePushNotifications(false)}
                        disabled={isRegisteringPush}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          !isPushRegistered ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Tắt
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Bell Icon */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl text-slate-600">notifications</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Nút chuông thông báo nổi</span>
                        <span className="text-[11px] text-slate-500">Hiển thị nút chuông ở góc phải màn hình</span>
                      </div>
                    </div>
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotificationBell(true);
                          triggerToast('Đã bật nút chuông thông báo nổi', 'success');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          showNotificationBell ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Bật
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotificationBell(false);
                          triggerToast('Đã ẩn nút chuông thông báo nổi', 'info');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          !showNotificationBell ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Tắt
                      </button>
                    </div>
                  </div>

                  {/* Row 3: Auto Notification Popup */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl text-slate-600">web_stories</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Tự động hiện thông báo khi mở ứng dụng</span>
                        <span className="text-[11px] text-slate-500">Bật cửa sổ nhắc việc quan trọng khi vừa đăng nhập</span>
                      </div>
                    </div>
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAutoShowNotificationPopup(true);
                          triggerToast('Đã bật nhắc thông báo khi mở ứng dụng', 'success');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          autoShowNotificationPopup ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Bật
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAutoShowNotificationPopup(false);
                          triggerToast('Đã tắt nhắc thông báo khi mở ứng dụng', 'info');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          !autoShowNotificationPopup ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Tắt
                      </button>
                    </div>
                  </div>

                  {/* Row 4: Chat Widget */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl text-slate-600">forum</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Nút Chat nội bộ</span>
                        <span className="text-[11px] text-slate-500">Bật/tắt thanh trò chuyện trực tiếp giữa các nhân sự</span>
                      </div>
                    </div>
                    <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowChatWidget(true);
                          triggerToast('Đã bật nút Chat nội bộ', 'success');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          showChatWidget ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Bật
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowChatWidget(false);
                          triggerToast('Đã ẩn nút Chat nội bộ', 'info');
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          !showChatWidget ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Tắt
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: NHẬT KÝ HOẠT ĐỘNG */}
            {activeTab === 'activity_logs' && canViewLogs && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-extrabold text-slate-900">Nhật ký hoạt động hệ thống</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Theo dõi lịch sử thao tác của các tài khoản và nhân sự trong toàn bộ dự án.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportLogs}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-emerald-700 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm text-emerald-600">file_download</span>
                      <span>Xuất Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fetchActivityLogs();
                        triggerToast('Đã tải lại nhật ký mới nhất!', 'info');
                      }}
                      className="p-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
                      title="Làm mới"
                    >
                      <span className="material-symbols-outlined text-base">refresh</span>
                    </button>
                  </div>
                </div>

                {/* Filter Toolbar */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">search</span>
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      placeholder="Tìm hành động, nhân sự..."
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-primary focus:bg-white focus:outline-none"
                    />
                  </div>

                  <select
                    value={logModuleFilter}
                    onChange={(e) => setLogModuleFilter(e.target.value as ActivityModule)}
                    className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="all">Tất cả phân hệ</option>
                    <option value="tasks">Công việc</option>
                    <option value="attendance">Chấm công</option>
                    <option value="expenses">Chi phí</option>
                    <option value="field_logs">Nhật ký hiện trường</option>
                    <option value="library">Thư viện</option>
                    <option value="inventory">Kho</option>
                    <option value="documents">Hồ sơ</option>
                  </select>

                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 h-8 text-[11px]">
                    <span className="text-slate-400 font-bold">Từ</span>
                    <input
                      type="date"
                      value={logDateFrom}
                      onChange={(e) => setLogDateFrom(e.target.value)}
                      className="bg-transparent text-slate-700 font-medium focus:outline-none w-24 cursor-pointer"
                    />
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-400 font-bold">Đến</span>
                    <input
                      type="date"
                      value={logDateTo}
                      onChange={(e) => setLogDateTo(e.target.value)}
                      className="bg-transparent text-slate-700 font-medium focus:outline-none w-24 cursor-pointer"
                    />
                  </div>

                  {(logSearchQuery || logModuleFilter !== 'all' || logDateFrom || logDateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogSearchQuery('');
                        setLogModuleFilter('all');
                        setLogDateFrom('');
                        setLogDateTo('');
                        triggerToast('Đã xóa bộ lọc nhật ký', 'info');
                      }}
                      className="px-2.5 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                      title="Xóa bộ lọc"
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>

                {/* Logs List Container */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Tổng số: <strong className="text-primary font-mono">{filteredLogs.length}</strong> thao tác</span>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                    {filteredLogs.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-xs">
                        Không tìm thấy nhật ký hoạt động nào phù hợp.
                      </div>
                    ) : (
                      filteredLogs.map((log) => {
                        const timeStr = parseTime(log.timestamp);
                        const dateStr = parseDateKey(log.timestamp);
                        return (
                          <div
                            key={log.id}
                            onClick={() => setSelectedDetailLog(log)}
                            className="p-3 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-start justify-between gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-base">history</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs text-slate-800 font-semibold leading-relaxed break-words">
                                  {log.action}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                                  <span className="font-bold text-slate-600">{log.user || 'Hệ thống'}</span>
                                  <span>•</span>
                                  <span className="font-mono text-primary">{log.project || 'Toàn hệ thống'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[11px] font-mono font-bold text-slate-600 block">{timeStr}</span>
                              <span className="text-[10px] text-slate-400">{formatDateLabel(dateStr)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: TÀI KHOẢN & MẬT KHẨU */}
            {activeTab === 'account' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900">Tài khoản & Bảo mật</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quản lý thông tin đăng nhập và đổi mật khẩu bảo vệ tài khoản của bạn.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl border border-primary/20">
                      {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{user?.name || user?.username}</h3>
                      <p className="text-xs text-slate-500">Tên đăng nhập: <strong className="font-mono text-slate-700">{user?.username}</strong></p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-primary border border-blue-200">
                        {user?.role === 'admin' ? 'Quản trị viên (Admin)' : (user?.title || user?.role || 'Nhân viên')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl text-slate-600">lock_reset</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Đổi mật khẩu tài khoản</span>
                        <span className="text-[11px] text-slate-500">Nên cập nhật định kỳ để bảo đảm an toàn dữ liệu</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChangePasswordOpen(true)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      Đổi mật khẩu
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Log Detail Modal */}
      {selectedDetailLog && (
        <Modal
          isOpen={Boolean(selectedDetailLog)}
          onClose={() => setSelectedDetailLog(null)}
          title="Chi tiết thao tác nhật ký"
          size="md"
        >
          <div className="p-4 space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Hành động:</span>
              <div className="text-sm font-semibold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {selectedDetailLog.action}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">Nhân sự:</span>
                <span className="font-bold text-slate-800">{selectedDetailLog.user || 'Hệ thống'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 font-bold block mb-0.5">Dự án:</span>
                <span className="font-bold text-primary">{selectedDetailLog.project || 'Toàn hệ thống'}</span>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-400 font-bold block mb-0.5">Thời gian:</span>
              <span className="font-mono text-slate-700">{selectedDetailLog.timestamp}</span>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDetailLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={() => triggerToast('Đổi mật khẩu tài khoản thành công!', 'success')}
      />

      {/* Confirm Logout Modal */}
      <Modal
        isOpen={isConfirmLogoutOpen}
        onClose={() => setIsConfirmLogoutOpen(false)}
        title="Xác nhận đăng xuất"
        icon="logout"
        size="md"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Bạn có chắc chắn muốn đăng xuất?</p>
              <p className="text-xs text-slate-500 mt-0.5">Phiên làm việc hiện tại của bạn sẽ kết thúc.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsConfirmLogoutOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      <Toast
        show={toastState.show}
        message={toastState.message}
        type={toastState.type}
        onClose={() => setToastState((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
};
export default SettingsPage;
