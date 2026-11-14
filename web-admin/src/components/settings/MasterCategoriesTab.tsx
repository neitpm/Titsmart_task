import React, { useState } from 'react';
import { usePlatformAdminStore } from '../../services/platformAdminStore';

interface MasterCategoriesTabProps {
  triggerToast: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const MasterCategoriesTab: React.FC<MasterCategoriesTabProps> = ({ triggerToast }) => {
  const { masterCategories, saveMasterCategories } = usePlatformAdminStore();

  const [categories, setCategories] = useState<string[]>(masterCategories.projectCategories);
  const [statuses, setStatuses] = useState<string[]>(masterCategories.taskProgressStatuses);
  const [expenses, setExpenses] = useState<string[]>(masterCategories.expenseCategories);

  const [newCat, setNewCat] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newExpense, setNewExpense] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCategory = () => {
    if (!newCat.trim()) return;
    if (categories.includes(newCat.trim())) {
      triggerToast('Phân loại này đã tồn tại!', 'warning');
      return;
    }
    setCategories([...categories, newCat.trim()]);
    setNewCat('');
  };

  const handleRemoveCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleAddStatus = () => {
    if (!newStatus.trim()) return;
    if (statuses.includes(newStatus.trim())) {
      triggerToast('Trạng thái này đã tồn tại!', 'warning');
      return;
    }
    setStatuses([...statuses, newStatus.trim()]);
    setNewStatus('');
  };

  const handleRemoveStatus = (index: number) => {
    setStatuses(statuses.filter((_, i) => i !== index));
  };

  const handleAddExpense = () => {
    if (!newExpense.trim()) return;
    if (expenses.includes(newExpense.trim())) {
      triggerToast('Khoản mục chi phí này đã tồn tại!', 'warning');
      return;
    }
    setExpenses([...expenses, newExpense.trim()]);
    setNewExpense('');
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await saveMasterCategories({
        projectCategories: categories,
        taskProgressStatuses: statuses,
        expenseCategories: expenses
      });
      triggerToast('Đã lưu cấu hình danh mục toàn hệ thống thành công!', 'success');
    } catch {
      triggerToast('Lỗi khi lưu danh mục!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Danh mục chuẩn toàn hệ thống (Master Data)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình phân loại dự án, tiến độ công việc và các nhóm chi phí mẫu cho tất cả các đơn vị sử dụng.
          </p>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSaveAll}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-blue-800 transition-colors shadow-2xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">save</span>
          <span>{isSaving ? 'Đang lưu...' : 'Lưu tất cả danh mục'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Cột 1: Phân loại dự án */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
              <span className="material-symbols-outlined text-primary text-lg">category</span>
              <h2 className="text-sm font-bold text-slate-900">Phân loại Dự án ({categories.length})</h2>
            </div>
            <div className="flex gap-1.5 mb-3">
              <input
                type="text"
                placeholder="Thêm loại dự án mới..."
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3 py-1.5 bg-blue-50 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {categories.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                  <span className="font-semibold truncate pr-2">{c}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cột 2: Trạng thái tiến độ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
              <span className="material-symbols-outlined text-emerald-600 text-lg">checklist</span>
              <h2 className="text-sm font-bold text-slate-900">Trạng thái Công việc ({statuses.length})</h2>
            </div>
            <div className="flex gap-1.5 mb-3">
              <input
                type="text"
                placeholder="Thêm trạng thái mới..."
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddStatus())}
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddStatus}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {statuses.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                  <span className="font-semibold truncate pr-2">{s}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStatus(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cột 3: Khoản mục chi phí */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
              <span className="material-symbols-outlined text-amber-600 text-lg">paid</span>
              <h2 className="text-sm font-bold text-slate-900">Khoản mục Chi phí ({expenses.length})</h2>
            </div>
            <div className="flex gap-1.5 mb-3">
              <input
                type="text"
                placeholder="Thêm khoản chi..."
                value={newExpense}
                onChange={(e) => setNewExpense(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExpense())}
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddExpense}
                className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {expenses.map((ex, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                  <span className="font-semibold truncate pr-2">{ex}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExpense(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
