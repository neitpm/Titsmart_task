import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface CompanyTenant {
  id: string;
  code: string;
  name: string;
  slogan?: string;
  logo?: string;
  plan: 'trial' | 'standard' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'expired';
  adminEmail: string;
  adminPhone?: string;
  maxUsers: number;
  maxStorageGb: number;
  startDate: string;
  expiryDate: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SystemSecurityConfig {
  sessionTimeoutMinutes: number; // Thời gian tự động đăng xuất nếu không thao tác (0: Không giới hạn)
  minPasswordLength: number; // Độ dài mật khẩu tối thiểu
  requireSpecialChar: boolean; // Bắt buộc ký tự đặc biệt
  maxLoginAttempts: number; // Số lần đăng nhập sai tối đa trước khi tạm khóa
  allowMobileAppLogin: boolean; // Cho phép đăng nhập app di động
}

export interface MasterCategoryConfig {
  projectCategories: string[]; // Phân loại dự án
  taskProgressStatuses: string[]; // Trạng thái công việc
  expenseCategories: string[]; // Danh mục chi phí dự án
}

export interface IntegrationAlertConfig {
  telegramBotEnabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  zaloZnsEnabled: boolean;
  zaloTemplateId?: string;
  alertOnFundRequest: boolean; // Báo khi có đơn cấp quỹ
  alertOnTaskOverdue: boolean; // Báo khi công việc trễ hạn
  alertOnSecurityAnomaly: boolean; // Báo khi có đăng nhập bất thường
}

interface PlatformAdminStoreState {
  companies: CompanyTenant[];
  securityConfig: SystemSecurityConfig;
  masterCategories: MasterCategoryConfig;
  integrationConfig: IntegrationAlertConfig;
  isLoading: boolean;

  fetchPlatformData: () => Promise<void>;
  saveCompaniesToCloud: (companies: CompanyTenant[]) => Promise<void>;
  addCompany: (comp: Omit<CompanyTenant, 'id' | 'createdAt'>) => Promise<CompanyTenant>;
  updateCompany: (id: string, patch: Partial<CompanyTenant>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;

  saveSecurityConfig: (cfg: Partial<SystemSecurityConfig>) => Promise<void>;
  saveMasterCategories: (cats: Partial<MasterCategoryConfig>) => Promise<void>;
  saveIntegrationConfig: (integ: Partial<IntegrationAlertConfig>) => Promise<void>;
}

export const DEFAULT_COMPANIES: CompanyTenant[] = [
  {
    id: 'comp_default_titsmart',
    code: 'TITSMART',
    name: 'TITSMART TECHNOLOGY',
    slogan: 'Nâng tầm cuộc sống - Hướng đến tương lai',
    plan: 'enterprise',
    status: 'active',
    adminEmail: 'admin@titsmart.vn',
    adminPhone: '0979.888.643',
    maxUsers: 50,
    maxStorageGb: 100,
    startDate: '2026-01-01',
    expiryDate: '2027-12-31',
    notes: 'Khách hàng mặc định / Khởi tạo hệ thống',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

export const DEFAULT_SECURITY: SystemSecurityConfig = {
  sessionTimeoutMinutes: 120,
  minPasswordLength: 6,
  requireSpecialChar: false,
  maxLoginAttempts: 5,
  allowMobileAppLogin: true
};

export const DEFAULT_MASTER_CATEGORIES: MasterCategoryConfig = {
  projectCategories: [
    'Trạm biến áp 110kV / 220kV / 500kV',
    'Đường dây truyền tải điện',
    'Nhà máy Điện mặt trời / Điện gió',
    'Tự động hóa & SCADA trạm',
    'Hạ tầng cơ điện M&E',
    'Phần mềm & CNTT Doanh nghiệp',
    'Chi phí quản lý Văn phòng'
  ],
  taskProgressStatuses: [
    'Chưa thực hiện',
    'Đang triển khai',
    'Chờ kiểm tra / Nghiệm thu',
    'Đã hoàn thành',
    'Tạm ngưng / Chậm tiến độ'
  ],
  expenseCategories: [
    'Mua sắm vật tư chính',
    'Thiết bị phụ trợ & phụ tùng',
    'Nhân công thuê ngoài / Thầu phụ',
    'Thuê máy móc, cẩu & thiết bị',
    'Chi phí lưu trú & công tác phí',
    'Tiếp khách & quan hệ đối tác',
    'Vận chuyển & logistics',
    'Chi phí hành chính văn phòng'
  ]
};

export const DEFAULT_INTEGRATION: IntegrationAlertConfig = {
  telegramBotEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  zaloZnsEnabled: false,
  zaloTemplateId: '',
  alertOnFundRequest: true,
  alertOnTaskOverdue: true,
  alertOnSecurityAnomaly: true
};

const STORAGE_KEY = 'titsmart-platform-admin-store';

export const usePlatformAdminStore = create<PlatformAdminStoreState>()(
  persist(
    (set, get) => ({
      companies: DEFAULT_COMPANIES,
      securityConfig: DEFAULT_SECURITY,
      masterCategories: DEFAULT_MASTER_CATEGORIES,
      integrationConfig: DEFAULT_INTEGRATION,
      isLoading: false,

      fetchPlatformData: async () => {
        set({ isLoading: true });
        try {
          // Lấy cấu hình đa công ty từ cloud storage public
          const { data, error } = await supabase.storage
            .from('titsmart-images')
            .download('platform/tenants.json');

          if (!error && data) {
            const text = await data.text();
            const json = JSON.parse(text);
            if (json && Array.isArray(json.companies)) {
              set({
                companies: json.companies,
                securityConfig: { ...DEFAULT_SECURITY, ...(json.securityConfig || {}) },
                masterCategories: { ...DEFAULT_MASTER_CATEGORIES, ...(json.masterCategories || {}) },
                integrationConfig: { ...DEFAULT_INTEGRATION, ...(json.integrationConfig || {}) }
              });
            }
          }
        } catch (err) {
          console.warn('[PlatformAdminStore] fetchPlatformData fallback to local:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      saveCompaniesToCloud: async (companies: CompanyTenant[]) => {
        set({ companies });
        try {
          const payload = {
            companies,
            securityConfig: get().securityConfig,
            masterCategories: get().masterCategories,
            integrationConfig: get().integrationConfig,
            updatedAt: new Date().toISOString()
          };
          await supabase.storage.from('titsmart-images').upload(
            'platform/tenants.json',
            JSON.stringify(payload),
            { contentType: 'application/json', upsert: true }
          );
        } catch (err) {
          console.error('[PlatformAdminStore] saveCompaniesToCloud failed:', err);
        }
      },

      addCompany: async (comp) => {
        const id = `comp_${Date.now()}`;
        const newTenant: CompanyTenant = {
          ...comp,
          id,
          createdAt: new Date().toISOString()
        };
        const nextCompanies = [newTenant, ...get().companies];
        await get().saveCompaniesToCloud(nextCompanies);
        return newTenant;
      },

      updateCompany: async (id, patch) => {
        const nextCompanies = get().companies.map(c => 
          c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
        );
        await get().saveCompaniesToCloud(nextCompanies);
      },

      deleteCompany: async (id) => {
        const nextCompanies = get().companies.filter(c => c.id !== id);
        await get().saveCompaniesToCloud(nextCompanies);
      },

      saveSecurityConfig: async (cfg) => {
        const next = { ...get().securityConfig, ...cfg };
        set({ securityConfig: next });
        await get().saveCompaniesToCloud(get().companies);
      },

      saveMasterCategories: async (cats) => {
        const next = { ...get().masterCategories, ...cats };
        set({ masterCategories: next });
        await get().saveCompaniesToCloud(get().companies);
      },

      saveIntegrationConfig: async (integ) => {
        const next = { ...get().integrationConfig, ...integ };
        set({ integrationConfig: next });
        await get().saveCompaniesToCloud(get().companies);
      }
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        companies: state.companies,
        securityConfig: state.securityConfig,
        masterCategories: state.masterCategories,
        integrationConfig: state.integrationConfig
      })
    }
  )
);
