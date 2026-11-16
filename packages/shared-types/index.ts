export type CompanyRole = 'company_admin' | 'director' | 'chief_engineer' | 'engineer' | 'accountant' | 'staff';
export type PlatformRole = 'super_admin' | 'user';

export interface UserContext {
  userId: string;
  email: string;
  companyId: string;
  companyRole: CompanyRole;
  platformRole: PlatformRole;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  timestamp: string;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  database: 'connected' | 'disconnected' | 'not_applicable';
  timestamp: string;
}
