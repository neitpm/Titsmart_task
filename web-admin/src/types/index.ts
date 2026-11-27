export type Permission = 'VIEW_PROJECT_DIAGRAM' | 'MANAGE_PROJECT_DIAGRAM'
  | 'VIEW_PROJECTS' | 'CREATE_PROJECTS' | 'EDIT_PROJECTS' | 'DELETE_PROJECTS'
  | 'VIEW_TASKS' | 'IMPORT_TASKS' | 'EDIT_TASKS' | 'ASSIGN_TASKS' | 'UPDATE_TASK_PROGRESS' | 'APPROVE_TASKS'
  | 'VIEW_MATERIALS' | 'IMPORT_MATERIALS' | 'EDIT_MATERIALS' | 'UPDATE_MATERIAL_STATUS'
  | 'VIEW_FINANCE' | 'EDIT_PRICES' | 'VIEW_PAYMENTS' | 'EDIT_PAYMENTS' | 'VIEW_EXPENSES' | 'EDIT_EXPENSES'
  | 'CHECK_FUND_REQUEST' | 'APPROVE_FUND_REQUEST' | 'PROCESS_FUND_TRANSFER' | 'CONFIRM_FUND_RECEIPT'
  | 'VIEW_DOCUMENTS' | 'CREATE_DOCUMENTS' | 'EDIT_DOCUMENTS' | 'DELETE_DOCUMENTS' | 'MANAGE_DOCUMENTS'
  | 'VIEW_USERS' | 'EDIT_USERS' | 'MANAGE_USERS' | 'MANAGE_PERMISSIONS' | 'MANAGE_PAYROLL' | 'APPROVE_LEAVE_STEP1' | 'APPROVE_LEAVE_FINAL'
  | 'EXPORT_DATA' | 'MANAGE_INVENTORY' | 'VIEW_FIELD_LOGS' | 'MANAGE_FIELD_LOGS' | 'VIEW_ACTIVITY_LOG';

export type UserRole = 
  | 'SYSTEM_ADMIN'     // Quản trị viên hệ thống (Kỹ thuật phần mềm)
  | 'DIRECTOR'         // Ban Giám Đốc / Điều hành & Phê duyệt
  | 'PROJECT_MANAGER'  // Quản lý dự án / Chỉ huy trưởng
  | 'ACCOUNTANT'       // Kế toán / Tài chính
  | 'HR_MANAGER'       // Quản lý nhân sự / Chấm công
  | 'ENGINEER'         // Kỹ sư công trình
  | 'STAFF';           // Nhân viên

export const SYSTEM_PERMISSIONS: Permission[] = [
  'VIEW_USERS',
  'EDIT_USERS',
  'MANAGE_USERS',
  'MANAGE_PERMISSIONS',
  'VIEW_ACTIVITY_LOG',
  'MANAGE_INVENTORY'
];

export const BUSINESS_PERMISSIONS: Permission[] = [
  'VIEW_USERS',
  'EDIT_USERS',
  'MANAGE_USERS',
  'MANAGE_PERMISSIONS',
  'VIEW_PROJECTS',
  'CREATE_PROJECTS',
  'EDIT_PROJECTS',
  'DELETE_PROJECTS',
  'VIEW_TASKS',
  'IMPORT_TASKS',
  'EDIT_TASKS',
  'ASSIGN_TASKS',
  'UPDATE_TASK_PROGRESS',
  'APPROVE_TASKS',
  'VIEW_FIELD_LOGS',
  'MANAGE_FIELD_LOGS',
  'VIEW_MATERIALS',
  'IMPORT_MATERIALS',
  'EDIT_MATERIALS',
  'UPDATE_MATERIAL_STATUS',
  'VIEW_FINANCE',
  'EDIT_PRICES',
  'VIEW_PAYMENTS',
  'EDIT_PAYMENTS',
  'VIEW_EXPENSES',
  'EDIT_EXPENSES',
  'CHECK_FUND_REQUEST',
  'APPROVE_FUND_REQUEST',
  'PROCESS_FUND_TRANSFER',
  'CONFIRM_FUND_RECEIPT',
  'VIEW_DOCUMENTS',
  'CREATE_DOCUMENTS',
  'EDIT_DOCUMENTS',
  'DELETE_DOCUMENTS',
  'MANAGE_DOCUMENTS',
  'VIEW_PROJECT_DIAGRAM',
  'MANAGE_PROJECT_DIAGRAM',
  'MANAGE_PAYROLL',
  'APPROVE_LEAVE_STEP1',
  'APPROVE_LEAVE_FINAL',
  'EXPORT_DATA'
];

export type TaskStatus = 'Chưa làm' | 'Đang làm' | 'Chờ vật tư' | 'Chờ khách hàng' | 'Chờ nghiệm thu' | 'Hoàn thành' | 'Tạm dừng' | 'Chờ nhận việc' | 'Có thắc mắc';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export const TECH_SPEC_STATUS_OPTIONS = [
  'Chưa xác định',
  'Đáp ứng',
  'Chưa đáp ứng',
  'Đang xem xét',
];

export const PURCHASE_STATUS_OPTIONS = [
  'Không có hàng',
  'Chưa đặt hàng',
  'Đang đặt hàng',
  'Đã đặt hàng',
  'Đang giao',
  'Đã có hàng',
  'Hàng gia công',
];

export const CONSTRUCTION_STATUS_OPTIONS = [
  'Chưa thi công',
  'Đang thi công',
  'Chờ nghiệm thu',
  'Đã hoàn thành',
];

export interface Task {
  id: string;
  stt: string;
  code: string;
  name: string;
  projectCode: string;
  projectName: string;
  volume: number;
  unit: string;
  progress: number;
  status: TaskStatus;
  purchaseStatus: string;
  constrStatus: string;
  techSpecStatus?: string;
  issue?: string;
  issueStatus?: string;
  isDone: boolean;
  isSectionHeader?: boolean; // Cờ đánh dấu dòng Tiêu đề Mục (I, II, III...)
  sectionName?: string; // Tên phân mục cha
  parentId?: string; // ID của mục cha (nếu là mục con)
  notes?: string;
  assignerId?: string;
  assignerName?: string;
  assignedEngineerId?: string;
  assignedEngineerName?: string;
  reviewerId?: string;
  reviewerName?: string;
  dueDate?: string;
  startDate?: string;
  completedAt?: string;
  priority?: TaskPriority;
  followerIds?: string[];
  followerNames?: string[];
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export type ProjectPriority = 'urgent' | 'high' | 'normal' | 'low';

export const getProjectPriorityWeight = (priority?: string): number => {
  if (!priority) return 3;
  const p = String(priority).toLowerCase().trim();
  if (p === 'urgent' || p === 'cấp 1' || p === 'cap 1' || p === 'level_1' || p === '1' || p === 'critical') return 1;
  if (p === 'high' || p === 'cấp 2' || p === 'cap 2' || p === 'level_2' || p === '2') return 2;
  if (p === 'normal' || p === 'cấp 3' || p === 'cap 3' || p === 'level_3' || p === '3' || p === 'medium') return 3;
  if (p === 'low' || p === 'cấp 4' || p === 'cap 4' || p === 'level_4' || p === '4') return 4;
  return 3;
};

export const getProjectPriorityInfo = (priority?: string) => {
  const weight = getProjectPriorityWeight(priority);
  switch (weight) {
    case 1:
      return {
        value: 'urgent' as ProjectPriority,
        shortLabel: 'Cấp 1',
        label: 'Cấp 1 - Khẩn cấp / Trọng điểm',
        subLabel: 'Trọng điểm',
        badgeClass: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
        badgeBg: 'bg-red-500',
        dotClass: 'bg-red-500',
        borderClass: 'border-l-4 border-l-red-500',
        icon: 'local_fire_department',
        textClass: 'text-red-700 dark:text-red-400',
      };
    case 2:
      return {
        value: 'high' as ProjectPriority,
        shortLabel: 'Cấp 2',
        label: 'Cấp 2 - Ưu tiên cao',
        subLabel: 'Ưu tiên cao',
        badgeClass: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        badgeBg: 'bg-amber-500',
        dotClass: 'bg-amber-500',
        borderClass: 'border-l-4 border-l-amber-500',
        icon: 'bolt',
        textClass: 'text-amber-700 dark:text-amber-400',
      };
    case 4:
      return {
        value: 'low' as ProjectPriority,
        shortLabel: 'Cấp 4',
        label: 'Cấp 4 - Ưu tiên thấp',
        subLabel: 'Ưu tiên thấp',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        badgeBg: 'bg-slate-400',
        dotClass: 'bg-slate-400',
        borderClass: 'border-l-4 border-l-slate-300',
        icon: 'arrow_downward',
        textClass: 'text-slate-600 dark:text-slate-400',
      };
    case 3:
    default:
      return {
        value: 'normal' as ProjectPriority,
        shortLabel: 'Cấp 3',
        label: 'Cấp 3 - Tiêu chuẩn (Bình thường)',
        subLabel: 'Tiêu chuẩn',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
        badgeBg: 'bg-blue-500',
        dotClass: 'bg-blue-500',
        borderClass: '',
        icon: 'flag',
        textClass: 'text-blue-700 dark:text-blue-400',
      };
  }
};

export const PROJECT_PRIORITY_OPTIONS = [
  {
    value: 'urgent' as ProjectPriority,
    shortLabel: 'Cấp 1',
    label: 'Cấp 1 - Khẩn cấp / Trọng điểm',
    subLabel: 'Trọng điểm',
    activeBg: 'bg-red-50 text-red-700 border-red-300',
    ring: 'ring-red-400',
    icon: 'local_fire_department',
  },
  {
    value: 'high' as ProjectPriority,
    shortLabel: 'Cấp 2',
    label: 'Cấp 2 - Ưu tiên cao',
    subLabel: 'Ưu tiên cao',
    activeBg: 'bg-amber-50 text-amber-700 border-amber-300',
    ring: 'ring-amber-400',
    icon: 'bolt',
  },
  {
    value: 'normal' as ProjectPriority,
    shortLabel: 'Cấp 3',
    label: 'Cấp 3 - Tiêu chuẩn',
    subLabel: 'Tiêu chuẩn',
    activeBg: 'bg-blue-50 text-blue-700 border-blue-300',
    ring: 'ring-blue-400',
    icon: 'flag',
  },
  {
    value: 'low' as ProjectPriority,
    shortLabel: 'Cấp 4',
    label: 'Cấp 4 - Ưu tiên thấp',
    subLabel: 'Ưu tiên thấp',
    activeBg: 'bg-slate-100 text-slate-700 border-slate-300',
    ring: 'ring-slate-400',
    icon: 'arrow_downward',
  },
];

export interface Project {
  diagramUrl?: string;
  id: string;
  code: string;
  name: string;
  client?: string; // Chủ đầu tư
  location: string;
  latitude?: number; // Tọa độ vĩ độ công trình
  longitude?: number; // Tọa độ kinh độ công trình
  radiusMeters?: number; // Bán kính chấm công hợp lệ (mét, mặc định 500m)
  category?: string; // Phân loại dự án
  priority?: ProjectPriority; // Mức độ ưu tiên theo cấp bậc: Cấp 1 (urgent) > Cấp 2 (high) > Cấp 3 (normal) > Cấp 4 (low)
  contractValue?: number;
  notes?: string;
  progressPercent: number;
  status: 'active' | 'completed' | 'on_hold';
  activeTeams?: number;
  totalTasks: number;
  completedTasks: number;
  issueTasksCount: number;
  managerId?: string;
  memberIds?: string[];
  managerName: string;
  members?: string[]; // Danh sách thành viên (ID)
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface Material {
  id: string;
  stt?: number;
  code: string;
  name: string;
  englishName?: string;
  projectCode: string;
  projectName: string;
  volume: number;
  unit: string;
  unitPrice?: number;
  status: string;
  constrStatus?: string;
  supplier?: string;
  // Bổ sung cho Quản lý kho
  initialStock?: number;
  currentStock?: number;
  totalImport?: number;
  totalExport?: number;
  totalExpected?: number;
  category?: string;
  specs?: string;
  notes?: string;
  systemGroup?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  lastTransactionDate?: string;
}

export interface InventoryTransaction {
  id: string;
  type: 'IMPORT' | 'EXPORT';
  date: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  specs?: string;
  category?: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  sourceOrProject: string; // Nguồn Nhập hoặc Mã Dự Án xuất
  receiverName?: string; // Người Nhận (đối với xuất kho)
  receiverId?: string; // ID nhân sự nhận bàn giao / phụ trách
  isAsset?: boolean; // True nếu là tài sản/công cụ lâu bền của cty cấp phát
  custodyStatus?: 'IN_USE' | 'RETURNED' | 'TRANSFERRED' | 'LOST'; // Trạng thái nắm giữ
  ownership?: 'COMPANY_OWNED' | 'PROJECT_CONSUMED'; // Quyền sở hữu (mặc định COMPANY_OWNED)
  returnDate?: string; // Ngày hoàn trả về kho
  returnTransactionId?: string; // ID phiếu nhập kho hoàn trả tương ứng
  notes?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}
export type IssueStatus = 'OPEN' | 'PROCESSING' | 'RESOLVED';
export type IssuePriority = 'CRITICAL' | 'WARNING' | 'STANDARD';

export interface Issue {
  id: string;
  incidentCode: string;
  title: string;
  projectName: string;
  projectCode: string;
  location: string;
  reportedBy: string;
  reportedTime: string;
  description: string;
  photoUrl: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignedTo: string;
  managerDirectives?: string;
  timelineLogs: Array<{
    id: string;
    time: string;
    author: string;
    message: string;
  }>;
  updatedBy?: string;
  updatedAt?: string;
}

export type AccountStatus = 'NOT_CREATED' | 'INVITED' | 'ACTIVE' | 'DISABLED' | 'SYNC_ERROR';

export interface Engineer {
  id: string;
  code?: string;
  name: string;
  title: string;
  role?: string;
  username?: string;
  password?: string;
  isLocked?: boolean;
  isActive?: boolean;
  accountStatus?: AccountStatus;
  syncError?: string;
  mustChangePassword?: boolean;
  lastSyncedAt?: string;
  authUserId?: string;
  avatar: string;
  phone: string;
  emergencyPhone?: string;
  joinDate?: string;
  address?: string;
  identityNumber?: string;
  emergencyContactName?: string;
  email: string;
  departmentId?: string;
  departmentCode?: string;
  departmentName?: string;
  managedProjects?: { code: string; name: string }[];
  memberProjects?: { code: string; name: string }[];
  projectCodes?: string[];
  permissions?: Permission[];
  updatedBy?: string;
  updatedAt?: string;
  createdAt?: string;
}

// ==================== PHÒNG BAN & LỊCH SỬ LUÂN CHUYỂN ====================
export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  managerId?: string;
  managerName?: string;
  status: DepartmentStatus;
  sortOrder?: number;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentTransferHistory {
  id: string;
  engineerId: string;
  engineerName: string;
  fromDepartmentId?: string;
  fromDepartmentName?: string;
  toDepartmentId: string;
  toDepartmentName: string;
  transferredById?: string;
  transferredByName?: string;
  transferDate: string;
  reason: string;
  notes?: string;
  createdAt?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'task_assigned' | 'issue_alert' | 'material_update' | 'system' | string;
  icon?: string;
  link?: string;
  senderId?: string;
  senderName?: string;
  createdById?: string;
  createdByName?: string;
}

export type LeaveType = 'Nghỉ phép năm' | 'Nghỉ bệnh' | 'Nghỉ việc riêng' | 'Nghỉ không lương' | 'Khác';
export type LeaveStatus = 'PENDING_STEP1' | 'PENDING' | 'APPROVED_STEP1' | 'APPROVED' | 'REJECTED';
export type LeaveSession = 'ALL_DAY' | 'MORNING' | 'AFTERNOON';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  session?: LeaveSession;
  reason: string;
  status: LeaveStatus;
  // Cấp 1: Người duyệt được chỉ định (Quản lý trực tiếp / Chỉ huy trưởng)
  step1ReviewerId?: string;
  step1ReviewerName?: string;
  step1ReviewNote?: string;
  step1ReviewedAt?: string;
  // Cấp 2: Người duyệt cấp cao nhất (Ban Giám Đốc)
  step2ReviewerId?: string;
  step2ReviewerName?: string;
  step2ReviewNote?: string;
  step2ReviewedAt?: string;
  // Người theo dõi (Followers / CC)
  followerIds?: string[];
  followerNames?: string[];
  // Legacy compatibility fields
  reviewerId?: string;
  reviewerName?: string;
  reviewNote?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export type FundRequestStatus = 
  | 'PENDING_CHECK' 
  | 'NEED_MORE_INFO' 
  | 'CHECKED_WAITING_APPROVAL' 
  | 'REJECTED_BY_CHECKER' 
  | 'APPROVED_WAITING_ACCOUNTING' 
  | 'ACCOUNTING_PROCESSING' 
  | 'TRANSFERRED_WAITING_CONFIRMATION' 
  | 'COMPLETED' 
  | 'REJECTED'
  // Legacy compatibility:
  | 'PENDING'
  | 'APPROVED';

export interface FundRequestAuditLog {
  action: string;
  actorId: string;
  actorName: string;
  actorRole?: string;
  timestamp: string;
  note?: string;
  attachmentUrl?: string;
}

export interface FundRequest {
  id: string;
  projectCode: string;
  projectName?: string;
  amount: number;
  type: string;
  purpose: string;
  neededDate: string;
  note?: string;
  status: FundRequestStatus;

  // Người tạo
  creatorId?: string;
  creatorName: string;
  creatorTitle?: string;
  createdAt: string;

  // Người kiểm tra (bước 1)
  checkerId?: string;
  checkerName?: string;
  checkerTitle?: string;
  checkedAt?: string;
  checkerNote?: string;

  // Người duyệt lãnh đạo (bước 2)
  reviewerId?: string;
  reviewerName?: string;
  reviewerTitle?: string;
  reviewedAt?: string;
  reviewNote?: string;
  isDirectApproval?: boolean;
  directApprovalReason?: string;

  // Kế toán xử lý (bước 3)
  accountantId?: string;
  accountantName?: string;
  accountantReceivedAt?: string;
  transferDocUrl?: string; // Bắt buộc file UNC
  transferDocName?: string;
  transferredAt?: string;
  transferNote?: string;

  // Người tạo xác nhận nhận tiền (bước 4)
  confirmedAt?: string;
  confirmNote?: string;
  expenseCreated?: boolean;
  expenseId?: string;

  // Từ chối / Bổ sung
  rejectReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  moreInfoReason?: string;

  // Lịch sử từng bước
  history?: FundRequestAuditLog[];

  // Legacy fields
  notificationId?: string;
  approvedBy?: string;
  approvedAt?: string;
}

// ==========================================
// PAYMENT REQUEST (YÊU CẦU THANH TOÁN)
// ==========================================
export type PaymentRequestType = 'supplier' | 'advance_refund' | 'subcontractor' | 'other';

export type PaymentRequestStatus =
  | 'DRAFT'                        // Nháp
  | 'PENDING_FUND_PAYMENT'         // Chờ người cầm quỹ chi (≤ hạn mức, không cần kế toán duyệt)
  | 'PENDING_ACCOUNTANT_APPROVAL'  // Chờ kế toán duyệt (> hạn mức)
  | 'PENDING_DELEGATE_APPROVAL'    // Kế toán vắng – Chờ cấp trên duyệt thay
  | 'PENDING_APPROVAL'             // Chờ duyệt (legacy / dự phòng)
  | 'NEED_MORE_INFO'               // Yêu cầu bổ sung
  | 'APPROVED'                     // Đã duyệt (> hạn mức, chờ chi quỹ)
  | 'PENDING_PAYMENT'              // Chờ chi quỹ (sau khi kế toán/cấp trên duyệt)
  | 'PAID'                         // Đã thanh toán (Hoàn tất)
  | 'REJECTED'                     // Từ chối
  | 'CANCELLED';                   // Hủy

export interface PaymentRequestAuditLog {
  action: string;
  actorId: string;
  actorName: string;
  actorRole?: string;
  timestamp: string;
  note?: string;
  attachmentUrl?: string;
}

export interface PaymentRequestAttachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export interface PaymentRequest {
  id: string;
  code: string;                      // Mã yêu cầu (VD: YCTT-2026-001)
  projectCode: string;               // Mã dự án hoặc "OFFICE" / "COMPANY" nếu chi phí công ty
  projectName?: string;
  paymentType: PaymentRequestType;    // supplier | advance_refund | subcontractor | other
  recipientName: string;             // Nhà cung cấp hoặc người nhận tiền
  content: string;                   // Nội dung thanh toán
  amount: number;                    // Số tiền đề nghị (trước VAT)
  vatAmount: number;                 // Tiền VAT / thuế
  totalAmount: number;               // Tổng thanh toán (= amount + vatAmount)
  paymentMethod: 'bank_transfer' | 'cash'; // Phương thức thanh toán
  bankName?: string;                 // Ngân hàng
  bankAccountNumber?: string;        // Số tài khoản
  bankAccountHolder?: string;        // Chủ tài khoản
  dueDate: string;                   // Hạn thanh toán (YYYY-MM-DD)
  note?: string;                     // Ghi chú
  status: PaymentRequestStatus;      // Trạng thái

  // Người đề nghị
  creatorId: string;
  creatorName: string;
  creatorTitle?: string;
  createdAt: string;

  // Người duyệt (Chỉ huy / Quản lý dự án / Giám đốc)
  approverId?: string;
  approverName?: string;
  approverTitle?: string;
  approvedAt?: string;
  approvalNote?: string;

  // Kế toán xử lý
  accountantId?: string;
  accountantName?: string;
  receivedAt?: string;              // Kế toán tiếp nhận (Chờ thanh toán)
  paidAt?: string;                  // Kế toán xác nhận đã trả tiền
  paymentDocUrl?: string;           // UNC hoặc biên lai chi tiền
  paymentDocName?: string;
  paymentNote?: string;

  // Liên kết chi phí thực tế (khi đã thanh toán)
  expenseCreated?: boolean;
  expenseId?: string;

  // Liên kết nghiệp vụ
  linkedFundRequestId?: string;     // Nếu hoàn ứng: ID đơn cấp quỹ / tạm ứng trước đó
  linkedContractNumber?: string;    // Số hợp đồng / đơn đặt hàng nếu có

  // Lý do từ chối hoặc yêu cầu bổ sung
  rejectReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  moreInfoReason?: string;
  moreInfoRequestedBy?: string;
  moreInfoRequestedAt?: string;

  // Hồ sơ đính kèm (báo giá, hợp đồng, biên bản nghiệm thu, hóa đơn, hoàn ứng...)
  attachments: PaymentRequestAttachment[];

  // Luồng nghiệp vụ mới: Người cầm quỹ
  fundHolderId?: string;
  fundHolderName?: string;
  fundConfirmedAt?: string;        // Thời điểm người cầm quỹ xác nhận đã chi
  fundConfirmedNote?: string;      // Ghi chú khi chi quỹ
  fundDocUrl?: string;
  fundDocName?: string;

  // Luồng nghiệp vụ mới: Kế toán / Cấp trên duyệt thay
  delegateApproverId?: string;     // ID cấp trên kế toán duyệt thay
  delegateApproverName?: string;
  delegateApprovedAt?: string;
  delegateReason?: string;         // Lý do ủy quyền / kế toán vắng

  // Hạn mức áp dụng tại thời điểm tạo (snapshot từ cấu hình)
  amountThreshold?: number;        // Hạn mức tại thời điểm gửi

  // Lịch sử luồng duyệt
  history?: PaymentRequestAuditLog[];
}

export type AttendanceAdjustmentType = 'Bù vào ca' | 'Bù ra ca' | 'Bù cả ngày';

export interface AttendanceAdjustmentRequest {
  id: string;
  userId: string;
  userName: string;
  userTitle?: string;
  projectId?: string;
  projectName?: string;
  adjustmentDate: string;
  adjustmentType: AttendanceAdjustmentType;
  checkInTime?: string;
  checkOutTime?: string;
  reason: string;
  status: LeaveStatus;
  step1ReviewerId?: string;
  step1ReviewerName?: string;
  step1ReviewNote?: string;
  step1ReviewedAt?: string;
  step2ReviewerId?: string;
  step2ReviewerName?: string;
  step2ReviewNote?: string;
  step2ReviewedAt?: string;
  followerIds?: string[];
  followerNames?: string[];
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export type AttendanceMode = 'time' | 'shift' | 'hybrid'; // Theo thời gian | Theo ca | Kết hợp cả 2
export type GpsRequirement = 'none' | 'record_only' | 'strict'; // Không yêu cầu GPS | Chỉ ghi nhận vị trí | Bắt buộc trong bán kính
export type WorkLocationType = 'office' | 'field' | 'remote'; // Tại văn phòng | Tại công trường/dự án | Đi công tác/Khảo sát

export interface WorkShift {
  id: string;
  name: string; // Tên ca, vd: "Ca hành chính", "Ca sáng", "Ca chiều", "Ca đêm"
  startTime: string; // "08:00"
  endTime: string; // "17:30"
  lateGraceMinutes: number; // Phút cho phép đi trễ (vd: 15)
  earlyLeaveGraceMinutes: number; // Phút cho phép về sớm (vd: 15)
  workWeight: number; // Số công chuẩn (vd: 1.0, 0.5)
  description?: string;
  isActive: boolean;
}

export interface AttendanceGpsLocation {
  id: string;
  name: string; // Tên vị trí (vd: "Văn phòng TITSMART", "Dự án TBA Đăk Mil")
  address?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // Bán kính cho phép (mét, vd: 300)
  isActive: boolean;
}

export interface AttendanceConfig {
  mode: AttendanceMode;
  gpsRequirement: GpsRequirement;
  requirePhoto: boolean;
  allowFieldWork?: boolean; // Cho phép chấm công đi công trường / công tác ngoài văn phòng
  shifts: WorkShift[];
  locations: AttendanceGpsLocation[];
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  mode: 'time',
  gpsRequirement: 'record_only',
  requirePhoto: false,
  allowFieldWork: true,
  shifts: [
    {
      id: 'shift_hc',
      name: 'Ca hành chính',
      startTime: '08:00',
      endTime: '17:30',
      lateGraceMinutes: 15,
      earlyLeaveGraceMinutes: 15,
      workWeight: 1.0,
      description: 'Ca làm việc tiêu chuẩn: 08:00 - 17:30',
      isActive: true,
    },
    {
      id: 'shift_sang',
      name: 'Ca sáng',
      startTime: '08:00',
      endTime: '12:00',
      lateGraceMinutes: 15,
      earlyLeaveGraceMinutes: 15,
      workWeight: 0.5,
      description: 'Nửa ca buổi sáng: 08:00 - 12:00',
      isActive: true,
    },
    {
      id: 'shift_chieu',
      name: 'Ca chiều',
      startTime: '13:30',
      endTime: '17:30',
      lateGraceMinutes: 15,
      earlyLeaveGraceMinutes: 15,
      workWeight: 0.5,
      description: 'Nửa ca buổi chiều: 13:30 - 17:30',
      isActive: true,
    },
    {
      id: 'shift_dem',
      name: 'Ca đêm / Tăng ca',
      startTime: '18:00',
      endTime: '22:00',
      lateGraceMinutes: 15,
      earlyLeaveGraceMinutes: 15,
      workWeight: 0.5,
      description: 'Ca tối / ngoài giờ: 18:00 - 22:00',
      isActive: true,
    }
  ],
  locations: [
    {
      id: 'loc_office_default',
      name: 'Văn phòng TITSMART',
      address: 'Trụ sở chính công ty',
      latitude: 10.7769,
      longitude: 106.7009,
      radiusMeters: 300,
      isActive: true,
    }
  ]
};

// ==================== BẢNG CHẤM CÔNG & BẢNG LƯƠNG XÁC NHẬN (DIGITAL SIGNATURE) ====================
export type PayrollSignatureStatus = 'pending' | 'signed' | 'disputed';

export interface MonthlyPayrollItem {
  id: string; // `payroll-${year}-${month}-${userId}` hoặc UUID từ Supabase
  cloudId?: string;
  month: number; // 1 - 12
  year: number; // e.g. 2026
  userId: string;
  userName: string;
  userCode?: string;
  userTitle?: string;
  department?: string;

  // 1. Số liệu chấm công
  standardWorkingDays: number; // Số ngày công chuẩn (mặc định 26 hoặc 24)
  actualWorkingDays: number;   // Số ngày công thực tế làm việc
  paidLeaveDays: number;       // Nghỉ phép có lương (Phép năm, lễ, việc riêng có lương)
  unpaidLeaveDays: number;     // Nghỉ không lương (KP)
  sundayWorkingDays: number;   // Công làm ngày Chủ nhật
  otHoursNormal: number;       // Giờ OT ngày thường (hệ số 1.5)
  otHoursSunday: number;       // Giờ OT Chủ nhật (hệ số 2.0)
  otHoursHoliday: number;      // Giờ OT Lễ (hệ số 3.0)
  fieldWorkDays: number;       // Số ngày làm việc tại công trường / dự án
  remoteWorkDays: number;      // Số ngày đi công tác ngoài
  lateTimes: number;           // Số lần đi trễ
  earlyTimes: number;          // Số lần về sớm
  totalEquivalentDays: number; // Tổng số công quy đổi hưởng lương

  // 2. Thu nhập & Phụ cấp
  baseSalary: number;          // Mức lương cơ bản thỏa thuận / HĐLĐ
  salaryByWorkDays: number;    // Tiền lương theo ngày công = (baseSalary / standardWorkingDays) * actualWorkingDays
  paidLeaveSalary: number;     // Tiền lương ngày phép có lương
  allowanceLunch: number;      // Phụ cấp ăn trưa
  allowanceFuel: number;       // Phụ cấp xăng xe / đi lại
  allowancePhone: number;      // Phụ cấp điện thoại
  allowanceField: number;      // Phụ cấp công trường / lưu trú hiện trường
  allowanceRole: number;       // Phụ cấp chức vụ / trách nhiệm
  allowanceOther: number;      // Phụ cấp khác
  totalAllowances: number;     // Tổng các khoản phụ cấp
  otPay: number;               // Tiền làm thêm giờ (OT)
  bonus: number;               // Thưởng hiệu quả / dự án
  grossIncome: number;         // Tổng thu nhập (Lương + Phụ cấp + OT + Thưởng)

  // 3. Khấu trừ
  deductionSocialInsurance: number; // BHXH, BHYT, BHTN (thường 10.5%)
  deductionAdvance: number;         // Tạm ứng đã nhận trong tháng
  deductionTax: number;             // Thuế TNCN tạm tính
  deductionOther: number;           // Giảm trừ khác (phạt, trừ nghỉ không phép...)
  totalDeductions: number;          // Tổng các khoản giảm trừ

  // 4. Thực lĩnh (Net)
  netSalary: number;                // Số tiền thực lĩnh = grossIncome - totalDeductions
  paymentStatus: 'unpaid' | 'paid';
  paymentDate?: string;
  notes?: string;

  // 5. Ký xác nhận của Nhân viên
  signatureStatus: PayrollSignatureStatus;
  signedAt?: string;
  signedByName?: string;
  signedByUserId?: string;
  signatureImage?: string;          // Ảnh chữ ký điện tử Base64 PNG
  signatureType?: 'draw' | 'quick'; // Ký vẽ tay hoặc ký nhanh xác thực

  // 6. Phản hồi / Thắc mắc / Khiếu nại từ Nhân viên (nếu có)
  disputeNote?: string;
  disputedAt?: string;
  disputeResolvedAt?: string;
  adminResolutionNote?: string;

  // 7. Khóa / Phê duyệt
  isLocked?: boolean;               // Kế toán đã chốt sổ
  approvedBy?: string;
  approvedAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId?: string;
  projectCode?: string;
  content: string;
  fileUrl?: string;
  fileType?: 'image' | 'file';
  fileName?: string;
  readBy?: string[];
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string;
  project: string;
  timestamp: string;
  icon: string;
  badgeBg: string;
  iconColor: string;
}

export interface ProjectMaterialPlan {
  id: string;
  parentId?: string;
  stt: string;
  projectCode: string;
  jobContent: string;
  unit: string;
  contractVolume: number;
  techSpecModel?: string;
  techSpecOrigin?: string;
  techSpecStatus?: string;
  progressStatus?: string;
  orderedVolume?: number;
  orderedStatus?: string;
  expectedDate?: string;
  issueContent?: string;
  issueStatus?: string;
  docCo?: boolean;
  docCq?: boolean;
  docFireInspection?: boolean;
  docStamp?: boolean;
  dispatchToSite?: boolean;
  dispatchDate?: string;
  supplyScope?: 'contractor' | 'owner' | 'unknown';
  notes?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface ProjectPurchasing {
  id: string;
  parentId?: string;
  materialPlanId?: string;
  stt: string;
  projectCode: string;
  content: string;
  unit: string;
  volumeContract: number;
  volumeOrder: number;
  unitPrice: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  prepayPercent: number;
  prepayAmount: number;
  remainingAmount: number;
  orderStatus: string;
  contractStatus: string;
  paymentDate?: string;
  invoiceStatus?: string;
  supplier?: string;
  costPaidAmount?: number;
  costPaymentDate?: string;
  costPaymentMethod?: string;
  costPayerName?: string;
  notes?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface ProjectExpense {
  id: string;
  stt: string;
  projectCode: string;
  date: string;
  content: string;
  description: string;
  spenderName?: string;
  createdByName?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  totalAmount: number;
  incomeAmount?: number;
  balanceFund?: number;
  notes?: string;
  invoiceUrl?: string;
  fundRequestId?: string; // Khóa ngoại duy nhất liên kết với đơn cấp quỹ để chống nạp trùng
  updatedBy?: string;
  updatedAt?: string;
}

export interface LaborPayroll {
  id: string;
  stt: string;
  projectCode: string;
  date: string;
  content: string;
  description: string;
  workerName?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  bankAccount: string;
  bankInfo?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  paymentStatus: string;
  notes?: string;
  updatedBy?: string;
  updatedAt?: string;
}

// Đợt thanh toán của một hồ sơ
export interface DocumentPaymentInstallment {
  id: string;
  installmentNo: number; // Đợt 1, 2, 3...
  title: string; // Nội dung chi / thu (VD: Tạm ứng 30%, Thanh toán đợt 1...)
  amount: number; // Số tiền
  paymentDate: string; // Ngày chuyển tiền / nhận tiền thực tế
  paymentMethod?: 'UNC' | 'TIEN_MAT' | 'CHUYEN_KHOAN';
  transactionCode?: string; // Mã giao dịch ngân hàng / Số phiếu chi / Số UNC
  payerOrReceiver?: string; // Người chi / Người nhận
  proofFileUrls?: string[]; // Ảnh UNC / Phiếu chi / Sao kê
  
  // Trạng thái ký và xác nhận bên nhận:
  // 'CHO_XAC_NHAN': Đã chuyển tiền nhưng chờ bên nhận ký/xác nhận
  // 'DA_XAC_NHAN': Bên nhận đã ký nhận tiền
  // 'TU_CHOI': Bên nhận từ chối ký hoặc phát hiện sai số tiền (chuyển sang 'Đang đối soát')
  confirmationStatus: 'CHO_XAC_NHAN' | 'DA_XAC_NHAN' | 'TU_CHOI';
  confirmedBy?: string; // Tên người ký xác nhận
  confirmedAt?: string; // Thời điểm ký xác nhận
  confirmationSignatureUrl?: string; // File chữ ký / Biên bản ký nhận
  discrepancyNote?: string; // Ghi chú đối soát nếu sai số tiền hoặc từ chối
}

// Mục checklist chứng từ bắt buộc của hồ sơ
export interface DocumentChecklistItem {
  id: string;
  itemType: string; // Đề nghị/tờ trình, Báo giá/Hợp đồng, Biên bản nghiệm thu, Hóa đơn VAT, Phiếu chi/UNC, Chứng từ quyết toán, Chữ ký/xác nhận
  title: string;
  isRequired: boolean;
  // Trạng thái: Chưa có → Đã tải lên → Chờ kiểm tra → Hợp lệ / Yêu cầu bổ sung
  status: 'CHUA_CO' | 'DA_TAI_LEN' | 'CHO_KIEM_TRA' | 'HOP_LE' | 'YEU_CAU_BO_SUNG';
  fileUrls?: string[];
  feedbackNote?: string; // Lý do yêu cầu bổ sung hoặc ghi chú kiểm tra
  checkedBy?: string;
  checkedAt?: string;
}

// Phiên bản hồ sơ theo thời gian (Audit version snapshot)
export interface DocumentVersion {
  versionNumber: number; // V1, V2, V3...
  title: string; // Tên mốc / Hành động (VD: Khởi tạo đề nghị, Duyệt hạn mức 80%, Chi đợt 1...)
  timestamp: string;
  changedById?: string;
  changedByName: string;
  reason?: string; // Lý do điều chỉnh (VD: Duyệt 80% theo hạn mức, Bổ sung khối lượng phát sinh...)
  changesSummary: Array<{
    field: string;
    label: string;
    before: any;
    after: any;
  }>;
  snapshot: {
    contractValue: number;
    approvedAmount?: number;
    paidAmount?: number;
    settledAmount?: number;
    docStatus: string;
    paymentStatus: string;
    fileUrls?: string[];
  };
}

export interface DocumentTrack {
  id: string;
  projectId?: string;
  stt: string;
  contractNo: string;
  contractName: string;
  projectCode?: string;
  company: string;
  receiverName: string;
  phone: string;
  address: string;
  sendDate: string;
  receiveDate?: string;
  docStatus: string;
  docType?: string; // 'Giao' | 'Nhận'
  side?: string;
  contractValue: number;
  prepayPercent: number;
  prepayAmount: number;
  paymentStatus: string;
  isCompleted: boolean;
  notes?: string;
  dueDate?: string | null; // Hạn thanh toán / Hạn phải thu (cho phép null nếu chưa xác định)
  remindDays?: number; // Số ngày nhắc trước hạn (VD: 3, 5, 7)
  fileUrls?: string[];

  // === Mở rộng hỗ trợ Hồ sơ đầu vào & Hồ sơ đầu ra ===
  // Chưa phân loại dành cho hồ sơ lịch sử được tạo trước khi hệ thống có luồng đầu vào/đầu ra.
  // Không tự suy đoán để tránh làm sai công nợ phải thu/phải trả.
  flowType?: 'input' | 'output' | 'unclassified';
  flowClassificationReason?: string;
  flowClassifiedAt?: string;
  flowClassifiedBy?: string;
  subType?: string; // Báo giá, Hợp đồng, Đơn đặt hàng, Biên bản nghiệm thu, Hóa đơn VAT, Đề nghị thanh toán...
  beforeTaxAmount?: number; // Giá trị trước thuế
  vatRate?: number; // % VAT (0, 8, 10, v.v.)
  vatAmount?: number; // Tiền VAT
  totalAmount?: number; // Tổng tiền đã gồm VAT (= contractValue đề nghị ban đầu)
  paidAmount?: number; // Đã thanh toán (đầu vào) hoặc Đã thu (đầu ra)
  remainingAmount?: number; // Còn phải trả (đầu vào) hoặc Còn phải thu (đầu ra)
  acceptedAmount?: number; // Giá trị đã nghiệm thu (đầu ra)
  invoiceNo?: string; // Số hóa đơn VAT / chứng từ
  invoiceDate?: string | null; // Ngày hóa đơn / chứng từ
  actualPaymentDate?: string | null; // Ngày thanh toán thực tế / Ngày nhận tiền thực tế
  paymentRefId?: string; // Liên kết Yêu cầu thanh toán / Chi phí / Đơn mua hàng / Hợp đồng
  
  // === QUẢN TRỊ 3 NGUYÊN TẮC: PHIÊN BẢN - NGHĨA VỤ TIỀN - DÒNG THỜI GIAN ===
  // 1. Đối chiếu nghĩa vụ tiền cố định
  initialProposedAmount?: number; // Giá trị đề nghị / hợp đồng ban đầu (V1 - KHÔNG ĐƯỢC GHI ĐÈ)
  approvedAmount?: number; // Được duyệt thanh toán
  unapprovedAmount?: number; // Chưa được duyệt (= initialProposedAmount - approvedAmount)
  settledAmount?: number; // Đã quyết toán thực tế
  pendingSettlementAmount?: number; // Còn phải quyết toán (= paidAmount - settledAmount)
  remainingPayableUnderApproval?: number; // Còn được thanh toán theo mức duyệt (= approvedAmount - paidAmount)
  
  // 2. Danh sách đợt thanh toán (Installments)
  installments?: DocumentPaymentInstallment[];

  // 3. Checklist chứng từ & chữ ký bắt buộc
  checklist?: DocumentChecklistItem[];

  // 4. Lịch sử & Phiên bản (V1, V2, V3...)
  versions?: DocumentVersion[];
  currentVersion?: number;

  // 5. Trạng thái ký xác nhận dòng tiền
  signatureStatus?: 'CHUA_KY' | 'CHO_KY_XAC_NHAN' | 'DA_KY' | 'DANG_DOI_SOAT';

  /** Thời điểm hồ sơ được tạo, không thay đổi khi hồ sơ được chỉnh sửa. */
  createdAt?: string;
  createdById?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface FieldLog {
  id: string;
  projectCode: string;
  note: string;
  images: string[]; // URL ảnh (đường dẫn /uploads/...)
  timestamp: string; // Thời điểm tạo báo cáo
  taskId?: string;
  createdById?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export const getTextColorStyle = (status?: string) => {
  if (!status) return "text-slate-700";
  const s = status.toLowerCase();
  if (s.includes("chưa") || s.includes("không")) return "text-red-600";
  if (s.includes("đã")) return "text-emerald-600";
  if (s.includes("đang")) return "text-amber-600";
  return "text-slate-700";
};

export const getStatusColorStyle = (status?: string) => {
  if (!status) return "border-slate-200 bg-slate-50 text-slate-600";
  const s = status.toLowerCase();
  if (s.includes("chờ nghiệm thu")) return "border-purple-300 bg-purple-50 text-purple-700 font-bold";
  if (s.includes("nhân công")) return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (s.includes("ko có") || s.includes("không có") || s.includes("vướng mắc") || s.includes("hủy") || s.includes("chưa đáp ứng") || s.includes("chưa ký") || s.includes("chưa xuất") || s.includes("không cần")) return "border-red-200 bg-red-50 text-red-700";
  if (s.includes("đã có hàng") || s.includes("đã nhận") || s.includes("đã thi công") || s.includes("hoàn thành") || s.includes("đã ký") || s.includes("đã xuất") || (s.includes("đáp ứng") && !s.includes("chưa"))) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("đang đặt") || s.includes("đang giao") || s.includes("đang trình") || s.includes("đang kiểm") || s.includes("ete") || s.includes("xem xét") || s.includes("đang thương thảo")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("đã đặt hàng") || s.includes("đang thi công")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (s.includes("gia công")) return "border-purple-200 bg-purple-50 text-purple-700";
  if (s.includes("kéo dây") && !s.includes("lắp")) return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (s.includes("lắp thiết bị")) return "border-teal-200 bg-teal-50 text-teal-700";
  if (s.includes("tb + kéo dây")) return "border-cyan-200 bg-cyan-50 text-cyan-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

export const normalizeStatusText = (value?: string) => (value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d");

export const purchaseProgressScore = (status?: string) => {
  const clean = normalizeStatusText(status);
  if (!clean || clean === "khong co hang" || clean === "chua dat hang") return 0;
  if (clean === "dang dat hang") return 0.3;
  if (clean === "da dat hang") return 0.6;
  if (clean === "dang giao" || clean === "dang giao hang") return 0.85;
  if (clean === "da co hang" || clean === "da nhan du" || clean === "hang gia cong") return 1;
  return 0;
};

export const constructionProgressScore = (status?: string) => {
  const clean = normalizeStatusText(status);
  if (!clean || clean === "chua thi cong" || clean === "dang vuong mac") return 0;
  if (clean === "vuong mac") return 0.2;
  if (clean === "da keo day" || clean === "da lap thiet bi vao tu") return 0.2;
  if (clean === "da lap tb + keo day") return 0.3;
  if (clean === "dang ete") return 0.4;
  if (clean === "dang thi cong") return 0.5;
  if (clean === "cho nghiem thu") return 0.95;
  if (clean === "da thi cong" || clean === "da hoan thanh") return 1;
  return 0;
};

export const calculateAutoProgressPercent = (purchaseStatus?: string, constrStatus?: string) =>
  Math.round((purchaseProgressScore(purchaseStatus) * 0.5 + constructionProgressScore(constrStatus) * 0.5) * 100);

export const calculateAutoProgressRatio = (purchaseStatus?: string, constrStatus?: string) =>
  calculateAutoProgressPercent(purchaseStatus, constrStatus) / 100;




export const ISSUE_STATUS_OPTIONS = ["Không có", "Chưa xử lý", "Đang xử lý", "Đã xử lý xong"] as const;

export const getIssueStatusColorStyle = (status?: string) => {
  if (!status) return "border-slate-200 bg-slate-50 text-slate-600";
  const s = status.toLowerCase();
  if (s === "chưa xử lý") return "border-red-200 bg-red-50 text-red-700";
  if (s === "đang xử lý") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "đã xử lý xong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "không có") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

export const isTaskSectionHeaderItem = (node: any): boolean => {
  if (!node) return false;
  if (node.isSectionHeader) return true;
  if (String(node.notes || '').toLowerCase().includes('[section]')) return true;
  const vol = Number(node.volume || 0);
  const unitVal = String(node.unit || '').trim();
  const name = String(node.name || '').trim();
  const stt = String(node.stt || '').trim();
  const romanRegex = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/i;

  if (romanRegex.test(stt) || /^[A-Z]{1,2}$/i.test(stt)) return true;
  if (name.endsWith(':') && (vol === 0 || !vol) && (unitVal === '' || unitVal === '-')) return true;

  const hasNoVolumeAndUnit = (vol === 0 || !vol) && (unitVal === '' || unitVal === '-');
  if (hasNoVolumeAndUnit) {
    if (!stt.includes('.')) return true;
    if (/^\d+\.\d+$/.test(stt)) return true;
    if (name === name.toUpperCase() && /[A-ZÀ-Ỹ]/.test(name)) return true;
  }
  return false;
};

export const isTaskActuallyDone = (task: any): boolean => {
  if (!task) return false;
  if (task.isDone) return true;
  if (typeof task.progress === 'number' && task.progress >= 1) return true;
  const statusClean = normalizeStatusText(task.status);
  if (statusClean === 'da hoan thanh' || statusClean === 'hoan thanh' || statusClean === 'done' || statusClean === 'completed') return true;
  const constrClean = normalizeStatusText(task.constrStatus);
  const purchClean = normalizeStatusText(task.purchaseStatus);
  if ((constrClean === 'da thi cong' || constrClean === 'da hoan thanh') &&
      (!purchClean || purchClean === 'da co hang' || purchClean === 'da nhan du' || purchClean === 'hang gia cong' || purchClean === 'khong co hang')) {
    return true;
  }
  return false;
};

export const getTaskEffectiveProgress = (task: any): number => {
  if (!task) return 0;
  if (isTaskActuallyDone(task)) return 1;
  if (typeof task.progress === 'number') {
    return task.progress > 1 ? task.progress / 100 : task.progress;
  }
  return calculateAutoProgressRatio(task.purchaseStatus, task.constrStatus);
};

export type PurchaseRequestStatus = 
  | 'PENDING_CHECK'              // Chờ người kiểm tra xác nhận
  | 'CHECKED_WAITING_APPROVAL'   // Đã kiểm tra - Chờ Lãnh đạo duyệt
  | 'APPROVED'                   // Lãnh đạo đã duyệt - Chuyển bộ phận mua hàng
  | 'ORDERED'                    // Đã tiến hành đặt hàng
  | 'REJECTED';                  // Bị từ chối

export interface PurchaseRequestItem {
  id: string;                    // materialPlanId
  stt?: string;
  name: string;                  // Tên vật tư
  unit?: string;                 // ĐVT
  quantity?: number;             // Số lượng đề nghị mua
  note?: string;                 // Ghi chú
  currentStatus?: string;
}

export interface PurchaseRequestAuditLog {
  action: string;
  actorId?: string;
  actorName: string;
  actorRole?: string;
  timestamp: string;
  note?: string;
}

export interface PurchaseRequest {
  id: string;
  code: string;
  projectCode: string;
  projectName?: string;
  creatorId?: string;
  creatorName: string;
  creatorTitle?: string;
  checkerId?: string;
  checkerName?: string;
  checkerTitle?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewerTitle?: string;
  neededDate?: string;
  priority?: 'normal' | 'urgent';
  reason?: string;
  note?: string;
  status: PurchaseRequestStatus;
  items: PurchaseRequestItem[];
  createdAt: string;
  history?: PurchaseRequestAuditLog[];
}
