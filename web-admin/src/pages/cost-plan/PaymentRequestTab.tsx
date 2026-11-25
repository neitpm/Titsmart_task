import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PaymentRequest, PaymentRequestStatus, PaymentRequestType, Project, Engineer } from '../../types';
import { api } from '../../services/apiSupabase';
import { TabOverview, TabOverviewKpi, TabOverviewActionItem } from '../../components/common/TabOverview';
import { CustomSelect } from '../../components/common/CustomSelect';
import { Modal } from '../../components/common/Modal';
import { uploadAttachment } from '../../utils/fileUploadHelper';
import { Toast } from '../../components/common/Toast';
import { isSystemAdmin, isDirector } from '../../services/authStore';

// ─── Hạn mức thanh toán mặc định (cấu hình, không hard-code trong logic nghiệp vụ) ───
const DEFAULT_THRESHOLD = 5_000_000; // 5 triệu VNĐ
function getThreshold(): number {
  try {
    const v = localStorage.getItem('payment_threshold');
    if (v) return Number(v) || DEFAULT_THRESHOLD;
  } catch {}
  return DEFAULT_THRESHOLD;
}

interface PaymentRequestTabProps {
  user: any;
  projects: Project[];
  engineers: Engineer[];
  selectedProjectCode?: string;
  onSelectProjectCode?: (code: string) => void;
  onRequestCreatedOrUpdated?: () => void;
  onCreateExpenseFromPayment?: (payment: PaymentRequest) => void;
  autoOpenCreateModal?: boolean;
  onCloseCreateModal?: () => void;
}

// ─── Nhận diện vai trò ───────────────────────────────────────────────────────
function checkIsAccountant(user: any): boolean {
  if (!user) return false;
  const r = (user.role || '').toLowerCase();
  const t = (user.title || '').toLowerCase();
  return r === 'accountant' || t.includes('kế toán');
}
function checkIsFundHolder(user: any, engineers: Engineer[]): boolean {
  if (!user) return false;
  const eng = engineers.find(e => e.id === user.id || (e as any).userId === user.id);
  if (!eng) return false;
  const r = (eng.role || '').toLowerCase();
  const t = (eng.title || '').toLowerCase();
  return r.includes('cầm quỹ') || t.includes('cầm quỹ') || r.includes('fund_holder') || t.includes('thủ quỹ');
}

// Kiểm tra kế toán hiện tại có đang nghỉ / vắng không
// Dựa trên leave records trong engineers (trường leaveStatus hoặc tương tự)
function isAccountantAbsent(engineers: Engineer[]): boolean {
  const today = new Date().toISOString().split('T')[0];
  const accountants = engineers.filter(e => {
    const r = (e.role || '').toLowerCase();
    const t = (e.title || '').toLowerCase();
    return r === 'accountant' || t.includes('kế toán');
  });
  if (accountants.length === 0) return false;
  // Nếu tất cả kế toán đều có leave record approved bao gồm hôm nay → vắng
  return accountants.every(acc => {
    const leaveEnd = (acc as any).leaveEndDate || (acc as any).leave_end_date;
    const leaveStart = (acc as any).leaveStartDate || (acc as any).leave_start_date;
    if (leaveStart && leaveEnd) {
      return today >= leaveStart && today <= leaveEnd;
    }
    return false;
  });
}

// ─── Nhãn trạng thái ─────────────────────────────────────────────────────────
const STATUS_LABELS: Record<PaymentRequestStatus, { label: string; badgeClass: string; icon: string }> = {
  DRAFT:                       { label: 'Nháp',                           badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',   icon: 'draft' },
  PENDING_FUND_PAYMENT:        { label: 'Chờ quỹ chi (≤ hạn mức)',        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',       icon: 'account_balance_wallet' },
  PENDING_ACCOUNTANT_APPROVAL: { label: 'Chờ kế toán duyệt',              badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',    icon: 'pending_actions' },
  PENDING_DELEGATE_APPROVAL:   { label: 'KT vắng – Chờ duyệt thay',       badgeClass: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'swap_horiz' },
  PENDING_APPROVAL:            { label: 'Chờ duyệt',                      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',    icon: 'pending_actions' },
  NEED_MORE_INFO:              { label: 'Yêu cầu bổ sung',                badgeClass: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'info' },
  APPROVED:                    { label: 'Đã duyệt – Chờ chi quỹ',         badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',       icon: 'check_circle' },
  PENDING_PAYMENT:             { label: 'Chờ chi quỹ',                    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: 'payments' },
  PAID:                        { label: 'Đã thanh toán',                  badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'task_alt' },
  REJECTED:                    { label: 'Từ chối',                        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',       icon: 'cancel' },
  CANCELLED:                   { label: 'Đã hủy',                         badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',   icon: 'block' },
};

const PAYMENT_TYPE_LABELS: Record<PaymentRequestType, string> = {
  supplier: 'Nhà cung cấp',
  advance_refund: 'Hoàn ứng nhân viên',
  subcontractor: 'Thuê ngoài / Nhà thầu phụ',
  other: 'Chi phí khác'
};

// ─── Approval Timeline Component ─────────────────────────────────────────────
const ApprovalTimeline: React.FC<{ req: PaymentRequest; threshold: number }> = ({ req, threshold }) => {
  const isSmall = req.totalAmount <= threshold;
  const steps = isSmall
    ? [
        { label: 'Người đề nghị tạo', status: 'done', icon: 'person', detail: req.creatorName },
        {
          label: 'Người cầm quỹ chi tiền',
          icon: 'account_balance_wallet',
          status: req.status === 'PAID' ? 'done' : req.status === 'PENDING_FUND_PAYMENT' ? 'active' : 'done',
          detail: req.fundHolderName || (req.status === 'PAID' ? 'Đã chi' : 'Đang chờ')
        },
        { label: 'Hoàn tất', icon: 'task_alt', status: req.status === 'PAID' ? 'done' : 'pending', detail: req.fundConfirmedAt ? req.fundConfirmedAt.slice(0, 10) : '' }
      ]
    : [
        { label: 'Người đề nghị tạo', icon: 'person', status: 'done', detail: req.creatorName },
        {
          label: req.status === 'PENDING_DELEGATE_APPROVAL' ? 'Cấp trên KT duyệt thay' : 'Kế toán duyệt',
          icon: req.status === 'PENDING_DELEGATE_APPROVAL' ? 'swap_horiz' : 'fact_check',
          status: ['APPROVED', 'PENDING_PAYMENT', 'PAID'].includes(req.status) ? 'done'
            : ['PENDING_ACCOUNTANT_APPROVAL', 'PENDING_DELEGATE_APPROVAL'].includes(req.status) ? 'active' : 'pending',
          detail: req.delegateApproverName || req.approverName || ''
        },
        {
          label: 'Người cầm quỹ chi tiền',
          icon: 'account_balance_wallet',
          status: req.status === 'PAID' ? 'done' : ['APPROVED', 'PENDING_PAYMENT'].includes(req.status) ? 'active' : 'pending',
          detail: req.fundHolderName || ''
        },
        { label: 'Hoàn tất', icon: 'task_alt', status: req.status === 'PAID' ? 'done' : 'pending', detail: req.fundConfirmedAt ? req.fundConfirmedAt.slice(0, 10) : '' }
      ];

  if (['REJECTED', 'CANCELLED'].includes(req.status)) {
    return (
      <div className="flex items-center gap-2 p-2 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-700 font-semibold">
        <span className="material-symbols-outlined text-[16px]">cancel</span>
        {req.status === 'REJECTED' ? `Đã từ chối${req.rejectReason ? `: ${req.rejectReason}` : ''}` : 'Đã hủy'}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-0">
      {steps.map((step, i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <div className="flex items-center w-full">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              step.status === 'done' ? 'bg-emerald-500 text-white' :
              step.status === 'active' ? 'bg-blue-500 text-white animate-pulse' :
              'bg-slate-200 text-slate-400'
            }`}>
              <span className="material-symbols-outlined text-[13px]">{step.status === 'done' ? 'check' : step.icon}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${step.status === 'done' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
          <div className="mt-1 text-center">
            <div className={`text-[10px] font-bold ${step.status === 'active' ? 'text-blue-600' : step.status === 'done' ? 'text-emerald-600' : 'text-slate-400'}`}>
              {step.label}
            </div>
            {step.detail && <div className="text-[9px] text-slate-500 mt-0.5">{step.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const PaymentRequestTab: React.FC<PaymentRequestTabProps> = ({
  user,
  projects,
  engineers,
  selectedProjectCode = '',
  onSelectProjectCode,
  onRequestCreatedOrUpdated,
  onCreateExpenseFromPayment,
  autoOpenCreateModal = false,
  onCloseCreateModal
}) => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setToast({ message, type: type === 'error' ? 'warning' : type });
  };

  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hạn mức cấu hình
  const [threshold, setThreshold] = useState<number>(getThreshold());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState(selectedProjectCode || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Tabs: "all" | "mine" | "need_action"
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'need_action'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(autoOpenCreateModal);
  useEffect(() => {
    if (autoOpenCreateModal) setIsCreateModalOpen(true);
  }, [autoOpenCreateModal]);

  const [detailModalRequest, setDetailModalRequest] = useState<PaymentRequest | null>(null);
  const [actionReasonModal, setActionReasonModal] = useState<{
    isOpen: boolean;
    type: 'REJECT' | 'NEED_MORE_INFO';
    requestId: string;
    reason: string;
  }>({ isOpen: false, type: 'REJECT', requestId: '', reason: '' });

  // Fund Payment Confirmation Modal
  const [fundModal, setFundModal] = useState<{
    isOpen: boolean;
    request: PaymentRequest | null;
    docUrl: string;
    docName: string;
    note: string;
    isUploading: boolean;
  }>({ isOpen: false, request: null, docUrl: '', docName: '', note: '', isUploading: false });

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

  useEffect(() => {
    if (selectedProjectCode) {
      setFilterProject(selectedProjectCode);
      setFormData(prev => ({ ...prev, projectCode: selectedProjectCode }));
    }
  }, [selectedProjectCode]);

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

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // ─── Vai trò hiện tại ───────────────────────────────────────────────────────
  const isSysAdmin   = isSystemAdmin(user);
  const isDir        = isDirector(user);
  const isAccountant = checkIsAccountant(user);
  const isFundHolder = checkIsFundHolder(user, engineers);
  const accountantAbsent = isAccountantAbsent(engineers);

  // Cấp trên kế toán: Director hoặc SysAdmin (khi kế toán vắng mặt)
  const isAccountantSuperior = (isSysAdmin || isDir) && !isAccountant;

  // ─── Logic phân luồng ────────────────────────────────────────────────────────
  // Khi gửi yêu cầu: quyết định trạng thái ban đầu dựa trên hạn mức
  const getInitialStatus = (totalAmount: number): PaymentRequestStatus => {
    if (totalAmount <= threshold) return 'PENDING_FUND_PAYMENT';
    if (accountantAbsent) return 'PENDING_DELEGATE_APPROVAL';
    return 'PENDING_ACCOUNTANT_APPROVAL';
  };

  // ─── Quyền hành động ────────────────────────────────────────────────────────
  // Kế toán duyệt yêu cầu > hạn mức
  const canAccountantApprove = (req: PaymentRequest) =>
    (isSysAdmin || isAccountant) && req.status === 'PENDING_ACCOUNTANT_APPROVAL' && req.creatorId !== user?.id;

  // Cấp trên duyệt thay khi kế toán vắng
  const canDelegateApprove = (req: PaymentRequest) =>
    (isSysAdmin || isAccountantSuperior) && req.status === 'PENDING_DELEGATE_APPROVAL' && req.creatorId !== user?.id;

  // Người cầm quỹ xác nhận chi tiền
  const canFundHolderPay = (req: PaymentRequest) =>
    (isSysAdmin || isFundHolder) &&
    ['PENDING_FUND_PAYMENT', 'APPROVED', 'PENDING_PAYMENT'].includes(req.status);

  // Quyền từ chối / bổ sung: kế toán hoặc cấp trên (khi có thể duyệt)
  const canRejectOrNeedInfo = (req: PaymentRequest) =>
    canAccountantApprove(req) || canDelegateApprove(req) || (isSysAdmin || isDir);

  // ─── Filtered list ───────────────────────────────────────────────────────────
  const filteredRequests = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return requests.filter(req => {
      // Tab filter
      if (activeTab === 'mine' && req.creatorId !== user?.id) return false;
      if (activeTab === 'need_action') {
        const myAction =
          canAccountantApprove(req) || canDelegateApprove(req) || canFundHolderPay(req) ||
          (req.status === 'NEED_MORE_INFO' && req.creatorId === user?.id);
        if (!myAction) return false;
      }

      // Visibility: nhân viên thường chỉ thấy đơn của mình
      if (!isSysAdmin && !isDir && !isAccountant && !isFundHolder && activeTab === 'all') {
        if (req.creatorId !== user?.id) return false;
      }

      if (filterProject !== 'all' && req.projectCode !== filterProject) return false;

      if (filterStatus !== 'all') {
        if (filterStatus === 'OVERDUE') {
          if (['PAID', 'REJECTED', 'CANCELLED'].includes(req.status)) return false;
          if (!req.dueDate || req.dueDate >= today) return false;
        } else if (req.status !== filterStatus) return false;
      }

      if (filterType !== 'all' && req.paymentType !== filterType) return false;
      if (filterDateFrom && req.dueDate < filterDateFrom) return false;
      if (filterDateTo && req.dueDate > filterDateTo) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (
          !req.code?.toLowerCase().includes(q) &&
          !req.recipientName?.toLowerCase().includes(q) &&
          !req.content?.toLowerCase().includes(q) &&
          !req.creatorName?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [requests, user, isSysAdmin, isDir, isAccountant, isFundHolder, filterProject, filterStatus, filterType, filterDateFrom, filterDateTo, searchQuery, activeTab]);

  // ─── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo<TabOverviewKpi[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    const cm = today.slice(0, 7);

    let waitFund = 0, waitFundAmt = 0;
    let waitAccountant = 0, waitAccountantAmt = 0;
    let waitDelegate = 0, waitDelegateAmt = 0;
    let overdue = 0, overdueAmt = 0;
    let paidMonth = 0, paidMonthAmt = 0;

    requests.forEach(r => {
      const tot = Number(r.totalAmount) || 0;
      if (['PENDING_FUND_PAYMENT', 'PENDING_PAYMENT', 'APPROVED'].includes(r.status)) { waitFund++; waitFundAmt += tot; }
      if (r.status === 'PENDING_ACCOUNTANT_APPROVAL') { waitAccountant++; waitAccountantAmt += tot; }
      if (r.status === 'PENDING_DELEGATE_APPROVAL') { waitDelegate++; waitDelegateAmt += tot; }
      if (!['PAID', 'REJECTED', 'CANCELLED'].includes(r.status) && r.dueDate && r.dueDate < today) { overdue++; overdueAmt += tot; }
      if (r.status === 'PAID' && (r.fundConfirmedAt || r.paidAt || '').slice(0, 7) === cm) { paidMonth++; paidMonthAmt += tot; }
    });

    return [
      { id: 'PENDING_FUND', label: 'Chờ quỹ chi', value: `${waitFundAmt.toLocaleString('vi-VN')} đ`, subValue: `${waitFund} yêu cầu`, tone: 'info', active: filterStatus === 'PENDING_FUND_PAYMENT', onClick: () => setFilterStatus(p => p === 'PENDING_FUND_PAYMENT' ? 'all' : 'PENDING_FUND_PAYMENT') },
      { id: 'PENDING_ACCOUNTANT_APPROVAL', label: 'Chờ kế toán duyệt', value: `${waitAccountantAmt.toLocaleString('vi-VN')} đ`, subValue: `${waitAccountant} yêu cầu`, tone: 'warning', active: filterStatus === 'PENDING_ACCOUNTANT_APPROVAL', onClick: () => setFilterStatus(p => p === 'PENDING_ACCOUNTANT_APPROVAL' ? 'all' : 'PENDING_ACCOUNTANT_APPROVAL') },
      { id: 'PENDING_DELEGATE', label: 'KT vắng – Chờ duyệt thay', value: `${waitDelegateAmt.toLocaleString('vi-VN')} đ`, subValue: `${waitDelegate} yêu cầu`, tone: 'warning', active: filterStatus === 'PENDING_DELEGATE_APPROVAL', onClick: () => setFilterStatus(p => p === 'PENDING_DELEGATE_APPROVAL' ? 'all' : 'PENDING_DELEGATE_APPROVAL') },
      { id: 'OVERDUE', label: 'Quá hạn thanh toán', value: `${overdueAmt.toLocaleString('vi-VN')} đ`, subValue: `${overdue} yêu cầu`, tone: 'danger', active: filterStatus === 'OVERDUE', onClick: () => setFilterStatus(p => p === 'OVERDUE' ? 'all' : 'OVERDUE') },
      { id: 'PAID', label: `Đã TT tháng ${cm.slice(5)}`, value: `${paidMonthAmt.toLocaleString('vi-VN')} đ`, subValue: `${paidMonth} yêu cầu`, tone: 'success', active: filterStatus === 'PAID', onClick: () => setFilterStatus(p => p === 'PAID' ? 'all' : 'PAID') },
    ];
  }, [requests, filterStatus]);

  // ─── Action Items ────────────────────────────────────────────────────────────
  const actionItems = useMemo<TabOverviewActionItem[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    const items: TabOverviewActionItem[] = [];
    requests.forEach(r => {
      const tot = Number(r.totalAmount) || 0;
      if (r.status === 'NEED_MORE_INFO' && r.creatorId === user?.id) {
        items.push({ id: r.id, title: `${r.code}: Cần bổ sung hồ sơ`, subtitle: `Lý do: ${r.moreInfoReason || 'Thiếu chứng từ'} • ${tot.toLocaleString('vi-VN')} đ`, badge: 'Bổ sung TT', badgeTone: 'warning', onClick: () => setDetailModalRequest(r) });
      } else if (canAccountantApprove(r) || canDelegateApprove(r)) {
        items.push({ id: r.id, title: `${r.code}: Cần duyệt`, subtitle: `${r.recipientName} • ${tot.toLocaleString('vi-VN')} đ`, badge: r.status === 'PENDING_DELEGATE_APPROVAL' ? 'Duyệt thay' : 'Duyệt', badgeTone: 'warning', onClick: () => setDetailModalRequest(r) });
      } else if (canFundHolderPay(r)) {
        items.push({ id: r.id, title: `${r.code}: Cần chi quỹ`, subtitle: `${r.recipientName} • ${tot.toLocaleString('vi-VN')} đ`, badge: 'Chi quỹ', badgeTone: 'info', onClick: () => setDetailModalRequest(r) });
      } else if (!['PAID', 'REJECTED', 'CANCELLED'].includes(r.status) && r.dueDate && r.dueDate < today) {
        items.push({ id: r.id, title: `${r.code}: Quá hạn thanh toán`, subtitle: `Hạn: ${r.dueDate} • ${tot.toLocaleString('vi-VN')} đ`, badge: 'Quá hạn', badgeTone: 'danger', onClick: () => setDetailModalRequest(r) });
      }
    });
    return items.slice(0, 6);
  }, [requests, user]);

  // ─── Chart ───────────────────────────────────────────────────────────────────
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
      if (monthMap[cMonth]) monthMap[cMonth].requested += tot;
      if (r.status === 'PAID') {
        const pMonth = (r.fundConfirmedAt || r.paidAt || r.dueDate || '').slice(0, 7);
        if (monthMap[pMonth]) monthMap[pMonth].paid += tot;
      }
    });
    return Object.values(monthMap);
  }, [requests]);

  // ─── Attachment Upload ────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingAttachment(true);
    try {
      const newAttachments = [...formData.attachments];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadAttachment(file, 'payment_requests');
        newAttachments.push({ name: file.name, url: res.url, size: file.size });
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

  // ─── Create ───────────────────────────────────────────────────────────────────
  const handleSubmitCreate = async (asDraft: boolean) => {
    if (!formData.recipientName.trim()) { triggerToast('Vui lòng nhập Nhà cung cấp hoặc người nhận tiền', 'error'); return; }
    if (!formData.content.trim()) { triggerToast('Vui lòng nhập Nội dung thanh toán', 'error'); return; }
    if (formData.amount <= 0) { triggerToast('Vui lòng nhập Số tiền đề nghị thanh toán lớn hơn 0', 'error'); return; }

    setSubmitting(true);
    try {
      const totalAmount = formData.amount + formData.vatAmount;
      const selectedProj = projects.find(p => p.code === formData.projectCode || p.id === formData.projectCode);
      const initialStatus: PaymentRequestStatus = asDraft ? 'DRAFT' : getInitialStatus(totalAmount);

      await api.paymentRequests.create({
        ...formData,
        projectName: selectedProj?.name || (formData.projectCode === 'COMPANY' ? 'Chi phí công ty' : formData.projectCode),
        status: initialStatus,
        amountThreshold: threshold,
        creatorId: user?.id || '',
        creatorName: user?.name || user?.username || 'Nhân sự',
        creatorTitle: user?.title || user?.role || 'Nhân viên'
      });

      let msg = asDraft ? 'Đã lưu bản nháp' : 'Đã gửi yêu cầu thanh toán';
      if (!asDraft) {
        if (initialStatus === 'PENDING_FUND_PAYMENT') msg += ' → Chờ người cầm quỹ chi';
        else if (initialStatus === 'PENDING_ACCOUNTANT_APPROVAL') msg += ' → Chờ kế toán duyệt';
        else if (initialStatus === 'PENDING_DELEGATE_APPROVAL') msg += ' → Kế toán vắng, chờ cấp trên duyệt thay';
      }
      triggerToast(msg, 'success');
      setIsCreateModalOpen(false);
      setFormData({ projectCode: selectedProjectCode || 'COMPANY', paymentType: 'supplier', recipientName: '', content: '', amount: 0, vatAmount: 0, paymentMethod: 'bank_transfer', bankName: '', bankAccountNumber: '', bankAccountHolder: '', dueDate: new Date().toISOString().split('T')[0], note: '', linkedFundRequestId: '', linkedContractNumber: '', attachments: [] });
      fetchRequests();
      onRequestCreatedOrUpdated?.();
    } catch (err: any) {
      triggerToast(err?.message || 'Lỗi khi tạo yêu cầu thanh toán', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Kế toán / Cấp trên duyệt ────────────────────────────────────────────────
  const handleApproveByAccountant = async (req: PaymentRequest, isDelegate = false) => {
    const nowIso = new Date().toISOString();
    try {
      await api.paymentRequests.update(req.id, {
        status: 'APPROVED',
        approverId: user?.id,
        approverName: user?.name || user?.username,
        approverTitle: user?.title || user?.role,
        approvedAt: nowIso,
        ...(isDelegate ? { delegateApproverId: user?.id, delegateApproverName: user?.name || user?.username, delegateApprovedAt: nowIso } : {})
      }, {
        action: isDelegate ? 'Cấp trên duyệt thay (kế toán vắng)' : 'Kế toán duyệt yêu cầu thanh toán',
        actorId: user?.id || '',
        actorName: user?.name || user?.username || 'Người duyệt',
        actorRole: isDelegate ? 'Cấp trên Kế toán' : 'Kế toán',
        timestamp: nowIso
      });
      triggerToast('Đã duyệt. Chuyển sang Chờ người cầm quỹ chi tiền.', 'success');
      fetchRequests();
      setDetailModalRequest(null);
    } catch (err: any) {
      triggerToast(err?.message || 'Lỗi khi duyệt yêu cầu', 'error');
    }
  };

  // ─── Từ chối / Yêu cầu bổ sung ───────────────────────────────────────────────
  const handleRejectOrNeedInfo = async () => {
    if (!actionReasonModal.reason.trim()) { triggerToast('Vui lòng nhập lý do cụ thể', 'error'); return; }
    const nowIso = new Date().toISOString();
    const isReject = actionReasonModal.type === 'REJECT';
    try {
      await api.paymentRequests.update(actionReasonModal.requestId, {
        status: isReject ? 'REJECTED' : 'NEED_MORE_INFO',
        ...(isReject ? { rejectReason: actionReasonModal.reason, rejectedBy: user?.name || user?.username, rejectedAt: nowIso }
                     : { moreInfoReason: actionReasonModal.reason, moreInfoRequestedBy: user?.name || user?.username, moreInfoRequestedAt: nowIso })
      }, {
        action: isReject ? 'Từ chối yêu cầu thanh toán' : 'Yêu cầu bổ sung hồ sơ chứng từ',
        actorId: user?.id || '',
        actorName: user?.name || user?.username || 'Người duyệt',
        actorRole: user?.title || 'Người xử lý',
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

  // ─── Người cầm quỹ xác nhận đã chi ──────────────────────────────────────────
  const handleConfirmFundPaid = async () => {
    if (!fundModal.request) return;
    const req = fundModal.request;
    const nowIso = new Date().toISOString();
    try {
      await api.paymentRequests.update(req.id, {
        status: 'PAID',
        fundHolderId: user?.id,
        fundHolderName: user?.name || user?.username,
        fundConfirmedAt: nowIso,
        fundConfirmedNote: fundModal.note,
        fundDocUrl: fundModal.docUrl,
        fundDocName: fundModal.docName,
        // Tương thích backward
        paidAt: nowIso,
        paymentDocUrl: fundModal.docUrl,
        paymentDocName: fundModal.docName,
        paymentNote: fundModal.note
      }, {
        action: 'Người cầm quỹ xác nhận đã chi tiền',
        actorId: user?.id || '',
        actorName: user?.name || user?.username || 'Người cầm quỹ',
        actorRole: 'Người cầm quỹ',
        timestamp: nowIso,
        note: fundModal.note,
        attachmentUrl: fundModal.docUrl
      });
      triggerToast(`Đã xác nhận chi ${req.totalAmount.toLocaleString('vi-VN')} đ cho ${req.recipientName}`, 'success');
      setFundModal({ isOpen: false, request: null, docUrl: '', docName: '', note: '', isUploading: false });
      fetchRequests();
      setDetailModalRequest(null);
      if (onCreateExpenseFromPayment) onCreateExpenseFromPayment({ ...req, status: 'PAID', paidAt: nowIso });
    } catch (err: any) {
      triggerToast(err?.message || 'Lỗi khi xác nhận thanh toán', 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  const needActionCount = useMemo(() => requests.filter(r =>
    canAccountantApprove(r) || canDelegateApprove(r) || canFundHolderPay(r) ||
    (r.status === 'NEED_MORE_INFO' && r.creatorId === user?.id)
  ).length, [requests, user]);

  return (
    <div className="flex flex-col flex-1 h-full w-full bg-slate-50 overflow-hidden">

      {/* ── 1. OVERVIEW ── */}
      <TabOverview
        kpis={kpis}
        loading={loading}
        error={error}
        onRetry={fetchRequests}
        chartTitle="TỔNG GIÁ TRỊ ĐỀ NGHỊ & THỰC CHI (6 THÁNG GẦN NHẤT)"
        hasChartData={chartData.length > 0}
        chartContent={
          <div className="h-44 w-full flex items-end gap-3 pt-6 pb-2 px-4">
            {chartData.map((item, idx) => {
              const maxVal = Math.max(...chartData.map(d => Math.max(d.requested, d.paid)), 1000000);
              const reqH = Math.min(100, Math.max(5, (item.requested / maxVal) * 100));
              const paidH = Math.min(100, Math.max(5, (item.paid / maxVal) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1.5 h-32">
                    <div style={{ height: `${reqH}%` }} className="w-1/2 max-w-[24px] bg-amber-400 rounded-t transition-all hover:opacity-80 relative group">
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap z-20 shadow-md">Đề nghị: {item.requested.toLocaleString('vi-VN')} đ</div>
                    </div>
                    <div style={{ height: `${paidH}%` }} className="w-1/2 max-w-[24px] bg-emerald-500 rounded-t transition-all hover:opacity-80 relative group">
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap z-20 shadow-md">Thực chi: {item.paid.toLocaleString('vi-VN')} đ</div>
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

      {/* ── 2. TOOLBAR ── */}
      <div className="border-y border-slate-200 bg-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          {(['all', 'mine', 'need_action'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-all ${activeTab === tab ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab === 'all' ? 'Tất cả' : tab === 'mine' ? 'Của tôi' : `Cần xử lý${needActionCount > 0 ? ` (${needActionCount})` : ''}`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Project */}
          <CustomSelect value={filterProject} onChange={e => { setFilterProject(e.target.value); if (onSelectProjectCode && e.target.value !== 'all') onSelectProjectCode(e.target.value); }} className="border border-slate-200 rounded px-2 py-1 bg-white text-xs">
            <option value="all">Tất cả dự án</option>
            <option value="COMPANY">Chi phí công ty</option>
            {projects.map(p => <option key={p.id} value={p.code}>{p.name || p.code}</option>)}
          </CustomSelect>

          {/* Type */}
          <CustomSelect value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-slate-200 rounded px-2 py-1 bg-white text-xs">
            <option value="all">Tất cả loại</option>
            {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </CustomSelect>

          {/* Status */}
          <CustomSelect value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-slate-200 rounded px-2 py-1 bg-white text-xs">
            <option value="all">Tất cả trạng thái</option>
            <option value="OVERDUE">⚠️ Quá hạn</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </CustomSelect>

          {/* Date range */}
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="border border-slate-200 rounded px-1.5 py-1 text-xs" />
          <span className="text-slate-400">-</span>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="border border-slate-200 rounded px-1.5 py-1 text-xs" />
        </div>

        {/* Search & Create */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input type="text" placeholder="Tìm mã, NCC, nội dung..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-1 border border-slate-200 rounded-md text-xs w-48 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button type="button" onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold px-3 py-1.5 rounded-md text-xs transition-colors shadow-2xs cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Tạo yêu cầu</span>
          </button>
        </div>
      </div>

      {/* ── 3. LIST TABLE ── */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10 select-none">
            <tr>
              <th className="py-2.5 px-3 w-28">Mã YC</th>
              <th className="py-2.5 px-3 w-24">Hạn TT</th>
              <th className="py-2.5 px-3 w-36">Dự án</th>
              <th className="py-2.5 px-3 w-44">Người nhận / NCC</th>
              <th className="py-2.5 px-3 min-w-[180px]">Nội dung</th>
              <th className="py-2.5 px-3 w-32 text-right">Tổng tiền</th>
              <th className="py-2.5 px-3 w-36 text-center">Trạng thái</th>
              <th className="py-2.5 px-3 w-28">Người đề nghị</th>
              <th className="py-2.5 px-3 w-24 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRequests.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-slate-400 font-medium">{loading ? 'Đang nạp danh sách...' : 'Không tìm thấy yêu cầu thanh toán nào.'}</td></tr>
            ) : filteredRequests.map(req => {
              const today = new Date().toISOString().split('T')[0];
              const isOverdue = !['PAID', 'REJECTED', 'CANCELLED'].includes(req.status) && req.dueDate && req.dueDate < today;
              const statusMeta = STATUS_LABELS[req.status] || STATUS_LABELS.DRAFT;
              const myAction = canAccountantApprove(req) || canDelegateApprove(req) || canFundHolderPay(req);

              return (
                <tr key={req.id} onClick={() => setDetailModalRequest(req)} className={`hover:bg-slate-50 cursor-pointer transition-colors ${isOverdue ? 'bg-rose-50/20' : ''} ${myAction ? 'border-l-2 border-l-blue-400' : ''}`}>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{req.code}</td>
                  <td className="py-2.5 px-3">
                    <div className={`font-semibold ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>{req.dueDate}</div>
                    {isOverdue && <span className="text-[10px] text-rose-500 font-bold">Quá hạn</span>}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-700 truncate max-w-[140px]" title={req.projectName || req.projectCode}>
                    {req.projectCode === 'COMPANY' ? '🏢 Công ty' : (req.projectName || req.projectCode)}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    <div className="truncate max-w-[170px]" title={req.recipientName}>{req.recipientName}</div>
                    <span className="text-[10px] text-slate-400 font-normal">{PAYMENT_TYPE_LABELS[req.paymentType] || req.paymentType}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    <div className="line-clamp-2" title={req.content}>{req.content}</div>
                    {req.attachments?.length > 0 && <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5"><span className="material-symbols-outlined text-[12px]">attach_file</span><span>{req.attachments.length} đính kèm</span></div>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="font-extrabold text-slate-900">{(req.totalAmount || 0).toLocaleString('vi-VN')} đ</div>
                    {(req.vatAmount || 0) > 0 && <span className="text-[10px] text-slate-400">VAT: {req.vatAmount.toLocaleString('vi-VN')} đ</span>}
                    {(req.totalAmount || 0) <= threshold && req.status !== 'DRAFT' && <div className="text-[9px] text-teal-600 font-semibold">≤ Hạn mức quỹ</div>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${statusMeta.badgeClass}`}>
                      <span className="material-symbols-outlined text-[11px]">{statusMeta.icon}</span>
                      {statusMeta.label}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    <div className="font-semibold text-slate-800 truncate">{req.creatorName}</div>
                    <span className="text-[10px] text-slate-400">{req.createdAt?.slice(0, 10)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {/* Kế toán duyệt */}
                      {canAccountantApprove(req) && (
                        <button type="button" onClick={() => handleApproveByAccountant(req, false)} className="p-1 text-primary hover:bg-blue-50 rounded" title="Kế toán duyệt"><span className="material-symbols-outlined text-[18px]">fact_check</span></button>
                      )}
                      {/* Cấp trên duyệt thay */}
                      {canDelegateApprove(req) && (
                        <button type="button" onClick={() => handleApproveByAccountant(req, true)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Duyệt thay (KT vắng)"><span className="material-symbols-outlined text-[18px]">swap_horiz</span></button>
                      )}
                      {/* Người cầm quỹ chi */}
                      {canFundHolderPay(req) && (
                        <button type="button" onClick={() => setFundModal({ isOpen: true, request: req, docUrl: '', docName: '', note: '', isUploading: false })} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Xác nhận đã chi"><span className="material-symbols-outlined text-[18px]">payments</span></button>
                      )}
                      <button type="button" onClick={() => setDetailModalRequest(req)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Xem chi tiết"><span className="material-symbols-outlined text-[18px]">visibility</span></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── 4. MODAL TẠO YÊU CẦU ── */}
      <Modal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); if (onCloseCreateModal) onCloseCreateModal(); }} title="Tạo Yêu cầu Thanh toán" icon="payments" size="2xl">
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dự án / Chi phí công ty <span className="text-rose-500">*</span></label>
              <CustomSelect value={formData.projectCode} onChange={e => setFormData(prev => ({ ...prev, projectCode: e.target.value }))} className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white text-xs">
                <option value="COMPANY">🏢 Chi phí công ty</option>
                {projects.map(p => <option key={p.id} value={p.code}>{p.name || p.code}</option>)}
              </CustomSelect>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Loại thanh toán <span className="text-rose-500">*</span></label>
              <CustomSelect value={formData.paymentType} onChange={e => setFormData(prev => ({ ...prev, paymentType: e.target.value as PaymentRequestType }))} className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white text-xs">
                {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </CustomSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nhà cung cấp / Người nhận tiền <span className="text-rose-500">*</span></label>
              <input type="text" placeholder="VD: Công ty TNHH ABC / Nguyễn Văn A" value={formData.recipientName} onChange={e => setFormData(prev => ({ ...prev, recipientName: e.target.value }))} className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Hạn thanh toán <span className="text-rose-500">*</span></label>
              <input type="date" value={formData.dueDate} onChange={e => setFormData(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Nội dung thanh toán <span className="text-rose-500">*</span></label>
            <textarea rows={2} placeholder="VD: Thanh toán đợt 2 vật tư thiết bị điện..." value={formData.content} onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))} className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none resize-none" />
          </div>

          {/* Số tiền */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Số tiền đề nghị (trước VAT) <span className="text-rose-500">*</span></label>
              <input type="number" min="0" value={formData.amount || ''} onChange={e => setFormData(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))} className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-primary outline-none bg-white" placeholder="0" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tiền VAT / Thuế (nếu có)</label>
              <input type="number" min="0" value={formData.vatAmount || ''} onChange={e => setFormData(prev => ({ ...prev, vatAmount: Number(e.target.value) || 0 }))} className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-primary outline-none bg-white" placeholder="0" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tổng thanh toán</label>
              <div className="h-8 flex items-center px-2.5 font-extrabold text-sm text-primary bg-blue-50 border border-blue-200 rounded">
                {(formData.amount + formData.vatAmount).toLocaleString('vi-VN')} đ
              </div>
              {(formData.amount + formData.vatAmount) <= threshold && (formData.amount + formData.vatAmount) > 0 && (
                <div className="text-[10px] text-teal-600 font-semibold mt-1">✓ ≤ Hạn mức quỹ ({threshold.toLocaleString('vi-VN')} đ) → Người cầm quỹ chi trực tiếp</div>
              )}
              {(formData.amount + formData.vatAmount) > threshold && (
                <div className="text-[10px] text-amber-600 font-semibold mt-1">! Vượt hạn mức → {accountantAbsent ? 'Kế toán vắng, chờ cấp trên duyệt thay' : 'Chờ kế toán duyệt'}</div>
              )}
            </div>
          </div>

          {/* Phương thức */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-700">Phương thức thanh toán:</span>
              {(['bank_transfer', 'cash'] as const).map(m => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="paymentMethod" value={m} checked={formData.paymentMethod === m} onChange={() => setFormData(prev => ({ ...prev, paymentMethod: m }))} />
                  <span>{m === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</span>
                </label>
              ))}
            </div>
            {formData.paymentMethod === 'bank_transfer' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngân hàng</label><input type="text" placeholder="VD: Vietcombank" value={formData.bankName} onChange={e => setFormData(prev => ({ ...prev, bankName: e.target.value }))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs bg-white" /></div>
                <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Số tài khoản</label><input type="text" placeholder="VD: 0123456789" value={formData.bankAccountNumber} onChange={e => setFormData(prev => ({ ...prev, bankAccountNumber: e.target.value }))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs bg-white font-mono" /></div>
                <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Chủ tài khoản</label><input type="text" placeholder="VD: NGUYEN VAN A" value={formData.bankAccountHolder} onChange={e => setFormData(prev => ({ ...prev, bankAccountHolder: e.target.value }))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs bg-white uppercase" /></div>
              </div>
            )}
          </div>

          {/* Hồ sơ đính kèm */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">Hồ sơ đính kèm (báo giá, hợp đồng, biên bản, hóa đơn...)</label>
              <label className={`cursor-pointer text-primary hover:underline flex items-center gap-1 font-bold ${isUploadingAttachment ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span>{isUploadingAttachment ? 'Đang tải lên...' : 'Thêm tệp'}</span>
                <input type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
              </label>
            </div>
            {formData.attachments.length === 0
              ? <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-slate-400">Chưa có chứng từ. Vui lòng tải lên báo giá / hóa đơn để người duyệt kiểm tra.</div>
              : <div className="space-y-1.5">
                  {formData.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="flex items-center gap-2 truncate flex-1">
                        <span className="material-symbols-outlined text-slate-500 text-[16px]">description</span>
                        <a href={file.url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium truncate">{file.name}</a>
                      </div>
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))} className="text-slate-400 hover:text-rose-500 p-1"><span className="material-symbols-outlined text-[16px]">close</span></button>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Ghi chú bổ sung</label>
            <input type="text" placeholder="Thông tin thêm (nếu có)..." value={formData.note} onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))} className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold">Hủy bỏ</button>
            <button type="button" disabled={submitting} onClick={() => handleSubmitCreate(true)} className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold disabled:opacity-50">Lưu bản nháp</button>
            <button type="button" disabled={submitting} onClick={() => handleSubmitCreate(false)} className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-white font-bold disabled:opacity-50 shadow-2xs">
              {submitting ? 'Đang gửi...' : 'Gửi yêu cầu thanh toán'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 5. MODAL CHI TIẾT ── */}
      {detailModalRequest && (
        <Modal isOpen={!!detailModalRequest} onClose={() => setDetailModalRequest(null)} title={`Chi tiết: ${detailModalRequest.code}`} icon="receipt_long" size="2xl">
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Trạng thái</span>
                <span className={`inline-flex items-center gap-1.5 mt-0.5 px-2.5 py-0.5 rounded text-xs font-bold border ${STATUS_LABELS[detailModalRequest.status]?.badgeClass}`}>
                  <span className="material-symbols-outlined text-[13px]">{STATUS_LABELS[detailModalRequest.status]?.icon}</span>
                  {STATUS_LABELS[detailModalRequest.status]?.label}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng thanh toán</span>
                <span className="text-lg font-black text-primary block">{(detailModalRequest.totalAmount || 0).toLocaleString('vi-VN')} đ</span>
                {(detailModalRequest.totalAmount || 0) <= threshold
                  ? <span className="text-[10px] text-teal-600 font-semibold">≤ Hạn mức quỹ — Chi trực tiếp</span>
                  : <span className="text-[10px] text-amber-600 font-semibold">Vượt hạn mức — Cần duyệt</span>
                }
              </div>
            </div>

            {/* Approval Timeline */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Luồng phê duyệt</span>
              <ApprovalTimeline req={detailModalRequest} threshold={threshold} />
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div><span className="text-slate-400 block font-semibold text-[10px]">Dự án:</span><span className="font-bold text-slate-800">{detailModalRequest.projectName || detailModalRequest.projectCode}</span></div>
              <div><span className="text-slate-400 block font-semibold text-[10px]">Người nhận / NCC:</span><span className="font-bold text-slate-800">{detailModalRequest.recipientName}</span></div>
              <div><span className="text-slate-400 block font-semibold text-[10px]">Loại thanh toán:</span><span className="font-bold text-slate-800">{PAYMENT_TYPE_LABELS[detailModalRequest.paymentType]}</span></div>
              <div><span className="text-slate-400 block font-semibold text-[10px]">Hạn thanh toán:</span><span className="font-bold text-slate-800">{detailModalRequest.dueDate}</span></div>
              <div><span className="text-slate-400 block font-semibold text-[10px]">Phương thức:</span><span className="font-bold text-slate-800">{detailModalRequest.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</span></div>
              <div><span className="text-slate-400 block font-semibold text-[10px]">Người đề nghị:</span><span className="font-bold text-slate-800">{detailModalRequest.creatorName}</span></div>
            </div>

            {/* Bank Info */}
            {detailModalRequest.paymentMethod === 'bank_transfer' && detailModalRequest.bankAccountNumber && (
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Thông tin chuyển khoản</span>
                <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">{detailModalRequest.bankName}: {detailModalRequest.bankAccountNumber}</div>
                <div className="text-slate-600 font-semibold uppercase">{detailModalRequest.bankAccountHolder}</div>
              </div>
            )}

            {/* Content */}
            <div>
              <span className="text-slate-400 block font-semibold text-[10px] mb-1">Nội dung thanh toán:</span>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 leading-relaxed">{detailModalRequest.content}</div>
            </div>

            {/* Reject / More Info */}
            {detailModalRequest.status === 'REJECTED' && detailModalRequest.rejectReason && (
              <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                <span className="text-[10px] font-bold text-rose-700 uppercase block mb-1">Lý do từ chối</span>
                <div className="text-rose-800 font-semibold">{detailModalRequest.rejectReason}</div>
                {detailModalRequest.rejectedBy && <div className="text-[10px] text-rose-500 mt-0.5">Bởi {detailModalRequest.rejectedBy} lúc {detailModalRequest.rejectedAt?.slice(0, 16).replace('T', ' ')}</div>}
              </div>
            )}
            {detailModalRequest.status === 'NEED_MORE_INFO' && detailModalRequest.moreInfoReason && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase block mb-1">Thông tin cần bổ sung</span>
                <div className="text-amber-800 font-semibold">{detailModalRequest.moreInfoReason}</div>
              </div>
            )}

            {/* Delegate info */}
            {detailModalRequest.delegateApproverName && (
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <span className="text-[10px] font-bold text-orange-700 uppercase block mb-1">Duyệt thay (Kế toán vắng)</span>
                <div className="text-orange-800 font-semibold">Duyệt bởi: {detailModalRequest.delegateApproverName}</div>
                {detailModalRequest.delegateApprovedAt && <div className="text-[10px] text-orange-500 mt-0.5">Lúc {detailModalRequest.delegateApprovedAt.slice(0, 16).replace('T', ' ')}</div>}
              </div>
            )}

            {/* Fund paid info */}
            {detailModalRequest.status === 'PAID' && detailModalRequest.fundHolderName && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">Xác nhận chi quỹ</span>
                <div className="text-emerald-800 font-semibold">Người chi: {detailModalRequest.fundHolderName}</div>
                {detailModalRequest.fundConfirmedAt && <div className="text-[10px] text-emerald-500 mt-0.5">Lúc {detailModalRequest.fundConfirmedAt.slice(0, 16).replace('T', ' ')}</div>}
                {detailModalRequest.fundConfirmedNote && <div className="text-emerald-700 italic mt-1">"{detailModalRequest.fundConfirmedNote}"</div>}
                {detailModalRequest.fundDocUrl && <a href={detailModalRequest.fundDocUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-1"><span className="material-symbols-outlined text-[13px]">attachment</span>{detailModalRequest.fundDocName || 'Chứng từ chi'}</a>}
              </div>
            )}

            {/* Attachments */}
            <div>
              <span className="text-slate-400 block font-semibold text-[10px] mb-1">Hồ sơ đính kèm ({detailModalRequest.attachments?.length || 0}):</span>
              {!detailModalRequest.attachments?.length
                ? <div className="text-slate-400 italic">Không có tài liệu đính kèm.</div>
                : <div className="space-y-1.5">
                    {detailModalRequest.attachments.map((att, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="flex items-center gap-2 truncate">
                          <span className="material-symbols-outlined text-slate-500 text-[16px]">attachment</span>
                          <a href={att.url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold truncate">{att.name}</a>
                        </div>
                        <a href={att.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-primary"><span className="material-symbols-outlined text-[16px]">download</span></a>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* History Timeline */}
            {detailModalRequest.history && detailModalRequest.history.length > 0 && (
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] mb-1">Lịch sử phê duyệt & xử lý:</span>
                <div className="space-y-2 border-l-2 border-slate-200 pl-3 ml-2">
                  {detailModalRequest.history.map((h, i) => (
                    <div key={i} className="text-[11px]">
                      <div className="font-bold text-slate-800">{h.action}</div>
                      <div className="text-slate-500">Bởi <strong>{h.actorName}</strong> ({h.actorRole || 'Nhân sự'}) lúc {h.timestamp?.slice(0, 16).replace('T', ' ')}</div>
                      {h.note && <div className="text-slate-600 bg-slate-50 p-1.5 rounded mt-1 italic">"{h.note}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <button type="button" onClick={() => setDetailModalRequest(null)} className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold">Đóng</button>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Từ chối / Bổ sung */}
                {canRejectOrNeedInfo(detailModalRequest) && ['PENDING_ACCOUNTANT_APPROVAL', 'PENDING_DELEGATE_APPROVAL', 'PENDING_APPROVAL'].includes(detailModalRequest.status) && (
                  <>
                    <button type="button" onClick={() => setActionReasonModal({ isOpen: true, type: 'NEED_MORE_INFO', requestId: detailModalRequest.id, reason: '' })} className="px-3 py-1.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold">Yêu cầu bổ sung</button>
                    <button type="button" onClick={() => setActionReasonModal({ isOpen: true, type: 'REJECT', requestId: detailModalRequest.id, reason: '' })} className="px-3 py-1.5 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold">Từ chối</button>
                  </>
                )}

                {/* Kế toán duyệt */}
                {canAccountantApprove(detailModalRequest) && (
                  <button type="button" onClick={() => handleApproveByAccountant(detailModalRequest, false)} className="px-4 py-1.5 rounded bg-primary hover:bg-primary/90 text-white font-bold shadow-2xs">
                    Kế toán duyệt
                  </button>
                )}

                {/* Cấp trên duyệt thay */}
                {canDelegateApprove(detailModalRequest) && (
                  <button type="button" onClick={() => handleApproveByAccountant(detailModalRequest, true)} className="px-4 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-2xs">
                    Duyệt thay (KT vắng)
                  </button>
                )}

                {/* Người cầm quỹ chi */}
                {canFundHolderPay(detailModalRequest) && (
                  <button type="button" onClick={() => setFundModal({ isOpen: true, request: detailModalRequest, docUrl: '', docName: '', note: '', isUploading: false })} className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-2xs">
                    Xác nhận đã chi tiền
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 6. MODAL TỪ CHỐI / BỔ SUNG ── */}
      <Modal isOpen={actionReasonModal.isOpen} onClose={() => setActionReasonModal({ isOpen: false, type: 'REJECT', requestId: '', reason: '' })} title={actionReasonModal.type === 'REJECT' ? 'Từ chối Yêu cầu Thanh toán' : 'Yêu cầu Bổ sung Hồ sơ'} icon={actionReasonModal.type === 'REJECT' ? 'cancel' : 'help'} size="md">
        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-600">{actionReasonModal.type === 'REJECT' ? 'Vui lòng nêu rõ lý do từ chối:' : 'Vui lòng ghi rõ các chứng từ / thông tin cần bổ sung:'}</p>
          <textarea rows={3} value={actionReasonModal.reason} onChange={e => setActionReasonModal(prev => ({ ...prev, reason: e.target.value }))} placeholder="Nhập lý do chi tiết..." className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-primary outline-none resize-none" />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setActionReasonModal({ isOpen: false, type: 'REJECT', requestId: '', reason: '' })} className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold">Hủy</button>
            <button type="button" onClick={handleRejectOrNeedInfo} className={`px-4 py-1.5 rounded text-white font-bold shadow-2xs ${actionReasonModal.type === 'REJECT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}>Xác nhận</button>
          </div>
        </div>
      </Modal>

      {/* ── 7. MODAL XÁC NHẬN CHI QUỸ ── */}
      <Modal isOpen={fundModal.isOpen} onClose={() => setFundModal({ isOpen: false, request: null, docUrl: '', docName: '', note: '', isUploading: false })} title="Xác nhận Đã Chi Tiền" icon="task_alt" size="md">
        <div className="p-4 space-y-3 text-xs">
          {fundModal.request && (
            <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
              <div className="text-[11px] text-emerald-800 font-bold">Chi: {(fundModal.request.totalAmount || 0).toLocaleString('vi-VN')} đ</div>
              <div className="text-slate-600 text-[10px] mt-0.5">Người nhận: <strong>{fundModal.request.recipientName}</strong> • {fundModal.request.content}</div>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Phiếu chi / UNC / Biên lai xác nhận</label>
            <div className="flex items-center gap-2">
              <input type="file" id="fundDocInput" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFundModal(prev => ({ ...prev, isUploading: true }));
                try {
                  const res = await uploadAttachment(file, 'fund_docs');
                  setFundModal(prev => ({ ...prev, docUrl: res.url, docName: file.name }));
                  triggerToast('Tải lên chứng từ thành công', 'success');
                } catch (err: any) {
                  triggerToast(err?.message || 'Lỗi khi tải file', 'error');
                } finally {
                  setFundModal(prev => ({ ...prev, isUploading: false }));
                }
              }} />
              <label htmlFor="fundDocInput" className={`cursor-pointer px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1.5 ${fundModal.isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span>{fundModal.isUploading ? 'Đang tải...' : 'Tải phiếu chi'}</span>
              </label>
              {fundModal.docName && <span className="text-emerald-700 font-semibold truncate max-w-[200px]" title={fundModal.docName}>✓ {fundModal.docName}</span>}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Ghi chú chi tiền</label>
            <input type="text" placeholder="VD: Đã chi tiền mặt lúc 10:30..." value={fundModal.note} onChange={e => setFundModal(prev => ({ ...prev, note: e.target.value }))} className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-1 focus:ring-primary outline-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setFundModal({ isOpen: false, request: null, docUrl: '', docName: '', note: '', isUploading: false })} className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold">Hủy</button>
            <button type="button" onClick={handleConfirmFundPaid} className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-2xs">Xác nhận hoàn tất</button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && <Toast show={true} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
