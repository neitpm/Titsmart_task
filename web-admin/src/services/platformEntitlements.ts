export interface PlatformModuleEntitlement {
  code: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  startDate?: string | null;
  expiryDate?: string | null;
}

export interface PlatformCompanyEntitlements {
  companyId: string;
  company: {
    id: string;
    code: string;
    name: string;
    slogan?: string | null;
    logo_url?: string | null;
    status: string;
    plan: string;
  };
  modules: PlatformModuleEntitlement[];
}

const PLATFORM_API_URL =
  (import.meta.env.VITE_PLATFORM_API_URL as string | undefined) || 'http://127.0.0.1:55400';

export async function fetchPlatformEntitlements(params: {
  companyId?: string;
  email?: string;
}): Promise<PlatformCompanyEntitlements> {
  const query = new URLSearchParams();
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.email) query.set('email', params.email);

  const response = await fetch(`${PLATFORM_API_URL}/company-entitlements?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Không thể tải quyền module của công ty');
  }

  return payload as PlatformCompanyEntitlements;
}

export function hasPlatformModule(
  entitlements: PlatformCompanyEntitlements | null | undefined,
  moduleCode: string,
): boolean {
  return Boolean(entitlements?.modules.some((module) => module.code === moduleCode && module.isEnabled));
}
