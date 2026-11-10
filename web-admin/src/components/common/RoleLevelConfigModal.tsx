import React, { useState } from 'react';
import { Modal } from './Modal';
import { useRoleLevelStore, CustomRoleLevel } from '../../services/roleLevelStore';
import { useAuthStore } from '../../services/authStore';
import { Permission } from '../../types';

interface RoleLevelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLevel?: (level: CustomRoleLevel) => void;
}

const ALL_PERMISSION_GROUPS: {
  title: string;
  items: { key: Permission; label: string }[];
}[] = [
  {
    title: 'Dự án & Tổng quan',
    items: [
      { key: 'VIEW_PROJECTS', label: 'Xem danh sách dự án' },
      { key: 'CREATE_PROJECTS', label: 'Tạo dự án mới' },
      { key: 'EDIT_PROJECTS', label: 'Sửa thông tin dự án' },
      { key: 'DELETE_PROJECTS', label: 'Xóa dự án' },
    ]
  },
  {
    title: 'Tiến độ công việc',
    items: [
      { key: 'VIEW_TASKS', label: 'Xem tiến độ' },
      { key: 'IMPORT_TASKS', label: 'Nhập Excel/OCR' },
      { key: 'EDIT_TASKS', label: 'Thêm/Sửa/Xóa công việc' },
      { key: 'ASSIGN_TASKS', label: 'Giao việc' },
      { key: 'UPDATE_TASK_PROGRESS', label: 'Cập nhật % và Trạng thái' },
      { key: 'APPROVE_TASKS', label: 'Nghiệm thu công việc' },
      { key: 'VIEW_FIELD_LOGS', label: 'Xem nhật ký công trường' },
      { key: 'MANAGE_FIELD_LOGS', label: 'Cập nhật nhật ký công trường' },
    ]
  },
  {
    title: 'Kế hoạch vật tư',
    items: [
      { key: 'VIEW_MATERIALS', label: 'Xem danh sách vật tư' },
      { key: 'IMPORT_MATERIALS', label: 'Nhập Excel vật tư' },
      { key: 'EDIT_MATERIALS', label: 'Sửa/Xóa vật tư' },
      { key: 'UPDATE_MATERIAL_STATUS', label: 'Cập nhật trạng thái' },
      { key: 'MANAGE_INVENTORY', label: 'Nhập/Xuất/Chuyển kho' },
    ]
  },
  {
    title: 'Tài chính & Hợp đồng',
    items: [
      { key: 'VIEW_FINANCE', label: 'Xem bảng giá' },
      { key: 'EDIT_PRICES', label: 'Cập nhật giá, VAT' },
      { key: 'VIEW_PAYMENTS', label: 'Xem Kế hoạch thanh toán' },
      { key: 'EDIT_PAYMENTS', label: 'Cập nhật thanh toán' },
      { key: 'VIEW_EXPENSES', label: 'Xem chi phí công trình' },
      { key: 'EDIT_EXPENSES', label: 'Quản lý chi phí công trình' },
    ]
  },
  {
    title: 'Nhân sự & Hệ thống',
    items: [
      { key: 'VIEW_USERS', label: 'Xem nhân sự' },
      { key: 'EDIT_USERS', label: 'Chỉnh sửa nhân sự' },
      { key: 'MANAGE_USERS', label: 'Quản lý nhân sự' },
      { key: 'MANAGE_PERMISSIONS', label: 'Cấp quyền hệ thống' },
      { key: 'MANAGE_PAYROLL', label: 'Bảng chấm công' },
      { key: 'APPROVE_LEAVE_STEP1', label: 'Duyệt phép Cấp 1' },
      { key: 'APPROVE_LEAVE_FINAL', label: 'Duyệt phép Cấp 2 (Ban GĐ)' },
      { key: 'EXPORT_DATA', label: 'Xuất báo cáo (Excel/PDF)' },
      { key: 'VIEW_ACTIVITY_LOG', label: 'Xem lịch sử hoạt động' },
    ]
  },
  {
    title: 'Hồ sơ & Tài liệu',
    items: [
      { key: 'VIEW_PROJECT_DIAGRAM', label: 'Xem Thư viện' },
      { key: 'MANAGE_PROJECT_DIAGRAM', label: 'Chỉnh sửa Thư viện' },
      { key: 'VIEW_DOCUMENTS', label: 'Xem hồ sơ & chứng từ' },
      { key: 'CREATE_DOCUMENTS', label: 'Thêm mới hồ sơ gửi đi' },
      { key: 'EDIT_DOCUMENTS', label: 'Cập nhật thông tin & tình trạng ký' },
      { key: 'DELETE_DOCUMENTS', label: 'Xóa hồ sơ' },
      { key: 'MANAGE_DOCUMENTS', label: 'Toàn quyền quản lý hồ sơ' },
    ]
  }
];

export const RoleLevelConfigModal: React.FC<RoleLevelConfigModalProps> = ({
  isOpen,
  onClose,
  onSelectLevel
}) => {
  const { levels, addLevel, updateLevel, deleteLevel } = useRoleLevelStore();
  const user = useAuthStore(state => state.user);

  const [activeLevelId, setActiveLevelId] = useState<string>(levels[0]?.id || 'level1');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDefaultRole, setFormDefaultRole] = useState('');
  const [formPermissions, setFormPermissions] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);

  const currentLevel = levels.find(l => l.id === activeLevelId) || levels[0];

  const handleStartCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    const nextNumber = levels.length + 1;
    setFormName(`Cấp ${nextNumber} - `);
    setFormDescription('');
    setFormDefaultRole('');
    // Mặc định lấy theo Cấp 3
    setFormPermissions([
      'VIEW_PROJECTS',
      'VIEW_TASKS', 'UPDATE_TASK_PROGRESS', 'VIEW_FIELD_LOGS', 'MANAGE_FIELD_LOGS',
      'VIEW_MATERIALS', 'UPDATE_MATERIAL_STATUS',
      'VIEW_USERS',
      'VIEW_PROJECT_DIAGRAM', 'VIEW_DOCUMENTS'
    ]);
  };

  const handleStartEdit = (level: CustomRoleLevel) => {
    setIsCreating(false);
    setIsEditing(true);
    setFormName(level.name);
    setFormDescription(level.description || '');
    setFormDefaultRole(level.defaultRoleName || '');
    setFormPermissions([...level.permissions]);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSaving(true);
    try {
      if (isCreating) {
        const created = await addLevel({
          name: formName.trim(),
          description: formDescription.trim(),
          defaultRoleName: formDefaultRole.trim(),
          permissions: formPermissions
        }, user?.username || 'Admin');
        setActiveLevelId(created.id);
      } else if (isEditing && currentLevel) {
        await updateLevel(currentLevel.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          defaultRoleName: formDefaultRole.trim(),
          permissions: formPermissions
        }, user?.username || 'Admin');
      }
      setIsCreating(false);
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu cấp quyền');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (level: CustomRoleLevel) => {
    if (level.isBuiltin) {
      alert('Không thể xóa các cấp mặc định của hệ thống.');
      return;
    }
    if (!window.confirm(`Bạn chắc chắn muốn xóa "${level.name}"?`)) return;

    try {
      await deleteLevel(level.id, user?.username || 'Admin');
      setActiveLevelId(levels[0]?.id || 'level1');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa cấp quyền');
    }
  };

  const togglePermission = (perm: Permission) => {
    setFormPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cấu hình Cấp Phân Quyền Hệ Thống"
      size="xl"
      icon="settings_accessibility"
    >
      <div className="flex flex-col md:flex-row h-[560px] max-h-[75vh] -m-1">
        {/* Left column: List of Levels */}
        <div className="w-full md:w-64 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Danh mục Cấp</span>
            <button
              type="button"
              onClick={handleStartCreate}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-primary hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Thêm cấp</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {levels.map((lvl) => {
              const isActive = !isCreating && lvl.id === activeLevelId;
              return (
                <div
                  key={lvl.id}
                  onClick={() => {
                    if (isCreating || isEditing) {
                      if (!window.confirm('Bạn có thay đổi chưa lưu, vẫn chuyển cấp?')) return;
                      handleCancelForm();
                    }
                    setActiveLevelId(lvl.id);
                  }}
                  className={`group relative p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isActive
                      ? 'bg-white border-primary/40 shadow-xs ring-1 ring-primary/20'
                      : 'bg-white/60 hover:bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary' : 'bg-slate-300'}`}></span>
                        <span className={`text-xs font-bold truncate block ${isActive ? 'text-primary' : 'text-slate-800'}`}>
                          {lvl.name}
                        </span>
                      </div>
                      {lvl.defaultRoleName && (
                        <span className="text-[10px] text-slate-500 font-medium pl-3.5 block truncate">
                          Chức danh: {lvl.defaultRoleName}
                        </span>
                      )}
                    </div>

                    {!lvl.isBuiltin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(lvl);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity"
                        title="Xóa cấp này"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                  <div className="mt-1 pl-3.5 text-[10px] text-slate-400 font-mono">
                    {lvl.permissions.length} quyền được gán
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-200 bg-white/80">
            <p className="text-[11px] text-slate-500 leading-tight">
              💡 <strong>Gợi ý:</strong> Cấu hình trước các cấp (ví dụ: Cấp 4 - Kế toán, Cấp 5 - Kho) giúp việc cấp quyền cho nhân viên mới chỉ cần 1 click.
            </p>
          </div>
        </div>

        {/* Right column: Level Details / Form */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {isCreating || isEditing ? (
            /* EDIT / CREATE FORM */
            <form onSubmit={handleSaveForm} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {isCreating ? '➕ Thêm Cấp Phân Quyền Mới' : `✏️ Chỉnh sửa: ${currentLevel?.name}`}
                  </h3>
                  <p className="text-xs text-slate-500">Đặt tên cấp và tick chọn bộ quyền mặc định áp dụng</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formName.trim()}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-primary hover:bg-blue-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu cấp quyền'}
                  </button>
                </div>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên cấp phân quyền <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="VD: Cấp 4 - Kế toán trưởng..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Chức danh gợi ý (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={formDefaultRole}
                      onChange={(e) => setFormDefaultRole(e.target.value)}
                      placeholder="VD: Kế toán, Quản lý kho, Chỉ huy trưởng..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mô tả phạm vi trách nhiệm
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="VD: Phụ trách thu chi, duyệt kế hoạch thanh toán, quản lý hóa đơn..."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Permissions checklist */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase">Danh sách quyền thuộc cấp này</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = ALL_PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));
                        if (allKeys.every(k => formPermissions.includes(k))) {
                          setFormPermissions([]);
                        } else {
                          setFormPermissions(allKeys);
                        }
                      }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {ALL_PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key)).every(k => formPermissions.includes(k))
                        ? 'Bỏ chọn tất cả'
                        : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ALL_PERMISSION_GROUPS.map((grp) => (
                      <div key={grp.title} className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 pb-1">
                          {grp.title}
                        </div>
                        {grp.items.map((item) => {
                          const isChecked = formPermissions.includes(item.key);
                          return (
                            <label
                              key={item.key}
                              className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none py-0.5"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(item.key)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                              />
                              <span className={isChecked ? 'font-semibold text-slate-800' : 'text-slate-600'}>
                                {item.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* VIEW DETAIL */
            currentLevel && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">{currentLevel.name}</h3>
                      {currentLevel.isBuiltin && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">
                          Mặc định
                        </span>
                      )}
                    </div>
                    {currentLevel.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{currentLevel.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(currentLevel)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm text-primary">edit</span>
                      <span>Chỉnh sửa cấp</span>
                    </button>
                    {onSelectLevel && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectLevel(currentLevel);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">check</span>
                        <span>Áp dụng vào Form</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                    <span>
                      Đang kích hoạt: <strong className="text-primary font-mono">{currentLevel.permissions.length}</strong> quyền
                    </span>
                    {currentLevel.defaultRoleName && (
                      <span>
                        Chức danh gợi ý: <strong className="text-slate-800">{currentLevel.defaultRoleName}</strong>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ALL_PERMISSION_GROUPS.map((grp) => {
                      const activeInGroup = grp.items.filter(i => currentLevel.permissions.includes(i.key));
                      return (
                        <div
                          key={grp.title}
                          className={`p-2.5 rounded-xl border ${
                            activeInGroup.length > 0 ? 'border-blue-100 bg-blue-50/30' : 'border-slate-100 bg-slate-50/30 opacity-60'
                          } space-y-1`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/70 pb-1 mb-1">
                            <span className="text-[11px] font-bold text-slate-700 uppercase">{grp.title}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {activeInGroup.length}/{grp.items.length}
                            </span>
                          </div>
                          {grp.items.map((item) => {
                            const has = currentLevel.permissions.includes(item.key);
                            return (
                              <div
                                key={item.key}
                                className={`flex items-center gap-1.5 text-xs py-0.5 ${
                                  has ? 'text-slate-800 font-semibold' : 'text-slate-400 line-through'
                                }`}
                              >
                                <span className={`material-symbols-outlined text-xs ${has ? 'text-emerald-600' : 'text-slate-300'}`}>
                                  {has ? 'check_circle' : 'cancel'}
                                </span>
                                <span>{item.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </Modal>
  );
};
