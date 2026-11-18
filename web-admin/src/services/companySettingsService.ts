import { platformAuthClient } from './platformAuthClient';

const apiBase = import.meta.env.VITE_PLATFORM_PROVISION_URL || 'http://127.0.0.1:55400';

export type CompanySettings = {
  id?: string;
  company_id: string;
  name: string;
  slogan?: string | null;
  logo_url?: string | null;
  hotline?: string | null;
  contact_email?: string | null;
  address?: string | null;
  updated_at?: string;
};

const token = async () => (await platformAuthClient.auth.getSession()).data.session?.access_token || '';

export const getCompanySettings = async (companyId: string) => {
  const response = await fetch(`${apiBase}/api/v1/companies/${companyId}/settings`, { headers: { Authorization: `Bearer ${await token()}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Không tải được cấu hình công ty');
  return body as CompanySettings;
};

export const updateCompanySettings = async (companyId: string, settings: Pick<CompanySettings, 'name' | 'slogan' | 'logo_url' | 'hotline' | 'contact_email' | 'address'>) => {
  const response = await fetch(`${apiBase}/api/v1/companies/${companyId}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(settings) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Không lưu được cấu hình công ty');
  return body.settings as CompanySettings;
};

// Upload logo file → trả về logo_url
export const uploadCompanyLogo = async (companyId: string, file: File): Promise<string> => {
  const authToken = await token();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${apiBase}/api/v1/companies/${companyId}/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: formData,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Upload logo thất bại');
  return body.logo_url as string;
};
