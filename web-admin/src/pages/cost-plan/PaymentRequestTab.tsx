import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PaymentRequest, PaymentRequestStatus, PaymentRequestType, Project, Engineer } from '../../types';
import { api } from '../../services/apiSupabase';
import { TabOverview, TabOverviewKpi, TabOverviewActionItem } from '../../components/common/TabOverview';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Modal } from '../../components/common/Modal';
import { uploadAttachment } from '../../utils/fileUploadHelper';
import { Toast } from '../../components/common/Toast';
import { isSystemAdmin, isDirector } from '../../services/authStore';

interface PaymentRequestTabProps {
  user: any;
  projects: Project[];
  engineers: Engineer[];
  selectedProjectCode?: string;
  onSelectProjectCode?: (code: string) => void;
  onRequestCreatedOrUpdated?: () => void;
  onCreateExpenseFromPayment?: (payment: PaymentRequest) => void;
}

const STATUS_LABELS: Record<PaymentRequestStatus, { label: string; tone: string; badgeClass: string }> = {
  DRAFT: { label: 'Nháp', tone: 'default', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', tone: 'warning', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  NEED_MORE_INFO: { label: 'Yêu cầu bổ sung', tone: 'warning', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  APPROVED: { label: 'Đã duyệt', tone: 'primary', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', tone: 'info', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  PAID: { label: 'Đã thanh toán', tone: 'success', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Từ chối', tone: 'danger', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Đã hủy', tone: 'default', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200' }
};

const PAYMENT_TYPE_LABELS: Record<PaymentRequestType, string> = {
  supplier: 'Nhà cung cấp',
  advance_refund: 'Hoàn ứng nhân viên',
  subcontractor: 'Thuê ngoài / Nhà thầu phụ',
  other: 'Chi phí khác'
};

export const PaymentRequestTab: React.FC<PaymentRequestTabProps> = ({
  user,
  projects,
  engineers,
  selectedProjectCode = '',
  onSelectProjectCode,
  onRequestCreatedOrUpdated,
  onCreateExpenseFromPayment
}) => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setToast({ message, type: type === 'error' ? 'warning' : type });
  };

  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState(selectedProjectCode || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [detailModalRequest, setDetailModalRequest] = useState<PaymentRequest | null>(null);
  const [actionReasonModal, setActionReasonModal] = useState<{
    isOpen: boolean;
    type: 'REJECT' | 'NEED_MORE_INFO';
    requestId: string;
    reason: string;
  }>({ isOpen: false, type: 'REJECT', requestId: '', reason: '' });

  // Payment Confirmation Modal (for Accountant)
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    request: PaymentRequest | null;
    paymentDocUrl: string;
    paymentDocName: string;
    paymentNote: string;
    isUploadingDoc: boolean;
  }>({ isOpen: false, request: null, paymentDocUrl: '', paymentDocName: '', paymentNote: '', isUploadingDoc: false });

  // Form state
  const [formData, setFormData] = useState<{
    projectCode: string;
    paymentType: PaymentRequestType;
    recipientName: string;
    content: string;
    amount: number;
    vatAmount: number;
    paymentMethod: 'bank_transfer' | 'cash';
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
    dueDate: string;
    note: string;
    linkedFundRequestId: string;
    linkedContractNumber: string;
    attachments: { name: string; url: string; size?: number }[];
  }>({
    projectCode: selectedProjectCode || 'COMPANY',
    paymentType: 'supplier',
    recipientName: '',
    content: '',
    amount: 0,
    vatAmount: 0,
    paymentMethod: 'bank_transfer',
    bankName: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
    dueDate: new Date().toISOString().split('T')[0],
    note: '',
    linkedFundRequestId: '',
    linkedContractNumber: '',
    attachments: []
  });

  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync selectedProjectCode
  useEffect(() => {
    if (selectedProjectCode) {
      setFilterProject(selectedProjectCode);
      setFormData(prev => ({ ...prev, projectCode: selectedProjectCode }));
    }
  }, [selectedProjectCode]);

  // Load payment requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.paymentRequests.getAll();
      setRequests(data);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách yêu cầu thanh toán');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Permission calculation
  const isSysAdmin = isSystemAdmin(user);
  const isDir = isDirector(user);
  const isAccountant = isSysAdmin || user?.role === 'accountant' || user?.title?.toLowerCase().includes('kế toán');
  const isPM = isSysAdmin || isDir || user?.role === 'pm' || user?.title?.toLowerCase().includes('chỉ huy') || user?.title?.toLowerCase().includes('quản lý');

  const canApprove = (req: PaymentRequest) => {
    if (req.creatorId === user?.id) return false; // Không tự duyệt
    if (isSysAdmin || isDir) return true;
    if (isPM && req.projectCode === selectedProjectCode) return true;
    return false;
  };

  const canProcessPayment = (req: PaymentRequest) => {
    return isSysAdmin || isAccountant;
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return requests.filter(req => {
      // Permission visibility: Nhân viên chỉ xem đơn của mình trừ khi là PM, Kế toán, Lãnh đạo
      if (!isSysAdmin && !isDir && !isAccountant && !isPM) {
        if (req.creatorId !== user?.id) return false;
      }

      if (filterProject !== 'all') {
        if (req.projectCode !== filterProject) return false;
      }
      if (filterStatus !== 'all') {
        if (filterStatus === 'OVERDUE') {
          if (req.status === 'PAID' || req.status === 'REJECTED' || req.status === 'CANCELLED') return false;
          if (req.dueDate >= today) return false;
        } else if (req.status !== filterStatus) {
          return false;
        }
      }
      if (filterType !== 'all') {
        if (req.paymentType !== filterType) return false;
      }
      if (filterDateFrom && req.dueDate < filterDateFrom) return false;
      if (filterDateTo && req.dueDate > filterDateTo) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = req.code?.toLowerCase().includes(q);
        const matchRecipient = req.recipientName?.toLowerCase().includes(q);
        const matchContent = req.content?.toLowerCase().includes(q);
        const matchCreator = req.creatorName?.toLowerCase().includes(q);
        if (!matchCode && !matchRecipient && !matchContent && !matchCreator) return false;
      }

      return true;
    });
  }, [requests, user, isSysAdmin, isDir, isAccountant, isPM, filterProject, filterStatus, filterType, filterDateFrom, filterDateTo, searchQuery, selectedProjectCode]);

  // KPIs
  const kpis = useMemo<TabOverviewKpi[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);

    let pendingApprovalCount = 0;
    let pendingApprovalTotal = 0;
    let pendingPaymentCount = 0;
    let pendingPaymentTotal = 0;
    let overdueCount = 0;
    let overdueTotal = 0;
    let paidThisMonthCount = 0;
    let paidThisMonthTotal = 0;

    requests.forEach(r => {
      const tot = Number(r.totalAmount) || 0;
      if (r.status === 'PENDING_APPROVAL') {
        pendingApprovalCount++;
        pendingApprovalTotal += tot;
      } else if (r.status === 'APPROVED' || r.status === 'PENDING_PAYMENT') {
        pendingPaymentCount++;
        pendingPaymentTotal += tot;
      }

      if (r.status !== 'PAID' && r.status !== 'REJECTED' && r.status !== 'CANCELLED') {
        if (r.dueDate && r.dueDate < today) {
          overdueCount++;
          overdueTotal += tot;
        }
      }

      if (r.status === 'PAID') {
        const pDate = (r.paidAt || r.dueDate || '').slice(0, 7);
        if (pDate === currentMonth) {
          paidThisMonthCount++;
          paidThisMonthTotal += tot;
        }
      }
    });

    return [
      {
        id: 'PENDING_APPROVAL',
        label: 'Chờ duyệt',
        value: `${pendingApprovalTotal.toLocaleString('vi-VN')} đ`,
        subValue: `${pendingApprovalCount} yêu cầu`,
        tone: 'warning',
        active: filterStatus === 'PENDING_APPROVAL',
        onClick: () => setFilterStatus(prev => prev === 'PENDING_APPROVAL' ? 'all' : 'PENDING_APPROVAL')
      },
      {
        id: 'PENDING_PAYMENT',
        label: 'Chờ thanh toán',
        value: `${pendingPaymentTotal.toLocaleString('vi-VN')} đ`,
        subValue: `${pendingPaymentCount} yêu cầu`,
        tone: 'info',
        active: filterStatus === 'PENDING_PAYMENT' || filterStatus === 'APPROVED',
        onClick: () => setFilterStatus(prev => prev === 'PENDING_PAYMENT' ? 'all' : 'PENDING_PAYMENT')
      },
      {
        id: 'OVERDUE',
        label: 'Quá hạn thanh toán',
        value: `${overdueTotal.toLocaleString('vi-VN')} đ`,
        subValue: `${overdueCount} yêu cầu`,
        tone: 'danger',
        active: filterStatus === 'OVERDUE',
        onClick: () => setFilterStatus(prev => prev === 'OVERDUE' ? 'all' : 'OVERDUE')
      },
      {
        id: 'PAID',
        label: 'Đã thanh toán tháng này',
        value: `${paidThisMonthTotal.toLocaleString('vi-VN')} đ`,
        subValue: `${paidThisMonthCount} yêu cầu`,
        tone: 'success',
        active: filterStatus === 'PAID',
        onClick: () => setFilterStatus(prev => prev === 'PAID' ? 'all' : 'PAID')
      }
    ];
  }, [requests, filterStatus]);

  // Action Items (Cần xử lý ngay)
  const actionItems = useMemo<TabOverviewActionItem[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    const urgentItems: TabOverviewActionItem[] = [];

    requests.forEach(r => {
      const tot = Number(r.totalAmount) || 0;
      if (r.status === 'NEED_MORE_INFO') {
        urgentItems.push({
          id: r.id,
          title: `${r.code}: Cần bổ sung hồ sơ (${r.recipientName})`,
          subtitle: `Lý do: ${r.moreInfoReason || 'Thiếu chứng từ'} • Số tiền: ${tot.toLocaleString('vi-VN')} đ`,
          badge: 'Bổ sung TT',
          badgeTone: 'warning',
          onClick: () => setDetailModalRequest(r)
        });
      } else if (r.status !== 'PAID' && r.status !== 'REJECTED' && r.status !== 'CANCELLED' && r.dueDate && r.dueDate < today) {
        urgentItems.push({
          id: r.id,
          title: `${r.code}: Quá hạn thanh toán (${r.recipientName})`,
          subtitle: `Hạn: ${r.dueDate} • Số tiền: ${tot.toLocaleString('vi-VN')} đ • ${r.content}`,
          badge: 'Quá hạn',
          badgeTone: 'danger',
          onClick: () => setDetailModalRequest(r)
        });
      } else if (r.status === 'PENDING_APPROVAL' && tot >= 50000000) {
        urgentItems.push({
          id: r.id,
          title: `${r.code}: Đơn giá trị lớn chờ duyệt (${r.recipientName})`,
          subtitle: `Số tiền: ${tot.toLocaleString('vi-VN')} đ • Dự án: ${r.projectName || r.projectCode}`,
          badge: 'Giá trị lớn',
          badgeTone: 'info',
          onClick: () => setDetailModalRequest(r)
        });
      }
    });

    return urgentItems.slice(0, 5);
  }, [requests]);

  // Monthly Chart Data (6 months trend)
  const chartData = useMemo(() => {
    const monthMap: Record<string, { month: string; requested: number; paid: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[mStr] = { month: `T${d.getMonth() + 1}`, requested: 0, paid: 0 };
    }

    requests.forEach(r => {
      const tot = Number(r.totalAmount) || 0;
      const cMonth = (r.createdAt || '').slice(0, 7);
      if (monthMap[cMonth]) {
        monthMap[cMonth].requested += tot;
      }
      if (r.status === 'PAID') {
        const pMonth = (r.paidAt || r.dueDate || '').slice(0, 7);
        if (monthMap[pMonth]) {
          monthMap[pMonth].paid += tot;
        }
      }
    });

    return Object.values(monthMap);
  }, [requests]);

  // Handle Attachment Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingAttachment(true);
    try {
      const newAttachments = [...formData.attachments];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadAttachment(file, 'payment_requests');
        newAttachments.push({
          name: file.name,
          url: res.url,
          size: file.size
        });
      }
      setFormData(prev => ({ ...prev, attachments: newAttachments }));
      triggerToast('Tải lên chứng từ thành công', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Lỗi khi tải file chứng từ', 'error');
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = '';
    }
  };

  // Submit create payment request
  const handleSubmitCreate = async (asDraft: boolean) => {
    if (!formData.recipientName.trim()) {
      triggerToast('Vui lòng nhập Nhà cung cấp hoặc người nhận tiền', 'error');
      return;
    }
    if (!formData.content.trim()) {
      triggerToast('Vui lòng nhập Nội dung thanh toán', 'error');
      return;
    }
    if (formData.amount <= 0) {
      triggerToast('Vui lòng nhập Số tiền đề nghị thanh toán lớn hơn 0', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const selectedProj = projects.find(p => p.code === formData.projectCode || p.id === formData.projectCode);
      const newReq = await api.paymentRequests.create({
        ...formData,
        projectName: selectedProj?.name || (formData.projectCode === 'COMPANY' ? 'Chi phí công ty' : formData.projectCode),
        status: asDraft ? 'DRAFT' : 'PENDING_APPROVAL',
        creatorId: user?.id || '',
        creatorName: user?.name || user?.username || 'Nhân sự',
        creatorTitle: user?.title || user?.role || 'Nhân viên'
      });

      triggerToast(asDraft ? 'Đã lưu bản nháp yêu cầu thanh toán' : 'Đã gửi yêu cầu thanh toán thành công', 'success');
      setIsCreateModalOpen(false);
      // Reset form
      setFormData({
        projectCode: selectedProjectCode || 'COMPANY',
        paymentType: 'supplier',
        recipientName: '',
        content: '',
        amount: 0,
        vatAmount: 0,
        paymentMethod: 'bank_transfer',
        bankName: '',
        bankAccountNumber: '',
        bankAccountHolder: '',
        dueDate: new Date().toISOString().split('T')[0],
        note: '',
        linkedFundRequestId: '',
        linkedContractNumber: '',
        attachments: []
      });
      fetchRequests();
      onRequestCreatedOrUpdated?.();
    } catch (err: any) {
      triggerToast(err?.message || 'Lỗi khi tạo yêu cầu thanh toán', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Status transitions
  const handleApprove = async (req: PaymentRequest) => {
    try {
      const nowIso = new Date().toISOString();
      await api.paymentRequests.update(req.id, {
        status: 'APPROVED',
        approverId: user?.id,
        approverName: user?.name || user?.username,
        approverTitle: user?.title || user?.role,
        approvedAt: nowIso
      }, {
        action: 'Duyệt yêu cầu thanh toán (chuyển Kế toán)',
        actorId: user?.id || '',
        actorName: user?.name || user?.username || 'Người duyệt',
        actorRole: user?.title || 'Quản lý',
        timestamp: nowIso
      });

      triggerToast('Đã duyệt yêu cầu thanh toán thành công', 'success');
      fetchRequests();
      setDetailModalRequest(null);
    } catch (err: any) {
      triggerToast(err?.message || 'Lỗi khi duyệt yêu cầu', 'error');
    }
  };

  const handleAccountantReceive = async (req: PaymentRequest) => {
    try {
      const nowIso = new Date().toISOString();
      await api.paymentRequests.update(req.id, {
        status: 'PENDING_PAYMENT',
        accountantId: user?.id,
        accountantName: user?.name || user?.username,
        receivedAt: nowIso
      }, {
        action: 'Kế toán tiếp nhận hồ sơ, chuyển Chờ thanh toán',
        actorId: user?.id || '',
        actorName: user?.name || user?.username || 'Kế toán',
        actorRole: 'Kế toán',
        timestamp: nowIso
      });

      triggerToast('Đã tiếp nhận hồ sơ thanh toán', 'success');
      fetchRequests();
      setDetailModalRequest(null);
    } catch (err: any) {
      triggerToast(err?.message || 'Lỗi khi tiếp nhận hồ sơ', 'error');
    }
  };

  const handleConfirmPaid = async () => {
    if (!paymentModal.request) return;
    const req = paymentModal.request;
    const nowIso = new Date().toISOString();

    try {
      await api.paymentRequests.update(req.id, {
        status: 'PAID',
        paidAt: nowIso,
        paymentDocUrl: paymentModal.paymentDocUrl,
        paymentDocName: paymentModal.paymentDocName,
        paymentNote: paymentModal.paymentNote
      }, {
        action: 'Kế toán xác nhận đã chi tiền (Hoàn tất thanh toán)',
        actorId: user?.id || '',
        actorName: user?.name || user?.username || 'Kế toán',
        actorRole: 'Kế toán',
        timestamp: nowIso,
        note: paymentModal.paymentNote,
        attachmentUrl: paymentModal.paymentDocUrl
      });

      triggerToast(`Đã xác nhận thanh toán ${req.totalAmount.toLocaleString('vi-VN')} đ cho ${req.recipientName}`, 'success');
      setPaymentModal({ isOpen: false, request: null, paymentDocUrl: '', paymentDocName: '', paymentNote: '', isUploadingDoc: false });
      fetchRequests();
      setDetailModalRequest(null);

      // Hỏi hoặc gợi ý tạo bản ghi chi phí thực tế
      if (onCreateExpenseFromPayment) {
        onCreateExpenseFromPayment({ ...req, status: 'PAID', paidAt: nowIso });
      }
    } catch (err: any) {
      triggerToast(err?.message || 'Lỗi khi xác nhận thanh toán', 'error');
    }
  };

  const handleRejectOrNeedInfo = async () => {
    if (!actionReasonModal.reason.trim()) {
      triggerToast('Vui lòng nhập lý do cụ thể', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    const isReject = actionReasonModal.type === 'REJECT';

    try {
      await api.paymentRequests.update(actionReasonModal.requestId, {
        status: isReject ? 'REJECTED' : 'NEED_MORE_INFO',
        ...(isReject ? {
          rejectReason: actionReasonModal.reason,
          rejectedBy: user?.name || user?.username,
          rejectedAt: nowIso
        } : {
          moreInfoReason: actionReasonModal.reason,
          moreInfoRequestedBy: user?.name || user?.username,
          moreInfoRequestedAt: nowIso
        })
      }, {
        action: isReject ? 'Từ chối yêu cầu thanh toán' : 'Yêu cầu bổ sung hồ sơ chứng từ',
        actorId: user?.id || '',
        actorName: user?.name || user?.username || 'Người duyệt',
        actorRole: user?.title || 'Quản lý',
        timestamp: nowIso,
        note: actionReasonModal.reason
      });

      triggerToast(isReject ? 'Đã từ chối yêu cầu thanh toán' : 'Đã gửi yêu cầu bổ sung thông tin', 'success');
      setActionReasonModal({ isOpen: false, type: 'REJECT', requestId: '', reason: '' });
      fetchRequests();
      setDetailModalRequest(null);
    } catch (err: any) {
      triggerToast(err?.message || 'Lỗi khi xử lý thao tác', 'error');
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full w-full bg-slate-50 overflow-hidden">
      {/* 1. DASHBOARD OVERVIEW SECTION */}
      <TabOverview
        kpis={kpis}
        loading={loading}
        error={error}
        onRetry={fetchRequests}
        chartTitle="TỔNG GIÁ TRỊ YÊU CẦU & THỰC CHI (6 THÁNG GẦN NHẤT)"
        hasChartData={chartData.length > 0}
        chartContent={
          <div className="h-44 w-full flex items-end gap-3 pt-6 pb-2 px-4">
            {chartData.map((item, idx) => {
              const maxVal = Math.max(...chartData.map(d => Math.max(d.requested, d.paid)), 1000000);
              const reqHeight = Math.min(100, Math.max(10, (item.requested / maxVal) * 100));
              const paidHeight = Math.min(100, Math.max(10, (item.paid / maxVal) * 100));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1.5 h-32">
                    {/* Cột Đề nghị */}
                    <div
                      style={{ height: `${reqHeight}%` }}
                      className="w-1/2 max-w-[24px] bg-amber-400 rounded-t transition-all hover:opacity-80 relative group"
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap z-20 shadow-md">
                        Đề nghị: {item.requested.toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                    {/* Cột Thực chi */}
                    <div
                      style={{ height: `${paidHeight}%` }}
                      className="w-1/2 max-w-[24px] bg-emerald-500 rounded-t transition-all hover:opacity-80 relative group"
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap z-20 shadow-md">
                        Thực chi: {item.paid.toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">{item.month}</span>
                </div>
              );
            })}
          </div>
        }
        actionTitle="YÊU CẦU CẦN XỬ LÝ NGAY"
        actionItems={actionItems}
        emptyActionText="Không có yêu cầu nào cần xử lý gấp."
      />

      {/* 2. TOOLBAR & FILTER SECTION */}
      <div className="border-y border-slate-200 bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Dự án:</span>
            <CustomSelect
              value={filterProject}
              onChange={e => {
                setFilterProject(e.target.value);
                if (onSelectProjectCode && e.target.value !== 'all') {
                  onSelectProjectCode(e.target.value);
                }
              }}
              className="border border-slate-200 rounded px-2 py-1 bg-white text-xs font-medium"
            >
              <option value="all">Tất cả dự án</option>
              <option value="COMPANY">Chi phí công ty</option>
              {projects.map(p => (
                <option key={p.id} value={p.code}>{p.name || p.code}</option>
              ))}
            </CustomSelect>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Loại:</span>
            <CustomSelect
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="border border-slate-200 rounded px-2 py-1 bg-white text-xs font-medium"
            >
              <option value="all">Tất cả loại</option>
              {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </CustomSelect>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Trạng thái:</span>
            <CustomSelect
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-slate-200 rounded px-2 py-1 bg-white text-xs font-medium"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="OVERDUE">⚠️ Quá hạn thanh toán</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </CustomSelect>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Hạn:</span>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="border border-slate-200 rounded px-1.5 py-1 text-xs"
              placeholder="Từ ngày"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="border border-slate-200 rounded px-1.5 py-1 text-xs"
              placeholder="Đến ngày"
            />
          </div>
        </div>

        {/* Search & Create Button */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input
              type="text"
              placeholder="Tìm mã, NCC, nội dung..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 border border-slate-200 rounded-md text-xs w-48 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold px-3 py-1.5 rounded-md text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Tạo yêu cầu thanh toán</span>
          </button>
        </div>
      </div>

      {/* 3. PAYMENT REQUESTS LIST TABLE */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10 select-none">
            <tr>
              <th className="py-2.5 px-3 w-28">Mã YC</th>
              <th className="py-2.5 px-3 w-28">Hạn TT</th>
              <th className="py-2.5 px-3 w-40">Dự án</th>
              <th className="py-2.5 px-3 w-44">Người nhận / NCC</th>
              <th className="py-2.5 px-3 min-w-[200px]">Nội dung thanh toán</th>
              <th className="py-2.5 px-3 w-32 text-right">Tổng tiền</th>
              <th className="py-2.5 px-3 w-32 text-center">Trạng thái</th>
              <th className="py-2.5 px-3 w-36">Người đề nghị</th>
              <th className="py-2.5 px-3 w-28 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                  {loading ? 'Đang nạp danh sách yêu cầu...' : 'Không tìm thấy yêu cầu thanh toán nào.'}
                </td>
              </tr>
            ) : (
              filteredRequests.map(req => {
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = req.status !== 'PAID' && req.status !== 'REJECTED' && req.status !== 'CANCELLED' && req.dueDate && req.dueDate < today;
                const statusMeta = STATUS_LABELS[req.status] || STATUS_LABELS.DRAFT;

                return (
                  <tr
                    key={req.id}
                    onClick={() => setDetailModalRequest(req)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${isOverdue ? 'bg-rose-50/20' : ''}`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      {req.code}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className={`font-semibold ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {req.dueDate}
                      </div>
                      {isOverdue && <span className="text-[10px] text-rose-500 font-bold">Quá hạn</span>}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 truncate max-w-[160px]" title={req.projectName || req.projectCode}>
                      {req.projectCode === 'COMPANY' ? '🏢 Chi phí công ty' : (req.projectName || req.projectCode)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      <div className="truncate max-w-[170px]" title={req.recipientName}>{req.recipientName}</div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {PAYMENT_TYPE_LABELS[req.paymentType] || req.paymentType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div className="line-clamp-2" title={req.content}>{req.content}</div>
                      {req.attachments?.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">
                          <span className="material-symbols-outlined text-[12px]">attach_file</span>
                          <span>{req.attachments.length} hồ sơ đính kèm</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-extrabold text-slate-900">{req.totalAmount.toLocaleString('vi-VN')} đ</div>
                      {req.vatAmount > 0 && (
                        <span className="text-[10px] text-slate-400">VAT: {req.vatAmount.toLocaleString('vi-VN')} đ</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div className="font-semibold text-slate-800 truncate">{req.creatorName}</div>
                      <span className="text-[10px] text-slate-400">{req.createdAt?.slice(0, 10)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* Quick action buttons depending on role & status */}
                        {req.status === 'PENDING_APPROVAL' && canApprove(req) && (
                          <button
                            type="button"
                            onClick={() => handleApprove(req)}
                            className="p-1 text-primary hover:bg-blue-50 rounded"
                            title="Phê duyệt"
                          >
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          </button>
                        )}
                        {req.status === 'APPROVED' && canProcessPayment(req) && (
                          <button
                            type="button"
                            onClick={() => handleAccountantReceive(req)}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Tiếp nhận chi tiền"
                          >
                            <span className="material-symbols-outlined text-[18px]">account_balance</span>
                          </button>
                        )}
                        {req.status === 'PENDING_PAYMENT' && canProcessPayment(req) && (
                          <button
                            type="button"
                            onClick={() => setPaymentModal({ isOpen: true, request: req, paymentDocUrl: '', paymentDocName: '', paymentNote: '', isUploadingDoc: false })}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Xác nhận đã trả tiền"
                          >
                            <span className="material-symbols-outlined text-[18px]">payments</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDetailModalRequest(req)}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                          title="Xem chi tiết"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. MODAL TẠO YÊU CẦU THANH TOÁN */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo Yêu cầu Thanh toán"
        icon="payments"
        size="2xl"
      >
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dự án hoặc chi phí công ty */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Dự án / Chi phí công ty <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={formData.projectCode}
                onChange={e => setFormData(prev => ({ ...prev, projectCode: e.target.value }))}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white text-xs"
              >
                <option value="COMPANY">🏢 Chi phí công ty</option>
                {projects.map(p => (
                  <option key={p.id} value={p.code}>{p.name || p.code}</option>
                ))}
              </CustomSelect>
            </div>

            {/* Loại thanh toán */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Loại thanh toán <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={formData.paymentType}
                onChange={e => setFormData(prev => ({ ...prev, paymentType: e.target.value as PaymentRequestType }))}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white text-xs"
              >
                {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </CustomSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nhà cung cấp hoặc người nhận */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nhà cung cấp / Người nhận tiền <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Công ty TNHH Thiết bị ABC / Nguyễn Văn A"
                value={formData.recipientName}
                onChange={e => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            {/* Hạn thanh toán */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Hạn thanh toán <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* Nội dung thanh toán */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Nội dung thanh toán <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="VD: Thanh toán đợt 2 cung cấp vật tư thiết bị điện cho dự án..."
              value={formData.content}
              onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none resize-none"
            />
          </div>

          {/* Số tiền, VAT, Tổng tiền */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Số tiền đề nghị (trước VAT) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.amount || ''}
                onChange={e => setFormData(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-primary outline-none bg-white"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tiền VAT / Thuế (nếu có)</label>
              <input
                type="number"
                min="0"
                value={formData.vatAmount || ''}
                onChange={e => setFormData(prev => ({ ...prev, vatAmount: Number(e.target.value) || 0 }))}
                className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-primary outline-none bg-white"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tổng thanh toán</label>
              <div className="h-8 flex items-center px-2.5 font-extrabold text-sm text-primary bg-blue-50 border border-blue-200 rounded">
                {(formData.amount + formData.vatAmount).toLocaleString('vi-VN')} đ
              </div>
            </div>
          </div>

          {/* Phương thức & Thông tin tài khoản */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-700">Phương thức thanh toán:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank_transfer"
                  checked={formData.paymentMethod === 'bank_transfer'}
                  onChange={() => setFormData(prev => ({ ...prev, paymentMethod: 'bank_transfer' }))}
                />
                <span>Chuyển khoản</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={formData.paymentMethod === 'cash'}
                  onChange={() => setFormData(prev => ({ ...prev, paymentMethod: 'cash' }))}
                />
                <span>Tiền mặt</span>
              </label>
            </div>

            {formData.paymentMethod === 'bank_transfer' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngân hàng</label>
                  <input
                    type="text"
                    placeholder="VD: Vietcombank, Techcombank..."
                    value={formData.bankName}
                    onChange={e => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Số tài khoản</label>
                  <input
                    type="text"
                    placeholder="VD: 0123456789"
                    value={formData.bankAccountNumber}
                    onChange={e => setFormData(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-xs bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chủ tài khoản</label>
                  <input
                    type="text"
                    placeholder="VD: NGUYEN VAN A"
                    value={formData.bankAccountHolder}
                    onChange={e => setFormData(prev => ({ ...prev, bankAccountHolder: e.target.value }))}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-xs bg-white uppercase"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Hồ sơ đính kèm */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">
                Hồ sơ đính kèm (báo giá, hợp đồng, biên bản nghiệm thu, hóa đơn...)
              </label>
              <label className={`cursor-pointer text-primary hover:underline flex items-center gap-1 font-bold ${isUploadingAttachment ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span>{isUploadingAttachment ? 'Đang tải lên...' : 'Thêm tệp'}</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                />
              </label>
            </div>

            {formData.attachments.length === 0 ? (
              <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-slate-400">
                Chưa có chứng từ đính kèm nào. Vui lòng tải lên báo giá / hóa đơn để người duyệt kiểm tra.
              </div>
            ) : (
              <div className="space-y-1.5">
                {formData.attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                    <div className="flex items-center gap-2 truncate flex-1">
                      <span className="material-symbols-outlined text-slate-500 text-[16px]">description</span>
                      <a href={file.url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium truncate">
                        {file.name}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Ghi chú bổ sung</label>
            <input
              type="text"
              placeholder="Thông tin thêm (nếu có)..."
              value={formData.note}
              onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
              className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmitCreate(true)}
              className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold disabled:opacity-50"
            >
              Lưu bản nháp
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmitCreate(false)}
              className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-white font-bold disabled:opacity-50 shadow-2xs"
            >
              {submitting ? 'Đang gửi...' : 'Gửi yêu cầu thanh toán'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 5. MODAL XEM CHI TIẾT & PHÊ DUYỆT */}
      {detailModalRequest && (
        <Modal
          isOpen={!!detailModalRequest}
          onClose={() => setDetailModalRequest(null)}
          title={`Chi tiết Yêu cầu: ${detailModalRequest.code}`}
          icon="receipt_long"
          size="2xl"
        >
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Trạng thái</span>
                <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded text-xs font-bold border ${STATUS_LABELS[detailModalRequest.status]?.badgeClass}`}>
                  {STATUS_LABELS[detailModalRequest.status]?.label}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng thanh toán</span>
                <span className="text-lg font-black text-primary block">
                  {detailModalRequest.totalAmount.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>

            {/* Grid properties */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">Dự án:</span>
                <span className="font-bold text-slate-800">{detailModalRequest.projectName || detailModalRequest.projectCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">Người nhận / NCC:</span>
                <span className="font-bold text-slate-800">{detailModalRequest.recipientName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">Loại thanh toán:</span>
                <span className="font-bold text-slate-800">{PAYMENT_TYPE_LABELS[detailModalRequest.paymentType]}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">Hạn thanh toán:</span>
                <span className="font-bold text-slate-800">{detailModalRequest.dueDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">Phương thức:</span>
                <span className="font-bold text-slate-800">
                  {detailModalRequest.paymentMethod === 'bank_transfer' ? 'Chuyển khoản ngân hàng' : 'Tiền mặt'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px]">Người đề nghị:</span>
                <span className="font-bold text-slate-800">{detailModalRequest.creatorName}</span>
              </div>
            </div>

            {/* Bank details if bank transfer */}
            {detailModalRequest.paymentMethod === 'bank_transfer' && detailModalRequest.bankAccountNumber && (
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase">Thông tin chuyển khoản</span>
                  <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                    {detailModalRequest.bankName}: {detailModalRequest.bankAccountNumber}
                  </div>
                  <div className="text-slate-600 font-semibold uppercase">{detailModalRequest.bankAccountHolder}</div>
                </div>
              </div>
            )}

            {/* Content */}
            <div>
              <span className="text-slate-400 block font-semibold text-[10px] mb-1">Nội dung thanh toán:</span>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 leading-relaxed">
                {detailModalRequest.content}
              </div>
            </div>

            {/* Attachments */}
            <div>
              <span className="text-slate-400 block font-semibold text-[10px] mb-1">
                Hồ sơ đính kèm ({detailModalRequest.attachments?.length || 0}):
              </span>
              {!detailModalRequest.attachments?.length ? (
                <div className="text-slate-400 italic">Không có tài liệu đính kèm.</div>
              ) : (
                <div className="space-y-1.5">
                  {detailModalRequest.attachments.map((att, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="flex items-center gap-2 truncate">
                        <span className="material-symbols-outlined text-slate-500 text-[16px]">attachment</span>
                        <a href={att.url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold truncate">
                          {att.name}
                        </a>
                      </div>
                      <a href={att.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-primary">
                        <span className="material-symbols-outlined text-[16px]">download</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit History */}
            {detailModalRequest.history && detailModalRequest.history.length > 0 && (
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] mb-1">Lịch sử phê duyệt & xử lý:</span>
                <div className="space-y-2 border-l-2 border-slate-200 pl-3 ml-2">
                  {detailModalRequest.history.map((h, i) => (
                    <div key={i} className="text-[11px]">
                      <div className="font-bold text-slate-800">{h.action}</div>
                      <div className="text-slate-500">
                        Bởi <strong>{h.actorName}</strong> ({h.actorRole || 'Nhân sự'}) lúc {h.timestamp?.slice(0, 16).replace('T', ' ')}
                      </div>
                      {h.note && <div className="text-slate-600 bg-slate-50 p-1.5 rounded mt-1 italic">"{h.note}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons depending on status and role */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDetailModalRequest(null)}
                className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Đóng
              </button>

              <div className="flex items-center gap-2">
                {/* Luồng Duyệt */}
                {detailModalRequest.status === 'PENDING_APPROVAL' && canApprove(detailModalRequest) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActionReasonModal({ isOpen: true, type: 'NEED_MORE_INFO', requestId: detailModalRequest.id, reason: '' })}
                      className="px-3 py-1.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold"
                    >
                      Yêu cầu bổ sung
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionReasonModal({ isOpen: true, type: 'REJECT', requestId: detailModalRequest.id, reason: '' })}
                      className="px-3 py-1.5 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold"
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(detailModalRequest)}
                      className="px-4 py-1.5 rounded bg-primary hover:bg-primary/90 text-white font-bold shadow-2xs"
                    >
                      Duyệt yêu cầu
                    </button>
                  </>
                )}

                {/* Luồng Kế toán tiếp nhận */}
                {detailModalRequest.status === 'APPROVED' && canProcessPayment(detailModalRequest) && (
                  <button
                    type="button"
                    onClick={() => handleAccountantReceive(detailModalRequest)}
                    className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-2xs"
                  >
                    Tiếp nhận chuyển Chờ thanh toán
                  </button>
                )}

                {/* Luồng Kế toán chi tiền */}
                {detailModalRequest.status === 'PENDING_PAYMENT' && canProcessPayment(detailModalRequest) && (
                  <button
                    type="button"
                    onClick={() => setPaymentModal({ isOpen: true, request: detailModalRequest, paymentDocUrl: '', paymentDocName: '', paymentNote: '', isUploadingDoc: false })}
                    className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-2xs"
                  >
                    Xác nhận đã trả tiền
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. MODAL TỪ CHỐI / YÊU CẦU BỔ SUNG */}
      <Modal
        isOpen={actionReasonModal.isOpen}
        onClose={() => setActionReasonModal({ isOpen: false, type: 'REJECT', requestId: '', reason: '' })}
        title={actionReasonModal.type === 'REJECT' ? 'Từ chối Yêu cầu Thanh toán' : 'Yêu cầu Bổ sung Hồ sơ'}
        icon={actionReasonModal.type === 'REJECT' ? 'cancel' : 'help'}
        size="md"
      >
        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-600">
            {actionReasonModal.type === 'REJECT'
              ? 'Vui lòng nêu rõ lý do từ chối để người đề nghị được biết và chỉnh sửa:'
              : 'Vui lòng ghi rõ các chứng từ hoặc thông tin cần bổ sung:'}
          </p>
          <textarea
            rows={3}
            value={actionReasonModal.reason}
            onChange={e => setActionReasonModal(prev => ({ ...prev, reason: e.target.value }))}
            placeholder="Nhập lý do chi tiết..."
            className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-primary outline-none resize-none"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setActionReasonModal({ isOpen: false, type: 'REJECT', requestId: '', reason: '' })}
              className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleRejectOrNeedInfo}
              className={`px-4 py-1.5 rounded text-white font-bold shadow-2xs ${
                actionReasonModal.type === 'REJECT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              Xác nhận
            </button>
          </div>
        </div>
      </Modal>

      {/* 7. MODAL XÁC NHẬN ĐÃ THANH TOÁN (KẾ TOÁN) */}
      <Modal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ isOpen: false, request: null, paymentDocUrl: '', paymentDocName: '', paymentNote: '', isUploadingDoc: false })}
        title="Xác nhận Đã Thanh toán"
        icon="task_alt"
        size="md"
      >
        <div className="p-4 space-y-3 text-xs">
          {paymentModal.request && (
            <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
              <div className="text-[11px] text-emerald-800 font-bold">
                Xác nhận chi: {paymentModal.request.totalAmount.toLocaleString('vi-VN')} đ
              </div>
              <div className="text-slate-600 text-[10px] mt-0.5">
                Người nhận: <strong>{paymentModal.request.recipientName}</strong> • {paymentModal.request.content}
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Ủy nhiệm chi (UNC) / Giấy biên lai xác nhận chuyển tiền
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="paymentDocInput"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPaymentModal(prev => ({ ...prev, isUploadingDoc: true }));
                  try {
                    const res = await uploadAttachment(file, 'payment_docs');
                    setPaymentModal(prev => ({
                      ...prev,
                      paymentDocUrl: res.url,
                      paymentDocName: file.name
                    }));
                    triggerToast('Tải lên UNC thành công', 'success');
                  } catch (err: any) {
                    triggerToast(err?.message || 'Lỗi khi tải UNC', 'error');
                  } finally {
                    setPaymentModal(prev => ({ ...prev, isUploadingDoc: false }));
                  }
                }}
              />
              <label
                htmlFor="paymentDocInput"
                className={`cursor-pointer px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1.5 ${
                  paymentModal.isUploadingDoc ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span>{paymentModal.isUploadingDoc ? 'Đang tải...' : 'Tải UNC / Phiếu chi'}</span>
              </label>
              {paymentModal.paymentDocName && (
                <span className="text-emerald-700 font-semibold truncate max-w-[200px]" title={paymentModal.paymentDocName}>
                  ✓ {paymentModal.paymentDocName}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Ghi chú thanh toán</label>
            <input
              type="text"
              placeholder="VD: Đã chuyển khoản qua VCB lúc 10:30..."
              value={paymentModal.paymentNote}
              onChange={e => setPaymentModal(prev => ({ ...prev, paymentNote: e.target.value }))}
              className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPaymentModal({ isOpen: false, request: null, paymentDocUrl: '', paymentDocName: '', paymentNote: '', isUploadingDoc: false })}
              className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmPaid}
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-2xs"
            >
              Xác nhận hoàn tất
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Alert */}
      {toast && (
        <Toast
          show={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
