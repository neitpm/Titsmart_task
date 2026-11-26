import React, { useEffect, useMemo } from 'react';
import { Engineer } from '../../types';
import { useDepartmentStore } from '../../services/departmentStore';
import { Modal } from '../common/Modal';

interface DepartmentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineer?: Engineer | null;
}

export const DepartmentHistoryModal: React.FC<DepartmentHistoryModalProps> = ({
  isOpen,
  onClose,
  engineer
}) => {
  const transferHistory = useDepartmentStore((s) => s.transferHistory);
  const fetchTransferHistory = useDepartmentStore((s) => s.fetchTransferHistory);

  useEffect(() => {
    if (isOpen) {
      fetchTransferHistory(engineer?.id);
    }
  }, [isOpen, engineer?.id, fetchTransferHistory]);

  const records = useMemo(() => {
    if (!engineer) return transferHistory;
    return transferHistory.filter((h) => h.engineerId === engineer.id);
  }, [transferHistory, engineer]);

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={engineer ? `Lịch sử điều chuyển phòng ban: ${engineer.name}` : 'Lịch sử điều chuyển nhân sự toàn công ty'}
      size="lg"
      icon="history"
      zIndexClass="z-[110]"
      requireConfirmOnClose={false}
    >
      <div className="flex flex-col max-h-[65vh] bg-white rounded-lg overflow-hidden text-xs">
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-slate-600 flex items-center justify-between font-medium">
          <span>Tổng số lượt điều chuyển: <strong>{records.length}</strong></span>
          <span className="italic text-[11px] text-slate-400">Lưu vết minh bạch theo quy trình nhân sự</span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 sticky top-0 font-bold text-slate-600 text-[11px] uppercase border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">STT</th>
                {!engineer && <th className="py-2.5 px-3">Nhân sự</th>}
                <th className="py-2.5 px-3">Từ phòng ban</th>
                <th className="py-2.5 px-3">Sang phòng ban</th>
                <th className="py-2.5 px-3 min-w-[160px]">Lý do điều chuyển</th>
                <th className="py-2.5 px-3">Người thực hiện</th>
                <th className="py-2.5 px-3 w-32">Thời điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={engineer ? 6 : 7} className="py-10 text-center text-slate-400 italic">
                    Chưa có lịch sử điều chuyển nào được ghi nhận
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                    {!engineer && (
                      <td className="py-2.5 px-3 font-bold text-slate-900">{r.engineerName}</td>
                    )}
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {r.fromDepartmentName || 'Chưa phân phòng'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-primary font-bold border border-blue-200">
                        {r.toDepartmentName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      <div>{r.reason}</div>
                      {r.notes && <div className="text-[10px] text-slate-400 italic mt-0.5">{r.notes}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                      {r.transferredByName || 'Admin'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {formatDate(r.transferDate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
