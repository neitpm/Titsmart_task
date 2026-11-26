import { create } from 'zustand';
import { Department, DepartmentTransferHistory, Engineer } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'dept-unassigned',
    code: 'PB-UNASSIGNED',
    name: 'Chưa phân phòng',
    description: 'Phòng ban mặc định cho nhân sự chưa được phân bổ',
    status: 'ACTIVE',
    sortOrder: 999
  },
  {
    id: 'dept-ky-thuat',
    code: 'PB-KT',
    name: 'Phòng Kỹ thuật & Dự án',
    description: 'Quản lý thi công, kỹ thuật dự án và giám sát hiện trường',
    status: 'ACTIVE',
    sortOrder: 1
  },
  {
    id: 'dept-kinh-doanh',
    code: 'PB-KD',
    name: 'Phòng Kinh doanh & Đấu thầu',
    description: 'Tìm kiếm khách hàng, hồ sơ thầu và quan hệ đối tác',
    status: 'ACTIVE',
    sortOrder: 2
  },
  {
    id: 'dept-ke-toan',
    code: 'PB-KTTC',
    name: 'Phòng Kế toán & Tài chính',
    description: 'Quản lý thu chi, thanh toán, ngân sách và dòng tiền dự án',
    status: 'ACTIVE',
    sortOrder: 3
  },
  {
    id: 'dept-nhan-su',
    code: 'PB-HCNS',
    name: 'Phòng Hành chính - Nhân sự',
    description: 'Tuyển dụng, chấm công, tiền lương và hồ sơ nhân sự',
    status: 'ACTIVE',
    sortOrder: 4
  },
  {
    id: 'dept-ban-giam-doc',
    code: 'PB-BGD',
    name: 'Ban Giám Đốc',
    description: 'Ban lãnh đạo điều hành chiến lược và phê duyệt',
    status: 'ACTIVE',
    sortOrder: 0
  }
];

const LOCAL_STORAGE_DEPARTMENTS_KEY = 'titsmart_departments';
const LOCAL_STORAGE_TRANSFER_HISTORY_KEY = 'titsmart_dept_transfers';

const loadLocalDepartments = (): Department[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DEPARTMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_DEPARTMENTS;
};

const loadLocalTransferHistory = (): DepartmentTransferHistory[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TRANSFER_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

interface DepartmentState {
  departments: Department[];
  transferHistory: DepartmentTransferHistory[];
  isLoading: boolean;
  error: string | null;

  fetchDepartments: () => Promise<void>;
  fetchTransferHistory: (engineerId?: string) => Promise<void>;
  addDepartment: (dept: Omit<Department, 'id'>) => Promise<Department>;
  updateDepartment: (id: string, updates: Partial<Department>) => Promise<Department>;
  toggleDepartmentStatus: (id: string) => Promise<void>;
  deleteDepartment: (id: string, currentEngineers: Engineer[]) => Promise<{ success: boolean; message?: string }>;
  transferEngineerDepartment: (params: {
    engineerId: string;
    engineerName: string;
    fromDepartmentId?: string;
    fromDepartmentName?: string;
    toDepartmentId: string;
    toDepartmentName: string;
    transferredById?: string;
    transferredByName?: string;
    reason: string;
    notes?: string;
  }) => Promise<DepartmentTransferHistory>;
  getDepartmentById: (id?: string) => Department | undefined;
  getDepartmentByCode: (code?: string) => Department | undefined;
}

export const useDepartmentStore = create<DepartmentState>((set, get) => ({
  departments: loadLocalDepartments(),
  transferHistory: loadLocalTransferHistory(),
  isLoading: false,
  error: null,

  fetchDepartments: async () => {
    set({ isLoading: true, error: null });
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('departments')
          .select('*')
          .order('sort_order', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: Department[] = data.map((d: any) => ({
            id: d.id,
            code: d.code,
            name: d.name,
            description: d.description || '',
            managerId: d.manager_id,
            managerName: d.manager_name,
            status: d.status || 'ACTIVE',
            sortOrder: d.sort_order ?? 0,
            createdAt: d.created_at,
            updatedAt: d.updated_at
          }));
          set({ departments: mapped, isLoading: false });
          try {
            localStorage.setItem(LOCAL_STORAGE_DEPARTMENTS_KEY, JSON.stringify(mapped));
          } catch {}
          return;
        }
      }
    } catch {}

    // Fallback: local storage
    const local = loadLocalDepartments();
    set({ departments: local, isLoading: false });
  },

  fetchTransferHistory: async (engineerId?: string) => {
    try {
      if (supabase) {
        let query = supabase
          .from('department_transfer_history')
          .select('*')
          .order('transfer_date', { ascending: false });

        if (engineerId) {
          query = query.eq('engineer_id', engineerId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          const mapped: DepartmentTransferHistory[] = data.map((h: any) => ({
            id: h.id,
            engineerId: h.engineer_id,
            engineerName: h.engineer_name,
            fromDepartmentId: h.from_department_id,
            fromDepartmentName: h.from_department_name,
            toDepartmentId: h.to_department_id,
            toDepartmentName: h.to_department_name,
            transferredById: h.transferred_by_id,
            transferredByName: h.transferred_by_name,
            transferDate: h.transfer_date,
            reason: h.reason,
            notes: h.notes,
            createdAt: h.created_at
          }));
          set({ transferHistory: mapped });
          try {
            localStorage.setItem(LOCAL_STORAGE_TRANSFER_HISTORY_KEY, JSON.stringify(mapped));
          } catch {}
          return;
        }
      }
    } catch {}

    const local = loadLocalTransferHistory();
    set({ transferHistory: engineerId ? local.filter(h => h.engineerId === engineerId) : local });
  },

  addDepartment: async (deptData) => {
    const newId = `dept-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newDept: Department = {
      ...deptData,
      id: newId,
      status: deptData.status || 'ACTIVE',
      sortOrder: deptData.sortOrder ?? get().departments.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('departments')
          .insert({
            code: newDept.code,
            name: newDept.name,
            description: newDept.description,
            manager_id: newDept.managerId,
            manager_name: newDept.managerName,
            status: newDept.status,
            sort_order: newDept.sortOrder
          })
          .select()
          .single();

        if (!error && data) {
          newDept.id = data.id;
        }
      }
    } catch {}

    const updated = [...get().departments, newDept];
    set({ departments: updated });
    try {
      localStorage.setItem(LOCAL_STORAGE_DEPARTMENTS_KEY, JSON.stringify(updated));
    } catch {}
    return newDept;
  },

  updateDepartment: async (id, updates) => {
    const existing = get().departments.find(d => d.id === id);
    if (!existing) throw new Error('Không tìm thấy phòng ban');

    const updatedDept: Department = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    try {
      if (supabase) {
        await supabase
          .from('departments')
          .update({
            code: updatedDept.code,
            name: updatedDept.name,
            description: updatedDept.description,
            manager_id: updatedDept.managerId,
            manager_name: updatedDept.managerName,
            status: updatedDept.status,
            sort_order: updatedDept.sortOrder,
            updated_at: updatedDept.updatedAt
          })
          .eq('id', id);
      }
    } catch {}

    const updated = get().departments.map(d => d.id === id ? updatedDept : d);
    set({ departments: updated });
    try {
      localStorage.setItem(LOCAL_STORAGE_DEPARTMENTS_KEY, JSON.stringify(updated));
    } catch {}
    return updatedDept;
  },

  toggleDepartmentStatus: async (id) => {
    const dept = get().departments.find(d => d.id === id);
    if (!dept) return;
    const nextStatus = dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await get().updateDepartment(id, { status: nextStatus });
  },

  deleteDepartment: async (id, currentEngineers) => {
    const dept = get().departments.find(d => d.id === id);
    if (!dept) return { success: false, message: 'Phòng ban không tồn tại' };

    if (dept.code === 'PB-UNASSIGNED') {
      return { success: false, message: 'Không thể xóa phòng ban mặc định của hệ thống' };
    }

    // Kiểm tra xem phòng còn nhân sự hay không
    const memberCount = currentEngineers.filter(e =>
      e.departmentId === id ||
      e.departmentCode === dept.code ||
      e.departmentName?.toLowerCase() === dept.name.toLowerCase()
    ).length;

    if (memberCount > 0) {
      return {
        success: false,
        message: `Phòng ban đang có ${memberCount} nhân sự trực thuộc. Vui lòng chuyển nhân sự sang phòng khác trước khi xóa, hoặc chuyển phòng sang trạng thái Ngừng hoạt động.`
      };
    }

    try {
      if (supabase) {
        await supabase.from('departments').delete().eq('id', id);
      }
    } catch {}

    const updated = get().departments.filter(d => d.id !== id);
    set({ departments: updated });
    try {
      localStorage.setItem(LOCAL_STORAGE_DEPARTMENTS_KEY, JSON.stringify(updated));
    } catch {}
    return { success: true };
  },

  transferEngineerDepartment: async (params) => {
    const newRecord: DepartmentTransferHistory = {
      id: `transfer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      engineerId: params.engineerId,
      engineerName: params.engineerName,
      fromDepartmentId: params.fromDepartmentId,
      fromDepartmentName: params.fromDepartmentName,
      toDepartmentId: params.toDepartmentId,
      toDepartmentName: params.toDepartmentName,
      transferredById: params.transferredById,
      transferredByName: params.transferredByName,
      transferDate: new Date().toISOString(),
      reason: params.reason,
      notes: params.notes,
      createdAt: new Date().toISOString()
    };

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('department_transfer_history')
          .insert({
            engineer_id: newRecord.engineerId,
            engineer_name: newRecord.engineerName,
            from_department_id: newRecord.fromDepartmentId,
            from_department_name: newRecord.fromDepartmentName,
            to_department_id: newRecord.toDepartmentId,
            to_department_name: newRecord.toDepartmentName,
            transferred_by_id: newRecord.transferredById,
            transferred_by_name: newRecord.transferredByName,
            transfer_date: newRecord.transferDate,
            reason: newRecord.reason,
            notes: newRecord.notes
          })
          .select()
          .single();

        if (!error && data) {
          newRecord.id = data.id;
        }

        // Cập nhật thông tin phòng ban trực tiếp vào bảng engineers
        await supabase
          .from('engineers')
          .update({
            department_id: params.toDepartmentId,
            department_code: get().departments.find(d => d.id === params.toDepartmentId)?.code || '',
            department_name: params.toDepartmentName,
            updated_at: new Date().toISOString()
          })
          .eq('id', params.engineerId);
      }
    } catch {}

    const updatedHistory = [newRecord, ...get().transferHistory];
    set({ transferHistory: updatedHistory });
    try {
      localStorage.setItem(LOCAL_STORAGE_TRANSFER_HISTORY_KEY, JSON.stringify(updatedHistory));
    } catch {}
    return newRecord;
  },

  getDepartmentById: (id) => {
    if (!id) return undefined;
    return get().departments.find(d => d.id === id);
  },

  getDepartmentByCode: (code) => {
    if (!code) return undefined;
    return get().departments.find(d => d.code?.toUpperCase() === code?.toUpperCase());
  }
}));
