import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '@/components/common/Modal';
import { CustomSelect } from '@/components/common/CustomSelect';
import { FileUpload } from '@/components/common/FileUpload';
import { DocumentTrack } from '@/types';
import { useRealtimeStore } from '@/services/realtimeStore';
import { useAuthStore } from '@/services/authStore';
import {
  DocumentFlow,
  INPUT_SUBTYPES,
  OUTPUT_SUBTYPES,
  INPUT_STATUSES,
  OUTPUT_STATUSES
} from './documentConstants';

interface DocumentFormModalProps {
  isOpen: boolean;
  flow: DocumentFlow; // 'input' hoặc 'output'
  documentData: DocumentTrack | null; // null nếu là tạo mới
  defaultProjectCode?: string; // Khóa sẵn nếu đang ở trong dự án
  lockedProject?: boolean;
  onClose: () => void;
  onSave: (data: Partial<DocumentTrack>) => Promise<void> | void;
  triggerToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const DocumentFormModal: React.FC<DocumentFormModalProps> = ({
  isOpen,
  flow,
  documentData,
  defaultProjectCode,
  lockedProject = false,
  onClose,
  onSave,
  triggerToast
}) => {
  const { user } = useAuthStore();
  const projects = useRealtimeStore(s => s.projects);
  const documentTracks = useRealtimeStore(s => s.documentTracks);
  const expenses = useRealtimeStore(s => s.expenses);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Form Fields
  const [contractNo, setContractNo] = useState('');
  const [contractName, setContractName] = useState('');
  const [projectCode, setProjectCode] = useState(defaultProjectCode || 'COMPANY');
  const [subType, setSubType] = useState('');
  const [partnerName, setPartnerName] = useState(''); // NCC hoặc Khách hàng/CĐT
  const [receiverName, setReceiverName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Ngày tháng (chú ý: HẠN KHÔNG ĐƯỢC TỰ ĐỘNG LẤY NGÀY HÔM NAY)
  const [sendDate, setSendDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receiveDate, setReceiveDate] = useState('');
  const [dueDate, setDueDate] = useState<string>(''); // Bắt đầu rỗng
  const [remindDays, setRemindDays] = useState<number>(3);
  const [actualPaymentDate, setActualPaymentDate] = useState('');

  // Giá trị tài chính
  const [beforeTaxAmount, setBeforeTaxAmount] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(10);
  const [vatAmount, setVatAmount] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [acceptedAmount, setAcceptedAmount] = useState<number>(0); // Hồ sơ khối lượng nghiệm thu
  const [paidAmount, setPaidAmount] = useState<number>(0);

  // Số hóa đơn & chứng từ
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [paymentRefId, setPaymentRefId] = useState('');

  // Trạng thái
  const [docStatus, setDocStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [fileUrls, setFileUrls] = useState<string[]>([]);

  // Tùy chọn subtype & status dựa theo flow
  const subTypeOptions = flow === 'input' ? INPUT_SUBTYPES : OUTPUT_SUBTYPES;
  const statusOptions = flow === 'input' ? INPUT_STATUSES : OUTPUT_STATUSES;

  // Tự động tính tiền VAT và Tổng tiền khi đổi trước thuế hoặc % VAT
  const handleBeforeTaxChange = (val: number) => {
    setBeforeTaxAmount(val);
    const computedVat = Math.round((val * vatRate) / 100);
    setVatAmount(computedVat);
    setTotalAmount(val + computedVat);
  };

  const handleVatRateChange = (rate: number) => {
    setVatRate(rate);
    const computedVat = Math.round((beforeTaxAmount * rate) / 100);
    setVatAmount(computedVat);
    setTotalAmount(beforeTaxAmount + computedVat);
  };

  const handleTotalAmountChange = (val: number) => {
    setTotalAmount(val);
    // Nếu trước thuế chưa nhập, tự suy ngược nếu cần
    if (beforeTaxAmount === 0 && val > 0) {
      const bTax = Math.round(val / (1 + vatRate / 100));
      setBeforeTaxAmount(bTax);
      setVatAmount(val - bTax);
    }
  };

  // Đồng bộ khi mở modal hoặc đổi documentData
  useEffect(() => {
    if (!isOpen) {
      setDuplicateWarning(null);
      return;
    }

    if (documentData) {
      setContractNo(documentData.contractNo || '');
      setContractName(documentData.contractName || '');
      setProjectCode(defaultProjectCode || documentData.projectCode || 'COMPANY');
      setSubType(documentData.subType || (flow === 'input' ? 'Hóa đơn nhà cung cấp (VAT)' : 'Hợp đồng CĐT / Khách hàng'));
      setPartnerName(documentData.company || '');
      setReceiverName(documentData.receiverName || '');
      setPhone(documentData.phone || '');
      setAddress(documentData.address || '');

      setSendDate(documentData.sendDate || new Date().toISOString().split('T')[0]);
      setReceiveDate(documentData.receiveDate || '');
      // KHÔNG BAO GIỜ gán ngày hôm nay nếu dueDate là null/rỗng
      setDueDate(documentData.dueDate ? documentData.dueDate.split('T')[0] : '');
      setRemindDays(documentData.remindDays ?? 3);
      setActualPaymentDate(documentData.actualPaymentDate ? documentData.actualPaymentDate.split('T')[0] : '');

      const tAmount = documentData.totalAmount ?? documentData.contractValue ?? 0;
      const bTax = documentData.beforeTaxAmount ?? (documentData.contractValue ? Math.round(documentData.contractValue / 1.1) : 0);
      setBeforeTaxAmount(bTax);
      setVatRate(documentData.vatRate ?? 10);
      setVatAmount(documentData.vatAmount ?? Math.max(0, tAmount - bTax));
      setTotalAmount(tAmount);
      setAcceptedAmount(documentData.acceptedAmount ?? tAmount);
      setPaidAmount(documentData.paidAmount ?? documentData.prepayAmount ?? 0);

      setInvoiceNo(documentData.invoiceNo || '');
      setInvoiceDate(documentData.invoiceDate ? documentData.invoiceDate.split('T')[0] : '');
      setPaymentRefId(documentData.paymentRefId || '');

      setDocStatus(documentData.docStatus || (flow === 'input' ? 'Nháp' : 'Nháp'));
      setNotes((documentData.notes || '').replace(/\[STATUS:[^\]]+\]/g, '').trim());
      setFileUrls(documentData.fileUrls || []);
    } else {
      // TẠO MỚI: QUY TẮC BẮT BUỘC
      // - Hạn thanh toán / Hạn phải thu: ĐỂ TRỐNG (null/empty string), KHÔNG tự điền hôm nay
      setContractNo(`HS-${Date.now().toString().slice(-6)}`);
      setContractName('');
      setProjectCode(defaultProjectCode || 'COMPANY');
      setSubType(flow === 'input' ? 'Hóa đơn nhà cung cấp (VAT)' : 'Hợp đồng CĐT / Khách hàng');
      setPartnerName('');
      setReceiverName(user?.name || '');
      setPhone('');
      setAddress('');

      setSendDate(new Date().toISOString().split('T')[0]); // Ngày chứng từ
      setReceiveDate('');
      setDueDate(''); // TUYỆT ĐỐI ĐỂ TRỐNG
      setRemindDays(3);
      setActualPaymentDate('');

      setBeforeTaxAmount(0);
      setVatRate(10);
      setVatAmount(0);
      setTotalAmount(0);
      setAcceptedAmount(0);
      setPaidAmount(0);

      setInvoiceNo('');
      setInvoiceDate('');
      setPaymentRefId('');

      setDocStatus(flow === 'input' ? 'Nháp' : 'Nháp');
      setNotes('');
      setFileUrls([]);
    }
    setDuplicateWarning(null);
  }, [isOpen, documentData, defaultProjectCode, flow, user?.name]);

  // Kiểm tra trùng số hóa đơn / số hợp đồng trong cùng nhà cung cấp hoặc khách hàng
  useEffect(() => {
    const num = (invoiceNo || contractNo).trim().toLowerCase();
    const partner = partnerName.trim().toLowerCase();
    if (!num || !partner) {
      setDuplicateWarning(null);
      return;
    }

    const isDuplicate = documentTracks.some(d => {
      if (documentData && d.id === documentData.id) return false;
      const dPartner = (d.company || '').trim().toLowerCase();
      const dNo = (d.invoiceNo || d.contractNo || '').trim().toLowerCase();
      return dPartner === partner && dNo === num;
    });

    if (isDuplicate) {
      setDuplicateWarning(`Cảnh báo: Số chứng từ/hóa đơn "${invoiceNo || contractNo}" đã tồn tại cho đối tác "${partnerName}".`);
    } else {
      setDuplicateWarning(null);
    }
  }, [invoiceNo, contractNo, partnerName, documentTracks, documentData]);

  // Còn phải trả / Còn phải thu
  const remaining = Math.max(0, totalAmount - paidAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractName.trim()) {
      triggerToast?.('Vui lòng nhập tên hoặc trích yếu hồ sơ!', 'warning');
      return;
    }

    if (duplicateWarning) {
      const confirmDup = window.confirm(`${duplicateWarning}\nBạn có chắc chắn muốn tiếp tục lưu không?`);
      if (!confirmDup) return;
    }

    setIsSubmitting(true);
    try {
      // Xác định trạng thái thanh toán tự động nếu người dùng chưa chọn thủ công
      let pStatus = 'Chưa thanh toán';
      if (flow === 'input') {
        if (paidAmount >= totalAmount && totalAmount > 0) pStatus = 'Đã thanh toán';
        else if (paidAmount > 0) pStatus = 'Thanh toán một phần';
        else pStatus = 'Chưa thanh toán';
      } else {
        if (paidAmount >= totalAmount && totalAmount > 0) pStatus = 'Đã thu đủ';
        else if (paidAmount > 0) pStatus = 'Thu một phần';
        else pStatus = 'Chưa thu';
      }

      // Chuẩn hóa ngày hạn: Nếu rỗng thì truyền null
      const normalizedDueDate = dueDate && dueDate.trim() ? dueDate.trim() : null;

      const payload: Partial<DocumentTrack> = {
        flowType: flow,
        subType: subType.trim() || undefined,
        contractNo: contractNo.trim(),
        contractName: contractName.trim(),
        projectCode: projectCode.trim() || 'COMPANY',
        company: partnerName.trim(),
        receiverName: receiverName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        sendDate: sendDate || new Date().toISOString().split('T')[0],
        receiveDate: receiveDate ? receiveDate.trim() : undefined,
        // QUY TẮC: Nếu người dùng không nhập hạn thì lưu null
        dueDate: normalizedDueDate,
        remindDays: normalizedDueDate ? (remindDays || 3) : undefined,
        actualPaymentDate: actualPaymentDate ? actualPaymentDate.trim() : null,

        // Tài chính
        beforeTaxAmount: Number(beforeTaxAmount) || 0,
        vatRate: Number(vatRate) || 0,
        vatAmount: Number(vatAmount) || 0,
        totalAmount: Number(totalAmount) || 0,
        contractValue: Number(totalAmount) || 0, // Tương thích trường cũ
        acceptedAmount: flow === 'output' ? (Number(acceptedAmount) || 0) : undefined,
        paidAmount: Number(paidAmount) || 0,
        prepayAmount: Number(paidAmount) || 0, // Tương thích trường cũ
        remainingAmount: remaining,

        // Hóa đơn & liên kết
        invoiceNo: invoiceNo.trim() || undefined,
        invoiceDate: invoiceDate ? invoiceDate.trim() : null,
        paymentRefId: paymentRefId.trim() || undefined,

        // Trạng thái
        docStatus: docStatus.trim() || (flow === 'input' ? 'Nháp' : 'Nháp'),
        paymentStatus: pStatus,
        isCompleted: pStatus.includes('Đã thanh toán') || pStatus.includes('Đã thu đủ') || docStatus === 'Hoàn thành',
        side: flow === 'input' ? 'Bên trả' : 'Bên nhận',
        notes: notes.trim(),
        fileUrls: fileUrls
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      triggerToast?.('Lỗi khi lưu hồ sơ: ' + (err.message || 'Xin thử lại'), 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const partnerLabel = flow === 'input' ? 'Nhà cung cấp / Bên thụ hưởng *' : 'Khách hàng / Chủ đầu tư *';
  const modalTitle = documentData
    ? (flow === 'input' ? 'Sửa Hồ sơ đầu vào (Công ty phải trả)' : 'Sửa Hồ sơ đầu ra (Bên khác phải trả)')
    : (flow === 'input' ? 'Tạo Hồ sơ đầu vào mới (Công ty phải trả)' : 'Tạo Hồ sơ đầu ra mới (Thu tiền từ CĐT/Khách)');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} icon={flow === 'input' ? 'upload_file' : 'download_for_offline'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Cảnh báo trùng lặp nếu có */}
        {duplicateWarning && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-base">warning</span>
            <span className="font-medium text-[11px]">{duplicateWarning}</span>
          </div>
        )}

        {/* Khối 1: Thông tin chung & Đối tác */}
        <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 space-y-3">
          <div className="font-bold text-slate-800 text-[13px] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">badge</span>
            <span>Thông tin hồ sơ & Đối tác</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dự án</label>
              {lockedProject ? (
                <div className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-lg text-slate-600 font-medium">
                  {projects.find(p => p.code === projectCode)?.name || projectCode}
                </div>
              ) : (
                <CustomSelect
                  value={projectCode}
                  onChange={e => setProjectCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary"
                >
                  <option value="COMPANY">🏢 Công ty / Chung</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.code}>
                      [{p.code}] {p.name}
                    </option>
                  ))}
                </CustomSelect>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Loại chứng từ / hồ sơ *</label>
              <CustomSelect
                value={subType}
                onChange={e => setSubType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-medium text-slate-800"
              >
                {subTypeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </CustomSelect>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mã / Số hồ sơ nội bộ *</label>
              <input
                type="text"
                required
                value={contractNo}
                onChange={e => setContractNo(e.target.value)}
                placeholder="VD: HD-0012, PO-883"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trích yếu / Tên nội dung hồ sơ *</label>
              <input
                type="text"
                required
                value={contractName}
                onChange={e => setContractName(e.target.value)}
                placeholder={flow === 'input' ? 'VD: Mua vật tư tủ điện, Thi công kéo cáp trạm...' : 'VD: Nghiệm thu đợt 2 gói thầu PCCC, Tạm ứng hợp đồng...'}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{partnerLabel}</label>
              <input
                type="text"
                required
                value={partnerName}
                onChange={e => setPartnerName(e.target.value)}
                placeholder={flow === 'input' ? 'Công ty TNHH Cung cấp thiết bị...' : 'Ban QLDA / Khách hàng...'}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Người phụ trách / liên hệ</label>
              <input
                type="text"
                value={receiverName}
                onChange={e => setReceiverName(e.target.value)}
                placeholder="Họ tên người liên hệ"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="09xx..."
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Số hóa đơn VAT / Phiếu gốc</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="VD: 0001234..."
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-mono text-blue-900"
              />
            </div>
          </div>
        </div>

        {/* Khối 2: Giá trị tài chính & Thuế */}
        <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100 space-y-3">
          <div className="font-bold text-slate-800 text-[13px] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-700 text-[18px]">payments</span>
              <span>Giá trị tài chính & Thuế</span>
            </div>
            <div className="text-[12px] font-bold text-slate-700">
              {flow === 'input' ? 'Còn phải trả: ' : 'Còn phải thu: '}
              <span className={`px-2 py-0.5 rounded font-mono ${remaining > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
                {remaining.toLocaleString('vi-VN')} đ
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Giá trị trước thuế</label>
              <input
                type="number"
                min="0"
                step="any"
                value={beforeTaxAmount || ''}
                onChange={e => handleBeforeTaxChange(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-mono text-right"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Thuế suất VAT (%)</label>
              <CustomSelect
                value={vatRate}
                onChange={e => handleVatRateChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary"
              >
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={8}>8%</option>
                <option value={10}>10%</option>
              </CustomSelect>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tiền VAT</label>
              <input
                type="number"
                min="0"
                step="any"
                value={vatAmount || ''}
                onChange={e => {
                  const v = Number(e.target.value);
                  setVatAmount(v);
                  setTotalAmount(beforeTaxAmount + v);
                }}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-mono text-right"
              />
            </div>

            <div>
              <label className="block font-bold text-blue-900 mb-1">Tổng tiền (gồm VAT) *</label>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={totalAmount || ''}
                onChange={e => handleTotalAmountChange(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 border-2 border-blue-400 bg-white rounded-lg focus:ring-1 focus:ring-primary font-mono font-bold text-right text-blue-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {flow === 'output' ? (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giá trị đã nghiệm thu</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={acceptedAmount || ''}
                  onChange={e => setAcceptedAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-mono text-right"
                />
              </div>
            ) : null}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {flow === 'input' ? 'Số tiền đã thanh toán' : 'Số tiền đã thu'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={paidAmount || ''}
                onChange={e => setPaidAmount(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-mono text-right text-emerald-700 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Khối 3: Ngày tháng & Quy tắc Hạn (QUAN TRỌNG: KHÔNG ĐƯỢC TỰ ĐỘNG LẤY NGÀY HÔM NAY) */}
        <div className="bg-amber-50/40 p-3 rounded-lg border border-amber-200/70 space-y-3">
          <div className="font-bold text-slate-800 text-[13px] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-700 text-[18px]">calendar_clock</span>
              <span>Thời hạn & Ngày chứng từ</span>
            </div>
            <span className="text-[11px] text-slate-500 font-normal italic">
              * Hạn thanh toán không bắt buộc. Để trống sẽ không bị báo quá hạn.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ngày chứng từ / Ngày lập</label>
              <input
                type="date"
                value={sendDate}
                onChange={e => setSendDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-bold text-amber-900 mb-1 flex items-center justify-between">
                <span>{flow === 'input' ? 'Hạn thanh toán' : 'Hạn phải thu'}</span>
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate('')}
                    className="text-[10px] text-rose-600 hover:underline font-semibold cursor-pointer"
                  >
                    Xóa hạn (Để trống)
                  </button>
                )}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                placeholder="Chưa xác định hạn"
                className="w-full px-3 py-2 border border-amber-300 bg-white rounded-lg focus:ring-1 focus:ring-amber-500 font-bold text-amber-900"
              />
              {!dueDate && (
                <div className="text-[11px] text-slate-500 mt-1">
                  Đang để trống: <b>Chưa xác định hạn</b> (Không nhắc hạn)
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {flow === 'input' ? 'Ngày thanh toán thực tế' : 'Ngày nhận tiền thực tế'}
              </label>
              <input
                type="date"
                value={actualPaymentDate}
                onChange={e => setActualPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Khối 4: Trạng thái & File đính kèm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Trạng thái quy trình *</label>
            <CustomSelect
              value={docStatus}
              onChange={e => setDocStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary font-bold text-slate-800"
            >
              {statusOptions.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </CustomSelect>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ghi chú thêm</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ghi chú nội bộ..."
              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Đính kèm tài liệu */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Tệp đính kèm (PDF, Word, Ảnh hóa đơn...)</label>
          <FileUpload
            value={fileUrls}
            onChange={(val) => setFileUrls(Array.isArray(val) ? val : (val ? [val] : []))}
            multiple
          />
        </div>

        {/* Nút hành động */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 font-semibold cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>{isSubmitting ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
