import { DocumentTrack } from '@/types';

export type DocumentFlow = 'input' | 'output';

export const INPUT_SUBTYPES = [
  'Báo giá nhà cung cấp',
  'Đơn đặt hàng (PO)',
  'Hợp đồng mua/thuê/thầu phụ',
  'Biên bản giao hàng / Nghiệm thu đầu vào',
  'Hóa đơn nhà cung cấp (VAT)',
  'Đề nghị thanh toán',
  'Phiếu chi / Ủy nhiệm chi',
  'Chứng từ tạm ứng / Hoàn ứng',
  'Khác'
];

export const OUTPUT_SUBTYPES = [
  'Hợp đồng CĐT / Khách hàng',
  'Dự toán / Báo giá / Phụ lục',
  'Hồ sơ khối lượng',
  'Biên bản nghiệm thu',
  'Hồ sơ thanh toán từng đợt',
  'Hóa đơn xuất (VAT)',
  'Đề nghị thanh toán gửi khách hàng',
  'Chứng từ khách đã chuyển tiền',
  'Khác'
];

export const INPUT_STATUSES = [
  'Nháp',
  'Đang bổ sung hồ sơ',
  'Chờ duyệt',
  'Chờ thanh toán',
  'Thanh toán một phần',
  'Đã thanh toán',
  'Hủy'
];

export const OUTPUT_STATUSES = [
  'Nháp',
  'Đang lập hồ sơ',
  'Chờ gửi',
  'Đã gửi',
  'Chờ khách hàng xác nhận',
  'Được chấp thuận',
  'Đã xuất hóa đơn',
  'Thu một phần',
  'Đã thu đủ',
  'Quá hạn'
];

export const formatCurrency = (val?: number | null) => {
  if (val === undefined || val === null || isNaN(val)) return '0 đ';
  return Number(val).toLocaleString('vi-VN') + ' đ';
};

export const formatDateDisplay = (dateStr?: string | null) => {
  if (!dateStr || !dateStr.trim()) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
};

/**
 * Tính hạn theo quy tắc:
 * - Hạn thanh toán / Hạn phải thu là tùy chọn (không bắt buộc).
 * - Nếu dueDate null/rỗng: Trả về { status: 'none', text: 'Chưa xác định hạn' }
 * - Chỉ khi có dueDate thực sự thì mới tính:
 *    + Quá hạn: diffDays < 0
 *    + Sắp đến hạn: diffDays <= remindDays
 *    + Còn hạn: diffDays > remindDays
 */
export const calculateDocumentDueInfo = (doc: DocumentTrack) => {
  // Nếu đã thanh toán đủ hoặc hoàn thành thì không báo hạn nữa
  const isCompletedOrPaid = doc.isCompleted || 
    doc.paymentStatus?.includes('Đã thanh toán') || 
    doc.paymentStatus?.includes('Đã thu đủ') ||
    doc.docStatus === 'Đã thanh toán' ||
    doc.docStatus === 'Đã thu đủ' ||
    doc.docStatus === 'Hủy';

  if (!doc.dueDate || !String(doc.dueDate).trim()) {
    return {
      status: 'none' as const,
      hasDueDate: false,
      daysLeft: null,
      text: 'Chưa xác định hạn',
      badgeClass: 'text-slate-400 bg-slate-100 border-slate-200'
    };
  }

  if (isCompletedOrPaid) {
    return {
      status: 'completed' as const,
      hasDueDate: true,
      daysLeft: null,
      text: 'Đã hoàn tất',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(doc.dueDate);
  if (isNaN(due.getTime())) {
    return {
      status: 'none' as const,
      hasDueDate: false,
      daysLeft: null,
      text: 'Chưa xác định hạn',
      badgeClass: 'text-slate-400 bg-slate-100 border-slate-200'
    };
  }
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const remind = doc.remindDays ?? 3;

  if (diffDays < 0) {
    return {
      status: 'overdue' as const,
      hasDueDate: true,
      daysLeft: diffDays,
      text: `Quá hạn ${Math.abs(diffDays)} ngày`,
      badgeClass: 'text-rose-700 bg-rose-50 border-rose-200 font-bold'
    };
  } else if (diffDays === 0) {
    return {
      status: 'due_today' as const,
      hasDueDate: true,
      daysLeft: 0,
      text: 'Hạn hôm nay 🔔',
      badgeClass: 'text-amber-800 bg-amber-100 border-amber-300 font-bold animate-pulse'
    };
  } else if (diffDays <= remind) {
    return {
      status: 'warning' as const,
      hasDueDate: true,
      daysLeft: diffDays,
      text: `Còn ${diffDays} ngày`,
      badgeClass: 'text-amber-700 bg-amber-50 border-amber-200 font-medium'
    };
  }

  return {
    status: 'normal' as const,
    hasDueDate: true,
    daysLeft: diffDays,
    text: `Còn ${diffDays} ngày`,
    badgeClass: 'text-slate-600 bg-slate-50 border-slate-200'
  };
};

/** Phân loại luồng hồ sơ (fallback cho dữ liệu cũ) */
export const resolveDocumentFlow = (doc: DocumentTrack): DocumentFlow => {
  if (doc.flowType === 'input' || doc.flowType === 'output') return doc.flowType;
  // Dựa vào side hoặc docType cũ
  if (doc.side === 'Bên nhận' || doc.side === 'Khách hàng' || doc.side === 'Chủ đầu tư') {
    return 'output';
  }
  return 'input';
};
