import React, { useState } from 'react';
import { Engineer } from '../../types';
import { useDepartmentStore } from '../../services/departmentStore';
import { useAuthStore } from '../../services/authStore';
import { Modal } from '../common/Modal';
import { CustomSelect } from '../common/CustomSelect';

interface DepartmentTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineer: Engineer | null;
  onSuccess?: () => void;
}

export const DepartmentTransferModal: React.FC<DepartmentTransferModalProps> = ({
  isOpen,
  onClose,
  engineer,
  onSuccess
}) => {
  const user = useAuthStore((s) => s.user);
  const departments = useDepartmentStore((s) => s.departments);
  const transferEngineerDepartment = useDepartmentStore((s) => s.transferEngineerDepartment);

  const [toDepartmentId, setToDepartmentId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!engineer) return null;

  // Lấy phòng hiện tại của nhân sự
  const currentDept = departments.find(
    (d) =>
      d.id === engineer.departmentId ||
      d.code?.toUpperCase() === engineer.departmentCode?.toUpperCase() ||
      d.name.toLowerCase() === (engineer.departmentName || (engineer as any).department || '').trim().toLowerCase()
  );

  const activeDepartments = departments.filter((d) => d.status === 'ACTIVE');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toDepartmentId) {
      setError('Vui lòng chọn phòng ban tiếp nhận');
      return;
    }
    if (currentDept && toDepartmentId === currentDept.id) {
      setError('Phòng ban tiếp nhận phải khác phòng ban hiện tại');
      return;
    }
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do điều chuyển phòng ban');
      return;
    }

    const targetDept = departments.find((d) => d.id === toDepartmentId);
    if (!targetDept) {
      setError('Phòng ban tiếp nhận không tồn tại');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await transferEngineerDepartment({
        engineerId: engineer.id,
        engineerName: engineer.name,
        fromDepartmentId: currentDept?.id,
        fromDepartmentName: currentDept?.name || (engineer.departmentName || (engineer as any).department || 'Chưa phân phòng'),
        toDepartmentId: targetDept.id,
        toDepartmentName: targetDept.name,
        transferredById: user?.id,
        transferredByName: user?.name || 'Quản trị viên',
        reason: reason.trim(),
        notes: notes.trim() || undefined
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi điều chuyển phòng ban');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Điều chuyển phòng ban: ${engineer.name}`}
      size="md"
      icon="move_down"
      zIndexClass="z-[110]"
      requireConfirmOnClose={false}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 p-1 text-xs">
        {error && (
          <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Thông tin nhân sự & phòng ban hiện tại */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Nhân sự:</span>
            <span className="font-bold text-slate-900 text-sm">{engineer.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Chức vụ:</span>
            <span className="font-semibold text-slate-700">{engineer.title || engineer.role || 'Kỹ sư'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Phòng ban hiện tại:</span>
            <span className="font-bold text-primary px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
              {currentDept?.name || engineer.departmentName || (engineer as any).department || 'Chưa phân phòng'}
            </span>
          </div>
        </div>

        {/* Chọn phòng ban tiếp nhận */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Phòng ban tiếp nhận mới <span className="text-rose-500">*</span>
          </label>
          <CustomSelect
            value={toDepartmentId}
            onChange={(e) => setToDepartmentId(e.target.value)}
            required
            searchable={true}
            className="w-full text-xs font-bold"
          >
            <option value="">-- Chọn phòng ban mới --</option>
            {activeDepartments.map((dept) => (
              <option key={dept.id} value={dept.id} disabled={currentDept?.id === dept.id}>
                {dept.name} ({dept.code}) {currentDept?.id === dept.id ? '- Đang trực thuộc' : ''}
              </option>
            ))}
          </CustomSelect>
        </div>

        {/* Lý do điều chuyển */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Lý do điều chuyển <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={2}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: Tăng cường nhân sự dự án, điều động theo quyết định số..."
            className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:border-primary outline-none font-medium"
          />
        </div>

        {/* Ghi chú thêm */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Ghi chú bổ sung (nếu có)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Quyết định đính kèm, bàn giao công việc..."
            className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:border-primary outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {isSubmitting && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
            <span>Xác nhận điều chuyển</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
