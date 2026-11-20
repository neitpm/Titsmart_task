import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { platformAuthClient } from '../services/platformAuthClient';
import { fetchPlatformEntitlements, PlatformCompanyEntitlements } from '../services/platformEntitlements';
import { getCompanySettings, updateCompanySettings } from '../services/companySettingsService';

const apiBase = import.meta.env.VITE_PLATFORM_PROVISION_URL || 'http://127.0.0.1:55400';
const authToken = async () => (await platformAuthClient.auth.getSession()).data.session?.access_token || '';
const apiFetch = async (path: string, options?: RequestInit) => {
  const token = await authToken();
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  if (options?.headers && (options.headers as Record<string, string>)['Accept'] === 'text/csv') {
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.blob();
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `API error ${res.status}`);
  return body;
};

// ── Types ────────────────────────────────────────────────────────────────────
type Person = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  department?: string;
  position?: string;
  role: string;
  role_id?: string;
  status: string;
  joined_at?: string;
  avatar_url?: string;
  national_id?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  username?: string;
  company_roles?: { id: string; name: string; title?: string };
};

type Role = {
  id: string;
  name: string;
  title?: string;
  description?: string;
  permissions: string[];
  level: number;
  sort_order: number;
  is_active: boolean;
};

type CatalogItem = {
  id: string;
  catalog_type: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type AuditLog = {
  id: string;
  created_at: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
};

type WorkflowSettings = {
  allow_direct_fund_approval: boolean;
  allow_checker_as_approver: boolean;
  default_checker_user_id: string;
  default_approver_user_id: string;
  default_accountant_user_id: string;
};

type UiSettings = {
  navigation_config: Record<string, boolean>;
};

const ALL_PERMISSIONS = [
  { key: 'view_projects', label: 'Xem danh sách dự án', module: 'Dự án & Tổng quan' },
  { key: 'create_project', label: 'Tạo dự án mới', module: 'Dự án & Tổng quan' },
  { key: 'edit_project', label: 'Sửa thông tin dự án', module: 'Dự án & Tổng quan' },
  { key: 'delete_project', label: 'Xóa dự án', module: 'Dự án & Tổng quan' },
  { key: 'view_progress', label: 'Xem tiến độ', module: 'Tiến độ công việc' },
  { key: 'import_progress', label: 'Nhập Excel/OCR', module: 'Tiến độ công việc' },
  { key: 'manage_tasks', label: 'Thêm/Sửa/Xóa công việc', module: 'Tiến độ công việc' },
  { key: 'assign_tasks', label: 'Giao việc', module: 'Tiến độ công việc' },
  { key: 'update_progress', label: 'Cập nhật % và trạng thái', module: 'Tiến độ công việc' },
  { key: 'accept_tasks', label: 'Nghiệm thu công việc', module: 'Tiến độ công việc' },
  { key: 'view_site_diary', label: 'Xem nhật ký công trường', module: 'Tiến độ công việc' },
  { key: 'edit_site_diary', label: 'Cập nhật nhật ký công trường', module: 'Tiến độ công việc' },
  { key: 'view_materials', label: 'Xem danh sách vật tư', module: 'Kế hoạch vật tư' },
  { key: 'import_materials', label: 'Nhập Excel vật tư', module: 'Kế hoạch vật tư' },
  { key: 'manage_materials', label: 'Sửa/Xóa vật tư', module: 'Kế hoạch vật tư' },
  { key: 'update_material_status', label: 'Cập nhật trạng thái', module: 'Kế hoạch vật tư' },
  { key: 'transfer_materials', label: 'Nhập/Xuất/Chuyển kho', module: 'Kế hoạch vật tư' },
  { key: 'view_price_list', label: 'Xem bảng giá', module: 'Tài chính & Hợp đồng' },
  { key: 'edit_price_vat', label: 'Cập nhật giá, VAT', module: 'Tài chính & Hợp đồng' },
  { key: 'view_payment_plan', label: 'Xem kế hoạch thanh toán', module: 'Tài chính & Hợp đồng' },
  { key: 'update_payment', label: 'Cập nhật thanh toán', module: 'Tài chính & Hợp đồng' },
  { key: 'view_project_cost', label: 'Xem chi phí công trình', module: 'Tài chính & Hợp đồng' },
  { key: 'manage_project_cost', label: 'Quản lý chi phí công trình', module: 'Tài chính & Hợp đồng' },
  { key: 'review_fund_request', label: 'Kiểm tra yêu cầu cấp quỹ', module: 'Tài chính & Hợp đồng' },
  { key: 'approve_fund_request', label: 'Duyệt yêu cầu cấp quỹ (Lãnh đạo)', module: 'Tài chính & Hợp đồng' },
  { key: 'process_fund_transfer', label: 'Xử lý chuyển khoản cấp quỹ (Kế toán)', module: 'Tài chính & Hợp đồng' },
  { key: 'confirm_fund_received', label: 'Xác nhận đã nhận tiền cấp quỹ', module: 'Tài chính & Hợp đồng' },
  { key: 'view_people', label: 'Xem nhân sự', module: 'Nhân sự & Hệ thống' },
  { key: 'edit_people', label: 'Chỉnh sửa nhân sự', module: 'Nhân sự & Hệ thống' },
  { key: 'manage_people', label: 'Quản lý nhân sự', module: 'Nhân sự & Hệ thống' },
  { key: 'manage_system_access', label: 'Cấp quyền hệ thống', module: 'Nhân sự & Hệ thống' },
  { key: 'view_attendance', label: 'Bảng chấm công', module: 'Nhân sự & Hệ thống' },
  { key: 'approve_leave_level_1', label: 'Duyệt phép Cấp 1', module: 'Nhân sự & Hệ thống' },
  { key: 'approve_leave_level_2', label: 'Duyệt phép Cấp 2 (Ban GĐ)', module: 'Nhân sự & Hệ thống' },
  { key: 'export_reports', label: 'Xuất báo cáo (Excel/PDF)', module: 'Nhân sự & Hệ thống' },
  { key: 'view_activity_logs', label: 'Xem lịch sử hoạt động', module: 'Nhân sự & Hệ thống' },
  { key: 'view_library', label: 'Xem Thư viện', module: 'Hồ sơ & Tài liệu' },
  { key: 'edit_library', label: 'Chỉnh sửa Thư viện', module: 'Hồ sơ & Tài liệu' },
  { key: 'view_documents', label: 'Xem hồ sơ & chứng từ', module: 'Hồ sơ & Tài liệu' },
  { key: 'create_document', label: 'Thêm mới hồ sơ gửi đi', module: 'Hồ sơ & Tài liệu' },
  { key: 'update_document_status', label: 'Cập nhật thông tin & tình trạng ký', module: 'Hồ sơ & Tài liệu' },
  { key: 'delete_document', label: 'Xóa hồ sơ', module: 'Hồ sơ & Tài liệu' },
  { key: 'manage_documents', label: 'Toàn quyền quản lý hồ sơ', module: 'Hồ sơ & Tài liệu' },
  { key: 'company_admin', label: 'Toàn quyền quản trị công ty', module: 'Nhân sự & Hệ thống' },
];

const CATALOG_TYPES = [
  { key: 'project_type', label: 'Loại dự án' },
  { key: 'cost_type', label: 'Loại chi phí' },
  { key: 'material_type', label: 'Loại vật tư' },
  { key: 'document_type', label: 'Loại tài liệu' },
  { key: 'task_status', label: 'Trạng thái công việc' },
];

const NAV_MODULES = [
  { key: 'dashboard', label: 'Tổng quan (Dashboard)' },
  { key: 'projects', label: 'Dự án' },
  { key: 'people', label: 'Nhân sự' },
  { key: 'finance', label: 'Tài chính' },
  { key: 'catalog', label: 'Danh mục' },
  { key: 'reports', label: 'Báo cáo' },
  { key: 'settings', label: 'Cài đặt' },
];

type Tab = 'company' | 'people' | 'permissions' | 'catalog' | 'workflow' | 'navigation' | 'audit';
const TABS: Array<[Tab, string]> = [
  ['company', 'Công ty & Thương hiệu'],
  ['people', 'Nhân sự'],
  ['permissions', 'Phân quyền & Cấp bậc'],
  ['catalog', 'Danh mục nội bộ'],
  ['workflow', 'Quy trình duyệt'],
  ['navigation', 'Giao diện & Điều hướng'],
  ['audit', 'Nhật ký hoạt động'],
];

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Main Component ────────────────────────────────────────────────────────────
export const CompanyAdminPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PlatformCompanyEntitlements | null>(null);
  const [tab, setTab] = useState<Tab>('company');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Tab 1: Company & Brand ─────────────────────────────────────────────────
  const [brand, setBrand] = useState({ name: '', slogan: '', logo_url: '', hotline: '', contact_email: '', address: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Tab 2: People ──────────────────────────────────────────────────────────
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [newPerson, setNewPerson] = useState({ email: '', name: '', national_id: '', phone: '', address: '', emergency_contact_name: '', emergency_contact_phone: '', department: '', position: '', role_id: '', joined_at: '', username: '' });
  const [authPwd, setAuthPwd] = useState(generatePassword());
  const [provisioningId, setProvisioningId] = useState<string | null>(null);

  // ── Tab 3: Permissions ─────────────────────────────────────────────────────
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', title: '', description: '', level: 0 });
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);

  // ── Tab 4: Catalog ─────────────────────────────────────────────────────────
  const [catalogType, setCatalogType] = useState('project_type');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [newCatalog, setNewCatalog] = useState({ name: '', sort_order: 0 });
  const [editingCatalog, setEditingCatalog] = useState<string | null>(null);
  const [editCatalogName, setEditCatalogName] = useState('');

  // ── Tab 5: Workflow ────────────────────────────────────────────────────────
  const [workflow, setWorkflow] = useState<WorkflowSettings>({
    allow_direct_fund_approval: false,
    allow_checker_as_approver: false,
    default_checker_user_id: '',
    default_approver_user_id: '',
    default_accountant_user_id: '',
  });

  // ── Tab 6: UI/Navigation ───────────────────────────────────────────────────
  const [uiSettings, setUiSettings] = useState<UiSettings>({ navigation_config: {} });

  // ── Tab 7: Audit Logs ──────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState({ resource_type: '', from: '', to: '' });
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const AUDIT_LIMIT = 20;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showMsg = (msg: string, type: 'ok' | 'err' = 'ok') => { setMessage(msg); setMsgType(type); };

  const postAuditLog = useCallback(async (
    companyId: string,
    action: string,
    resource_type: string,
    resource_id?: string,
    metadata?: Record<string, unknown>
  ) => {
    try {
      await apiFetch(`/api/v1/companies/${companyId}/audit-logs`, {
        method: 'POST',
        body: JSON.stringify({ action, resource_type, resource_id, metadata }),
      });
    } catch {
      // audit log failure is non-fatal
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    platformAuthClient.auth.getUser().then(async ({ data: result, error: authError }) => {
      if (authError || !result.user?.email) { setLoading(false); return; }
      try {
        const entitlements = await fetchPlatformEntitlements({ email: result.user.email });
        setData(entitlements);
        const settings = await getCompanySettings(entitlements.companyId);
        setBrand({
          name: settings.name || entitlements.company.name,
          slogan: settings.slogan || '',
          logo_url: settings.logo_url || '',
          hotline: settings.hotline || '',
          contact_email: settings.contact_email || '',
          address: settings.address || '',
        });
        setLogoPreview(settings.logo_url || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải được cấu hình công ty');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  // ── Load data per tab ──────────────────────────────────────────────────────
  const loadPeople = useCallback(async () => {
    if (!data) return;
    setPeopleLoading(true);
    try {
      const res = await apiFetch(`/api/v1/companies/${data.companyId}/people`);
      setPeople(res.people || []);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không tải được nhân sự', 'err');
    } finally {
      setPeopleLoading(false);
    }
  }, [data]);

  const loadRoles = useCallback(async () => {
    if (!data) return;
    setRolesLoading(true);
    try {
      const res = await apiFetch(`/api/v1/companies/${data.companyId}/roles`);
      setRoles(res.roles || []);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không tải được cấp bậc', 'err');
    } finally {
      setRolesLoading(false);
    }
  }, [data]);

  const loadCatalog = useCallback(async (type: string) => {
    if (!data) return;
    setCatalogLoading(true);
    try {
      const res = await apiFetch(`/api/v1/companies/${data.companyId}/catalog?type=${type}`);
      setCatalog(res.items || []);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không tải được danh mục', 'err');
    } finally {
      setCatalogLoading(false);
    }
  }, [data]);

  const loadWorkflow = useCallback(async () => {
    if (!data) return;
    try {
      const res = await apiFetch(`/api/v1/companies/${data.companyId}/workflow`);
      setWorkflow({
        allow_direct_fund_approval: Boolean(res.allow_direct_fund_approval),
        allow_checker_as_approver: Boolean(res.allow_checker_as_approver),
        default_checker_user_id: res.default_checker_user_id || '',
        default_approver_user_id: res.default_approver_user_id || '',
        default_accountant_user_id: res.default_accountant_user_id || '',
      });
    } catch {
      // may not exist yet, ignore
    }
  }, [data]);

  const loadUiSettings = useCallback(async () => {
    if (!data) return;
    try {
      const res = await apiFetch(`/api/v1/companies/${data.companyId}/ui-settings`);
      setUiSettings({ navigation_config: res.navigation_config || {} });
    } catch {
      // may not exist yet
    }
  }, [data]);

  const loadAuditLogs = useCallback(async (reset = false) => {
    if (!data) return;
    setAuditLoading(true);
    const offset = reset ? 0 : auditOffset;
    const params = new URLSearchParams({ limit: String(AUDIT_LIMIT), offset: String(offset) });
    if (auditFilter.resource_type) params.set('resource_type', auditFilter.resource_type);
    if (auditFilter.from) params.set('from', auditFilter.from);
    if (auditFilter.to) params.set('to', auditFilter.to);
    try {
      const res = await apiFetch(`/api/v1/companies/${data.companyId}/audit-logs?${params}`);
      const logs: AuditLog[] = res.logs || [];
      if (reset) { setAuditLogs(logs); setAuditOffset(AUDIT_LIMIT); }
      else { setAuditLogs(prev => [...prev, ...logs]); setAuditOffset(offset + AUDIT_LIMIT); }
      setAuditHasMore(logs.length === AUDIT_LIMIT);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không tải được nhật ký', 'err');
    } finally {
      setAuditLoading(false);
    }
  }, [data, auditFilter, auditOffset]);

  useEffect(() => {
    setMessage('');
    if (tab === 'people') loadPeople();
    if (tab === 'permissions') loadRoles();
    if (tab === 'catalog') loadCatalog(catalogType);
    if (tab === 'workflow') loadWorkflow();
    if (tab === 'navigation') loadUiSettings();
    if (tab === 'audit') loadAuditLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === 'catalog') loadCatalog(catalogType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogType]);

  // ── Tab 1: Brand actions ───────────────────────────────────────────────────
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!data || !logoFile) return null;
    const fd = new FormData();
    fd.append('file', logoFile);
    const res = await apiFetch(`/api/v1/companies/${data.companyId}/logo`, { method: 'POST', body: fd });
    return res.logo_url as string;
  };

  const saveBrand = async () => {
    if (!data) return;
    setSaving(true);
    try {
      let logoUrl = brand.logo_url;
      if (logoFile) {
        const uploaded = await uploadLogo();
        if (uploaded) { logoUrl = uploaded; setLogoPreview(uploaded); }
      }
      const payload = { ...brand, logo_url: logoUrl };
      const settings = await updateCompanySettings(data.companyId, payload);
      setBrand({ name: settings.name, slogan: settings.slogan || '', logo_url: settings.logo_url || '', hotline: settings.hotline || '', contact_email: settings.contact_email || '', address: settings.address || '' });
      setLogoFile(null);
      await postAuditLog(data.companyId, 'update_brand_settings', 'company', data.companyId, { fields: Object.keys(payload) });
      showMsg('Đã lưu thông tin công ty và thương hiệu.');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không lưu được', 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── Tab 2: People actions ──────────────────────────────────────────────────
  const addPerson = async () => {
    if (!data || !newPerson.email.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/companies/${data.companyId}/people`, { method: 'POST', body: JSON.stringify(newPerson) });
      await postAuditLog(data.companyId, 'add_person', 'person', res.id, { email: newPerson.email });
      showMsg('Đã thêm nhân sự.');
      setNewPerson({ email: '', name: '', national_id: '', phone: '', address: '', emergency_contact_name: '', emergency_contact_phone: '', department: '', position: '', role_id: '', joined_at: '', username: '' });
      await loadPeople();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không thêm được nhân sự', 'err');
    } finally {
      setSaving(false);
    }
  };

  const togglePersonStatus = async (person: Person) => {
    if (!data) return;
    const newStatus = person.status === 'active' ? 'inactive' : 'active';
    try {
      await apiFetch(`/api/v1/companies/${data.companyId}/people/${person.id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
      await postAuditLog(data.companyId, newStatus === 'active' ? 'unlock_person' : 'lock_person', 'person', person.id, { email: person.email });
      await loadPeople();
      showMsg(`Đã ${newStatus === 'active' ? 'kích hoạt' : 'khóa'} ${person.email}.`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không cập nhật được', 'err');
    }
  };

  const removePerson = async (person: Person) => {
    if (!data || !window.confirm(`Xóa nhân sự ${person.email} khỏi công ty?`)) return;
    try {
      await apiFetch(`/api/v1/companies/${data.companyId}/people/${person.id}`, { method: 'DELETE' });
      await postAuditLog(data.companyId, 'remove_person', 'person', person.id, { email: person.email });
      await loadPeople();
      showMsg(`Đã xóa ${person.email} khỏi danh sách nhân sự.`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không xóa được nhân sự', 'err');
    }
  };

  const provisionAuth = async (person: Person) => {
    if (!data) return;
    setProvisioningId(person.id);
    try {
      await apiFetch('/provision-company-user', {
        method: 'POST',
        body: JSON.stringify({ companyId: data.companyId, email: person.email, password: authPwd, name: person.name || person.email }),
      });
      await postAuditLog(data.companyId, 'provision_auth_account', 'person', person.id, { email: person.email });
      showMsg(`Đã tạo tài khoản Auth cho ${person.email}.`);
      // Giữ nguyên mật khẩu vừa gửi vào Auth để admin có thể copy chính xác.
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không tạo được tài khoản Auth', 'err');
    } finally {
      setProvisioningId(null);
    }
  };

  // ── Tab 3: Roles/Permissions actions ──────────────────────────────────────
  const addRole = async () => {
    if (!data || !newRole.name.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/companies/${data.companyId}/roles`, { method: 'POST', body: JSON.stringify({ ...newRole, permissions: [] }) });
      await postAuditLog(data.companyId, 'add_role', 'role', res.id, { name: newRole.name });
      showMsg('Đã thêm cấp bậc.');
      setNewRole({ name: '', title: '', description: '', level: 0 });
      await loadRoles();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không thêm được cấp bậc', 'err');
    } finally {
      setSaving(false);
    }
  };

  const toggleRoleStatus = async (role: Role) => {
    if (!data) return;
    try {
      await apiFetch(`/api/v1/companies/${data.companyId}/roles/${role.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !role.is_active }) });
      await postAuditLog(data.companyId, role.is_active ? 'disable_role' : 'enable_role', 'role', role.id, { name: role.name });
      await loadRoles();
      showMsg(`Đã ${!role.is_active ? 'kích hoạt' : 'tắt'} cấp bậc ${role.name}.`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không cập nhật được', 'err');
    }
  };

  const selectRole = (role: Role) => {
    setSelectedRoleId(role.id);
    setEditPerms([...role.permissions]);
  };

  const savePermissions = async () => {
    if (!data || !selectedRoleId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/companies/${data.companyId}/roles/${selectedRoleId}`, { method: 'PUT', body: JSON.stringify({ permissions: editPerms }) });
      await postAuditLog(data.companyId, 'update_role_permissions', 'role', selectedRoleId, { permissions: editPerms });
      showMsg('Đã lưu permissions.');
      await loadRoles();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không lưu được permissions', 'err');
    } finally {
      setSaving(false);
    }
  };

  const togglePerm = (key: string) => {
    setEditPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const permsByModule = useMemo(() => {
    const map: Record<string, typeof ALL_PERMISSIONS> = {};
    ALL_PERMISSIONS.forEach(p => { if (!map[p.module]) map[p.module] = []; map[p.module].push(p); });
    return map;
  }, []);

  const selectedRole = useMemo(() => roles.find(r => r.id === selectedRoleId), [roles, selectedRoleId]);

  // ── Tab 4: Catalog actions ─────────────────────────────────────────────────
  const addCatalogItem = async () => {
    if (!data || !newCatalog.name.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/companies/${data.companyId}/catalog`, { method: 'POST', body: JSON.stringify({ catalog_type: catalogType, name: newCatalog.name, sort_order: newCatalog.sort_order, is_active: true }) });
      await postAuditLog(data.companyId, 'add_catalog_item', 'catalog', res.id, { catalog_type: catalogType, name: newCatalog.name });
      setNewCatalog({ name: '', sort_order: 0 });
      await loadCatalog(catalogType);
      showMsg('Đã thêm mục danh mục.');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không thêm được', 'err');
    } finally {
      setSaving(false);
    }
  };

  const saveCatalogItem = async (item: CatalogItem) => {
    if (!data) return;
    try {
      await apiFetch(`/api/v1/companies/${data.companyId}/catalog/${item.id}`, { method: 'PUT', body: JSON.stringify({ name: editCatalogName }) });
      await postAuditLog(data.companyId, 'edit_catalog_item', 'catalog', item.id, { name: editCatalogName });
      setEditingCatalog(null);
      await loadCatalog(catalogType);
      showMsg('Đã cập nhật.');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không cập nhật được', 'err');
    }
  };

  const deleteCatalogItem = async (item: CatalogItem) => {
    if (!data || !confirm(`Xóa "${item.name}"?`)) return;
    try {
      await apiFetch(`/api/v1/companies/${data.companyId}/catalog/${item.id}`, { method: 'DELETE' });
      await postAuditLog(data.companyId, 'delete_catalog_item', 'catalog', item.id, { name: item.name });
      await loadCatalog(catalogType);
      showMsg('Đã xóa.');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không xóa được', 'err');
    }
  };

  // ── Tab 5: Workflow actions ────────────────────────────────────────────────
  const saveWorkflow = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/companies/${data.companyId}/workflow`, { method: 'PUT', body: JSON.stringify(workflow) });
      await postAuditLog(data.companyId, 'update_workflow', 'workflow', data.companyId);
      showMsg('Đã lưu quy trình duyệt.');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không lưu được', 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── Tab 6: UI settings actions ─────────────────────────────────────────────
  const saveUiSettings = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/companies/${data.companyId}/ui-settings`, { method: 'PUT', body: JSON.stringify(uiSettings) });
      await postAuditLog(data.companyId, 'update_ui_settings', 'ui_settings', data.companyId);
      showMsg('Đã lưu cài đặt giao diện.');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không lưu được', 'err');
    } finally {
      setSaving(false);
    }
  };

  const toggleNavModule = (key: string) => {
    setUiSettings(prev => ({ ...prev, navigation_config: { ...prev.navigation_config, [key]: !prev.navigation_config[key] } }));
  };

  // ── Tab 7: Audit log actions ───────────────────────────────────────────────
  const exportCsv = async () => {
    if (!data) return;
    const params = new URLSearchParams({ limit: '10000', offset: '0' });
    if (auditFilter.resource_type) params.set('resource_type', auditFilter.resource_type);
    if (auditFilter.from) params.set('from', auditFilter.from);
    if (auditFilter.to) params.set('to', auditFilter.to);
    try {
      const blob = await apiFetch(`/api/v1/companies/${data.companyId}/audit-logs?${params}`, { headers: { Accept: 'text/csv' } }) as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${data.companyId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Không xuất được CSV', 'err');
    }
  };

  // ── Render tab content ────────────────────────────────────────────────────
  const renderCompanyTab = () => (
    <Panel title="Công ty & Thương hiệu" subtitle="Cấu hình thông tin công ty. Lưu trong Platform DB, không ảnh hưởng Product DB.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tên công ty" value={brand.name} onChange={v => setBrand({ ...brand, name: v })} />
        <Field label="Slogan" value={brand.slogan} onChange={v => setBrand({ ...brand, slogan: v })} />
        <Field label="Hotline" value={brand.hotline} onChange={v => setBrand({ ...brand, hotline: v })} placeholder="09xx-xxx-xxx" />
        <Field label="Email đại diện" value={brand.contact_email} onChange={v => setBrand({ ...brand, contact_email: v })} placeholder="admin@company.vn" />
        <Field label="Địa chỉ trụ sở" value={brand.address} onChange={v => setBrand({ ...brand, address: v })} placeholder="123 Đường ABC, Q.1, TP.HCM" />
      </div>

      {/* Logo section */}
      <div className="mt-6 border bg-slate-50 p-4">
        <h3 className="mb-3 font-bold text-slate-700">Logo công ty</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-600">Upload file (JPG/PNG/WebP, tối đa 2MB)</p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold"
              onChange={handleLogoFileChange}
            />
            {logoFile && <p className="mt-1 text-xs text-slate-400">Chọn: {logoFile.name}</p>}
          </div>
        </div>
        {logoPreview && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-slate-500">Preview logo:</p>
            <img src={logoPreview} alt="Logo preview" className="h-20 w-20 border object-contain bg-white" />
          </div>
        )}
      </div>

      <button disabled={saving} onClick={saveBrand} className="mt-6 bg-blue-800 px-5 py-2.5 font-bold text-white disabled:opacity-60">
        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </button>
      <MsgBox message={message} type={msgType} />
    </Panel>
  );

  const renderPeopleTab = () => (
    <Panel title="Nhân sự" subtitle={`Quản lý danh sách nhân sự công ty ${data?.company.code || ''}.`}>
      {/* Form thêm nhân sự */}
      <div className="mb-6 border bg-slate-50 p-4">
        <h3 className="mb-3 font-bold text-slate-700">Thêm nhân sự mới</h3>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Thông tin cá nhân</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Email *" value={newPerson.email} onChange={v => setNewPerson({ ...newPerson, email: v })} placeholder="email@company.vn" />
          <Field label="Họ tên" value={newPerson.name} onChange={v => setNewPerson({ ...newPerson, name: v })} placeholder="Nguyễn Văn A" />
          <Field label="Số CCCD" value={newPerson.national_id} onChange={v => setNewPerson({ ...newPerson, national_id: v })} placeholder="Số căn cước" />
          <Field label="Điện thoại" value={newPerson.phone} onChange={v => setNewPerson({ ...newPerson, phone: v })} placeholder="09xx..." />
          <Field label="Địa chỉ" value={newPerson.address} onChange={v => setNewPerson({ ...newPerson, address: v })} placeholder="Địa chỉ liên hệ" />
          <label className="text-sm font-semibold">Ngày vào làm<input type="date" className="mt-2 w-full border p-2 font-normal" value={newPerson.joined_at} onChange={e => setNewPerson({ ...newPerson, joined_at: e.target.value })} /></label>
        </div>
        <div className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">Thông tin người thân khẩn cấp</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tên người thân" value={newPerson.emergency_contact_name} onChange={v => setNewPerson({ ...newPerson, emergency_contact_name: v })} placeholder="Họ tên người liên hệ" />
          <Field label="SĐT người thân khẩn cấp" value={newPerson.emergency_contact_phone} onChange={v => setNewPerson({ ...newPerson, emergency_contact_phone: v })} placeholder="09xx..." />
        </div>
        <div className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">Công việc & tài khoản truy cập</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Phòng ban" value={newPerson.department} onChange={v => setNewPerson({ ...newPerson, department: v })} placeholder="Kỹ thuật" />
          <Field label="Chức vụ" value={newPerson.position} onChange={v => setNewPerson({ ...newPerson, position: v })} placeholder="Nhân viên" />
          <Field label="Tên đăng nhập" value={newPerson.username} onChange={v => setNewPerson({ ...newPerson, username: v })} placeholder="Tùy chọn" />
          <SelectField label="Vai trò" value={newPerson.role_id} onChange={v => setNewPerson({ ...newPerson, role_id: v })}>
            <option value="">-- Chọn vai trò --</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.title || r.name}</option>)}
          </SelectField>
        </div>
        <button disabled={saving || !newPerson.email.trim()} onClick={addPerson} className="mt-4 bg-blue-800 px-5 py-2 font-bold text-white disabled:opacity-60">
          {saving ? 'Đang lưu...' : '+ Thêm nhân sự'}
        </button>
      </div>

      {/* Danh sách nhân sự */}
      {peopleLoading ? <p className="text-slate-500">Đang tải...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-100 text-left">
              <th className="p-3">Email</th>
              <th className="p-3">Họ tên</th>
              <th className="p-3">Phòng ban</th>
              <th className="p-3">Chức vụ</th>
              <th className="p-3">Vai trò</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Thao tác</th>
            </tr></thead>
            <tbody>{people.map(p => (
              <tr key={p.id} className="border-b hover:bg-slate-50">
                <td className="p-3">{p.email}</td>
                <td className="p-3">{p.name || '—'}</td>
                <td className="p-3">{p.department || '—'}</td>
                <td className="p-3">{p.position || '—'}</td>
                <td className="p-3">{p.company_roles?.title || p.role}</td>
                <td className="p-3">
                  <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {p.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
                <td className="p-3 flex items-center gap-2 flex-wrap">
                  <button onClick={() => togglePersonStatus(p)} className={`rounded-sm px-3 py-1 text-xs font-bold ${p.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                    {p.status === 'active' ? 'Khóa' : 'Mở khóa'}
                  </button>
                  <button
                    disabled={provisioningId === p.id}
                    onClick={() => provisionAuth(p)}
                    className="rounded-sm bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                  >
                    {provisioningId === p.id ? '...' : 'Tạo TK Auth'}
                  </button>
                  {p.role !== 'company_admin' && (
                    <button
                      onClick={() => removePerson(p)}
                      className="rounded-sm bg-red-100 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-200"
                    >
                      Xóa
                    </button>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {people.length === 0 && <p className="mt-4 text-center text-slate-400">Chưa có nhân sự nào.</p>}
        </div>
      )}

      {/* Auth provisioning password */}
      <div className="mt-6 border bg-slate-50 p-4">
        <h3 className="mb-2 font-bold text-slate-700 text-sm">Mật khẩu tạo tài khoản Auth (tự động sinh)</h3>
        <div className="flex items-center gap-3">
          <input className="border p-2 text-sm font-mono flex-1 max-w-xs" value={authPwd} onChange={e => setAuthPwd(e.target.value)} />
          <button onClick={() => setAuthPwd(generatePassword())} className="border px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">↻ Sinh lại</button>
        </div>
        <p className="mt-1 text-xs text-slate-400">Nhấn "Tạo TK Auth" ở hàng nhân sự để provision tài khoản với password trên.</p>
      </div>

      <MsgBox message={message} type={msgType} />
    </Panel>
  );

  const renderPermissionsTab = () => (
    <Panel title="Phân quyền & Cấp bậc" subtitle={`Quản lý các vai trò và quyền hạn trong công ty ${data?.company.code || ''}.`}>
      {/* Form thêm role */}
      <div className="mb-6 border bg-slate-50 p-4">
        <h3 className="mb-3 font-bold text-slate-700">Thêm cấp bậc mới</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Mã vai trò (code) *" value={newRole.name} onChange={v => setNewRole({ ...newRole, name: v })} placeholder="project_manager" />
          <Field label="Tên hiển thị" value={newRole.title} onChange={v => setNewRole({ ...newRole, title: v })} placeholder="Quản lý dự án" />
          <Field label="Mô tả" value={newRole.description} onChange={v => setNewRole({ ...newRole, description: v })} placeholder="Quản lý thành viên và tiến độ" />
          <label className="text-sm font-semibold">
            Cấp bậc (số)
            <input type="number" className="mt-2 w-full border p-2 font-normal" value={newRole.level} onChange={e => setNewRole({ ...newRole, level: Number(e.target.value) })} min={0} max={99} />
          </label>
        </div>
        <button disabled={saving || !newRole.name.trim()} onClick={addRole} className="mt-4 bg-blue-800 px-5 py-2 font-bold text-white disabled:opacity-60">
          {saving ? 'Đang lưu...' : '+ Thêm cấp bậc'}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Danh sách roles */}
        <div>
          {rolesLoading ? <p className="text-slate-500">Đang tải...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-100 text-left">
                  <th className="p-3">Mã</th>
                  <th className="p-3">Tên</th>
                  <th className="p-3">Cấp</th>
                  <th className="p-3">TT</th>
                  <th className="p-3">Thao tác</th>
                </tr></thead>
                <tbody>{roles.map(r => (
                  <tr
                    key={r.id}
                    className={`cursor-pointer border-b hover:bg-blue-50 ${selectedRoleId === r.id ? 'bg-blue-50' : ''}`}
                    onClick={() => selectRole(r)}
                  >
                    <td className="p-3 font-mono text-xs">{r.name}</td>
                    <td className="p-3 font-semibold">{r.title || '—'}</td>
                    <td className="p-3 text-center">{r.level}</td>
                    <td className="p-3">
                      <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.is_active ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={e => { e.stopPropagation(); toggleRoleStatus(r); }}
                        className={`rounded-sm px-2 py-1 text-xs font-bold ${r.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                      >
                        {r.is_active ? 'Tắt' : 'Bật'}
                      </button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {roles.length === 0 && <p className="mt-4 text-center text-slate-400">Chưa có cấp bậc nào.</p>}
            </div>
          )}
        </div>

        {/* Permission panel */}
        {selectedRole && (
          <div className="border bg-slate-50 p-4">
            <h3 className="mb-3 font-bold text-slate-700">Quyền hạn: {selectedRole.title || selectedRole.name}</h3>
            {Object.entries(permsByModule).map(([module, perms]) => (
              <div key={module} className="mb-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">{module}</p>
                {perms.map(p => (
                  <label key={p.key} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={editPerms.includes(p.key)} onChange={() => togglePerm(p.key)} className="accent-blue-700" />
                    {p.label}
                    <span className="font-mono text-xs text-slate-400">({p.key})</span>
                  </label>
                ))}
              </div>
            ))}
            <button disabled={saving} onClick={savePermissions} className="mt-2 bg-blue-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {saving ? 'Đang lưu...' : 'Lưu permissions'}
            </button>
          </div>
        )}
      </div>

      <MsgBox message={message} type={msgType} />
    </Panel>
  );

  const renderCatalogTab = () => (
    <Panel title="Danh mục nội bộ" subtitle="Quản lý danh mục dùng trong toàn công ty.">
      {/* Sub-tabs */}
      <div className="mb-5 flex flex-wrap gap-1 border-b">
        {CATALOG_TYPES.map(ct => (
          <button
            key={ct.key}
            onClick={() => setCatalogType(ct.key)}
            className={`px-4 py-2 text-sm font-semibold ${catalogType === ct.key ? 'border-b-2 border-blue-700 text-blue-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {ct.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      <div className="mb-5 flex items-end gap-3">
        <Field label={`Tên mục mới`} value={newCatalog.name} onChange={v => setNewCatalog({ ...newCatalog, name: v })} placeholder="Nhập tên..." />
        <label className="text-sm font-semibold w-28">
          Thứ tự
          <input type="number" min={0} className="mt-2 w-full border p-2 font-normal" value={newCatalog.sort_order} onChange={e => setNewCatalog({ ...newCatalog, sort_order: Number(e.target.value) })} />
        </label>
        <button disabled={saving || !newCatalog.name.trim()} onClick={addCatalogItem} className="bg-blue-800 px-4 py-2 font-bold text-white disabled:opacity-60 self-end">
          {saving ? '...' : '+ Thêm'}
        </button>
      </div>

      {/* Catalog list */}
      {catalogLoading ? <p className="text-slate-500">Đang tải...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-100 text-left">
              <th className="p-3">Tên</th>
              <th className="p-3 w-24">Thứ tự</th>
              <th className="p-3 w-24">Trạng thái</th>
              <th className="p-3 w-32">Thao tác</th>
            </tr></thead>
            <tbody>{catalog.map(item => (
              <tr key={item.id} className="border-b hover:bg-slate-50">
                <td className="p-3">
                  {editingCatalog === item.id ? (
                    <input
                      autoFocus
                      className="w-full border p-1 text-sm"
                      value={editCatalogName}
                      onChange={e => setEditCatalogName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveCatalogItem(item); if (e.key === 'Escape') setEditingCatalog(null); }}
                    />
                  ) : item.name}
                </td>
                <td className="p-3 text-center">{item.sort_order}</td>
                <td className="p-3">
                  <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.is_active ? 'Hoạt động' : 'Ẩn'}
                  </span>
                </td>
                <td className="p-3 flex gap-2">
                  {editingCatalog === item.id ? (
                    <>
                      <button onClick={() => saveCatalogItem(item)} className="rounded-sm bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Lưu</button>
                      <button onClick={() => setEditingCatalog(null)} className="rounded-sm border px-2 py-1 text-xs font-bold text-slate-600">Hủy</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingCatalog(item.id); setEditCatalogName(item.name); }} className="rounded-sm bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100">Sửa</button>
                      <button onClick={() => deleteCatalogItem(item)} className="rounded-sm bg-red-50 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100">Xóa</button>
                    </>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {catalog.length === 0 && <p className="mt-4 text-center text-slate-400">Chưa có mục nào.</p>}
        </div>
      )}

      <MsgBox message={message} type={msgType} />
    </Panel>
  );

  const renderWorkflowTab = () => (
    <Panel title="Quy trình duyệt" subtitle={`Cấu hình luồng kiểm tra, duyệt cho công ty ${data?.company.code || ''}.`}>
      <Toggle
        title="Cho phép duyệt trực tiếp"
        description="Bỏ qua bước kiểm tra khi lãnh đạo phê duyệt yêu cầu cấp quỹ."
        value={workflow.allow_direct_fund_approval}
        onChange={v => setWorkflow({ ...workflow, allow_direct_fund_approval: v })}
      />
      <Toggle
        title="Cho phép kiểm tra kiêm duyệt"
        description="Một nhân sự có thể vừa kiểm tra vừa phê duyệt yêu cầu."
        value={workflow.allow_checker_as_approver}
        onChange={v => setWorkflow({ ...workflow, allow_checker_as_approver: v })}
      />
      <div className="mt-5 grid gap-4 border-t pt-5 md:grid-cols-3">
        <SelectField label="Người kiểm tra mặc định" value={workflow.default_checker_user_id} onChange={v => setWorkflow({ ...workflow, default_checker_user_id: v })}>
          <option value="">-- Không chọn --</option>
          {people.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
        </SelectField>
        <SelectField label="Người duyệt mặc định" value={workflow.default_approver_user_id} onChange={v => setWorkflow({ ...workflow, default_approver_user_id: v })}>
          <option value="">-- Không chọn --</option>
          {people.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
        </SelectField>
        <SelectField label="Kế toán xử lý" value={workflow.default_accountant_user_id} onChange={v => setWorkflow({ ...workflow, default_accountant_user_id: v })}>
          <option value="">-- Không chọn --</option>
          {people.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
        </SelectField>
      </div>
      <button disabled={saving} onClick={saveWorkflow} className="mt-6 bg-blue-800 px-5 py-2.5 font-bold text-white disabled:opacity-60">
        {saving ? 'Đang lưu...' : 'Lưu quy trình'}
      </button>
      <MsgBox message={message} type={msgType} />
    </Panel>
  );

  const renderNavigationTab = () => {
    const navCfg = uiSettings.navigation_config;
    const enabledModules = NAV_MODULES.filter(m => navCfg[m.key] !== false);
    return (
      <Panel title="Giao diện & Điều hướng" subtitle="Hiện/ẩn các module trong thanh điều hướng của công ty.">
        <div className="mb-6 grid gap-3">
          {NAV_MODULES.map(m => (
            <div key={m.key} className="flex items-center justify-between border p-3">
              <span className="font-semibold text-slate-700">{m.label}</span>
              <button
                onClick={() => toggleNavModule(m.key)}
                className={`px-4 py-1.5 text-sm font-bold ${navCfg[m.key] !== false ? 'bg-emerald-600 text-white' : 'border bg-white text-slate-600'}`}
              >
                {navCfg[m.key] !== false ? 'Hiển thị' : 'Ẩn'}
              </button>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="mb-6 border bg-slate-50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Preview điều hướng (các module được bật)</p>
          <div className="flex flex-wrap gap-2">
            {enabledModules.length === 0 && <span className="text-sm text-slate-400">Tất cả module đã bị ẩn</span>}
            {enabledModules.map((m, i) => (
              <span key={m.key} className="flex items-center gap-1 rounded bg-blue-700 px-3 py-1 text-sm font-semibold text-white">
                <span className="text-xs opacity-60">{i + 1}.</span> {m.label}
              </span>
            ))}
          </div>
        </div>

        <button disabled={saving} onClick={saveUiSettings} className="bg-blue-800 px-5 py-2.5 font-bold text-white disabled:opacity-60">
          {saving ? 'Đang lưu...' : 'Lưu cài đặt giao diện'}
        </button>
        <MsgBox message={message} type={msgType} />
      </Panel>
    );
  };

  const renderAuditTab = () => (
    <Panel title="Nhật ký hoạt động" subtitle="Toàn bộ hành động thay đổi cấu hình công ty.">
      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <SelectField label="Loại tài nguyên" value={auditFilter.resource_type} onChange={v => setAuditFilter({ ...auditFilter, resource_type: v })}>
          <option value="">Tất cả</option>
          {['company', 'person', 'role', 'catalog', 'workflow', 'ui_settings'].map(t => <option key={t} value={t}>{t}</option>)}
        </SelectField>
        <label className="text-sm font-semibold">
          Từ ngày
          <input type="date" className="mt-2 block border p-2 font-normal" value={auditFilter.from} onChange={e => setAuditFilter({ ...auditFilter, from: e.target.value })} />
        </label>
        <label className="text-sm font-semibold">
          Đến ngày
          <input type="date" className="mt-2 block border p-2 font-normal" value={auditFilter.to} onChange={e => setAuditFilter({ ...auditFilter, to: e.target.value })} />
        </label>
        <button onClick={() => loadAuditLogs(true)} className="border bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 self-end">
          Lọc
        </button>
        <button onClick={exportCsv} className="border border-blue-700 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 self-end">
          ↓ Xuất CSV
        </button>
      </div>

      {/* Log table */}
      {auditLoading && auditLogs.length === 0 ? <p className="text-slate-500">Đang tải...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-100 text-left">
              <th className="p-3 w-40">Thời gian</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Hành động</th>
              <th className="p-3">Loại</th>
              <th className="p-3">ID</th>
            </tr></thead>
            <tbody>{auditLogs.map(log => (
              <tr key={log.id} className="border-b hover:bg-slate-50">
                <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                <td className="p-3 text-xs">{log.actor_email}</td>
                <td className="p-3 font-mono text-xs">{log.action}</td>
                <td className="p-3 text-xs text-slate-500">{log.resource_type}</td>
                <td className="p-3 font-mono text-xs text-slate-400">{log.resource_id || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
          {auditLogs.length === 0 && <p className="mt-4 text-center text-slate-400">Không có nhật ký nào.</p>}
        </div>
      )}

      {auditHasMore && (
        <button onClick={() => loadAuditLogs(false)} disabled={auditLoading} className="mt-4 border px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          {auditLoading ? 'Đang tải...' : 'Tải thêm'}
        </button>
      )}

      <MsgBox message={message} type={msgType} />
    </Panel>
  );

  const tabContent = useMemo(() => {
    switch (tab) {
      case 'company': return renderCompanyTab();
      case 'people': return renderPeopleTab();
      case 'permissions': return renderPermissionsTab();
      case 'catalog': return renderCatalogTab();
      case 'workflow': return renderWorkflowTab();
      case 'navigation': return renderNavigationTab();
      case 'audit': return renderAuditTab();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, brand, logoPreview, logoFile, people, peopleLoading, newPerson, authPwd, provisioningId,
    roles, rolesLoading, newRole, selectedRoleId, editPerms, selectedRole,
    catalog, catalogLoading, catalogType, newCatalog, editingCatalog, editCatalogName,
    workflow, uiSettings, auditLogs, auditLoading, auditFilter, auditHasMore,
    saving, message, msgType, data]);

  // Keep redirects after all hooks so hook order remains stable across renders.
  if (!loading && !data && !error) return <Navigate to="/company-admin/login" replace />;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-blue-700">Company Admin Portal</div>
          <h1 className="text-xl font-extrabold">{data?.company.name || 'Cấu hình công ty'}</h1>
        </div>
        <button className="border px-4 py-2" onClick={() => platformAuthClient.auth.signOut().then(() => navigate('/company-admin/login'))}>
          Đăng xuất
        </button>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 p-6">
        <aside className="w-64 shrink-0 border bg-white p-3">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={'block w-full border-b px-3 py-3 text-left font-semibold ' + (tab === id ? 'border-l-4 border-l-blue-700 bg-blue-50 text-blue-800' : 'text-slate-600')}
            >
              {label}
            </button>
          ))}
        </aside>
        <main className="min-w-0 flex-1">
          {loading && <Panel title="Đang tải..." />}
          {error && <Panel title="Lỗi"><p className="text-red-600">{error}</p></Panel>}
          {data && !loading && tabContent}
        </main>
      </div>
    </div>
  );
};

// ── Shared UI Components ───────────────────────────────────────────────────────
const Panel = ({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) => (
  <section className="border bg-white p-6">
    <h2 className="text-2xl font-bold">{title}</h2>
    {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
    <div className="mt-6">{children}</div>
  </section>
);

const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) => (
  <label className="text-sm font-semibold">
    {label}
    <input className="mt-2 w-full border p-2 font-normal" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </label>
);

const SelectField = ({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) => (
  <label className="text-sm font-semibold">
    {label}
    <select className="mt-2 w-full border p-2 font-normal" value={value} onChange={e => onChange(e.target.value)}>
      {children}
    </select>
  </label>
);

const Toggle = ({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) => (
  <div className="mb-4 flex items-center justify-between border p-4">
    <div>
      <b>{title}</b>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={'px-4 py-2 text-sm font-bold ' + (value ? 'bg-emerald-600 text-white' : 'border bg-white text-slate-600')}
    >
      {value ? 'Bật' : 'Tắt'}
    </button>
  </div>
);

const MsgBox = ({ message, type }: { message: string; type: 'ok' | 'err' }) => {
  if (!message) return null;
  return <p className={`mt-3 text-sm font-semibold ${type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{message}</p>;
};
