import { DocumentTrack } from '@/types';

export type DocumentFlow = 'input' | 'output' | 'unclassified';

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
  'Đã thanh toán – chờ ký xác nhận',
  'Đã thanh toán',
  'Đang đối soát',
  'Đã quyết toán',
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
  'Đã thu – chờ ký xác nhận',
  'Đã thu đủ',
  'Đang đối soát',
  'Quá hạn'
];

// Tạo danh sách Checklist chuẩn cho từng loại hồ sơ
export const generateDefaultChecklist = (flow: DocumentFlow, subType?: string): import('@/types').DocumentChecklistItem[] => {
  if (flow === 'input') {
    return [
      { id: 'chk-1', itemType: 'DE_NGHI', title: 'Đề nghị thanh toán / Tờ trình duyệt chi', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-2', itemType: 'HOP_DONG', title: 'Báo giá / Hợp đồng / Đơn đặt hàng (PO)', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-3', itemType: 'NGHIEM_THU', title: 'Biên bản giao hàng / Nghiệm thu đầu vào', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-4', itemType: 'HOA_DON', title: 'Hóa đơn tài chính (VAT)', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-5', itemType: 'UNC_PHIEU_CHI', title: 'Ủy nhiệm chi (UNC) / Phiếu chi có dấu ngân hàng', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-6', itemType: 'QUYET_TOAN', title: 'Bảng quyết toán / Chứng từ hoàn ứng', isRequired: false, status: 'CHUA_CO' },
      { id: 'chk-7', itemType: 'CHU_KY', title: 'Chữ ký / Biên lai xác nhận bên nhận tiền', isRequired: true, status: 'CHUA_CO' }
    ];
  } else {
    return [
      { id: 'chk-out-1', itemType: 'HOP_DONG', title: 'Hợp đồng kinh tế / Phụ lục ký với CĐT', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-out-2', itemType: 'KHOI_LUONG', title: 'Hồ sơ khối lượng hoàn thành', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-out-3', itemType: 'NGHIEM_THU', title: 'Biên bản nghiệm thu A-B / Nghiệm thu bàn giao', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-out-4', itemType: 'HOA_DON_XUAT', title: 'Hóa đơn GTGT xuất cho khách hàng', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-out-5', itemType: 'DE_NGHI_THU', title: 'Đề nghị thanh toán gửi CĐT / Khách hàng', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-out-6', itemType: 'SAO_KE_TIEN_VE', title: 'Sao kê ngân hàng / Giấy báo Có tiền về', isRequired: true, status: 'CHUA_CO' },
      { id: 'chk-out-7', itemType: 'BIEN_BAN_DOI_CHIEU', title: 'Biên bản đối chiếu công nợ / Xác nhận 2 bên', isRequired: true, status: 'CHUA_CO' }
    ];
  }
};

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
  // Dữ liệu lịch sử không có flowType phải được người có quyền xác nhận. Không dùng
  // side/docType để tự đoán vì dễ đảo chiều công nợ phải thu/phải trả.
  return 'unclassified';
};
