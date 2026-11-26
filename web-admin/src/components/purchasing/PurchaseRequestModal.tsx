import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { CustomSelect } from '../common/CustomSelect';
import { PurchaseRequest, PurchaseRequestItem, ProjectMaterialPlan, Engineer } from '../../types';
import { isHighestLevelPerson, isTechnicalAdminUser, getHighestRankLeader } from '../../utils/taskPermission';

interface PurchaseRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: ProjectMaterialPlan[];
  projectCode: string;
  projectName?: string;
  engineers: Engineer[];
  currentUser: any;
  onSubmit: (formData: {
    checkerId: string;
    checkerName: string;
    checkerTitle: string;
    reviewerId: string;
    reviewerName: string;
    reviewerTitle: string;
    neededDate: string;
    priority: 'normal' | 'urgent';
    reason: string;
    note: string;
    items: PurchaseRequestItem[];
  }) => Promise<void>;
}

export const PurchaseRequestModal: React.FC<PurchaseRequestModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  projectCode,
  projectName,
  engineers,
  currentUser,
  onSubmit
}) => {
  const [checkerId, setCheckerId] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [neededDate, setNeededDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    selectedItems.forEach(item => {
      init[item.id] = Number(item.contractVolume || 1);
    });
    return init;
  });

  const selectedChecker = engineers.find(e => e.id === checkerId);
  const isCheckerHighest = isHighestLevelPerson(selectedChecker);
  const highestLeader = getHighestRankLeader(engineers);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkerId && !isCheckerHighest) {
      alert('Vui lòng chọn Người kiểm tra!');
      return;
    }
    if (!reviewerId && !isCheckerHighest) {
      alert('Vui lòng chọn Lãnh đạo phê duyệt!');
      return;
    }
    if (checkerId && reviewerId && checkerId === reviewerId && !isCheckerHighest) {
      alert('Người kiểm tra và Người duyệt cuối cùng không được là cùng một người!');
      return;
    }

    const checker = engineers.find(e => e.id === checkerId);
    const reviewer = engineers.find(e => e.id === reviewerId) || (isCheckerHighest ? selectedChecker : highestLeader);

    const items: PurchaseRequestItem[] = selectedItems.map(p => ({
      id: p.id,
      stt: p.stt,
      name: p.jobContent || (p as any).name || (p as any).content || 'Vật tư',
      unit: p.unit || 'Bộ',
      quantity: quantities[p.id] !== undefined ? quantities[p.id] : Number(p.contractVolume || 1),
      currentStatus: p.orderedStatus || 'Chưa đặt hàng'
    }));

    setIsSubmitting(true);
    try {
      await onSubmit({
        checkerId: checkerId || '',
        checkerName: checker?.name || '',
        checkerTitle: checker?.title || checker?.role || 'Kỹ thuật',
        reviewerId: reviewer?.id || highestLeader?.id || '',
        reviewerName: reviewer?.name || highestLeader?.name || 'Lãnh đạo',
        reviewerTitle: reviewer?.title || reviewer?.role || 'Lãnh đạo',
        neededDate,
        priority,
        reason,
        note,
        items
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Lỗi khi gửi yêu cầu mua hàng!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lập Yêu cầu Mua hàng (Đa cấp)" size="xl" icon="shopping_cart">
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Banner thông tin dự án */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
          <div>
            <span className="font-semibold text-slate-500">Dự án: </span>
            <span className="font-bold">{projectName || projectCode}</span>
            <span className="font-mono text-slate-500 ml-1.5">({projectCode})</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">Người lập: </span>
            <span className="font-bold text-slate-800">{currentUser?.name || currentUser?.username}</span>
          </div>
        </div>

        {/* Danh sách vật tư đề nghị mua */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Danh sách vật tư đề nghị mua ({selectedItems.length} mục) <span className="text-rose-500">*</span>
          </label>
          <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-48 custom-scrollbar">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-1.5 px-2 text-center w-12">STT</th>
                  <th className="py-1.5 px-2">Tên vật tư / Thiết bị</th>
                  <th className="py-1.5 px-2 text-center w-16">ĐVT</th>
                  <th className="py-1.5 px-2 text-right w-24">Số lượng</th>
                  <th className="py-1.5 px-2 w-32">TT Hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-500">{item.stt || idx + 1}</td>
                    <td className="py-1.5 px-2 font-medium text-slate-800">{item.jobContent}</td>
                    <td className="py-1.5 px-2 text-center text-slate-600">{item.unit || '-'}</td>
                    <td className="py-1.5 px-2 text-right">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={quantities[item.id] !== undefined ? quantities[item.id] : (item.contractVolume || 1)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setQuantities(prev => ({ ...prev, [item.id]: val }));
                        }}
                        className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-right font-bold focus:ring-1 focus:ring-primary outline-none"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-slate-500 text-[11px]">{item.orderedStatus || 'Chưa đặt hàng'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cấu hình luồng duyệt đa cấp */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* Người kiểm tra */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Người kiểm tra kỹ thuật / Chỉ huy trưởng <span className="text-rose-500">*</span>
            </label>
            <CustomSelect
              value={checkerId}
              onChange={e => setCheckerId(e.target.value)}
              searchable={true}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
            >
              <option value="">-- Chọn Người kiểm tra --</option>
              {engineers
                .filter(eng => !eng.isLocked && !isTechnicalAdminUser(eng) && eng.id !== currentUser?.id)
                .map(eng => {
                  const isHighest = isHighestLevelPerson(eng);
                  return (
                    <option key={eng.id} value={eng.id}>
                      {eng.name} ({eng.title || eng.role || 'Kỹ thuật'}{isHighest ? ' - Cấp cao nhất' : ''})
                    </option>
                  );
                })}
            </CustomSelect>
          </div>

          {/* Lãnh đạo phê duyệt */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Lãnh đạo phê duyệt mua hàng <span className="text-rose-500">*</span>
            </label>
            <CustomSelect
              value={reviewerId}
              onChange={e => setReviewerId(e.target.value)}
              searchable={true}
              disabled={isCheckerHighest}
              className={`w-full border border-slate-300 rounded-lg p-2 text-xs ${isCheckerHighest ? 'bg-slate-100 opacity-80' : 'bg-white'}`}
            >
              <option value="">{isCheckerHighest ? `-- Tự động duyệt thẳng bởi ${selectedChecker?.name} --` : '-- Chọn Lãnh đạo duyệt --'}</option>
              {engineers
                .filter(eng => {
                  if (eng.isLocked || isTechnicalAdminUser(eng) || eng.id === currentUser?.id) return false;
                  if (checkerId && eng.id === checkerId && !isCheckerHighest) return false;
                  const isExec = String(eng.role || '').toLowerCase().includes('giám đốc') || String(eng.title || '').toLowerCase().includes('giám đốc');
                  return isExec || isHighestLevelPerson(eng);
                })
                .map(eng => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name} ({eng.title || eng.role || 'Lãnh đạo'})
                  </option>
                ))}
            </CustomSelect>
          </div>
        </div>

        {/* Ngày cần & Mức độ ưu tiên */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Hạn chót cần hàng <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={neededDate}
              onChange={e => setNeededDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mức độ ưu tiên
            </label>
            <CustomSelect
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
            >
              <option value="normal">Bình thường (Tiêu chuẩn)</option>
              <option value="urgent">Khẩn cấp / Tiến độ gấp</option>
            </CustomSelect>
          </div>
        </div>

        {/* Lý do mua hàng */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Lý do / Mục đích mua hàng <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={2}
            required
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Nêu rõ lý do mua hàng, phục vụ giai đoạn nào của công trình..."
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-primary outline-none resize-none"
          />
        </div>

        {/* Ghi chú thêm */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú thêm (tùy chọn)</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Yêu cầu kỹ thuật đặc biệt, hãng đề xuất, nhà cung cấp gợi ý..."
            className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-primary outline-none"
          />
        </div>

        {/* Nút hành động */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-primary hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <span className="material-symbols-outlined text-base">send</span>
            )}
            <span>Gửi Yêu Cầu Mua Hàng</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
