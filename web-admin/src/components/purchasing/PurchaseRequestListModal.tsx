import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PurchaseRequest, PurchaseRequestStatus } from '../../types';
import { isHighestLevelPerson } from '../../utils/taskPermission';

const formatDate = (iso?: string) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
};

interface PurchaseRequestListModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: PurchaseRequest[];
  currentUser: any;
  onApproveByChecker: (req: PurchaseRequest, note?: string) => Promise<void>;
  onApproveByReviewer: (req: PurchaseRequest, note?: string) => Promise<void>;
  onReject: (req: PurchaseRequest, note?: string) => Promise<void>;
  onMarkOrdered?: (req: PurchaseRequest) => Promise<void>;
  onRefresh?: () => void;
  loading?: boolean;
}

const STATUS_CONFIG: Record<PurchaseRequestStatus, { label: string; badge: string; icon: string }> = {
  PENDING_CHECK: { label: 'Chờ kiểm tra', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'schedule' },
  CHECKED_WAITING_APPROVAL: { label: 'Chờ duyệt', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'hourglass_top' },
  APPROVED: { label: 'Đã duyệt mua', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'verified' },
  ORDERED: { label: 'Đã đặt hàng', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: 'local_shipping' },
  REJECTED: { label: 'Từ chối', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'cancel' },
};

export const PurchaseRequestListModal: React.FC<PurchaseRequestListModalProps> = ({
  isOpen,
  onClose,
  requests,
  currentUser,
  onApproveByChecker,
  onApproveByReviewer,
  onReject,
  onMarkOrdered,
  onRefresh,
  loading = false,
}) => {
  const [selectedReq, setSelectedReq] = useState<PurchaseRequest | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const canCheck = (req: PurchaseRequest) => {
    if (req.status !== 'PENDING_CHECK') return false;
    if (isHighestLevelPerson(currentUser)) return true;
    return req.checkerId === currentUser?.id;
  };

  const canApprove = (req: PurchaseRequest) => {
    if (req.status !== 'CHECKED_WAITING_APPROVAL') return false;
    if (isHighestLevelPerson(currentUser)) return true;
    return req.reviewerId === currentUser?.id;
  };

  const handleAction = async (action: 'check' | 'approve' | 'reject' | 'order', req: PurchaseRequest) => {
    setProcessingId(req.id);
    try {
      if (action === 'check') {
        await onApproveByChecker(req, actionNote);
      } else if (action === 'approve') {
        await onApproveByReviewer(req, actionNote);
      } else if (action === 'reject') {
        await onReject(req, actionNote);
      } else if (action === 'order' && onMarkOrdered) {
        await onMarkOrdered(req);
      }
      setActionNote('');
      setSelectedReq(null);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xử lý yêu cầu mua hàng!');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Danh sách Yêu cầu Mua hàng" size="2xl" icon="list_alt">
      <div className="p-4 space-y-3">
        {/* Header toolbar */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Quy trình duyệt: Người lập ➔ Kiểm tra ➔ Lãnh đạo phê duyệt ➔ Đặt hàng</span>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[14px] ${loading ? 'animate-spin' : ''}`}>sync</span>
                <span>Làm mới</span>
              </button>
            )}
            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
              {requests.length} yêu cầu
            </span>
          </div>
        </div>

        {/* Bảng danh sách yêu cầu */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[60vh] custom-scrollbar">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2 px-2.5 w-10 text-center">STT</th>
                <th className="py-2 px-2.5 w-28">Mã đơn</th>
                <th className="py-2 px-2.5 min-w-[120px]">Dự án</th>
                <th className="py-2 px-2.5 min-w-[140px]">Vật tư đề xuất</th>
                <th className="py-2 px-2.5 w-28">Người lập</th>
                <th className="py-2 px-2.5 w-28">Cấp duyệt</th>
                <th className="py-2 px-2.5 w-24 text-center">Hạn cần</th>
                <th className="py-2 px-2.5 w-28 text-center">Trạng thái</th>
                <th className="py-2 px-2.5 w-32 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    Chưa có yêu cầu mua hàng nào được tạo.
                  </td>
                </tr>
              ) : (
                requests.map((req, idx) => {
                  const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING_CHECK;
                  const isProcessing = processingId === req.id;
                  const eligibleCheck = canCheck(req);
                  const eligibleApprove = canApprove(req);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-2.5 font-mono font-bold text-primary">{req.code}</td>
                      <td className="py-2 px-2.5 font-semibold text-slate-800">{req.projectName || req.projectCode}</td>
                      <td className="py-2 px-2.5">
                        <div className="font-medium text-slate-800">
                          {req.items?.length || 0} mục vật tư:
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs" title={req.items?.map(i => `${i.name} (x${i.quantity} ${i.unit})`).join(', ')}>
                          {req.items?.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                        </div>
                      </td>
                      <td className="py-2 px-2.5">
                        <div className="font-semibold text-slate-700">{req.creatorName}</div>
                        <div className="text-[10px] text-slate-400">{formatDate(req.createdAt)}</div>
                      </td>
                      <td className="py-2 px-2.5 text-[11px]">
                        <div><span className="text-slate-400">KT:</span> <b>{req.checkerName || '-'}</b></div>
                        <div><span className="text-slate-400">Duyệt:</span> <b>{req.reviewerName || '-'}</b></div>
                      </td>
                      <td className="py-2 px-2.5 text-center font-semibold text-slate-700">
                        {req.neededDate ? formatDate(req.neededDate) : '-'}
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${cfg.badge}`}>
                          <span className="material-symbols-outlined text-[13px]">{cfg.icon}</span>
                          <span>{cfg.label}</span>
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {eligibleCheck && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleAction('check', req)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-xs cursor-pointer"
                              title="Xác nhận kiểm tra kỹ thuật đạt chuẩn"
                            >
                              Xác nhận KT
                            </button>
                          )}
                          {eligibleApprove && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleAction('approve', req)}
                              className="px-2 py-1 bg-primary hover:bg-blue-800 text-white rounded text-[11px] font-bold shadow-xs cursor-pointer"
                              title="Lãnh đạo phê duyệt mua hàng"
                            >
                              Duyệt mua
                            </button>
                          )}
                          {req.status === 'APPROVED' && onMarkOrdered && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleAction('order', req)}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold shadow-xs cursor-pointer"
                              title="Đã tiến hành đặt hàng với nhà cung cấp"
                            >
                              Đã đặt hàng
                            </button>
                          )}
                          {(eligibleCheck || eligibleApprove) && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleAction('reject', req)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Từ chối yêu cầu mua hàng"
                            >
                              <span className="material-symbols-outlined text-base">close</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
