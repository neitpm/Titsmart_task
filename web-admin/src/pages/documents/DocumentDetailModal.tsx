import React, { useState, useMemo } from 'react';
import { Modal } from '@/components/common/Modal';
import { CustomSelect } from '@/components/common/CustomSelect';
import { FileUpload } from '@/components/common/FileUpload';
import {
  DocumentTrack,
  DocumentVersion,
  DocumentPaymentInstallment,
  DocumentChecklistItem
} from '@/types';
import { useAuthStore } from '@/services/authStore';
import {
  DocumentFlow,
  formatCurrency,
  formatDateDisplay,
  calculateDocumentDueInfo,
  generateDefaultChecklist
} from './documentConstants';

interface DocumentDetailModalProps {
  isOpen: boolean;
  documentData: DocumentTrack;
  onClose: () => void;
  onUpdate: (updatedDoc: Partial<DocumentTrack>, versionReason?: string) => Promise<void> | void;
  triggerToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  isOpen,
  documentData,
  onClose,
  onUpdate,
  triggerToast
}) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'installments' | 'checklist' | 'versions'>('overview');

  // Dữ liệu nghĩa vụ tiền
  // V1 - Giá trị ban đầu KHÔNG BAO GIỜ bị ghi đè
  const initialProposedAmount = documentData.initialProposedAmount ?? documentData.totalAmount ?? documentData.contractValue ?? 0;
  const approvedAmount = documentData.approvedAmount ?? (documentData.totalAmount ?? documentData.contractValue ?? 0);
  const unapprovedAmount = Math.max(0, initialProposedAmount - approvedAmount);
  
  // Tính tổng tiền các đợt đã chi
  const installments: DocumentPaymentInstallment[] = useMemo(() => {
    return documentData.installments || [];
  }, [documentData.installments]);

  const totalInstallmentPaid = useMemo(() => {
    if (installments.length > 0) {
      return installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    }
    return documentData.paidAmount ?? documentData.prepayAmount ?? 0;
  }, [installments, documentData.paidAmount, documentData.prepayAmount]);

  // Còn được thanh toán theo mức duyệt
  const remainingPayableUnderApproval = Math.max(0, approvedAmount - totalInstallmentPaid);
  // Đã quyết toán và còn phải quyết toán
  const settledAmount = documentData.settledAmount ?? 0;
  const pendingSettlementAmount = Math.max(0, totalInstallmentPaid - settledAmount);

  // Checklist chứng từ
  const checklist: DocumentChecklistItem[] = useMemo(() => {
    if (documentData.checklist && documentData.checklist.length > 0) {
      return documentData.checklist;
    }
    return generateDefaultChecklist((documentData.flowType as DocumentFlow) || 'input', documentData.subType);
  }, [documentData.checklist, documentData.flowType, documentData.subType]);

  // Versions
  const versions: DocumentVersion[] = useMemo(() => {
    return documentData.versions || [];
  }, [documentData.versions]);

  // State thêm đợt thanh toán
  const [isAddingInstallment, setIsAddingInstallment] = useState(false);
  const [newInstTitle, setNewInstTitle] = useState('');
  const [newInstAmount, setNewInstAmount] = useState<number>(0);
  const [newInstDate, setNewInstDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newInstTxCode, setNewInstTxCode] = useState('');
  const [newInstPayer, setNewInstPayer] = useState(user?.name || '');
  const [newInstFiles, setNewInstFiles] = useState<string[]>([]);
  const [newInstMethod, setNewInstMethod] = useState<'UNC' | 'TIEN_MAT' | 'CHUYEN_KHOAN'>('UNC');

  // State điều chỉnh phê duyệt / quyết toán
  const [isEditingApproval, setIsEditingApproval] = useState(false);
  const [tempApprovedAmount, setTempApprovedAmount] = useState<number>(approvedAmount);
  const [tempSettledAmount, setTempSettledAmount] = useState<number>(settledAmount);
  const [approvalReason, setApprovalReason] = useState('');

  // 1. Thêm một đợt thanh toán
  const handleAddInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newInstAmount <= 0) {
      triggerToast?.('Vui lòng nhập số tiền hợp lệ (> 0)!', 'warning');
      return;
    }

    const nextNo = installments.length + 1;
    const newInstallment: DocumentPaymentInstallment = {
      id: `inst-${Date.now()}`,
      installmentNo: nextNo,
      title: newInstTitle.trim() || `Thanh toán đợt ${nextNo}`,
      amount: newInstAmount,
      paymentDate: newInstDate,
      paymentMethod: newInstMethod,
      transactionCode: newInstTxCode.trim(),
      payerOrReceiver: newInstPayer.trim(),
      proofFileUrls: newInstFiles,
      confirmationStatus: 'CHO_XAC_NHAN' // Đã chuyển tiền nhưng chờ ký xác nhận
    };

    const updatedInstallments = [...installments, newInstallment];
    const newTotalPaid = updatedInstallments.reduce((s, i) => s + i.amount, 0);

    // Lưu version mới
    const currentVerNumber = (documentData.currentVersion ?? (versions.length || 1)) + 1;
    const newVersion: DocumentVersion = {
      versionNumber: currentVerNumber,
      title: `Đã chi đợt ${nextNo}: ${formatCurrency(newInstAmount)}`,
      timestamp: new Date().toISOString(),
      changedById: user?.id,
      changedByName: user?.name || 'Kế toán / Thủ quỹ',
      reason: `Thực hiện chi đợt ${nextNo} qua ${newInstMethod} - Mã GD: ${newInstTxCode || 'N/A'}. Chờ bên nhận ký xác nhận.`,
      changesSummary: [
        { field: 'paidAmount', label: 'Số tiền đã chi', before: totalInstallmentPaid, after: newTotalPaid },
        { field: 'docStatus', label: 'Trạng thái', before: documentData.docStatus, after: 'Đã thanh toán – chờ ký xác nhận' }
      ],
      snapshot: {
        contractValue: documentData.contractValue,
        approvedAmount: approvedAmount,
        paidAmount: newTotalPaid,
        settledAmount: settledAmount,
        docStatus: 'Đã thanh toán – chờ ký xác nhận',
        paymentStatus: newTotalPaid >= approvedAmount ? 'Đã thanh toán' : 'Thanh toán một phần'
      }
    };

    await onUpdate({
      installments: updatedInstallments,
      paidAmount: newTotalPaid,
      prepayAmount: newTotalPaid,
      docStatus: 'Đã thanh toán – chờ ký xác nhận',
      paymentStatus: newTotalPaid >= approvedAmount ? 'Đã thanh toán' : 'Thanh toán một phần',
      signatureStatus: 'CHO_KY_XAC_NHAN',
      currentVersion: currentVerNumber,
      versions: [...versions, newVersion]
    }, `Đã chi đợt ${nextNo}: ${formatCurrency(newInstAmount)}`);

    setIsAddingInstallment(false);
    setNewInstTitle('');
    setNewInstAmount(0);
    setNewInstTxCode('');
    setNewInstFiles([]);
    triggerToast?.('Đã ghi nhận đợt thanh toán! Hồ sơ chuyển sang: Đã thanh toán – chờ ký xác nhận', 'success');
  };

  // 2. Ký xác nhận đợt thanh toán hoặc Báo sai lệch / Từ chối ký
  const handleConfirmInstallment = async (instId: string, isConfirmed: boolean, note?: string) => {
    const updatedInstallments = installments.map(inst => {
      if (inst.id === instId) {
        return {
          ...inst,
          confirmationStatus: (isConfirmed ? 'DA_XAC_NHAN' : 'TU_CHOI') as any,
          confirmedBy: user?.name || 'Bên nhận',
          confirmedAt: new Date().toISOString(),
          discrepancyNote: note
        };
      }
      return inst;
    });

    const hasPendingSign = updatedInstallments.some(i => i.confirmationStatus === 'CHO_XAC_NHAN');
    const hasRejected = updatedInstallments.some(i => i.confirmationStatus === 'TU_CHOI');

    let nextStatus = documentData.docStatus;
    let nextSigStatus: any = 'DA_KY';

    if (hasRejected) {
      nextStatus = 'Đang đối soát';
      nextSigStatus = 'DANG_DOI_SOAT';
    } else if (hasPendingSign) {
      nextStatus = 'Đã thanh toán – chờ ký xác nhận';
      nextSigStatus = 'CHO_KY_XAC_NHAN';
    } else {
      nextStatus = 'Đã thanh toán';
      nextSigStatus = 'DA_KY';
    }

    const currentVerNumber = (documentData.currentVersion ?? (versions.length || 1)) + 1;
    const newVersion: DocumentVersion = {
      versionNumber: currentVerNumber,
      title: isConfirmed ? 'Bên nhận đã ký xác nhận tiền' : 'Từ chối ký / Báo sai số tiền (Đang đối soát)',
      timestamp: new Date().toISOString(),
      changedById: user?.id,
      changedByName: user?.name || 'Bên nhận',
      reason: note || (isConfirmed ? 'Đã đối soát khớp đúng và ký nhận tiền đầy đủ.' : 'Phát hiện chênh lệch / Sai thông tin.'),
      changesSummary: [
        { field: 'confirmationStatus', label: 'Xác nhận đợt thanh toán', before: 'CHO_XAC_NHAN', after: isConfirmed ? 'DA_XAC_NHAN' : 'TU_CHOI' },
        { field: 'docStatus', label: 'Trạng thái hồ sơ', before: documentData.docStatus, after: nextStatus }
      ],
      snapshot: {
        contractValue: documentData.contractValue,
        approvedAmount: approvedAmount,
        paidAmount: totalInstallmentPaid,
        settledAmount: settledAmount,
        docStatus: nextStatus,
        paymentStatus: documentData.paymentStatus
      }
    };

    await onUpdate({
      installments: updatedInstallments,
      docStatus: nextStatus,
      signatureStatus: nextSigStatus,
      currentVersion: currentVerNumber,
      versions: [...versions, newVersion]
    }, isConfirmed ? 'Ký nhận tiền thành công' : 'Báo sai lệch tiền');

    triggerToast?.(isConfirmed ? 'Đã xác nhận ký nhận tiền thành công!' : 'Đã chuyển hồ sơ sang trạng thái: Đang đối soát!', isConfirmed ? 'success' : 'warning');
  };

  // 3. Cập nhật trạng thái từng mục Checklist
  const handleUpdateChecklistItem = async (
    itemIndex: number,
    status: DocumentChecklistItem['status'],
    files?: string[],
    note?: string
  ) => {
    const updatedChecklist = [...checklist];
    updatedChecklist[itemIndex] = {
      ...updatedChecklist[itemIndex],
      status,
      fileUrls: files !== undefined ? files : updatedChecklist[itemIndex].fileUrls,
      feedbackNote: note !== undefined ? note : updatedChecklist[itemIndex].feedbackNote,
      checkedBy: user?.name,
      checkedAt: new Date().toISOString()
    };

    // Kiểm tra xem có checklist bắt buộc nào chưa hợp lệ không
    const missingReq = updatedChecklist.filter(c => c.isRequired && c.status !== 'HOP_LE');

    await onUpdate({
      checklist: updatedChecklist
    });

    triggerToast?.(`Đã cập nhật mục: ${updatedChecklist[itemIndex].title}`, 'success');
  };

  // 4. Lưu điều chỉnh phê duyệt / quyết toán
  const handleSaveApproval = async () => {
    if (!approvalReason.trim()) {
      triggerToast?.('Vui lòng nhập lý do phê duyệt / điều chỉnh giá trị!', 'warning');
      return;
    }

    const currentVerNumber = (documentData.currentVersion ?? (versions.length || 1)) + 1;
    const newVersion: DocumentVersion = {
      versionNumber: currentVerNumber,
      title: `Điều chỉnh phê duyệt / Quyết toán (V${currentVerNumber})`,
      timestamp: new Date().toISOString(),
      changedById: user?.id,
      changedByName: user?.name || 'Lãnh đạo / Kế toán',
      reason: approvalReason.trim(),
      changesSummary: [
        { field: 'approvedAmount', label: 'Số tiền được duyệt', before: approvedAmount, after: tempApprovedAmount },
        { field: 'settledAmount', label: 'Đã quyết toán', before: settledAmount, after: tempSettledAmount }
      ],
      snapshot: {
        contractValue: documentData.contractValue,
        approvedAmount: tempApprovedAmount,
        paidAmount: totalInstallmentPaid,
        settledAmount: tempSettledAmount,
        docStatus: tempApprovedAmount > 0 ? 'Chờ thanh toán' : documentData.docStatus,
        paymentStatus: documentData.paymentStatus
      }
    };

    await onUpdate({
      initialProposedAmount: initialProposedAmount, // Luôn giữ nguyên V1
      approvedAmount: tempApprovedAmount,
      unapprovedAmount: Math.max(0, initialProposedAmount - tempApprovedAmount),
      settledAmount: tempSettledAmount,
      pendingSettlementAmount: Math.max(0, totalInstallmentPaid - tempSettledAmount),
      remainingPayableUnderApproval: Math.max(0, tempApprovedAmount - totalInstallmentPaid),
      currentVersion: currentVerNumber,
      versions: [...versions, newVersion]
    }, approvalReason.trim());

    setIsEditingApproval(false);
    setApprovalReason('');
    triggerToast?.('Đã lưu phiên bản điều chỉnh thành công!', 'success');
  };

  const dueInfo = calculateDocumentDueInfo(documentData);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chi tiết Hồ sơ: [${documentData.contractNo}] ${documentData.contractName}`}
      icon="folder_managed"
      size="2xl"
    >
      <div className="space-y-4 text-xs">
        {/* THANH TAB 4 CHỨC NĂNG */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'overview'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">analytics</span>
            <span>Tổng quan & Đối chiếu tiền</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('installments')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'installments'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">payments</span>
            <span>Đợt thanh toán ({installments.length})</span>
            {installments.some(i => i.confirmationStatus === 'CHO_XAC_NHAN') && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'checklist'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">checklist</span>
            <span>Chứng từ & Chữ ký</span>
            {checklist.some(c => c.isRequired && c.status !== 'HOP_LE') && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700">
                Thiếu
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('versions')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'versions'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>Lịch sử & Phiên bản (V{documentData.currentVersion ?? (versions.length || 1)})</span>
          </button>
        </div>

        {/* ==================== TAB 1: TỔNG QUAN & ĐỐI CHIẾU NGHĨA VỤ TIỀN ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* 1. KHỐI BẢNG CỐ ĐỊNH ĐỐI CHIẾU NGHĨA VỤ TIỀN */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-700 text-lg">account_balance</span>
                  <span className="font-bold text-slate-800 text-xs">BẢNG ĐỐI CHIẾU GIÁ TRỊ & NGHĨA VỤ TIỀN</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingApproval(!isEditingApproval)}
                  className="text-xs px-2.5 py-1 text-primary border border-primary/30 hover:bg-blue-50 rounded font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">tune</span>
                  <span>{isEditingApproval ? 'Đóng điều chỉnh' : 'Cập nhật duyệt / Quyết toán'}</span>
                </button>
              </div>

              {/* Form duyệt điều chỉnh (nếu mở) */}
              {isEditingApproval && (
                <div className="p-3 bg-blue-50/50 border-b border-blue-100 space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Mức được duyệt (VNĐ):</label>
                      <input
                        type="number"
                        min="0"
                        value={tempApprovedAmount || ''}
                        onChange={e => setTempApprovedAmount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white font-mono text-right font-bold text-blue-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Đã quyết toán thực tế (VNĐ):</label>
                      <input
                        type="number"
                        min="0"
                        value={tempSettledAmount || ''}
                        onChange={e => setTempSettledAmount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white font-mono text-right font-bold text-emerald-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lý do điều chỉnh (Bắt buộc để lưu Version):</label>
                    <input
                      type="text"
                      required
                      value={approvalReason}
                      onChange={e => setApprovalReason(e.target.value)}
                      placeholder="VD: Duyệt 80% theo hạn mức đợt 1; Trừ giảm trừ khối lượng..."
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingApproval(false)}
                      className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-100"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveApproval}
                      className="px-4 py-1 bg-primary text-white rounded font-bold hover:bg-primary/90 flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">save</span>
                      <span>Lưu phiên bản mới</span>
                    </button>
                  </div>
                </div>
              )}

              {/* BẢNG CHỈ TIÊU CHI TIẾT */}
              <div className="overflow-x-auto table-scrollbar custom-scrollbar w-full">
                <table className="w-full text-xs text-left min-w-[550px]">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3.5">Chỉ tiêu tài chính</th>
                    <th className="py-2 px-3.5 text-right">Giá trị (VNĐ)</th>
                    <th className="py-2 px-3.5">Ý nghĩa đối soát & phân loại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Dòng 1: Giá trị ban đầu */}
                  <tr className="hover:bg-slate-50">
                    <td className="py-2.5 px-3.5 font-bold text-slate-900">
                      1. Giá trị đề nghị / hợp đồng ban đầu (V1)
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(initialProposedAmount)}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500">
                      Số tiền đề nghị ban đầu (Cố định, không bị ghi đè khi duyệt giảm)
                    </td>
                  </tr>

                  {/* Dòng 2: Được duyệt */}
                  <tr className="bg-blue-50/20 hover:bg-blue-50/40">
                    <td className="py-2 px-3.5 font-semibold text-blue-900 pl-6">
                      ↳ Được duyệt thanh toán
                    </td>
                    <td className="py-2 px-3.5 text-right font-mono font-bold text-blue-900">
                      {formatCurrency(approvedAmount)}
                    </td>
                    <td className="py-2 px-3.5 text-blue-800">
                      Mức tối đa được phép chi trả / thu theo phê duyệt
                    </td>
                  </tr>

                  {/* Dòng 3: Chưa được duyệt */}
                  <tr className="bg-rose-50/20 hover:bg-rose-50/40">
                    <td className="py-2 px-3.5 font-semibold text-rose-800 pl-6">
                      ↳ Chưa được duyệt (Cắt giảm / Giữ lại)
                    </td>
                    <td className="py-2 px-3.5 text-right font-mono font-bold text-rose-700">
                      {formatCurrency(unapprovedAmount)}
                    </td>
                    <td className="py-2 px-3.5 text-rose-700">
                      Phần không được duyệt hoặc cần lập đề nghị bổ sung riêng
                    </td>
                  </tr>

                  {/* Dòng 4: Đã thanh toán / Tạm ứng */}
                  <tr className="bg-emerald-50/20 hover:bg-emerald-50/40">
                    <td className="py-2.5 px-3.5 font-bold text-emerald-900">
                      2. Đã thanh toán / Tạm ứng thực tế
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-800">
                      {formatCurrency(totalInstallmentPaid)}
                    </td>
                    <td className="py-2.5 px-3.5 text-emerald-800">
                      Tổng tiền đã chi qua {installments.length} đợt thanh toán
                    </td>
                  </tr>

                  {/* Dòng 5: Còn được thanh toán theo mức duyệt */}
                  <tr className="bg-amber-50/30 hover:bg-amber-50/50">
                    <td className="py-2 px-3.5 font-bold text-amber-900 pl-6">
                      ↳ Còn được thanh toán theo mức duyệt
                    </td>
                    <td className="py-2 px-3.5 text-right font-mono font-bold text-amber-900">
                      {formatCurrency(remainingPayableUnderApproval)}
                    </td>
                    <td className="py-2 px-3.5 text-amber-800">
                      Hạn mức còn lại được chi tiếp trong phần Lãnh đạo đã phê duyệt
                    </td>
                  </tr>

                  {/* Dòng 6: Đã quyết toán */}
                  <tr className="hover:bg-slate-50">
                    <td className="py-2.5 px-3.5 font-bold text-slate-800">
                      3. Đã quyết toán thực tế
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-800">
                      {formatCurrency(settledAmount)}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500">
                      Đã có đầy đủ hóa đơn chứng từ nghiệm thu quyết toán
                    </td>
                  </tr>

                  {/* Dòng 7: Còn phải quyết toán */}
                  <tr className="bg-slate-50/70 hover:bg-slate-100/70">
                    <td className="py-2 px-3.5 font-semibold text-slate-700 pl-6">
                      ↳ Còn phải quyết toán / Hoàn ứng
                    </td>
                    <td className="py-2 px-3.5 text-right font-mono font-bold text-slate-700">
                      {formatCurrency(pendingSettlementAmount)}
                    </td>
                    <td className="py-2 px-3.5 text-slate-600">
                      Tiền tạm ứng đã xuất nhưng chưa nộp đủ chứng từ quyết toán
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>

            {/* 2. CẢNH BÁO TRẠNG THÁI KÝ & THIẾU CHỨNG TỪ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Box A: Ký xác nhận */}
              <div className="p-3 rounded-xl border bg-white shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">draw</span>
                    <span>Tình trạng ký nhận tiền</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    documentData.signatureStatus === 'DA_KY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : (documentData.signatureStatus === 'DANG_DOI_SOAT'
                        ? 'bg-rose-100 text-rose-800 animate-pulse'
                        : 'bg-amber-100 text-amber-800')
                  }`}>
                    {documentData.signatureStatus === 'DA_KY' ? '✓ Đã ký nhận' : (documentData.signatureStatus === 'DANG_DOI_SOAT' ? '⚠️ Đang đối soát' : '⏳ Chờ ký xác nhận')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Nguyên tắc: Hồ sơ không được đánh dấu hoàn tất chỉ vì đã chuyển tiền. Cần biên lai hoặc xác nhận của bên nhận để đóng hồ sơ.
                </p>
              </div>

              {/* Box B: Tình trạng chứng từ */}
              <div className="p-3 rounded-xl border bg-white shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-600 text-base">fact_check</span>
                    <span>Checklist chứng từ bắt buộc</span>
                  </span>
                  <span className="text-slate-500 font-medium">
                    {checklist.filter(c => c.status === 'HOP_LE').length} / {checklist.length} mục hợp lệ
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px]">
                  {checklist.some(c => c.isRequired && c.status !== 'HOP_LE') ? (
                    <span className="text-rose-700 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">warning</span>
                      <span>Còn thiếu chứng từ bắt buộc (chưa thể đóng hồ sơ)</span>
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      <span>Đã đầy đủ toàn bộ chứng từ bắt buộc</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: ĐỢT THANH TOÁN (INSTALLMENTS) ==================== */}
        {activeTab === 'installments' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <div className="font-bold text-slate-800">
                  Danh sách các đợt chuyển / thu tiền ({installments.length} đợt)
                </div>
                <div className="text-[11px] text-slate-500">
                  Tổng đã chi: <b className="font-mono text-emerald-800">{formatCurrency(totalInstallmentPaid)}</b> • Còn được chi theo duyệt: <b className="font-mono text-amber-900">{formatCurrency(remainingPayableUnderApproval)}</b>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingInstallment(!isAddingInstallment)}
                className="px-3 py-1.5 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">add_card</span>
                <span>{isAddingInstallment ? 'Đóng tạo' : 'Tạo đợt thanh toán mới'}</span>
              </button>
            </div>

            {/* FORM THÊM ĐỢT THANH TOÁN */}
            {isAddingInstallment && (
              <form onSubmit={handleAddInstallment} className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
                <div className="font-bold text-blue-900 text-[12px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">receipt_long</span>
                  <span>Ghi nhận đợt chuyển tiền / Chi tiền thực tế</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nội dung đợt chi *</label>
                    <input
                      type="text"
                      required
                      value={newInstTitle}
                      onChange={e => setNewInstTitle(e.target.value)}
                      placeholder={`VD: Thanh toán đợt ${installments.length + 1}...`}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Số tiền chi (VNĐ) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newInstAmount || ''}
                      onChange={e => setNewInstAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white font-mono font-bold text-right text-emerald-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ngày chuyển tiền thực tế *</label>
                    <input
                      type="date"
                      required
                      value={newInstDate}
                      onChange={e => setNewInstDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Hình thức thanh toán</label>
                    <CustomSelect
                      value={newInstMethod}
                      onChange={e => setNewInstMethod(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                    >
                      <option value="UNC">Ủy nhiệm chi (UNC)</option>
                      <option value="CHUYEN_KHOAN">Chuyển khoản Internet Banking</option>
                      <option value="TIEN_MAT">Tiền mặt (Phiếu chi)</option>
                    </CustomSelect>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mã giao dịch / Số UNC / Phiếu chi</label>
                    <input
                      type="text"
                      value={newInstTxCode}
                      onChange={e => setNewInstTxCode(e.target.value)}
                      placeholder="VD: FT24112700123"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Người thực hiện chuyển</label>
                    <input
                      type="text"
                      value={newInstPayer}
                      onChange={e => setNewInstPayer(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đính kèm chứng từ UNC / Phiếu chi có dấu</label>
                  <FileUpload
                    value={newInstFiles}
                    onChange={val => setNewInstFiles(Array.isArray(val) ? val : (val ? [val] : []))}
                    multiple
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-blue-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingInstallment(false)}
                    className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>Lưu đợt chi tiền</span>
                  </button>
                </div>
              </form>
            )}

            {/* DANH SÁCH CÁC ĐỢT CHI TIỀN */}
            {installments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
                <span className="material-symbols-outlined text-3xl block mb-1 text-slate-300">credit_card_off</span>
                Chưa có đợt thanh toán nào được ghi nhận. Bấm nút "Tạo đợt thanh toán mới" để nhập.
              </div>
            ) : (
              <div className="space-y-2.5">
                {installments.map((inst, idx) => (
                  <div
                    key={inst.id}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800">
                          Đợt {inst.installmentNo || idx + 1}
                        </span>
                        <span className="font-bold text-slate-900">{inst.title}</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          • Ngày: {formatDateDisplay(inst.paymentDate)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Số tiền</span>
                          <span className="font-mono font-bold text-sm text-emerald-800">
                            {formatCurrency(inst.amount)}
                          </span>
                        </div>

                        {/* Badge trạng thái ký */}
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          inst.confirmationStatus === 'DA_XAC_NHAN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (inst.confirmationStatus === 'TU_CHOI'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800')
                        }`}>
                          {inst.confirmationStatus === 'DA_XAC_NHAN'
                            ? '✓ Đã ký nhận'
                            : (inst.confirmationStatus === 'TU_CHOI' ? '⚠️ Đang đối soát (Từ chối)' : '⏳ Chờ ký xác nhận')}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                      <div className="flex items-center gap-3">
                        <span>Hình thức: <b>{inst.paymentMethod || 'UNC'}</b></span>
                        {inst.transactionCode && (
                          <span>Mã GD: <b className="font-mono text-slate-700">{inst.transactionCode}</b></span>
                        )}
                        {inst.payerOrReceiver && <span>Người chi: <b>{inst.payerOrReceiver}</b></span>}
                        {inst.confirmedBy && <span>Người ký nhận: <b>{inst.confirmedBy}</b></span>}
                      </div>

                      {/* Hành động xác nhận ký / Báo sai lệch */}
                      <div className="flex items-center gap-2">
                        {inst.confirmationStatus === 'CHO_XAC_NHAN' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const note = window.prompt('Nhập lý do sai lệch / từ chối ký:');
                                if (note !== null) handleConfirmInstallment(inst.id, false, note);
                              }}
                              className="px-2.5 py-1 text-rose-700 border border-rose-200 hover:bg-rose-50 rounded font-semibold cursor-pointer"
                            >
                              Báo sai lệch / Từ chối
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmInstallment(inst.id, true)}
                              className="px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded font-bold cursor-pointer"
                            >
                              Ký xác nhận đã nhận đủ tiền
                            </button>
                          </>
                        )}
                        {inst.confirmationStatus === 'TU_CHOI' && inst.discrepancyNote && (
                          <span className="text-rose-700 font-medium">Lý do: {inst.discrepancyNote}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: CHỨNG TỪ & CHỮ KÝ (CHECKLIST) ==================== */}
        {activeTab === 'checklist' && (
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">
                  Danh mục kiểm soát chứng từ bắt buộc (Checklist)
                </div>
                <div className="text-[11px] text-slate-500">
                  Quy trình chuẩn: Chưa có → Đã tải lên → Chờ kiểm tra → Hợp lệ / Yêu cầu bổ sung
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700">
                {checklist.filter(c => c.status === 'HOP_LE').length} / {checklist.length} Hợp lệ
              </span>
            </div>

            <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              {checklist.map((item, idx) => (
                <div key={item.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        item.status === 'HOP_LE'
                          ? 'bg-emerald-500'
                          : (item.status === 'YEU_CAU_BO_SUNG' ? 'bg-rose-500' : 'bg-amber-400')
                      }`} />
                      <span className="font-bold text-slate-900 text-xs">{item.title}</span>
                      {item.isRequired && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Bắt buộc
                        </span>
                      )}
                    </div>
                    {item.feedbackNote && (
                      <div className="text-[11px] text-rose-700 mt-1 pl-4">
                        Ghi chú/Phản hồi: <b>{item.feedbackNote}</b>
                      </div>
                    )}
                    {item.checkedBy && (
                      <div className="text-[10px] text-slate-400 mt-0.5 pl-4">
                        Kiểm tra bởi: {item.checkedBy} lúc {formatDateDisplay(item.checkedAt)}
                      </div>
                    )}
                  </div>

                  {/* Cụm đổi trạng thái */}
                  <div className="flex items-center gap-2 shrink-0">
                    <CustomSelect
                      value={item.status}
                      onChange={e => {
                        const newSt = e.target.value as any;
                        if (newSt === 'YEU_CAU_BO_SUNG') {
                          const note = window.prompt('Nhập lý do yêu cầu bổ sung chứng từ:');
                          handleUpdateChecklistItem(idx, newSt, undefined, note || '');
                        } else {
                          handleUpdateChecklistItem(idx, newSt);
                        }
                      }}
                      className={`text-xs px-2.5 py-1 rounded font-bold border ${
                        item.status === 'HOP_LE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : (item.status === 'YEU_CAU_BO_SUNG'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : (item.status === 'DA_TAI_LEN' || item.status === 'CHO_KIEM_TRA'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-slate-50 text-slate-600 border-slate-300'))
                      }`}
                    >
                      <option value="CHUA_CO">Chưa có</option>
                      <option value="DA_TAI_LEN">Đã tải lên</option>
                      <option value="CHO_KIEM_TRA">Chờ kiểm tra</option>
                      <option value="HOP_LE">Hợp lệ</option>
                      <option value="YEU_CAU_BO_SUNG">Yêu cầu bổ sung</option>
                    </CustomSelect>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: LỊCH SỬ & PHIÊN BẢN (VERSIONS) ==================== */}
        {activeTab === 'versions' && (
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-800">
                Nhật ký phiên bản & Đối chiếu trước / sau cập nhật
              </div>
              <div className="text-[11px] text-slate-500">
                Lịch sử bất biến (chỉ xem, không thể sửa/xóa) nhằm đối chiếu giá trị gốc và các lần duyệt/chi
              </div>
            </div>

            {versions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
                <span className="material-symbols-outlined text-3xl block mb-1 text-slate-300">history_toggle_off</span>
                Hồ sơ đang ở phiên bản khởi tạo (V1). Mọi thay đổi về phê duyệt, đợt chi sẽ tự động tạo mốc V2, V3...
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {versions.map((ver, vIdx) => (
                  <div key={vIdx} className="relative pl-8">
                    <span className="absolute left-1.5 top-1.5 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      {ver.versionNumber || vIdx + 1}
                    </span>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">
                          Phiên bản V{ver.versionNumber}: {ver.title}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDateDisplay(ver.timestamp)}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600">
                        Người thực hiện: <b>{ver.changedByName}</b>
                        {ver.reason && <span className="ml-2 text-slate-700 italic">• Lý do: "{ver.reason}"</span>}
                      </div>

                      {/* Chi tiết thay đổi trước -> sau */}
                      {ver.changesSummary && ver.changesSummary.length > 0 && (
                        <div className="mt-2 bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] space-y-1">
                          {ver.changesSummary.map((ch, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-2">
                              <span className="text-slate-500 min-w-[130px]">{ch.label}:</span>
                              <span className="font-mono text-rose-700 line-through">
                                {typeof ch.before === 'number' ? formatCurrency(ch.before) : String(ch.before ?? '-')}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="font-mono font-bold text-emerald-700">
                                {typeof ch.after === 'number' ? formatCurrency(ch.after) : String(ch.after ?? '-')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nút đóng */}
        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
