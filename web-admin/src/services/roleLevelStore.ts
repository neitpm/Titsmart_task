import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Permission } from '../types';
import { api } from './apiSupabase';

export interface CustomRoleLevel {
  id: string; // e.g. 'level1', 'level2', 'level3', 'level4', etc.
  name: string; // e.g. 'Cấp 1', 'Cấp 2 - Quản lý', 'Cấp 4 - Kế toán trưởng'
  description?: string;
  defaultRoleName?: string; // Tên chức vụ gợi ý, vd: 'Giám đốc', 'Kế toán'
  permissions: Permission[];
  isBuiltin?: boolean; // Cấp mặc định của hệ thống
}

export const DEFAULT_ROLE_LEVELS: CustomRoleLevel[] = [
  {
    id: 'level1',
    name: 'Cấp 1 - Ban Giám Đốc (Điều hành)',
    description: 'Thẩm quyền tối cao về nghiệp vụ, điều hành toàn diện, duyệt cấp cao, duyệt quỹ, phê duyệt dự án',
    defaultRoleName: 'Giám đốc',
    isBuiltin: true,
    permissions: [
      'VIEW_PROJECTS', 'CREATE_PROJECTS', 'EDIT_PROJECTS', 'DELETE_PROJECTS',
      'VIEW_TASKS', 'IMPORT_TASKS', 'EDIT_TASKS', 'ASSIGN_TASKS', 'UPDATE_TASK_PROGRESS', 'APPROVE_TASKS', 'VIEW_FIELD_LOGS', 'MANAGE_FIELD_LOGS',
      'VIEW_MATERIALS', 'IMPORT_MATERIALS', 'EDIT_MATERIALS', 'UPDATE_MATERIAL_STATUS', 'MANAGE_INVENTORY',
      'VIEW_FINANCE', 'EDIT_PRICES', 'VIEW_PAYMENTS', 'EDIT_PAYMENTS', 'VIEW_EXPENSES', 'EDIT_EXPENSES',
      'CHECK_FUND_REQUEST', 'APPROVE_FUND_REQUEST', 'PROCESS_FUND_TRANSFER', 'CONFIRM_FUND_RECEIPT',
      'VIEW_USERS', 'MANAGE_PAYROLL', 'APPROVE_LEAVE_STEP1', 'APPROVE_LEAVE_FINAL', 'EXPORT_DATA', 'VIEW_ACTIVITY_LOG',
      'VIEW_PROJECT_DIAGRAM', 'MANAGE_PROJECT_DIAGRAM', 'VIEW_DOCUMENTS', 'CREATE_DOCUMENTS', 'EDIT_DOCUMENTS', 'DELETE_DOCUMENTS', 'MANAGE_DOCUMENTS'
    ]
  },
  {
    id: 'level2',
    name: 'Cấp 2 - Quản lý / Chỉ huy trưởng',
    description: 'Quản lý tiến độ, chi phí, vật tư, giao việc và duyệt C1',
    defaultRoleName: 'Quản lý dự án',
    isBuiltin: true,
    permissions: [
      'VIEW_PROJECTS', 'CREATE_PROJECTS', 'EDIT_PROJECTS',
      'VIEW_TASKS', 'IMPORT_TASKS', 'EDIT_TASKS', 'ASSIGN_TASKS', 'UPDATE_TASK_PROGRESS', 'APPROVE_TASKS', 'VIEW_FIELD_LOGS', 'MANAGE_FIELD_LOGS',
      'VIEW_MATERIALS', 'IMPORT_MATERIALS', 'EDIT_MATERIALS', 'UPDATE_MATERIAL_STATUS', 'MANAGE_INVENTORY',
      'VIEW_FINANCE', 'VIEW_PAYMENTS', 'VIEW_EXPENSES', 'EDIT_EXPENSES',
      'CHECK_FUND_REQUEST', 'CONFIRM_FUND_RECEIPT',
      'VIEW_USERS', 'MANAGE_PAYROLL', 'EXPORT_DATA', 'VIEW_ACTIVITY_LOG',
      'APPROVE_LEAVE_STEP1',
      'VIEW_PROJECT_DIAGRAM', 'VIEW_DOCUMENTS', 'MANAGE_DOCUMENTS'
    ]
  },
  {
    id: 'level3',
    name: 'Cấp 3 - Nhân viên / Kỹ sư hiện trường',
    description: 'Thực thi công việc, báo cáo tiến độ, cập nhật vật tư và nhật ký hiện trường',
    defaultRoleName: 'Nhân viên',
    isBuiltin: true,
    permissions: [
      'VIEW_PROJECTS',
      'VIEW_TASKS', 'UPDATE_TASK_PROGRESS', 'VIEW_FIELD_LOGS', 'MANAGE_FIELD_LOGS',
      'VIEW_MATERIALS', 'UPDATE_MATERIAL_STATUS',
      'VIEW_USERS',
      'VIEW_PROJECT_DIAGRAM', 'VIEW_DOCUMENTS'
    ]
  }
];

interface RoleLevelStoreState {
  levels: CustomRoleLevel[];
  isLoading: boolean;
  fetchLevelsFromCloud: () => Promise<void>;
  saveLevelsToCloud: (levels: CustomRoleLevel[], updatedBy?: string) => Promise<void>;
  addLevel: (level: Omit<CustomRoleLevel, 'id'>, updatedBy?: string) => Promise<CustomRoleLevel>;
  updateLevel: (id: string, updates: Partial<CustomRoleLevel>, updatedBy?: string) => Promise<void>;
  deleteLevel: (id: string, updatedBy?: string) => Promise<void>;
  resetToDefault: (updatedBy?: string) => Promise<void>;
}

export const useRoleLevelStore = create<RoleLevelStoreState>()(
  persist(
    (set, get) => ({
      levels: DEFAULT_ROLE_LEVELS,
      isLoading: false,

      fetchLevelsFromCloud: async () => {
        try {
          const cloudLevels = await api.customRoleLevels.get();
          if (Array.isArray(cloudLevels) && cloudLevels.length > 0) {
            // Đảm bảo các cấp mặc định luôn có mặt và hợp nhất với các cấp tùy chỉnh
            const mergedMap = new Map<string, CustomRoleLevel>();
            DEFAULT_ROLE_LEVELS.forEach(lvl => mergedMap.set(lvl.id, lvl));
            cloudLevels.forEach((lvl: CustomRoleLevel) => mergedMap.set(lvl.id, lvl));
            set({ levels: Array.from(mergedMap.values()) });
          }
        } catch (err) {
          console.warn('[RoleLevelStore] Error fetching levels:', err);
        }
      },

      saveLevelsToCloud: async (levels, updatedBy) => {
        set({ levels });
        try {
          await api.customRoleLevels.save(levels, updatedBy);
        } catch (err) {
          console.error('[RoleLevelStore] Error saving levels to cloud:', err);
        }
      },

      addLevel: async (newLevel, updatedBy) => {
        const id = `level_${Date.now()}`;
        const created: CustomRoleLevel = {
          ...newLevel,
          id,
          isBuiltin: false
        };
        const nextLevels = [...get().levels, created];
        await get().saveLevelsToCloud(nextLevels, updatedBy);
        return created;
      },

      updateLevel: async (id, updates, updatedBy) => {
        const nextLevels = get().levels.map(lvl => {
          if (lvl.id === id) {
            return { ...lvl, ...updates };
          }
          return lvl;
        });
        await get().saveLevelsToCloud(nextLevels, updatedBy);
      },

      deleteLevel: async (id, updatedBy) => {
        // Không cho phép xóa Cấp 1, Cấp 2, Cấp 3 cốt lõi
        const target = get().levels.find(l => l.id === id);
        if (target?.isBuiltin) {
          throw new Error('Không thể xóa các cấp mặc định của hệ thống.');
        }
        const nextLevels = get().levels.filter(lvl => lvl.id !== id);
        await get().saveLevelsToCloud(nextLevels, updatedBy);
      },

      resetToDefault: async (updatedBy) => {
        await get().saveLevelsToCloud(DEFAULT_ROLE_LEVELS, updatedBy);
      }
    }),
    {
      name: 'titsmart-role-levels-config',
      partialize: (state) => ({ levels: state.levels })
    }
  )
);
