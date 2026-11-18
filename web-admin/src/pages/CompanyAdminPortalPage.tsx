import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { platformAuthClient } from '../services/platformAuthClient';
import { fetchPlatformEntitlements, PlatformCompanyEntitlements } from '../services/platformEntitlements';
import { getCompanySettings, updateCompanySettings } from '../services/companySettingsService';

type Tab = 'overview' | 'people' | 'permissions' | 'company' | 'catalog' | 'workflow' | 'navigation' | 'notifications' | 'audit' | 'security';
const tabs: Array<[Tab, string]> = [['overview', 'Tổng quan'], ['people', 'Nhân sự'], ['permissions', 'Phân quyền & Cấp bậc'], ['company', 'Công ty & Thương hiệu'], ['catalog', 'Danh mục nội bộ'], ['workflow', 'Quy trình duyệt cấp quỹ'], ['navigation', 'Giao diện & Điều hướng'], ['notifications', 'Thông báo & Chuông'], ['audit', 'Nhật ký hoạt động'], ['security', 'Tài khoản & Bảo mật']];

export const CompanyAdminPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PlatformCompanyEntitlements | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [allowDirect, setAllowDirect] = useState(false);
  const [allowChecker, setAllowChecker] = useState(false);
  const [accountant, setAccountant] = useState('');
  const [checker, setChecker] = useState('');
  const [approver, setApprover] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brand, setBrand] = useState({ name: '', slogan: '', logo_url: '' });

  useEffect(() => { platformAuthClient.auth.getUser().then(async ({ data: result, error: authError }) => {
    if (authError || !result.user?.email) { setLoading(false); return; }
    try {
      const entitlements = await fetchPlatformEntitlements({ email: result.user.email }); setData(entitlements);
      const settings = await getCompanySettings(entitlements.companyId); setBrand({ name: settings.name || entitlements.company.name, slogan: settings.slogan || '', logo_url: settings.logo_url || '' });
      const { data: workflow } = await platformAuthClient.from('company_workflow_settings').select('*').eq('company_id', entitlements.companyId).maybeSingle();
      if (workflow) { setAllowDirect(Boolean(workflow.allow_direct_fund_approval)); setAllowChecker(Boolean(workflow.allow_checker_as_approver)); setAccountant(workflow.default_accountant_user_id || ''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được cấu hình công ty'); } finally { setLoading(false); }
  }); }, []);
  if (!loading && !data && !error) return <Navigate to="/company-admin/login" replace />;
  const saveWorkflow = async () => { if (!data) return; setSaving(true); const { error: saveError } = await platformAuthClient.from('company_workflow_settings').upsert({ company_id: data.companyId, allow_direct_fund_approval: allowDirect, allow_checker_as_approver: allowChecker, default_accountant_user_id: accountant || null, updated_at: new Date().toISOString() }, { onConflict: 'company_id' }); setSaving(false); setMessage(saveError ? 'Không lưu được: ' + saveError.message : 'Đã lưu quy trình duyệt cấp quỹ.'); };
  const saveBrand = async () => { if (!data) return; setSaving(true); try { const settings = await updateCompanySettings(data.companyId, brand); setBrand({ name: settings.name, slogan: settings.slogan || '', logo_url: settings.logo_url || '' }); setMessage('Đã lưu thông tin công ty và thương hiệu.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Không lưu được'); } finally { setSaving(false); } };
  const workflow = tab === 'workflow' ? <Panel title="Quy trình duyệt cấp quỹ" subtitle={'Cấu hình luồng kiểm tra, duyệt và kế toán xử lý chuyển khoản cho công ty ' + (data?.company.code || '') + '.'}><Toggle title="Cho phép Lãnh đạo duyệt trực tiếp" description="Bỏ qua bước kiểm tra khi lãnh đạo phê duyệt yêu cầu cấp quỹ." value={allowDirect} onChange={setAllowDirect} /><Toggle title="Cho phép Người kiểm tra kiêm Người duyệt" description="Một nhân sự có thể vừa kiểm tra vừa phê duyệt yêu cầu." value={allowChecker} onChange={setAllowChecker} /><div className="mt-5 grid gap-4 border-t pt-5 md:grid-cols-3"><Field label="Người kiểm tra mặc định" value={checker} onChange={setChecker} placeholder="Chọn nhân sự" /><Field label="Người duyệt mặc định" value={approver} onChange={setApprover} placeholder="Chọn nhân sự" /><Field label="Kế toán xử lý chuyển khoản" value={accountant} onChange={setAccountant} placeholder="Chọn nhân sự" /></div><button disabled={saving} onClick={saveWorkflow} className="mt-6 bg-blue-800 px-5 py-2.5 font-bold text-white disabled:opacity-60">{saving ? 'Đang lưu...' : 'Lưu quy trình'}</button>{message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}</Panel> : tab === 'company' ? <Panel title="Công ty & Thương hiệu" subtitle="Cấu hình được lưu trong Platform DB, không sửa DB product."><div className="grid gap-4 md:grid-cols-2"><Field label="Tên công ty" value={brand.name} onChange={(value) => setBrand({ ...brand, name: value })} /><Field label="Slogan" value={brand.slogan} onChange={(value) => setBrand({ ...brand, slogan: value })} /><Field label="Logo URL hoặc data URL" value={brand.logo_url} onChange={(value) => setBrand({ ...brand, logo_url: value })} /></div>{brand.logo_url && <img src={brand.logo_url} alt="Logo công ty" className="mt-5 h-20 w-20 border object-contain" />}<button disabled={saving} onClick={saveBrand} className="mt-6 bg-blue-800 px-5 py-2.5 font-bold text-white disabled:opacity-60">{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>{message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}</Panel> : <Panel title={tabs.find(([id]) => id === tab)?.[1] || 'Tổng quan'} subtitle={'Cấu hình riêng của công ty ' + (data?.company.code || '') + '.'}><div className="grid gap-4 md:grid-cols-3">{['Cấu hình chung', 'Quyền truy cập', 'Nhật ký thay đổi'].map((item) => <div className="border p-5" key={item}><b>{item}</b><p className="mt-2 text-sm text-slate-500">Thiết lập theo chính sách công ty.</p></div>)}</div></Panel>;
  return <div className="min-h-screen bg-slate-50"><header className="flex items-center justify-between border-b bg-white px-6 py-4"><div><div className="text-xs font-bold uppercase tracking-widest text-blue-700">Company Admin Portal</div><h1 className="text-xl font-extrabold">{data?.company.name || 'Cấu hình công ty'}</h1></div><button className="border px-4 py-2" onClick={() => platformAuthClient.auth.signOut().then(() => navigate('/company-admin/login'))}>Đăng xuất</button></header><div className="mx-auto flex max-w-7xl gap-6 p-6"><aside className="w-72 shrink-0 border bg-white p-3">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={'block w-full border-b px-3 py-3 text-left font-semibold ' + (tab === id ? 'border-l-4 border-l-blue-700 bg-blue-50 text-blue-800' : 'text-slate-600')}>{label}</button>)}</aside><main className="min-w-0 flex-1">{loading && <Panel title="Đang tải..." />}{error && <Panel title="Lỗi">{error}</Panel>}{data && !loading && workflow}</main></div></div>;
};

const Panel = ({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) => <section className="border bg-white p-6"><h2 className="text-2xl font-bold">{title}</h2>{subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}<div className="mt-6">{children}</div></section>;
const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) => <label className="text-sm font-semibold">{label}<input className="mt-2 w-full border p-2 font-normal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
const Toggle = ({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) => <div className="mb-4 flex items-center justify-between border p-4"><div><b>{title}</b><p className="mt-1 text-sm text-slate-500">{description}</p></div><button onClick={() => onChange(!value)} className={'px-4 py-2 text-sm font-bold ' + (value ? 'bg-emerald-600 text-white' : 'border bg-white text-slate-600')}>{value ? 'Bật' : 'Tắt'}</button></div>;
