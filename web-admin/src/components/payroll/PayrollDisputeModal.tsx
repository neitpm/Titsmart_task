import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { MonthlyPayrollItem } from '../../types';
import { api } from '../../services/apiSupabase';

interface PayrollDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollItem: MonthlyPayrollItem;
  onSuccess: (updated: MonthlyPayrollItem) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const PayrollDisputeModal: React.FC<PayrollDisputeModalProps> = ({
  isOpen,
  onClose,
  payrollItem,
  onSuccess,
  showToast,
}) => {
  const [disputeNote, setDisputeNote] = useState(payrollItem.disputeNote || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!disputeNote.trim()) {
      showToast?.('Vui lòng nhập nội dung thắc mắc / khiếu nại của bạn!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Đảm bảo bản ghi tồn tại
      let activeItem = payrollItem;
      if (!payrollItem.id || payrollItem.id.startsWith('temp-')) {
        activeItem = await api.payroll.save(payrollItem, payrollItem.userName);
      }

      // 2. Gửi phản hồi
      const updated = await api.payroll.dispute(activeItem.id, {
        disputeNote: disputeNote.trim(),
        userId: payrollItem.userId,
        userName: payrollItem.userName,
      });

      showToast?.('Đã gửi phản hồi đến bộ phận Kế toán / Quản trị viên!', 'success');
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('[Dispute] Lỗi gửi phản hồi:', err);
      showToast?.('Lỗi: ' + (err.message || 'Không thể gửi phản hồi'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="PHẢN HỒI / THẮC MẮC BẢNG CÔNG & LƯƠNG" size="md">
      <div className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          <p className="font-bold flex items-center gap-1 text-amber-800">
            <span className="material-symbols-outlined text-[16px]">info</span>
            Gửi thắc mắc đến Kế toán & Ban Giám đốc:
          </p>
          <p className="mt-1 text-amber-700 leading-relaxed">
            Nếu bạn thấy có sự chênh lệch về số ngày công, tiền làm thêm giờ (OT), phụ cấp công trường hoặc các khoản khấu trừ trong <b>Tháng {payrollItem.month}/{payrollItem.year}</b>, vui lòng ghi rõ nội dung bên dưới để được kiểm tra và điều chỉnh.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Nội dung phản hồi / thắc mắc (*):
          </label>
          <textarea
            rows={4}
            value={disputeNote}
            onChange={e => setDisputeNote(e.target.value)}
            placeholder="Ví dụ: Ngày 15/10 em có đi công trường dự án Đắk Mil nhưng bảng công chưa tính phụ cấp công trường; hoặc ngày 20/10 em có tăng ca 3 tiếng..."
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md text-xs transition cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !disputeNote.trim()}
            className="flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-md text-xs shadow-xs transition cursor-pointer"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <span className="material-symbols-outlined text-[16px]">send</span>
            )}
            Gửi phản hồi
          </button>
        </div>
      </div>
    </Modal>
  );
};
