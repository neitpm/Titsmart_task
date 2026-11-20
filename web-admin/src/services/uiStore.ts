import { create } from 'zustand';
import { platformAuthClient } from './platformAuthClient';
import { persist } from 'zustand/middleware';
import { api } from './apiSupabase';

interface UIStoreState {
  sidebarHoverToExpand: boolean;
  sidebarShowToggleButton: boolean;
  isSidebarExpanded: boolean;
  isSidebarHovered: boolean;
  showNotificationBell: boolean;
  autoShowNotificationPopup: boolean;
  showChatWidget: boolean;
  availableUpdateVersion: string | null;
  isUpdatingApp: boolean;
  companyName: string;
  companySlogan: string;
  companyLogo: string | null;
  companyHotline?: string;
  companyAddress?: string;
  companyEmail?: string;
  allowDirectFundApproval: boolean;
  allowDualCheckerReviewerRole: boolean;
  defaultAccountantId?: string;
  defaultAccountantName?: string;
  isApplyingBranding: boolean;
  tablePaginationMode: 'infinite' | 'pagination';
  tablePageSize: number;
  setTablePaginationMode: (val: 'infinite' | 'pagination') => void;
  setTablePageSize: (val: number) => void;
  setSidebarHoverToExpand: (val: boolean) => void;
  setSidebarShowToggleButton: (val: boolean) => void;
  setIsSidebarExpanded: (val: boolean | ((prev: boolean) => boolean)) => void;
  setIsSidebarHovered: (val: boolean) => void;
  toggleSidebarExpanded: () => void;
  setShowNotificationBell: (val: boolean) => void;
  setAutoShowNotificationPopup: (val: boolean) => void;
  setShowChatWidget: (val: boolean) => void;
  setAllowDirectFundApproval: (val: boolean) => void;
  setAllowDualCheckerReviewerRole: (val: boolean) => void;
  setDefaultAccountant: (id?: string, name?: string) => void;
  setAvailableUpdateVersion: (val: string | null) => void;
  setIsUpdatingApp: (val: boolean) => void;
  setCompanyName: (val: string) => void;
  setCompanySlogan: (val: string) => void;
  setCompanyLogo: (val: string | null) => void;
  setCompanyHotline: (val: string) => void;
  setCompanyAddress: (val: string) => void;
  setCompanyEmail: (val: string) => void;
  setIsApplyingBranding: (val: boolean) => void;
  fetchBrandingFromCloud: () => Promise<void>;
  saveBrandingToCloud: (branding: { companyName: string; companySlogan: string; companyLogo: string | null; hotline?: string; address?: string; adminEmail?: string; updatedBy?: string }) => Promise<void>;
}

export const useUIStore = create<UIStoreState>()(
  persist(
    (set, get) => ({
      sidebarHoverToExpand: false,
      sidebarShowToggleButton: true,
      isSidebarExpanded: false,
      isSidebarHovered: false,
      showNotificationBell: true,
      autoShowNotificationPopup: true,
      showChatWidget: true,
      availableUpdateVersion: null,
      isUpdatingApp: false,
      companyName: 'WORKCORE',
      companySlogan: 'COMPANY APP',
      companyLogo: null,
      companyHotline: '',
      companyAddress: '',
      companyEmail: '',
      allowDirectFundApproval: false,
      allowDualCheckerReviewerRole: false,
      defaultAccountantId: '',
      defaultAccountantName: '',
      isApplyingBranding: false,
      tablePaginationMode: 'infinite',
      tablePageSize: 25,
      setTablePaginationMode: (val) => set({ tablePaginationMode: val }),
      setTablePageSize: (val) => set({ tablePageSize: val }),
      setAllowDirectFundApproval: (val) => set({ allowDirectFundApproval: val }),
      setAllowDualCheckerReviewerRole: (val) => set({ allowDualCheckerReviewerRole: val }),
      setDefaultAccountant: (id, name) => set({ defaultAccountantId: id || '', defaultAccountantName: name || '' }),
      setSidebarHoverToExpand: (val) => set({ sidebarHoverToExpand: val }),
      setSidebarShowToggleButton: (val) => set({ sidebarShowToggleButton: val }),
      setIsSidebarExpanded: (val) => set((state) => ({ 
        isSidebarExpanded: typeof val === 'function' ? val(state.isSidebarExpanded) : val 
      })),
      setIsSidebarHovered: (val) => set({ isSidebarHovered: val }),
      toggleSidebarExpanded: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
      setShowNotificationBell: (val) => set({ showNotificationBell: val }),
      setAutoShowNotificationPopup: (val) => set({ autoShowNotificationPopup: val }),
      setShowChatWidget: (val) => set({ showChatWidget: val }),
      setAvailableUpdateVersion: (val) => set({ availableUpdateVersion: val }),
      setIsUpdatingApp: (val) => set({ isUpdatingApp: val }),
      setCompanyName: (val) => set({ companyName: val }),
      setCompanySlogan: (val) => set({ companySlogan: val }),
      setCompanyLogo: (val) => set({ companyLogo: val }),
      setCompanyHotline: (val) => set({ companyHotline: val }),
      setCompanyAddress: (val) => set({ companyAddress: val }),
      setCompanyEmail: (val) => set({ companyEmail: val }),
      setIsApplyingBranding: (val) => set({ isApplyingBranding: val }),

      fetchBrandingFromCloud: async () => {
        try {
          const { data: platformSession } = await platformAuthClient.auth.getSession();
          const platformUser = platformSession.session?.user;
          const companyId = platformUser?.user_metadata?.company_id;
          if (companyId) {
            const token = platformSession.session?.access_token || '';
            const base = import.meta.env.VITE_PLATFORM_PROVISION_URL || 'http://127.0.0.1:55400';
            const response = await fetch(`${base}/api/v1/companies/${companyId}/settings`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const settings = await response.json();
              set({
                companyName: settings.name?.trim() || get().companyName,
                companySlogan: settings.slogan || '',
                companyLogo: settings.logo_url || null,
                companyHotline: settings.hotline || '',
                companyAddress: settings.address || '',
                companyEmail: settings.contact_email || '',
              });
              return;
            }
          }
          const config = await api.branding.get();
          if (config) {
            set({
              companyName: config.companyName?.trim() && config.companyName.trim().toUpperCase() !== 'TITSMART' ? config.companyName.trim() : get().companyName,
              companySlogan: config.companySlogan !== undefined ? config.companySlogan : get().companySlogan,
              companyLogo: config.companyLogo !== undefined ? config.companyLogo : null,
              companyHotline: config.hotline || '',
              companyAddress: config.address || '',
              companyEmail: config.adminEmail || '',
            });
          }
        } catch (err) {
          console.warn('[Branding] fetchBrandingFromCloud error:', err);
        }
      },

      saveBrandingToCloud: async (branding) => {
        const nextName = branding.companyName.trim() || 'TITSMART';
        const nextSlogan = branding.companySlogan.trim() || 'Project Manager';
        const nextLogo = branding.companyLogo || null;

        // Lưu trước vào store cục bộ
        set({
          companyName: nextName,
          companySlogan: nextSlogan,
          companyLogo: nextLogo,
          companyHotline: branding.hotline || get().companyHotline,
          companyAddress: branding.address || get().companyAddress,
          companyEmail: branding.adminEmail || get().companyEmail,
        });

        // Đẩy lên Supabase Cloud
        await api.branding.save({
          companyName: nextName,
          companySlogan: nextSlogan,
          companyLogo: nextLogo,
          hotline: branding.hotline,
          address: branding.address,
          adminEmail: branding.adminEmail,
          updatedBy: branding.updatedBy,
        });
      },
    }),
    {
      name: 'titsmart-ui-settings',
      partialize: (state) => ({
        sidebarHoverToExpand: state.sidebarHoverToExpand,
        sidebarShowToggleButton: state.sidebarShowToggleButton,
        isSidebarExpanded: state.isSidebarExpanded,
        showNotificationBell: state.showNotificationBell,
        autoShowNotificationPopup: state.autoShowNotificationPopup,
        showChatWidget: state.showChatWidget,
        companyName: state.companyName,
        companySlogan: state.companySlogan,
        companyLogo: state.companyLogo,
        allowDirectFundApproval: state.allowDirectFundApproval,
        allowDualCheckerReviewerRole: state.allowDualCheckerReviewerRole,
        defaultAccountantId: state.defaultAccountantId,
        defaultAccountantName: state.defaultAccountantName,
        tablePaginationMode: state.tablePaginationMode,
        tablePageSize: state.tablePageSize,
      }),
    }
  )
);
