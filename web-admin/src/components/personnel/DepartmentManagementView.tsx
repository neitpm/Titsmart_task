import React, { useState, useMemo } from 'react';
import { Department, Engineer } from '../../types';
import { useDepartmentStore } from '../../services/departmentStore';
import { Modal } from '../common/Modal';
import { CustomSelect } from '../common/CustomSelect';
import { ViewModeToolbar, resolveViewMode, AppViewMode } from '../common/ViewModeToolbar';

interface DepartmentManagementViewProps {
  engineers: Engineer[];
  onSelectDepartmentFilter?: (departmentId: string, departmentName: string) => void;
  isInline?: boolean;
}

export const DepartmentManagementView: React.FC<DepartmentManagementViewProps> = ({
  engineers,
  onSelectDepartmentFilter,
  isInline = true
}) => {
  const departments = useDepartmentStore((s) => s.departments);
  const addDepartment = useDepartmentStore((s) => s.addDepartment);
  const updateDepartment = useDepartmentStore((s) => s.updateDepartment);
  const toggleDepartmentStatus = useDepartmentStore((s) => s.toggleDepartmentStatus);
  const deleteDepartment = useDepartmentStore((s) => s.deleteDepartment);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [managerFilter, setManagerFilter] = useState<string>('ALL');

  // Chế độ xem: 4 tùy chọn theo đúng chuẩn TITSMART (Dạng thẻ, Thẻ thu gọn, Bảng gọn, Bảng chi tiết, Bảng Kanban)
  const [viewMode, setViewMode] = useState<AppViewMode>('table');

  // Form modal state (Tạo mới / Chỉnh sửa phòng ban)
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    managerId: '',
    managerName: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });
  const [formError, setFormError] = useState('');

  // Xem danh sách nhân sự của một phòng ban cụ thể
  const [viewingMembersDept, setViewingMembersDept] = useState<Department | null>(null);

  // Danh sách các trưởng phòng có trong phòng ban
  const departmentManagers = useMemo(() => {
    const list: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();
    departments.forEach((d) => {
      if (d.managerId && d.managerName && !seen.has(d.managerId)) {
        seen.add(d.managerId);
        list.push({ id: d.managerId, name: d.managerName });
      }
    });
    return list;
  }, [departments]);

  // Tính số lượng nhân sự theo phòng ban
  const departmentMemberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    departments.forEach((d) => {
      counts[d.id] = 0;
    });

    engineers.forEach((eng) => {
      if (eng.departmentId && counts[eng.departmentId] !== undefined) {
        counts[eng.departmentId]++;
      } else if (eng.departmentCode) {
        const found = departments.find((d) => d.code.toUpperCase() === eng.departmentCode?.toUpperCase());
        if (found) counts[found.id]++;
        else if (counts['dept_unassigned'] !== undefined) counts['dept_unassigned']++;
      } else if (eng.departmentName || (eng as any).department) {
        const dName = ((eng.departmentName || (eng as any).department) || '').toLowerCase();
        const found = departments.find((d) => d.name.toLowerCase() === dName);
        if (found) counts[found.id]++;
        else if (counts['dept_unassigned'] !== undefined) counts['dept_unassigned']++;
      } else if (counts['dept_unassigned'] !== undefined) {
        counts['dept_unassigned']++;
      }
    });

    return counts;
  }, [departments, engineers]);

  // Lọc phòng ban theo ô tìm kiếm, trạng thái, trưởng phòng
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;

      if (managerFilter !== 'ALL') {
        if (managerFilter === 'UNASSIGNED') {
          if (d.managerId) return false;
        } else if (d.managerId !== managerFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = d.code.toLowerCase().includes(q);
        const matchName = d.name.toLowerCase().includes(q);
        const matchDesc = (d.description || '').toLowerCase().includes(q);
        const matchMgr = (d.managerName || '').toLowerCase().includes(q);
        return matchCode || matchName || matchDesc || matchMgr;
      }

      return true;
    });
  }, [departments, statusFilter, managerFilter, searchQuery]);

  // Danh sách nhân sự thuộc phòng đang xem
  const membersOfViewingDept = useMemo(() => {
    if (!viewingMembersDept) return [];
    return engineers.filter((eng) => {
      if (viewingMembersDept.code === 'PB-UNASSIGNED') {
        const hasDept = eng.departmentId || eng.departmentCode || eng.departmentName || (eng as any).department;
        return !hasDept || eng.departmentId === viewingMembersDept.id || eng.departmentCode === viewingMembersDept.code;
      }
      return (
        eng.departmentId === viewingMembersDept.id ||
        eng.departmentCode?.toUpperCase() === viewingMembersDept.code.toUpperCase() ||
        (eng.departmentName && eng.departmentName.toLowerCase() === viewingMembersDept.name.toLowerCase()) ||
        ((eng as any).department && (eng as any).department.toLowerCase() === viewingMembersDept.name.toLowerCase())
      );
    });
  }, [viewingMembersDept, engineers]);

  const handleOpenCreate = () => {
    setEditingDept(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      managerId: '',
      managerName: '',
      status: 'ACTIVE'
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      code: dept.code,
      name: dept.name,
      description: dept.description || '',
      managerId: dept.managerId || '',
      managerName: dept.managerName || '',
      status: dept.status
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Vui lòng nhập tên phòng ban');
      return;
    }
    if (!formData.code.trim()) {
      setFormError('Vui lòng nhập mã phòng ban');
      return;
    }

    const cleanCode = formData.code.trim().toUpperCase();

    const duplicate = departments.find(
      (d) => d.code.toUpperCase() === cleanCode && (!editingDept || d.id !== editingDept.id)
    );
    if (duplicate) {
      setFormError(`Mã phòng ban "${cleanCode}" đã tồn tại trên hệ thống`);
      return;
    }

    const selectedManager = engineers.find((eng) => eng.id === formData.managerId);

    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, {
          code: cleanCode,
          name: formData.name.trim(),
          description: formData.description.trim(),
          managerId: formData.managerId || undefined,
          managerName: selectedManager ? selectedManager.name : (formData.managerName || undefined),
          status: formData.status
        });
      } else {
        await addDepartment({
          code: cleanCode,
          name: formData.name.trim(),
          description: formData.description.trim(),
          managerId: formData.managerId || undefined,
          managerName: selectedManager ? selectedManager.name : (formData.managerName || undefined),
          status: formData.status
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu phòng ban');
    }
  };

  const handleDelete = async (dept: Department) => {
    if (dept.code === 'PB-UNASSIGNED') {
      alert('Không thể xóa phòng ban mặc định của hệ thống.');
      return;
    }
    const count = departmentMemberCounts[dept.id] || 0;
    if (count > 0) {
      alert(`Phòng ban "${dept.name}" hiện đang có ${count} nhân sự trực thuộc.\n\nVui lòng điều chuyển toàn bộ nhân sự sang phòng khác trước khi xóa, hoặc chuyển trạng thái phòng sang "Ngừng hoạt động".`);
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa phòng ban "${dept.name}" (${dept.code})?`)) {
      const res = await deleteDepartment(dept.id, engineers);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  return (
    <div className={`flex flex-col flex-1 w-full bg-slate-50 ${isInline ? 'h-full' : 'h-[75vh] max-h-[750px] rounded-lg border border-slate-200'}`}>
      {/* Bộ lọc chuẩn 1 hàng: tìm kiếm, trạng thái, trưởng phòng, combobox chế độ xem, nút thêm */}
      <div className="px-3.5 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input
              type="text"
              placeholder="Tìm mã, tên phòng, trưởng phòng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:bg-white outline-none transition-colors"
            />
          </div>

          {/* Lọc Trạng thái */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium whitespace-nowrap text-[11px]">Trạng thái:</span>
            <div className="w-36">
              <CustomSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs font-medium"
              >
                <option value="ALL">Tất cả ({departments.length})</option>
                <option value="ACTIVE">Hoạt động ({departments.filter(d => d.status === 'ACTIVE').length})</option>
                <option value="INACTIVE">Ngừng dùng ({departments.filter(d => d.status === 'INACTIVE').length})</option>
              </CustomSelect>
            </div>
          </div>

          {/* Lọc Trưởng phòng */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium whitespace-nowrap text-[11px]">Trưởng phòng:</span>
            <div className="w-48">
              <CustomSelect
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
                searchable={true}
                className="text-xs font-medium"
              >
                <option value="ALL">-- Tất cả trưởng phòng --</option>
                <option value="UNASSIGNED">Chưa bổ nhiệm</option>
                {departmentManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>

          {(searchQuery || statusFilter !== 'ALL' || managerFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setManagerFilter('ALL');
              }}
              className="px-2 py-1 text-slate-500 hover:text-rose-600 rounded text-xs font-semibold flex items-center gap-0.5 cursor-pointer"
              title="Đặt lại bộ lọc"
            >
              <span className="material-symbols-outlined text-sm">clear_all</span>
              <span>Đặt lại</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Combobox Chọn chế độ xem (Dạng thẻ, Thẻ thu gọn, Bảng gọn, Bảng chi tiết, Bảng Kanban) */}
          <ViewModeToolbar
            currentMode={viewMode}
            onModeChange={setViewMode}
            supportedModes={['grid', 'compact_grid', 'table', 'table_detailed', 'kanban']}
          />

          <span className="text-slate-400 text-[11px] font-medium hidden md:inline">
            <strong>{filteredDepartments.length}</strong> / {departments.length} phòng
          </span>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Thêm phòng ban</span>
          </button>
        </div>
      </div>

      {/* NỘI DUNG HIỂN THỊ THEO 5 CHẾ ĐỘ XEM */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 p-3">
        {filteredDepartments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
            Không tìm thấy phòng ban nào phù hợp với bộ lọc
          </div>
        ) : (
          <>
            {/* 1. DẠNG THẺ (GRID) */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredDepartments.map((dept) => {
                  const memberCount = departmentMemberCounts[dept.id] || 0;
                  const isUnassigned = dept.code === 'PB-UNASSIGNED';
                  return (
                    <div
                      key={dept.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0">
                              <span className="material-symbols-outlined text-xl">corporate_fare</span>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-primary transition-colors" title={dept.name}>
                                {dept.name}
                              </h4>
                              <span className="text-[11px] font-mono text-primary font-bold">{dept.code}</span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            dept.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {dept.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng dùng'}
                          </span>
                        </div>

                        {dept.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                            {dept.description}
                          </p>
                        )}

                        <div className="space-y-1.5 py-2 border-t border-slate-100 text-[11px] text-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Trưởng phòng:</span>
                            <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                              {dept.managerName || 'Chưa bổ nhiệm'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Số nhân sự:</span>
                            <button
                              type="button"
                              onClick={() => setViewingMembersDept(dept)}
                              className="font-bold text-primary hover:underline cursor-pointer"
                            >
                              {memberCount} nhân sự
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 pt-2.5 border-t border-slate-100 mt-2">
                        {onSelectDepartmentFilter && (
                          <button
                            type="button"
                            onClick={() => onSelectDepartmentFilter(dept.id, dept.name)}
                            className="p-1 rounded text-slate-500 hover:text-primary hover:bg-slate-100"
                            title="Lọc nhân sự phòng này"
                          >
                            <span className="material-symbols-outlined text-base">filter_alt</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(dept)}
                          className="p-1 rounded text-slate-500 hover:text-primary hover:bg-slate-100"
                          title="Sửa phòng ban"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        {!isUnassigned && (
                          <button
                            type="button"
                            onClick={() => handleDelete(dept)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Xóa phòng ban"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. THẺ THU GỌN (COMPACT_GRID) */}
            {viewMode === 'compact_grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                {filteredDepartments.map((dept) => {
                  const memberCount = departmentMemberCounts[dept.id] || 0;
                  return (
                    <div
                      key={dept.id}
                      onClick={() => setViewingMembersDept(dept)}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between cursor-pointer hover:border-primary/50 group"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded bg-blue-50 text-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base">corporate_fare</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 truncate group-hover:text-primary transition-colors" title={dept.name}>
                            {dept.name}
                          </div>
                          <div className="text-[10px] font-mono text-primary font-semibold">{dept.code}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-[10.5px]">
                        <span className="text-slate-400 font-medium">{memberCount} người</span>
                        <span className={`w-2 h-2 rounded-full ${dept.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. BẢNG GỌN (TABLE) */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-2xs custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-600 uppercase text-[11px] tracking-tight">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">STT</th>
                      <th className="py-2.5 px-3 w-28">Mã phòng</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Tên phòng ban</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Trưởng phòng</th>
                      <th className="py-2.5 px-3 w-28 text-center">Số nhân sự</th>
                      <th className="py-2.5 px-3 w-28 text-center">Trạng thái</th>
                      <th className="py-2.5 px-3 w-24 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDepartments.map((dept, index) => {
                      const memberCount = departmentMemberCounts[dept.id] || 0;
                      const isUnassigned = dept.code === 'PB-UNASSIGNED';
                      return (
                        <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{index + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{dept.code}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{dept.name}</td>
                          <td className="py-2.5 px-3 text-slate-700">{dept.managerName || <span className="text-slate-400 italic">Chưa bổ nhiệm</span>}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-primary">
                            <button
                              type="button"
                              onClick={() => setViewingMembersDept(dept)}
                              className="hover:underline cursor-pointer"
                            >
                              {memberCount} nhân sự
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dept.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {dept.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng dùng'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(dept)}
                              className="p-1 rounded text-slate-500 hover:text-primary hover:bg-slate-100 mr-1"
                              title="Sửa"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            {!isUnassigned && (
                              <button
                                type="button"
                                onClick={() => handleDelete(dept)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Xóa"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. BẢNG CHI TIẾT (TABLE_DETAILED) */}
            {viewMode === 'table_detailed' && (
              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-2xs custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-600 uppercase text-[11px] tracking-tight">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">STT</th>
                      <th className="py-2.5 px-3 w-28">Mã phòng</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Tên phòng ban & Chức năng</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Trưởng phòng</th>
                      <th className="py-2.5 px-3 w-28 text-center">Số nhân sự</th>
                      <th className="py-2.5 px-3 w-32 text-center">Trạng thái</th>
                      <th className="py-2.5 px-3 w-36 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDepartments.map((dept, index) => {
                      const memberCount = departmentMemberCounts[dept.id] || 0;
                      const isUnassigned = dept.code === 'PB-UNASSIGNED';
                      return (
                        <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{index + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{dept.code}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div>{dept.name}</div>
                            {dept.description && (
                              <div className="text-[11px] text-slate-400 font-normal line-clamp-1 mt-0.5">{dept.description}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {dept.managerName ? (
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px] text-primary">account_circle</span>
                                <span className="font-semibold text-slate-800">{dept.managerName}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Chưa bổ nhiệm</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setViewingMembersDept(dept)}
                              className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-primary hover:text-white text-slate-700 font-bold text-[11px] border border-slate-200 transition-colors cursor-pointer"
                              title="Bấm xem nhân sự"
                            >
                              {memberCount} nhân sự
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              disabled={isUnassigned}
                              onClick={() => toggleDepartmentStatus(dept.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                dept.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              } ${isUnassigned ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                            >
                              {dept.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng dùng'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {onSelectDepartmentFilter && (
                                <button
                                  type="button"
                                  onClick={() => onSelectDepartmentFilter(dept.id, dept.name)}
                                  className="p-1 rounded text-slate-500 hover:text-primary hover:bg-slate-100"
                                  title="Lọc nhân sự phòng này"
                                >
                                  <span className="material-symbols-outlined text-base">filter_alt</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(dept)}
                                className="p-1 rounded text-slate-500 hover:text-primary hover:bg-slate-100"
                                title="Sửa"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              {!isUnassigned && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(dept)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                  title="Xóa"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. BẢNG KANBAN */}
            {viewMode === 'kanban' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDepartments.map((dept) => {
                  const members = engineers.filter((eng) => {
                    if (dept.code === 'PB-UNASSIGNED') {
                      const hasDept = eng.departmentId || eng.departmentCode || eng.departmentName || (eng as any).department;
                      return !hasDept || eng.departmentId === dept.id || eng.departmentCode === dept.code;
                    }
                    return (
                      eng.departmentId === dept.id ||
                      eng.departmentCode?.toUpperCase() === dept.code.toUpperCase() ||
                      (eng.departmentName && eng.departmentName.toLowerCase() === dept.name.toLowerCase()) ||
                      ((eng as any).department && (eng as any).department.toLowerCase() === dept.name.toLowerCase())
                    );
                  });

                  return (
                    <div key={dept.id} className="bg-slate-100/80 rounded-xl p-3 border border-slate-200 flex flex-col h-[520px]">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-primary text-base">corporate_fare</span>
                          <span className="font-bold text-xs text-slate-800 truncate" title={dept.name}>{dept.name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 font-bold text-[10px] border border-slate-200 shrink-0">
                          {members.length}
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {members.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-[11px] italic">
                            Chưa có nhân sự
                          </div>
                        ) : (
                          members.map((m) => (
                            <div key={m.id} className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-all">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden">
                                  {(m as any).avatar ? <img src={(m as any).avatar} alt="" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-sm">person</span>}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-xs text-slate-800 truncate">{m.name}</div>
                                  <div className="text-[10px] text-slate-500 truncate">{m.title || m.role || 'Kỹ sư'}</div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer ghi chú */}
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Tổng số phòng ban: <strong>{departments.length}</strong> (Đang hoạt động: <strong>{departments.filter(d => d.status === 'ACTIVE').length}</strong>)</span>
        <span className="italic hidden sm:inline">Phòng ban đã ngừng dùng sẽ không xuất hiện khi tạo mới nhân viên.</span>
      </div>

      {/* Modal Con: Tạo / Sửa Phòng ban */}
      {isFormOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsFormOpen(false)}
          title={editingDept ? `Chỉnh sửa: ${editingDept.name}` : 'Tạo mới Phòng ban'}
          size="md"
          icon="domain"
          zIndexClass="z-[110]"
          requireConfirmOnClose={true}
        >
          <form onSubmit={handleSaveForm} className="space-y-3 p-1">
            {formError && (
              <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã phòng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="PB-KT, PB-KD..."
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 font-mono font-bold focus:border-primary outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên phòng ban <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Phòng Kỹ thuật & Dự án..."
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 font-bold focus:border-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Trưởng phòng</label>
              <CustomSelect
                value={formData.managerId}
                onChange={(e) => {
                  const id = e.target.value;
                  const eng = engineers.find(x => x.id === id);
                  setFormData(prev => ({
                    ...prev,
                    managerId: id,
                    managerName: eng ? eng.name : ''
                  }));
                }}
                searchable={true}
                className="w-full text-xs font-bold"
              >
                <option value="">-- Chưa bổ nhiệm trưởng phòng --</option>
                {engineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name} ({eng.title || eng.role || 'Kỹ sư'})
                  </option>
                ))}
              </CustomSelect>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả chức năng nhiệm vụ</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Nhiệm vụ, phạm vi quản lý của phòng ban..."
                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:border-primary outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Trạng thái:</label>
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="dept_status_inline"
                  value="ACTIVE"
                  checked={formData.status === 'ACTIVE'}
                  onChange={() => setFormData(prev => ({ ...prev, status: 'ACTIVE' }))}
                  className="text-primary"
                />
                <span className="font-semibold text-emerald-700">Hoạt động</span>
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="dept_status_inline"
                  value="INACTIVE"
                  checked={formData.status === 'INACTIVE'}
                  onChange={() => setFormData(prev => ({ ...prev, status: 'INACTIVE' }))}
                  className="text-slate-500"
                />
                <span className="font-semibold text-slate-500">Ngừng hoạt động</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-white hover:bg-blue-700 shadow-xs"
              >
                {editingDept ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Con: Xem danh sách nhân sự của phòng ban */}
      {viewingMembersDept && (
        <Modal
          isOpen={true}
          onClose={() => setViewingMembersDept(null)}
          title={`Danh sách nhân sự: ${viewingMembersDept.name} (${membersOfViewingDept.length})`}
          size="lg"
          icon="group"
          zIndexClass="z-[110]"
          requireConfirmOnClose={false}
        >
          <div className="flex flex-col max-h-[60vh] bg-white rounded-lg overflow-hidden">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span>Trưởng phòng: <strong>{viewingMembersDept.managerName || 'Chưa bổ nhiệm'}</strong></span>
              {onSelectDepartmentFilter && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectDepartmentFilter(viewingMembersDept.id, viewingMembersDept.name);
                    setViewingMembersDept(null);
                  }}
                  className="px-2.5 py-1 rounded bg-primary text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                >
                  Lọc xem trên danh sách nhân sự
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 sticky top-0 font-bold text-slate-600 text-[11px] uppercase border-b">
                  <tr>
                    <th className="py-2 px-3 w-10 text-center">STT</th>
                    <th className="py-2 px-3">Họ và tên</th>
                    <th className="py-2 px-3">Chức danh / Vị trí</th>
                    <th className="py-2 px-3">Số điện thoại</th>
                    <th className="py-2 px-3">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {membersOfViewingDept.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                        Chưa có nhân sự nào được phân vào phòng này
                      </td>
                    </tr>
                  ) : (
                    membersOfViewingDept.map((mem, idx) => (
                      <tr key={mem.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{mem.name}</td>
                        <td className="py-2 px-3 text-slate-600">{mem.title || mem.role || 'Kỹ sư'}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{mem.phone || '-'}</td>
                        <td className="py-2 px-3 text-slate-600">{mem.email || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
