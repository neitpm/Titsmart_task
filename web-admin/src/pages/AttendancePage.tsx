import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore } from '../services/authStore';
import { api } from '../services/apiSupabase';
import { supabase } from '../lib/supabase';
import { uploadAttachment } from '../utils/fileUploadHelper';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { CustomSelect } from '../components/common/CustomSelect';
import { Toast } from '../components/common/Toast';
import * as XLSX from 'xlsx';
import { exportToStyledExcel } from '../utils/excelExportUtils';
import { exportMonthlyAttendanceTitsmart } from '../utils/exportMonthlyAttendance';
import { calculateYearLeaveAccrual, YearLeaveBalanceSummary } from '../utils/leaveAccrualRules';
import { isHighestLevelPerson, isTechnicalAdminUser, getHighestRankLeader, getUserRankLevel } from '../utils/taskPermission';

import { 
  LeaveRequest, 
  LeaveType, 
  AttendanceAdjustmentRequest, 
  AttendanceAdjustmentType,
  AttendanceConfig,
  DEFAULT_ATTENDANCE_CONFIG,
  WorkShift,
  AttendanceGpsLocation,
  WorkLocationType
} from '../types';
import { 
  findNearestLocation, 
  formatDistance, 
  getGoogleMapsLink, 
  evaluateShiftStatus, 
  suggestBestShift,
  calculateDistanceMeters
} from '../utils/attendanceUtils';
import { AttendanceConfigModal } from '../components/attendance/AttendanceConfigModal';
import { MonthlyPayrollTab } from '../components/payroll/MonthlyPayrollTab';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { useUIStore } from '../services/uiStore';
import { ViewModeToolbar, resolveViewMode, AppViewMode } from '../components/common/ViewModeToolbar';
import { StatusKanbanBoard } from '../components/common/StatusKanbanBoard';

interface AttendanceLog {
  id: string;
  userId: string;
  userName: string;
  projectId?: string;
  projectName?: string;
  checkInTime: string;
  checkOutTime?: string;
  checkInImage?: string;
  checkOutImage?: string;
  notes?: string;
  createdAt?: string;

  // Ca làm việc & Loại chấm công
  attendanceType?: 'time' | 'shift';
  workLocationType?: WorkLocationType;
  shiftId?: string;
  shiftName?: string;
  shiftStatus?: 'on_time' | 'late' | 'early' | 'normal';
  shiftLateMinutes?: number;

  // Định vị GPS khi Check-in
  checkInLat?: number;
  checkInLng?: number;
  checkInLocationName?: string;
  checkInDistanceMeters?: number;
  checkInWithinRadius?: boolean;

  // Định vị GPS khi Check-out
  checkOutLat?: number;
  checkOutLng?: number;
  checkOutLocationName?: string;
  checkOutDistanceMeters?: number;
  checkOutWithinRadius?: boolean;
}

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
};

const formatTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
};

const formatDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; }
};

const normalizeStr = (s: any): string => {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
};

const getDuration = (checkIn: string, checkOut?: string) => {
  if (!checkOut) return '—';
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
};

// In-memory persistent cache across tab and route navigation
let cachedLogs: AttendanceLog[] = [];
let cachedLeaves: LeaveRequest[] = [];
let cachedAdjustments: AttendanceAdjustmentRequest[] = [];
let hasFetchedAttendanceData = false;

export const AttendancePage: React.FC = () => {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const projects = useRealtimeStore(state => state.projects);
  const engineers = useRealtimeStore(state => state.engineers);
  const notifications = useRealtimeStore(state => state.notifications);
  const addNotification = useRealtimeStore(state => state.addNotification);
  const lastHandledNotifIdRef = useRef<string | null>(null);
  const latestNotif = notifications[0];

  // Tự động đồng bộ và nạp lại đơn từ tức thì khi nhận được thông báo liên quan đến nghỉ phép / chấm công
  useEffect(() => {
    if (!latestNotif || latestNotif.id === lastHandledNotifIdRef.current) return;
    lastHandledNotifIdRef.current = latestNotif.id;

    const type = String(latestNotif.type || '').toLowerCase();
    const title = String(latestNotif.title || '').toLowerCase();
    const link = String(latestNotif.link || '').toLowerCase();

    if (type.includes('leave') || title.includes('nghỉ phép') || link.includes('tab=leave')) {
      fetchLeaves(false);
    }
    if (type.includes('adj') || title.includes('chấm công') || link.includes('adjustment')) {
      fetchAdjustments();
      fetchLogs(false);
    }
  }, [latestNotif]);
  const isAdmin = user?.role === 'admin' || user?.role === 'Quản trị viên' || user?.role === 'pm';

  // Cho phép Quản lý (Cấp 2), Người duyệt (APPROVE_LEAVE_STEP1/FINAL) và Admin xem 'Tất cả' để duyệt
  const canViewAll = React.useMemo(() => {
    if (!user) return false;
    const roleStr = String(user.role || '').toLowerCase();
    const titleStr = String((user as any).title || '').toLowerCase();
    const usernameStr = String(user.username || '').toLowerCase();
    const perms = Array.isArray(user.permissions) ? user.permissions : [];

    return (
      isAdmin ||
      usernameStr === 'admin' ||
      roleStr === 'admin' ||
      roleStr.includes('quản trị') ||
      roleStr.includes('giám đốc') ||
      roleStr.includes('trưởng') ||
      roleStr.includes('chỉ huy') ||
      roleStr.includes('manager') ||
      roleStr.includes('pm') ||
      titleStr.includes('quản lý') ||
      titleStr.includes('trưởng') ||
      titleStr.includes('chỉ huy') ||
      titleStr.includes('giám đốc') ||
      perms.includes('APPROVE_LEAVE_STEP1' as any) ||
      perms.includes('APPROVE_LEAVE_FINAL' as any) ||
      perms.includes('VIEW_ALL_ATTENDANCE' as any) ||
      perms.includes('MANAGE_ATTENDANCE' as any)
    );
  }, [user, isAdmin]);

  const [mainTab, setMainTab] = useState<'attendance' | 'leave' | 'adjustment' | 'payroll'>('attendance');
  const [attendanceSubTab, setAttendanceSubTab] = useState<'timesheet' | 'logs'>('timesheet');
  const [highlightLeaveId, setHighlightLeaveId] = useState<string | null>(null);
  const [isHighlightActive, setIsHighlightActive] = useState<boolean>(false);
  const [logs, setLogs] = useState<AttendanceLog[]>(cachedLogs);
  const [loading, setLoading] = useState(!hasFetchedAttendanceData && cachedLogs.length === 0);
  const [selectedProject, setSelectedProject] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tab, setTab] = useState<'my' | 'all'>('my');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkInImage, setCheckInImage] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  
  // Cấu hình hình thức chấm công (Admin Setup)
  const [attendanceConfig, setAttendanceConfig] = useState<AttendanceConfig>(DEFAULT_ATTENDANCE_CONFIG);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Chế độ xem theo chuẩn appViewMode chung và toolbar
  const appViewMode = useUIStore(s => s.appViewMode);
  const setAppViewMode = useUIStore(s => s.setAppViewMode);
  const supportedAttendanceModes: AppViewMode[] = ['grid', 'compact_grid', 'table', 'table_detailed', 'kanban'];
  const viewMode = resolveViewMode(appViewMode, supportedAttendanceModes);

  // State chấm công theo ca
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');

  // State hình thức / địa điểm làm việc (văn phòng / công trình / công tác)
  const [workLocationType, setWorkLocationType] = useState<WorkLocationType>('office');

  // State chấm công định vị GPS
  const [gpsData, setGpsData] = useState<{
    lat: number;
    lng: number;
    distanceMeters: number;
    locationName: string;
    isWithinRadius: boolean;
  } | null>(null);
  const [isGpsScanning, setIsGpsScanning] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLeaveId, setDeleteLeaveId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLeaveExportMenu, setShowLeaveExportMenu] = useState(false);
  const [showAdjExportMenu, setShowAdjExportMenu] = useState(false);

  // State cho Xin nghỉ phép (khởi tạo từ cache)
  const [leaves, setLeaves] = useState<LeaveRequest[]>(cachedLeaves);
  const [leaveSearchQuery, setLeaveSearchQuery] = useState('');
  const [leaveFilterDateFrom, setLeaveFilterDateFrom] = useState('');
  const [leaveFilterDateTo, setLeaveFilterDateTo] = useState('');
  const [leaveSelectedYear, setLeaveSelectedYear] = useState<number>(new Date().getFullYear());
  const [leaveSelectedUser, setLeaveSelectedUser] = useState<string>('me');
  const [leavesLoading, setLeavesLoading] = useState(!hasFetchedAttendanceData && cachedLeaves.length === 0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Nghỉ phép năm');
  const [leaveDurationType, setLeaveDurationType] = useState<'FULL_DAY' | 'HALF_DAY'>('FULL_DAY');
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveSession, setLeaveSession] = useState<'ALL_DAY' | 'MORNING' | 'AFTERNOON'>('ALL_DAY');
  const [leaveReason, setLeaveReason] = useState('');
  const [step1ReviewerId, setStep1ReviewerId] = useState('');
  const [step2ReviewerId, setStep2ReviewerId] = useState('');
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'warning' | 'info' | 'error' }>({ show: false, message: '', type: 'info' });

  // State cho Chấm công bù
  const [adjustments, setAdjustments] = useState<AttendanceAdjustmentRequest[]>(cachedAdjustments);
  const [adjSearchQuery, setAdjSearchQuery] = useState('');
  const [adjFilterDateFrom, setAdjFilterDateFrom] = useState('');
  const [adjFilterDateTo, setAdjFilterDateTo] = useState('');
  const [adjTypeFilter, setAdjTypeFilter] = useState<string>('');
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjType, setAdjType] = useState<AttendanceAdjustmentType>('Bù vào ca');
  const [adjDate, setAdjDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjInTime, setAdjInTime] = useState('08:00');
  const [adjOutTime, setAdjOutTime] = useState('17:30');
  const [adjProject, setAdjProject] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjStep1ReviewerId, setAdjStep1ReviewerId] = useState('');
  const [adjStep2ReviewerId, setAdjStep2ReviewerId] = useState('');
  const [adjFollowerIds, setAdjFollowerIds] = useState<string[]>([]);
  const [reviewAdj, setReviewAdj] = useState<AttendanceAdjustmentRequest | null>(null);
  const [reviewAdjStep, setReviewAdjStep] = useState<1 | 2>(1);
  const [reviewAdjNote, setReviewAdjNote] = useState('');
  const [deleteAdjId, setDeleteAdjId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'info' | 'error' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3500);
  };

  const [reviewLeave, setReviewLeave] = useState<LeaveRequest | null>(null);
  const [reviewStep, setReviewStep] = useState<1 | 2>(1);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNote, setReviewNote] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Người có cấp bậc cao nhất trong công ty (Cấp 1 - Ban Giám Đốc)
  const highestLeader = React.useMemo(() => {
    return getHighestRankLeader(engineers);
  }, [engineers]);

  const highestRankDisplayName = highestLeader?.name || 'Ban Giám Đốc';

  const getStep2ReviewerDisplayName = (name?: string | null) => {
    if (!name) return highestRankDisplayName;
    const nLow = name.trim().toLowerCase();
    // Nếu dữ liệu cũ lưu tên tài khoản kỹ thuật admin -> hiển thị đại diện Ban Giám Đốc
    if (nLow === 'admin' || nLow === 'quản trị viên' || nLow === 'quản trị' || nLow === 'administrator') {
      return highestRankDisplayName;
    }
    return name;
  };

  // Danh sách Người duyệt Cấp 2 (Quản lý / Chỉ huy trưởng: Cấp 2 hoặc APPROVE_LEAVE_STEP1)
  const step1Reviewers = React.useMemo(() => {
    return engineers.filter(eng => {
      if (eng.id === user?.id || eng.isLocked || (eng as any).is_locked) return false;
      if (isTechnicalAdminUser(eng)) return false;
      const rank = getUserRankLevel(eng);
      return rank === 2 || (eng.permissions || []).includes('APPROVE_LEAVE_STEP1' as any);
    });
  }, [engineers, user]);

  // Danh sách Người duyệt Cấp 1 (Ban Giám Đốc: Cấp 1 hoặc APPROVE_LEAVE_FINAL)
  const step2Reviewers = React.useMemo(() => {
    return engineers.filter(eng => {
      if (eng.id === user?.id || eng.isLocked || (eng as any).is_locked) return false;
      if (isTechnicalAdminUser(eng)) return false;
      const rank = getUserRankLevel(eng);
      return rank === 1 || (eng.permissions || []).includes('APPROVE_LEAVE_FINAL' as any);
    });
  }, [engineers, user]);

  // Kiểm tra quyền duyệt Đơn nghỉ phép đảm bảo bảo mật và phân quyền chính xác theo Cấp
  const checkCanReviewLeave = (l: LeaveRequest) => {
    if (!user) return { canReviewStep1: false, canReviewStep2: false };

    // 1. Không bao giờ cho phép tự duyệt đơn của chính mình
    const isApplicant = user.id === l.userId || user.name === l.userName || (user.username && user.username === l.userName);
    if (isApplicant) return { canReviewStep1: false, canReviewStep2: false };

    // 2. Kiểm tra nếu là Người theo dõi (Follower) -> Chỉ theo dõi, không có quyền duyệt
    // trừ khi chính người đó được chỉ định đích danh là step1Reviewer hoặc step2Reviewer
    const isFollower = (
      (Array.isArray(l.followerIds) && l.followerIds.includes(user.id)) ||
      (Array.isArray(l.followerNames) && (
        l.followerNames.includes(user.name) || 
        l.followerNames.some((f: string) => f.toLowerCase() === (user.name || '').toLowerCase() || f.toLowerCase() === (user.username || '').toLowerCase())
      ))
    );

    const isDesignatedStep1 = Boolean(l.step1ReviewerId && (user.id === l.step1ReviewerId || user.name === l.step1ReviewerName));
    const isDesignatedStep2 = Boolean(l.step2ReviewerId && (user.id === l.step2ReviewerId || user.name === l.step2ReviewerName));

    const isLevel1 = getUserRankLevel(user) === 1 || isHighestLevelPerson(user);
    const isLevel2 = getUserRankLevel(user) === 2 || (user.permissions || []).includes('APPROVE_LEAVE_STEP1' as any);

    // Quyền Quản lý duyệt (Step 1 - Cấp 2)
    let canReviewStep1 = false;
    if (l.status === 'PENDING_STEP1' || (l.status === 'PENDING' && l.step1ReviewerId)) {
      if (isDesignatedStep1) {
        canReviewStep1 = true;
      } else if (!l.step1ReviewerId) {
        if (isLevel1 || (!isFollower && isLevel2)) {
          canReviewStep1 = true;
        }
      } else if (isLevel1) {
        canReviewStep1 = true;
      }
    }

    // Quyền Lãnh đạo duyệt (Step 2 - Cấp 1)
    let canReviewStep2 = false;
    if (l.status === 'APPROVED_STEP1' || (l.status === 'PENDING' && !l.step1ReviewerId)) {
      if (isDesignatedStep2) {
        canReviewStep2 = true;
      } else if (isLevel1) {
        canReviewStep2 = true;
      }
    }

    return { canReviewStep1, canReviewStep2 };
  };

  // Kiểm tra quyền duyệt Chấm công bù theo Cấp
  const checkCanReviewAdj = (adj: AttendanceAdjustmentRequest) => {
    if (!user) return { canReview1: false, canReview2: false };

    // Không tự duyệt đơn chấm công bù của mình
    if (user.id === adj.userId || user.name === adj.userName) {
      return { canReview1: false, canReview2: false };
    }

    const isDesignated1 = Boolean(adj.step1ReviewerId && (user.id === adj.step1ReviewerId || user.name === adj.step1ReviewerName));
    const isDesignated2 = Boolean(adj.step2ReviewerId && (user.id === adj.step2ReviewerId || user.name === adj.step2ReviewerName));

    const isLevel1 = getUserRankLevel(user) === 1 || isHighestLevelPerson(user);
    const isLevel2 = getUserRankLevel(user) === 2 || (user.permissions || []).includes('APPROVE_LEAVE_STEP1' as any);

    let canReview1 = false;
    if (adj.status === 'PENDING_STEP1' || (adj.status === 'PENDING' && adj.step1ReviewerId)) {
      if (isDesignated1) {
        canReview1 = true;
      } else if (!adj.step1ReviewerId) {
        if (isLevel1 || isLevel2) {
          canReview1 = true;
        }
      } else if (isLevel1) {
        canReview1 = true;
      }
    }

    let canReview2 = false;
    if (adj.status === 'APPROVED_STEP1' || (adj.status === 'PENDING' && !adj.step1ReviewerId)) {
      if (isDesignated2) {
        canReview2 = true;
      } else if (isLevel1) {
        canReview2 = true;
      }
    }

    return { canReview1, canReview2 };
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const viewParam = searchParams.get('view') || searchParams.get('type') || searchParams.get('scope');
    const leaveIdParam = searchParams.get('leaveId') || searchParams.get('id');
    const highlightParam = searchParams.get('highlight');
    if (tabParam === 'leave' || tabParam === 'leaves' || leaveIdParam || highlightParam) {
      setMainTab('leave');
      if (leaveIdParam) {
        setHighlightLeaveId(leaveIdParam);
        setIsHighlightActive(true);
      }
    } else if (tabParam === 'adjustment' || tabParam === 'adjustments' || tabParam === 'cham-cong-bu') {
      setMainTab('adjustment');
    } else if (tabParam === 'payroll' || tabParam === 'salary' || tabParam === 'bang-luong') {
      setMainTab('attendance');
      setAttendanceSubTab('timesheet');
    } else if (tabParam === 'logs' || tabParam === 'nhat-ky') {
      setMainTab('attendance');
      setAttendanceSubTab('logs');
    } else if (tabParam === 'attendance') {
      setMainTab('attendance');
    }

    if ((viewParam === 'all' || viewParam === 'tat-ca') && canViewAll) {
      setTab('all');
    } else {
      setTab('my');
    }
  }, [searchParams, canViewAll]);

  useEffect(() => {
    if (!canViewAll && tab !== 'my') {
      setTab('my');
    }
  }, [canViewAll, tab]);

  useEffect(() => {
    if (isHighlightActive && highlightLeaveId) {
      const timer = setTimeout(() => {
        const elem = document.querySelector('.highlighted-leave-row');
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
      const fadeTimer = setTimeout(() => setIsHighlightActive(false), 9000);
      return () => {
        clearTimeout(timer);
        clearTimeout(fadeTimer);
      };
    }
  }, [isHighlightActive, highlightLeaveId, leaves]);

  const handleExportMonthlyTitsmart = async () => {
    try {
      // Xác định tháng và năm từ filterDateFrom hoặc ngày hiện tại
      let targetMonth = new Date().getMonth() + 1;
      let targetYear = new Date().getFullYear();

      if (filterDateFrom) {
        const d = new Date(filterDateFrom);
        if (!isNaN(d.getTime())) {
          targetMonth = d.getMonth() + 1;
          targetYear = d.getFullYear();
        }
      }

      await exportMonthlyAttendanceTitsmart({
        month: targetMonth,
        year: targetYear,
        logs: logs,
        leaves: leaves,
        adjustments: adjustments,
        engineers: engineers
      });

      showToast(`Đã xuất Bảng chấm công Tháng ${targetMonth}/${targetYear} theo form chuẩn TITSMART thành công!`, 'success');
    } catch (err: any) {
      console.error('Lỗi khi xuất bảng chấm công:', err);
      showToast(err.message || 'Lỗi khi xuất file Excel', 'error');
    }
  };

  const handleExportExcel = async (format: 'xlsx' | 'csv' | 'docx' = 'xlsx') => {
    if (!filteredLogs.length) return;
    const exportData = filteredLogs.map((log, index) => ({
      'STT': index + 1,
      'Ngày': formatDate(log.checkInTime),
      'Giờ': formatTime(log.checkInTime),
      'Nhân viên': log.userName,
      'Dự án': log.projectName || '',
      'Ghi chú': log.notes || '',
    }));

    const today = new Date().toISOString().split('T')[0];
    if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ChamCong');
      XLSX.writeFile(workbook, `BangChamCong_${today}.csv`, { bookType: 'csv' });
    } else if (format === 'docx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ChamCong');
      XLSX.writeFile(workbook, `BangChamCong_${today}.docx`, { bookType: 'xlsx' });
    } else {
      await exportToStyledExcel({
        fileName: `BangChamCong_${today}.xlsx`,
        sheetName: 'ChamCong',
        title: 'BẢNG THEO DÕI CHẤM CÔNG NHÂN VIÊN',
        data: exportData,
      });
    }
  };

  const handleExportLeavesExcel = async (format: 'xlsx' | 'csv' | 'docx' = 'xlsx') => {
    if (!displayedLeaves.length) return;
    const exportData = displayedLeaves.map((leave, index) => {
      let statusStr = 'Chờ duyệt';
      if (leave.status === 'PENDING_STEP1') statusStr = 'Chờ Quản lý duyệt';
      else if (leave.status === 'APPROVED_STEP1') statusStr = 'Quản lý đã duyệt - Chờ BGD phê duyệt';
      else if (leave.status === 'APPROVED') statusStr = 'Đã duyệt hoàn tất';
      else if (leave.status === 'REJECTED') statusStr = 'Từ chối';

      return {
        'STT': index + 1,
        'Nhân viên': leave.userName,
        'Loại nghỉ': leave.leaveType,
        'Từ ngày': formatDate(leave.startDate),
        'Đến ngày': formatDate(leave.endDate),
        'Số ngày': leave.session === 'MORNING' ? `${leave.totalDays} (Sáng)` : leave.session === 'AFTERNOON' ? `${leave.totalDays} (Chiều)` : leave.totalDays,
        'Lý do': leave.reason,
        'Người theo dõi': (leave.followerNames && leave.followerNames.length > 0) ? leave.followerNames.join(', ') : '—',
        'Trạng thái': statusStr,
        'Quản lý duyệt': leave.step1ReviewerName ? `${leave.step1ReviewerName} (${leave.step1ReviewedAt ? 'Đã duyệt' : 'Chờ'})` : '—',
        'Ý kiến Quản lý': leave.step1ReviewNote || '',
        'Ban Giám Đốc duyệt': leave.step2ReviewerName || leave.reviewerName || '—',
        'Ý kiến Ban Giám Đốc': leave.step2ReviewNote || leave.reviewNote || ''
      };
    });

    const today = new Date().toISOString().split('T')[0];
    if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'XinNghiPheP');
      XLSX.writeFile(workbook, `BangNghiPhep_${today}.csv`, { bookType: 'csv' });
    } else if (format === 'docx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'XinNghiPheP');
      XLSX.writeFile(workbook, `BangNghiPhep_${today}.docx`, { bookType: 'xlsx' });
    } else {
      await exportToStyledExcel({
        fileName: `BangNghiPhep_${today}.xlsx`,
        sheetName: 'XinNghiPhep',
        title: 'DANH SÁCH ĐƠN XIN NGHỈ PHÉP',
        data: exportData,
      });
    }
  };

  // Lọc danh sách nghỉ phép ngay trong bộ nhớ (0ms latency, không reload, không spinner khi đổi tab)
  const displayedLeaves = React.useMemo(() => {
    let list = leaves;
    if ((!canViewAll || tab === 'my') && user) {
      list = list.filter(l => {
        const matchId = String(l.userId || '') === String(user.id || '');
        const matchName = user.name && l.userName && l.userName.trim().toLowerCase() === user.name.trim().toLowerCase();
        const matchUsername = user.username && l.userName && l.userName.trim().toLowerCase() === user.username.trim().toLowerCase();
        const matchFollower = Array.isArray(l.followerIds) && (
          l.followerIds.includes(user.id) || 
          (user.name && l.followerNames?.includes(user.name)) ||
          (user.username && l.followerNames?.includes(user.username))
        );
        return matchId || matchName || matchUsername || matchFollower;
      });
    }
    if (leaveSearchQuery.trim()) {
      const q = leaveSearchQuery.toLowerCase().trim();
      list = list.filter(l => {
        const matchUser = l.userName?.toLowerCase().includes(q);
        const matchType = l.leaveType?.toLowerCase().includes(q);
        const matchReason = l.reason?.toLowerCase().includes(q);
        const matchReviewer1 = l.step1ReviewerName?.toLowerCase().includes(q);
        const matchReviewer2 = l.step2ReviewerName?.toLowerCase().includes(q);
        const matchStartDate = formatDate(l.startDate)?.toLowerCase().includes(q);
        const matchEndDate = formatDate(l.endDate)?.toLowerCase().includes(q);
        return matchUser || matchType || matchReason || matchReviewer1 || matchReviewer2 || matchStartDate || matchEndDate;
      });
    }
    if (leaveFilterDateFrom || leaveFilterDateTo) {
      list = list.filter(l => {
        const start = l.startDate ? String(l.startDate).split('T')[0] : '';
        const end = l.endDate ? String(l.endDate).split('T')[0] : start;
        if (leaveFilterDateFrom && end < leaveFilterDateFrom) return false;
        if (leaveFilterDateTo && start > leaveFilterDateTo) return false;
        return true;
      });
    }
    return list;
  }, [leaves, tab, user, leaveSearchQuery, leaveFilterDateFrom, leaveFilterDateTo, canViewAll]);

  // Tính toán hạn mức phép năm và bù trừ linh hoạt theo tháng cho nhân viên được chọn hoặc cá nhân
  const targetLeaveUserId = React.useMemo(() => {
    if (tab === 'my' || !canViewAll || leaveSelectedUser === 'me') {
      return user?.id || '';
    }
    return leaveSelectedUser;
  }, [tab, canViewAll, leaveSelectedUser, user]);

  const targetLeaveUserName = React.useMemo(() => {
    if (tab === 'my' || !canViewAll || leaveSelectedUser === 'me') {
      return user?.name || 'Cá nhân';
    }
    const found = engineers.find(e => e.id === leaveSelectedUser);
    return found ? found.name : 'Nhân sự';
  }, [tab, canViewAll, leaveSelectedUser, user, engineers]);

  const myLeaveBalance: YearLeaveBalanceSummary | null = React.useMemo(() => {
    if (!targetLeaveUserId) return null;
    const currentMonth = leaveSelectedYear === new Date().getFullYear() ? (new Date().getMonth() + 1) : 12;
    const targetEngineer = engineers.find(e => e.id === targetLeaveUserId);
    return calculateYearLeaveAccrual(targetLeaveUserId, leaveSelectedYear, leaves, currentMonth, adjustments, targetEngineer?.joinDate);
  }, [targetLeaveUserId, leaveSelectedYear, leaves, adjustments, engineers]);

  // Lọc danh sách chấm công bù ngay trong bộ nhớ (0ms latency)
  const displayedAdjustments = React.useMemo(() => {
    let list = adjustments;
    if ((!canViewAll || tab === 'my') && user) {
      list = list.filter(a => {
        const matchId = String(a.userId || '') === String(user.id || '');
        const matchName = user.name && a.userName && a.userName.trim().toLowerCase() === user.name.trim().toLowerCase();
        const matchUsername = user.username && a.userName && a.userName.trim().toLowerCase() === user.username.trim().toLowerCase();
        const matchFollower = Array.isArray(a.followerIds) && (
          a.followerIds.includes(user.id) ||
          (user.name && a.followerNames?.includes(user.name)) ||
          (user.username && a.followerNames?.includes(user.username))
        );
        return matchId || matchName || matchUsername || matchFollower;
      });
    }
    if (adjTypeFilter) {
      list = list.filter(a => a.adjustmentType === adjTypeFilter);
    }
    if (adjSearchQuery.trim()) {
      const q = adjSearchQuery.toLowerCase().trim();
      list = list.filter(a => {
        const matchUser = a.userName?.toLowerCase().includes(q);
        const matchType = a.adjustmentType?.toLowerCase().includes(q);
        const matchReason = a.reason?.toLowerCase().includes(q);
        const matchProject = a.projectName?.toLowerCase().includes(q);
        const matchReviewer1 = a.step1ReviewerName?.toLowerCase().includes(q);
        const matchReviewer2 = a.step2ReviewerName?.toLowerCase().includes(q);
        const matchDate = formatDate(a.adjustmentDate)?.toLowerCase().includes(q);
        return matchUser || matchType || matchReason || matchProject || matchReviewer1 || matchReviewer2 || matchDate;
      });
    }
    if (adjFilterDateFrom || adjFilterDateTo) {
      list = list.filter(a => {
        const d = a.adjustmentDate ? String(a.adjustmentDate).split('T')[0] : '';
        if (adjFilterDateFrom && d < adjFilterDateFrom) return false;
        if (adjFilterDateTo && d > adjFilterDateTo) return false;
        return true;
      });
    }
    return list;
  }, [adjustments, tab, user, adjSearchQuery, adjFilterDateFrom, adjFilterDateTo, adjTypeFilter, canViewAll]);

  const fetchLogs = async (forceShowSpinner = false) => {
    if (forceShowSpinner || (!hasFetchedAttendanceData && cachedLogs.length === 0)) {
      setLoading(true);
    }
    try {
      const data = await api.attendance.getAll();
      cachedLogs = data;
      setLogs(data);
    } catch (e) {
      console.error('Failed to fetch attendance logs', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaves = async (forceShowSpinner = false) => {
    if (forceShowSpinner || (!hasFetchedAttendanceData && cachedLeaves.length === 0)) {
      setLeavesLoading(true);
    }
    try {
      const data = await api.leaves.getAll();
      cachedLeaves = data;
      setLeaves(data);
      hasFetchedAttendanceData = true;
    } catch (e) {
      console.error('Failed to fetch leave requests', e);
    } finally {
      setLeavesLoading(false);
    }
  };

  const fetchAdjustments = async () => {
    try {
      // 1. Lấy cache tạm thời để UI phản hồi tức thì
      const raw = localStorage.getItem('titsmart_attendance_adjustments');
      let localList: AttendanceAdjustmentRequest[] = [];
      if (raw) {
        try {
          localList = JSON.parse(raw);
          if (localList.length > 0 && adjustments.length === 0) {
            setAdjustments(localList);
            cachedAdjustments = localList;
          }
        } catch { /* ignore */ }
      }

      // 2. Fetch từ Supabase (Cloud) để đồng bộ trên mọi thiết bị (Desktop + Mobile)
      const remote = await api.adjustments.getAll();
      if (remote && remote.length > 0) {
        cachedAdjustments = remote;
        setAdjustments(remote);
        localStorage.setItem('titsmart_attendance_adjustments', JSON.stringify(remote));
      } else if (localList.length > 0) {
        // Migration: Nếu Supabase chưa có nhưng máy Desktop có sẵn dữ liệu cũ, đồng bộ lên Supabase
        for (const item of localList) {
          try {
            await api.adjustments.create(item);
          } catch (mErr) {
            console.warn('[Adjustments] Migration failed for item:', item, mErr);
          }
        }
        const synced = await api.adjustments.getAll();
        if (synced && synced.length > 0) {
          cachedAdjustments = synced;
          setAdjustments(synced);
          localStorage.setItem('titsmart_attendance_adjustments', JSON.stringify(synced));
        }
      } else {
        cachedAdjustments = [];
        setAdjustments([]);
        localStorage.setItem('titsmart_attendance_adjustments', JSON.stringify([]));
      }
    } catch (e) {
      console.error('Failed to fetch adjustments', e);
    }
  };

  const saveAdjustments = (data: AttendanceAdjustmentRequest[]) => {
    cachedAdjustments = data;
    setAdjustments(data);
    localStorage.setItem('titsmart_attendance_adjustments', JSON.stringify(data));
  };

  const fetchAttendanceConfig = async () => {
    try {
      const cfg = await api.attendance.getConfig();
      setAttendanceConfig(cfg);
    } catch (e) {
      console.warn('[AttendanceConfig] Lỗi tải cấu hình:', e);
    }
  };

  const handleSaveAttendanceConfig = async (newConfig: AttendanceConfig) => {
    try {
      const saved = await api.attendance.saveConfig(newConfig, user?.name || user?.username || 'Admin');
      setAttendanceConfig(saved);
      showToast('Đã lưu cấu hình hình thức chấm công thành công!', 'success');
    } catch (e: any) {
      showToast('Lỗi lưu cấu hình: ' + (e.message || 'Không thể lưu'), 'error');
      throw e;
    }
  };

  const handleTriggerGpsScan = () => {
    if (!navigator.geolocation) {
      setGpsError('Thiết bị hoặc trình duyệt không hỗ trợ định vị GPS');
      return;
    }
    setIsGpsScanning(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Ưu tiên đối chiếu với dự án Văn phòng (OFFICE) hoặc dự án đầu tiên có tọa độ
        const officeProj = projects.find(p => (p.code || '').toUpperCase() === 'OFFICE' && p.latitude !== undefined && p.longitude !== undefined)
          || projects.find(p => (p.name || '').toLowerCase().includes('văn phòng') && p.latitude !== undefined && p.longitude !== undefined);

        let distanceMeters = 0;
        let isWithinRadius = true;
        let locationName = 'Vị trí hiện tại';

        if (officeProj && officeProj.latitude !== undefined && officeProj.longitude !== undefined) {
          distanceMeters = calculateDistanceMeters(lat, lng, officeProj.latitude, officeProj.longitude);
          isWithinRadius = distanceMeters <= (officeProj.radiusMeters || 500);
          locationName = officeProj.name || 'Văn phòng';
        } else {
          const nearest = findNearestLocation(lat, lng, attendanceConfig.locations);
          distanceMeters = nearest.distanceMeters;
          isWithinRadius = nearest.isWithinRadius;
          locationName = nearest.nearestLocation?.name || 'Vị trí hiện tại';
        }

        setGpsData({
          lat,
          lng,
          distanceMeters,
          locationName,
          isWithinRadius,
        });

        // Nếu ở xa văn phòng (> 500m) và cho phép làm việc ngoài văn phòng, tự động chuyển sang "Tại công trình / Dự án"
        if (distanceMeters > 500 && attendanceConfig.allowFieldWork !== false) {
          setWorkLocationType(prev => prev === 'office' ? 'field' : prev);
        }
        setIsGpsScanning(false);
      },
      (err) => {
        setIsGpsScanning(false);
        setGpsError(err.message || 'Không thể lấy vị trí GPS. Vui lòng bật quyền truy cập vị trí trên trình duyệt.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (showCheckInModal) {
      // 1. Tự động gợi ý ca làm việc phù hợp nhất
      const best = suggestBestShift(attendanceConfig.shifts);
      if (best) setSelectedShiftId(best.id);

      // 2. Kích hoạt GPS nếu được cấu hình
      if (attendanceConfig.gpsRequirement !== 'none') {
        handleTriggerGpsScan();
      }
    }
  }, [showCheckInModal, attendanceConfig]);

  useEffect(() => {
    // Nạp dữ liệu ban đầu
    fetchLogs(false);
    fetchLeaves(false);
    fetchAdjustments();
    fetchAttendanceConfig();

    // ⚡ 1. LẮNG NGHE REALTIME DATABASE TỨC THÌ CHO NGHỈ PHÉP, CHẤM CÔNG VÀ CHẤM CÔNG BÙ
    const attendanceChannel = supabase
      .channel(`attendance-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_logs' },
        (payload: any) => {
          const newRow = payload?.new;
          const oldRow = payload?.old;
          const icon = newRow?.icon || oldRow?.icon;
          if (!icon || icon === 'LEAVE_REQUEST') {
            fetchLeaves(false);
          }
          if (!icon || icon === 'ATTENDANCE_ADJUSTMENT') {
            fetchAdjustments();
          }
          if (icon === 'ATTENDANCE_CONFIG') {
            fetchAttendanceConfig();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        () => {
          fetchLogs(false);
        }
      )
      .subscribe();

    // ⚡ 2. LẮNG NGHE SỰ KIỆN ĐỒNG BỘ NỘI BỘ GIỮA CÁC TAB / CỬA SỔ
    const handleLeavesSync = () => fetchLeaves(false);
    const handleAttendanceSync = () => {
      fetchAdjustments();
      fetchLogs(false);
    };

    window.addEventListener('titsmart_leaves_updated', handleLeavesSync);
    window.addEventListener('titsmart_attendance_updated', handleAttendanceSync);

    return () => {
      supabase.removeChannel(attendanceChannel);
      window.removeEventListener('titsmart_leaves_updated', handleLeavesSync);
      window.removeEventListener('titsmart_attendance_updated', handleAttendanceSync);
    };
  }, []);

  const handleCreateAdjustment = async () => {
    if (!user || isSubmitting) return;

    if (!adjReason.trim()) {
      setModalError('Vui lòng nhập lý do giải trình chấm công bù!');
      return;
    }

    setModalError(null);
    setIsSubmitting(true);
    try {
      const step1Eng = adjStep1ReviewerId ? engineers.find(e => e.id === adjStep1ReviewerId) : undefined;
      const step2Eng = adjStep2ReviewerId ? engineers.find(e => e.id === adjStep2ReviewerId) : undefined;
      const followerEngs = engineers.filter(e => adjFollowerIds.includes(e.id));
      const proj = projects.find(p => p.id === adjProject);

      const adjPayload: any = {
        userId: user.id,
        userName: user.name || user.username || 'Unknown',
        userTitle: (user as any).title || user.role,
        projectId: adjProject || undefined,
        projectName: proj?.name,
        adjustmentDate: adjDate,
        adjustmentType: adjType,
        checkInTime: adjType === 'Bù ra ca' ? undefined : `${adjDate}T${adjInTime}:00`,
        checkOutTime: adjType === 'Bù vào ca' ? undefined : `${adjDate}T${adjOutTime}:00`,
        reason: adjReason.trim(),
        status: step1Eng ? 'PENDING_STEP1' : 'PENDING',
        step1ReviewerId: step1Eng?.id,
        step1ReviewerName: step1Eng?.name,
        step2ReviewerId: step2Eng?.id,
        step2ReviewerName: step2Eng?.name,
        followerIds: adjFollowerIds.length > 0 ? adjFollowerIds : undefined,
        followerNames: followerEngs.length > 0 ? followerEngs.map(e => e.name) : undefined,
        createdAt: new Date().toISOString(),
      };

      // Đồng bộ trực tiếp lên Supabase
      const createdItem = await api.adjustments.create(adjPayload);
      const newAdj: AttendanceAdjustmentRequest = createdItem || {
        ...adjPayload,
        id: 'adj-' + Date.now(),
      };

      const updatedList = [newAdj, ...adjustments.filter(a => a.id !== newAdj.id)];
      saveAdjustments(updatedList);

      setShowAdjModal(false);
      setAdjReason('');
      setAdjProject('');
      setAdjStep1ReviewerId('');
      setAdjStep2ReviewerId('');
      setAdjFollowerIds([]);
      showToast('Tạo yêu cầu chấm công bù thành công!', 'success');

      // Gửi thông báo
      if (step1Eng) {
        await addNotification({
          title: 'Yêu cầu chấm công bù mới (Chờ duyệt)',
          message: `${user.name} vừa gửi yêu cầu ${adjType.toLowerCase()} ngày ${formatDate(adjDate)} (chờ ${step1Eng.name} duyệt bước 1)`,
          type: `adj_pending:::${step1Eng.id}:::${step1Eng.name}`,
          icon: 'edit_calendar',
          link: '/attendance?tab=adjustment',
        });
      } else {
        await addNotification({
          title: 'Yêu cầu chấm công bù mới',
          message: `${user.name} vừa gửi yêu cầu ${adjType.toLowerCase()} ngày ${formatDate(adjDate)} (chờ Ban Giám Đốc duyệt)`,
          type: highestLeader ? `adj_pending:::${highestLeader.id},admin:::${highestLeader.name},Lãnh đạo` : 'adj_pending:::admin:::Ban Giám Đốc',
          icon: 'edit_calendar',
          link: '/attendance?tab=adjustment',
        });
      }
    } catch (e: any) {
      showToast('Lỗi tạo yêu cầu chấm công bù: ' + (e.message || 'Không thể gửi yêu cầu'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleReviewAdjustment = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewAdj || !user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let finalStatus: 'APPROVED_STEP1' | 'APPROVED' | 'REJECTED' = status;
      if (status === 'APPROVED') {
        if (reviewAdjStep === 1) {
          finalStatus = 'APPROVED_STEP1';
        } else {
          finalStatus = 'APPROVED';
        }
      }

      const updatedAdj: AttendanceAdjustmentRequest = {
        ...reviewAdj,
        status: finalStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name || user.username || 'Admin',
      };

      if (reviewAdjStep === 1) {
        updatedAdj.step1ReviewerId = user.id;
        updatedAdj.step1ReviewerName = user.name || user.username || 'Quản lý';
        updatedAdj.step1ReviewNote = reviewAdjNote.trim() || undefined;
        updatedAdj.step1ReviewedAt = new Date().toISOString();
      } else {
        updatedAdj.step2ReviewerId = user.id;
        updatedAdj.step2ReviewerName = user.name || user.username || 'Ban Giám Đốc';
        updatedAdj.step2ReviewNote = reviewAdjNote.trim() || undefined;
        updatedAdj.step2ReviewedAt = new Date().toISOString();
      }

      // Nếu duyệt HOÀN TẤT -> Tự động đồng bộ / bổ sung 1 bản ghi Chấm công (AttendanceLog) vào danh sách logs
      if (finalStatus === 'APPROVED') {
        const inIso = updatedAdj.checkInTime || `${updatedAdj.adjustmentDate}T08:00:00`;
        const outIso = updatedAdj.checkOutTime || `${updatedAdj.adjustmentDate}T17:30:00`;
        
        try {
          const logObj = await api.attendance.checkIn({
            userId: updatedAdj.userId,
            userName: updatedAdj.userName,
            projectId: updatedAdj.projectId,
            projectName: updatedAdj.projectName,
            checkInTime: inIso,
            notes: `[Chấm công bù - Đã duyệt] ${updatedAdj.adjustmentType}: ${updatedAdj.reason}`,
          });
          // Ghi đè thời gian chính xác
          logObj.checkInTime = inIso;
          logObj.createdAt = updatedAdj.createdAt;
          if (updatedAdj.adjustmentType !== 'Bù vào ca') {
            logObj.checkOutTime = outIso;
          }
          cachedLogs = [logObj, ...cachedLogs];
          setLogs(prev => [logObj, ...prev]);
        } catch (err) {
          console.warn('Could not save to api.attendance, adding local log', err);
          const localLog: AttendanceLog = {
            id: 'log-adj-' + Date.now(),
            userId: updatedAdj.userId,
            userName: updatedAdj.userName,
            projectId: updatedAdj.projectId,
            projectName: updatedAdj.projectName,
            checkInTime: inIso,
            createdAt: updatedAdj.createdAt,
            checkOutTime: updatedAdj.adjustmentType !== 'Bù vào ca' ? outIso : undefined,
            notes: `[Chấm công bù - Đã duyệt] ${updatedAdj.adjustmentType}: ${updatedAdj.reason}`,
          };
          cachedLogs = [localLog, ...cachedLogs];
          setLogs(prev => [localLog, ...prev]);
        }
      }

      // Cập nhật trạng thái lên Supabase
      try {
        await api.adjustments.review(reviewAdj.id, {
          status: finalStatus,
          reviewerId: user.id,
          reviewerName: user.name || user.username || 'Reviewer',
          reviewNote: reviewAdjNote.trim() || undefined,
          step: reviewAdjStep,
        });
      } catch (cloudErr) {
        console.warn('[Adjustments] Failed to review on Supabase:', cloudErr);
      }

      const updatedList = adjustments.map(a => a.id === reviewAdj.id ? updatedAdj : a);
      saveAdjustments(updatedList);
      setReviewAdj(null);
      setReviewAdjNote('');
      showToast(finalStatus === 'REJECTED' ? 'Đã từ chối yêu cầu chấm công bù.' : 'Đã phê duyệt yêu cầu chấm công bù!', 'success');

      // Thông báo
      let notifTitle = '';
      let notifMsg = '';
      let notifType = '';

      if (finalStatus === 'APPROVED_STEP1') {
        notifTitle = 'Yêu cầu chấm công bù đã được Quản lý duyệt';
        notifMsg = `Yêu cầu của ${reviewAdj.userName} ngày ${formatDate(reviewAdj.adjustmentDate)} đã được ${user.name} duyệt → Chờ Ban Giám Đốc phê duyệt cuối cùng.`;
        notifType = highestLeader
          ? `adj_step1_approved:::${highestLeader.id},admin,${reviewAdj.userId}:::${highestLeader.name},${reviewAdj.userName}`
          : `adj_step1_approved:::admin,${reviewAdj.userId}:::Ban Giám Đốc,${reviewAdj.userName}`;
      } else if (finalStatus === 'APPROVED') {
        notifTitle = 'Yêu cầu chấm công bù đã được PHÊ DUYỆT';
        notifMsg = `Yêu cầu ${reviewAdj.adjustmentType.toLowerCase()} ngày ${formatDate(reviewAdj.adjustmentDate)} của bạn đã được phê duyệt thành công bởi ${user.name}. Dữ liệu chấm công đã được tự động cập nhật.`;
        notifType = `adj_approved:::${reviewAdj.userId}:::${reviewAdj.userName}`;
      } else {
        notifTitle = 'Yêu cầu chấm công bù bị TỪ CHỐI';
        notifMsg = `Yêu cầu ${reviewAdj.adjustmentType.toLowerCase()} ngày ${formatDate(reviewAdj.adjustmentDate)} của bạn đã bị từ chối bởi ${user.name}. Lý do: ${reviewAdjNote.trim() || 'Không có lý do cụ thể'}`;
        notifType = `adj_rejected:::${reviewAdj.userId}:::${reviewAdj.userName}`;
      }

      await addNotification({
        title: notifTitle,
        message: notifMsg,
        type: notifType,
        icon: finalStatus === 'REJECTED' ? 'cancel' : 'check_circle',
        link: '/attendance?tab=adjustment',
      });
    } catch (e: any) {
      showToast('Lỗi duyệt yêu cầu: ' + (e.message || 'Không thể xử lý'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleConfirmDeleteAdj = async () => {
    if (!deleteAdjId) return;
    try {
      await api.adjustments.delete(deleteAdjId);
    } catch (dErr) {
      console.warn('[Adjustments] Failed to delete from Supabase:', dErr);
    }
    const updated = adjustments.filter(a => a.id !== deleteAdjId);
    saveAdjustments(updated);
    setDeleteAdjId(null);
    showToast('Đã xóa yêu cầu chấm công bù.', 'info');
  };

  const handleExportAdjustmentsExcel = async (format: 'xlsx' | 'csv' | 'docx' = 'xlsx') => {
    if (!displayedAdjustments.length) return;
    const exportData = displayedAdjustments.map((adj, index) => {
      let statusStr = 'Chờ duyệt';
      if (adj.status === 'PENDING_STEP1') statusStr = 'Chờ Quản lý duyệt';
      else if (adj.status === 'APPROVED_STEP1') statusStr = 'Quản lý đã duyệt - Chờ BGD phê duyệt';
      else if (adj.status === 'APPROVED') statusStr = 'Đã duyệt hoàn tất';
      else if (adj.status === 'REJECTED') statusStr = 'Từ chối';

      return {
        'STT': index + 1,
        'Nhân viên': adj.userName,
        'Loại bù': adj.adjustmentType,
        'Ngày tạo đơn': formatDateTime(adj.createdAt),
        'Ngày cần bù': formatDate(adj.adjustmentDate),
        'Giờ vào yêu cầu': adj.checkInTime ? formatTime(adj.checkInTime) : '—',
        'Giờ ra yêu cầu': adj.checkOutTime ? formatTime(adj.checkOutTime) : '—',
        'Dự án': adj.projectName || '—',
        'Lý do giải trình': adj.reason,
        'Trạng thái': statusStr,
        'Quản lý duyệt': adj.step1ReviewerName ? `${adj.step1ReviewerName} (${adj.step1ReviewedAt ? 'Đã duyệt' : 'Chờ'})` : '—',
        'Ý kiến Quản lý': adj.step1ReviewNote || '',
        'Ban Giám Đốc duyệt': adj.step2ReviewerName || '—',
        'Ý kiến Ban Giám Đốc': adj.step2ReviewNote || ''
      };
    });

    const today = new Date().toISOString().split('T')[0];
    if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ChamCongBu');
      XLSX.writeFile(workbook, `BangChamCongBu_${today}.csv`, { bookType: 'csv' });
    } else if (format === 'docx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ChamCongBu');
      XLSX.writeFile(workbook, `BangChamCongBu_${today}.docx`, { bookType: 'xlsx' });
    } else {
      await exportToStyledExcel({
        fileName: `BangChamCongBu_${today}.xlsx`,
        sheetName: 'ChamCongBu',
        title: 'DANH SÁCH YÊU CẦU CHẤM CÔNG BÙ',
        data: exportData,
      });
    }
  };

  const handleCreateLeave = async () => {
    if (!user || isSubmitting) return;

    if (!leaveReason.trim()) {
      setModalError('Vui lòng nhập lý do xin nghỉ cụ thể!');
      return;
    }

    const start = new Date(leaveStartDate);
    const end = new Date(leaveEndDate);
    if (end < start) {
      setModalError('Ngày kết thúc không thể trước ngày bắt đầu!');
      return;
    }

    setModalError(null);
    setIsSubmitting(true);
    try {
      let diffDays = 1;
      let actualSession = leaveSession;

      if (leaveDurationType === 'HALF_DAY') {
        diffDays = 0.5;
        if (actualSession === 'ALL_DAY') {
          actualSession = 'MORNING';
        }
      } else {
        diffDays = Math.max(0, end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
        diffDays = Math.ceil(diffDays);
        if (leaveStartDate === leaveEndDate && (leaveSession === 'MORNING' || leaveSession === 'AFTERNOON')) {
          diffDays = 0.5;
          actualSession = leaveSession;
        } else {
          actualSession = 'ALL_DAY';
        }
      }

      const step1Eng = step1ReviewerId ? engineers.find(e => e.id === step1ReviewerId) : undefined;
      const step2Eng = step2ReviewerId ? engineers.find(e => e.id === step2ReviewerId) : undefined;
      const followerEngs = engineers.filter(e => followerIds.includes(e.id));
      const followerNames = followerEngs.map(e => e.name);

      const newLeave = await api.leaves.create({
        userId: user.id,
        userName: user.name || user.username || 'Unknown',
        leaveType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        totalDays: diffDays,
        session: actualSession,
        reason: leaveReason.trim(),
        step1ReviewerId: step1ReviewerId || undefined,
        step1ReviewerName: step1Eng?.name || undefined,
        step2ReviewerId: step2ReviewerId || undefined,
        step2ReviewerName: step2Eng?.name || undefined,
        followerIds: followerIds.length > 0 ? followerIds : undefined,
        followerNames: followerNames.length > 0 ? followerNames : undefined,
      });

      cachedLeaves = [newLeave, ...cachedLeaves];
      setLeaves(prev => [newLeave, ...prev]);
      setShowLeaveModal(false);
      setLeaveReason('');
      setStep1ReviewerId('');
      setStep2ReviewerId('');
      setFollowerIds([]);
      setLeaveDurationType('FULL_DAY');
      setLeaveSession('ALL_DAY');
      setModalError(null);
      showToast('Gửi đơn xin nghỉ phép thành công!', 'success');

      // Gửi thông báo: Nếu có chọn Quản lý thì gửi Quản lý duyệt trước, nếu không thì mặc định gửi Admin
      if (step1Eng) {
        await addNotification({
          title: 'Đơn xin nghỉ phép mới (Chờ duyệt)',
          message: `${user.name} vừa tạo đơn xin ${leaveType.toLowerCase()} (${diffDays} ngày: từ ${formatDate(leaveStartDate)} đến ${formatDate(leaveEndDate)}) (chờ ${step1Eng.name} duyệt bước 1)`,
          type: `leave_pending:::${step1Eng.id}:::${step1Eng.name}`,
          icon: 'event_busy',
          link: '/attendance?tab=leave',
        });
      } else {
        // Mặc định thông báo đến Ban Giám Đốc / Admin
        await addNotification({
          title: 'Đơn xin nghỉ phép mới',
          message: `${user.name} vừa tạo đơn xin ${leaveType.toLowerCase()} (${diffDays} ngày: từ ${formatDate(leaveStartDate)} đến ${formatDate(leaveEndDate)}) (chờ Ban Giám Đốc duyệt)`,
          type: highestLeader ? `leave_pending:::${highestLeader.id},admin:::${highestLeader.name},Lãnh đạo` : 'leave_pending:::admin:::Ban Giám Đốc',
          icon: 'event_busy',
          link: '/attendance?tab=leave',
        });
      }

      // Gửi thông báo cho những người theo dõi (Followers)
      if (followerIds.length > 0) {
        await addNotification({
          title: 'Thông báo nghỉ phép (Theo dõi)',
          message: `${user.name} đã tạo đơn xin ${leaveType.toLowerCase()} (${diffDays} ngày: từ ${formatDate(leaveStartDate)} đến ${formatDate(leaveEndDate)}). Bạn nhận thông báo này vì được thêm vào theo dõi.`,
          type: `leave_follower:::${followerIds.join(',')}:::${followerNames.join(',')}`,
          icon: 'visibility',
          link: '/attendance?tab=leave',
        });
      }
    } catch (e: any) {
      showToast('Lỗi tạo đơn xin nghỉ: ' + (e.message || 'Không thể tạo đơn'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleReviewLeave = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewLeave || !user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Xác định trạng thái mới dựa trên reviewStep
      let finalStatus: 'APPROVED_STEP1' | 'APPROVED' | 'REJECTED' = status;
      if (status === 'APPROVED') {
        if (reviewStep === 1) {
          // Quản lý duyệt bước 1 -> Luôn chuyển lên Quản trị / Ban Giám Đốc duyệt bước cuối
          finalStatus = 'APPROVED_STEP1';
        } else {
          // Quản trị / Ban Giám Đốc phê duyệt -> Hoàn tất đơn
          finalStatus = 'APPROVED';
        }
      }

      const reviewerDisplayName = isTechnicalAdminUser(user) ? highestRankDisplayName : (user.name || user.username || highestRankDisplayName);

      const updated = await api.leaves.review(reviewLeave.id, {
        status: finalStatus,
        reviewerId: user.id,
        reviewerName: reviewerDisplayName,
        reviewNote: reviewNote.trim() || undefined,
        step: reviewStep,
      });

      cachedLeaves = cachedLeaves.map(l => l.id === reviewLeave.id ? updated : l);
      setLeaves(prev => prev.map(l => l.id === reviewLeave.id ? updated : l));
      setReviewLeave(null);
      setReviewNote('');
      showToast(finalStatus === 'REJECTED' ? 'Đã từ chối đơn xin nghỉ.' : 'Đã xét duyệt đơn xin nghỉ thành công.', 'success');

      // Tiêu đề & nội dung & đối tượng nhận thông báo đích danh
      let notifTitle = '';
      let notifMsg = '';
      let notifType = '';

      if (finalStatus === 'APPROVED_STEP1') {
        // Quản lý đã duyệt bước 1 -> Mặc định gửi thông báo đến Lãnh đạo duyệt bước cuối và nhân viên
        notifTitle = 'Đơn nghỉ phép đã được Quản lý duyệt';
        notifMsg = `Đơn của ${reviewLeave.userName} đã được ${user.name} duyệt → Chờ Ban Giám Đốc phê duyệt cuối cùng.`;
        notifType = highestLeader
          ? `leave_step1_approved:::${highestLeader.id},admin,${reviewLeave.userId}:::${highestLeader.name},${reviewLeave.userName}`
          : `leave_step1_approved:::admin,${reviewLeave.userId}:::Ban Giám Đốc,${reviewLeave.userName}`;
      } else if (finalStatus === 'APPROVED') {
        // Phê duyệt hoàn tất -> Gửi đích danh cho nhân viên làm đơn
        notifTitle = 'Đơn nghỉ phép đã được PHÊ DUYỆT';
        notifMsg = `Đơn xin ${reviewLeave.leaveType.toLowerCase()} của bạn đã được phê duyệt chính thức bởi ${user.name}.`;
        notifType = `leave_approved:::${reviewLeave.userId}:::${reviewLeave.userName}`;
      } else {
        // Từ chối -> Gửi đích danh cho nhân viên làm đơn
        notifTitle = 'Đơn nghỉ phép bị TỪ CHỐI';
        notifMsg = `Đơn xin ${reviewLeave.leaveType.toLowerCase()} của bạn đã bị từ chối bởi ${user.name}. Lý do: ${reviewNote.trim() || 'Không có lý do cụ thể'}`;
        notifType = `leave_rejected:::${reviewLeave.userId}:::${reviewLeave.userName}`;
      }

      await addNotification({
        title: notifTitle,
        message: notifMsg,
        type: notifType,
        icon: finalStatus === 'REJECTED' ? 'cancel' : 'check_circle',
        link: '/attendance?tab=leave',
      });

      // Nếu đơn được duyệt hoàn tất và có người theo dõi, gửi thông báo cập nhật cho người theo dõi
      if (finalStatus === 'APPROVED' && reviewLeave.followerIds && reviewLeave.followerIds.length > 0) {
        await addNotification({
          title: 'Đơn nghỉ phép đã duyệt (Theo dõi)',
          message: `Đơn xin ${reviewLeave.leaveType.toLowerCase()} của ${reviewLeave.userName} (${reviewLeave.totalDays} ngày: từ ${formatDate(reviewLeave.startDate)} đến ${formatDate(reviewLeave.endDate)}) đã được phê duyệt.`,
          type: `leave_follower_approved:::${reviewLeave.followerIds.join(',')}:::${(reviewLeave.followerNames || []).join(',')}`,
          icon: 'event_available',
          link: '/attendance?tab=leave',
        });
      }
    } catch (e: any) {
      showToast('Lỗi duyệt đơn: ' + (e.message || 'Không thể duyệt đơn'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleDeleteLeave = (id: string) => {
    setDeleteLeaveId(id);
  };

  const handleConfirmDeleteLeave = async () => {
    if (!deleteLeaveId) return;
    try {
      await api.leaves.delete(deleteLeaveId);
      cachedLeaves = cachedLeaves.filter(l => l.id !== deleteLeaveId);
      setLeaves(prev => prev.filter(l => l.id !== deleteLeaveId));
      showToast('Đã xóa đơn nghỉ phép thành công.', 'info');
    } catch (e: any) {
      showToast('Lỗi xóa đơn: ' + (e.message || 'Không thể xóa đơn'), 'error');
    }
    setDeleteLeaveId(null);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const res = await uploadAttachment(file, 'attendance');
    return res.url;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setCheckInImage(url);
    } catch (err: any) {
      console.error('Upload failed', err);
      showToast('Lỗi tải ảnh: ' + (err.message || 'Không thể tải ảnh'), 'error');
    }
    e.target.value = '';
  };

  const handleCheckIn = async () => {
    if (!user || isSubmitting) return;

    if (!selectedProject) {
      showToast('Vui lòng chọn Dự án / Công trình cần chấm công!', 'warning');
      return;
    }

    const proj = projects.find(p => p.id === selectedProject || p.code === selectedProject);
    const hasProjectCoords = proj && proj.latitude !== undefined && proj.longitude !== undefined;
    
    // So sánh trực tiếp tọa độ vị trí hiện tại với dự án đã chọn
    let actualDistanceMeters = gpsData?.distanceMeters;
    let isWithinGeoRadius = true;
    let allowedRadius = proj?.radiusMeters || 500;

    if (hasProjectCoords && gpsData?.lat && gpsData?.lng) {
      actualDistanceMeters = calculateDistanceMeters(gpsData.lat, gpsData.lng, proj.latitude!, proj.longitude!);
      allowedRadius = proj.radiusMeters || 500;
      isWithinGeoRadius = actualDistanceMeters <= allowedRadius;
    }

    // 1. Kiểm tra GPS nếu ở chế độ bắt buộc (strict)
    if (attendanceConfig.gpsRequirement === 'strict') {
      if (isGpsScanning) {
        showToast('Đang quét tọa độ GPS, vui lòng đợi trong giây lát...', 'warning');
        return;
      }
      if (!gpsData) {
        showToast('Không thể xác định vị trí GPS của bạn để chấm công!', 'error');
        return;
      }
      if (hasProjectCoords && !isWithinGeoRadius) {
        showToast(`Bạn đang ở ngoài bán kính dự án (${formatDistance(actualDistanceMeters || 0)} / cho phép ≤ ${allowedRadius}m)!`, 'error');
        return;
      }
    }

    // 2. Kiểm tra bắt buộc chụp ảnh nếu được bật
    if (attendanceConfig.requirePhoto && !checkInImage) {
      showToast('Chính sách công ty bắt buộc chụp ảnh khuôn mặt khi chấm công!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const detectedWorkLocationType: 'office' | 'field' | 'remote' = 'field';

      const locationLabel = proj
        ? (proj.location ? `${proj.name} (${proj.location})` : proj.name)
        : (gpsData?.locationName || 'Công trình');

      const result = await api.attendance.checkIn({
        userId: user.id,
        userName: user.name || user.username || 'Unknown',
        projectId: selectedProject,
        projectName: proj?.name,
        checkInImage: checkInImage || undefined,
        notes: notes || undefined,
        attendanceType: 'time',
        workLocationType: detectedWorkLocationType,
        checkInLat: gpsData?.lat,
        checkInLng: gpsData?.lng,
        checkInLocationName: locationLabel,
        checkInDistanceMeters: actualDistanceMeters,
        checkInWithinRadius: isWithinGeoRadius,
      });

      cachedLogs = [result, ...cachedLogs];
      setLogs(prev => [result, ...prev]);
      setCheckInImage(null);
      setNotes('');
      setSelectedProject('');
      setGpsData(null);
      setWorkLocationType('office');
      setShowCheckInModal(false);
      showToast('Chấm công thành công!', 'success');

      // Gửi thông báo realtime chỉ đến admin
      await addNotification({
        title: 'Chấm công',
        message: `${user.name} đã chấm công tại ${proj?.name || 'dự án'} lúc ${formatTime(result.checkInTime)}${actualDistanceMeters !== undefined ? ` (${formatDistance(actualDistanceMeters)})` : ''}`,
        link: '/attendance?tab=attendance&view=all',
        type: 'attendance:::admin',
        icon: 'fingerprint',
      });
    } catch (e: any) {
      console.error('Attendance failed', e);
      showToast('Lỗi chấm công: ' + (e.message || 'Chấm công thất bại'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.attendance.delete(deleteId);
      cachedLogs = cachedLogs.filter(l => l.id !== deleteId);
      setLogs(prev => prev.filter(l => l.id !== deleteId));
    } catch (e) { console.error(e); }
    setDeleteId(null);
  };

  // Filter logs (0ms latency, lọc ngay trong bộ nhớ khi chuyển tab 'Của tôi' / 'Tất cả')
  const filteredLogs = React.useMemo(() => {
    let list = logs;
    if ((!canViewAll || tab === 'my') && user) {
      list = list.filter(l => {
        const matchId = String(l.userId || '') === String(user.id || '');
        const matchName = user.name && l.userName && l.userName.trim().toLowerCase() === user.name.trim().toLowerCase();
        return matchId || matchName;
      });
    }
    return list.filter(l => {
      if (filterDateFrom || filterDateTo) {
        const dObj = new Date(l.checkInTime);
        const logDate = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
        if (filterDateFrom && logDate < filterDateFrom) return false;
        if (filterDateTo && logDate > filterDateTo) return false;
      }
      if (filterUser) {
        const selectedEng = engineers.find(e => String(e.id) === String(filterUser) || String((e as any).username) === String(filterUser));
        const targetIds = new Set([
          String(filterUser).toLowerCase(),
          String(filterUser).replace(/^user-/, '').replace(/^eng-/, '').toLowerCase(),
          selectedEng?.id ? String(selectedEng.id).toLowerCase() : '',
          selectedEng?.id ? String(selectedEng.id).replace(/^user-/, '').replace(/^eng-/, '').toLowerCase() : '',
          (selectedEng as any)?.userId ? String((selectedEng as any).userId).toLowerCase() : '',
          selectedEng?.username ? String(selectedEng.username).toLowerCase() : ''
        ].filter(Boolean));

        const targetNames = new Set([
          selectedEng?.name ? String(selectedEng.name).trim().toLowerCase() : '',
          selectedEng?.username ? String(selectedEng.username).trim().toLowerCase() : '',
          selectedEng?.name ? normalizeStr(selectedEng.name) : ''
        ].filter(Boolean));

        const logUserId = String(l.userId || '').trim().toLowerCase();
        const logUserIdClean = logUserId.replace(/^user-/, '').replace(/^eng-/, '');
        const logUserName = String(l.userName || '').trim().toLowerCase();
        const logUserNorm = normalizeStr(l.userName);

        const matchId = targetIds.has(logUserId) || targetIds.has(logUserIdClean);
        const matchName = targetNames.has(logUserName) || targetNames.has(logUserNorm) || (selectedEng?.name && logUserName.includes(selectedEng.name.toLowerCase()));

        if (!matchId && !matchName) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchUser = l.userName?.toLowerCase().includes(q);
        const matchProject = l.projectName?.toLowerCase().includes(q);
        const matchNotes = l.notes?.toLowerCase().includes(q);
        const matchDate = formatDate(l.checkInTime)?.toLowerCase().includes(q);
        if (!matchUser && !matchProject && !matchNotes && !matchDate) return false;
      }
      return true;
    });
  }, [logs, tab, user, filterDateFrom, filterDateTo, filterUser, searchQuery, canViewAll, engineers]);

  const todayStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-100 overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-2 py-1.5 md:py-0 md:h-12 flex items-center justify-between gap-1.5 shrink-0 pr-14 sm:pr-16">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center border-l-4 border-primary pl-2">
            <h1 className="page-title text-xs sm:text-sm md:text-base font-extrabold text-slate-900 shrink-0">
              {mainTab === 'attendance' ? 'Chấm công' : mainTab === 'leave' ? 'Nghỉ phép' : 'Chấm công bù'}
            </h1>
          </div>

          {/* Sub-view switcher khi ở tab Chấm công: Bảng chấm công vs Nhật ký vào/ra */}
          {mainTab === 'attendance' && (
            <div className="hidden sm:flex items-center gap-0.5 bg-blue-50/80 p-0.5 rounded-lg border border-blue-200/80 text-xs ml-1 sm:ml-2">
              <button
                type="button"
                onClick={() => setAttendanceSubTab('timesheet')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  attendanceSubTab === 'timesheet'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Bảng tổng hợp chấm công tháng & Bảng lương"
              >
                <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                <span>Bảng chấm công</span>
              </button>
              <button
                type="button"
                onClick={() => setAttendanceSubTab('logs')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  attendanceSubTab === 'logs'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Nhật ký chi tiết các lượt Check-in/out GPS & Ảnh"
              >
                <span className="material-symbols-outlined text-[14px]">history</span>
                <span>Nhật ký vào/ra</span>
              </button>
            </div>
          )}
        </div>

        {/* Desktop-only Right controls (My/All switcher + Action Button) pushed to far right */}
        <div className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0">
          {/* Thanh công cụ chọn chế độ xem */}
          <ViewModeToolbar
            currentMode={viewMode}
            onModeChange={setAppViewMode}
            supportedModes={supportedAttendanceModes}
          />

          {canViewAll && (mainTab !== 'attendance' || attendanceSubTab === 'logs') && (
            <div className="inline-flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs shrink-0">
              <button
                onClick={() => setTab('my')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${tab === 'my' ? 'bg-white text-slate-900 shadow-xs font-bold ring-1 ring-slate-200/80' : 'text-slate-600 hover:text-slate-900'}`}
              >Của tôi</button>
              <button
                onClick={() => setTab('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${tab === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold ring-1 ring-slate-200/80' : 'text-slate-600 hover:text-slate-900'}`}
              >Tất cả</button>
            </div>
          )}

          {mainTab === 'attendance' ? (
            attendanceSubTab === 'timesheet' ? (
              <div className="flex items-center gap-2">
                {canViewAll && (
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(true)}
                    className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition-colors shrink-0 h-8 cursor-pointer shadow-xs active:scale-95"
                    title="Cài đặt hình thức chấm công (Theo ca / GPS / Thời gian)"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span className="hidden sm:inline">Cài đặt chấm công</span>
                  </button>
                )}

                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="flex items-center justify-center gap-1.5 px-2 sm:px-2.5 py-1 bg-primary hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-sm transition-colors shrink-0 h-8 cursor-pointer active:scale-95"
                  title="Chấm công"
                >
                  <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                  <span className="hidden sm:inline">Chấm công</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Desktop Date Filter for Attendance */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-1.5 py-0.5 bg-slate-50 shadow-xs h-8">
                    <span className="text-slate-400 font-medium whitespace-nowrap text-[11px] ml-0.5">Từ</span>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={e => setFilterDateFrom(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs w-[88px] text-slate-700 cursor-pointer"
                    />
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-400 font-medium whitespace-nowrap text-[11px]">Đến</span>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={e => setFilterDateTo(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs w-[88px] text-slate-700 cursor-pointer"
                    />
                    {(filterDateFrom || filterDateTo) && (
                      <button
                        type="button"
                        onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                        className="text-slate-400 hover:text-slate-600 px-0.5 text-xs font-bold"
                        title="Xóa lọc ngày"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* User filter if viewing all */}
                {canViewAll && tab === 'all' && (
                  <div className="hidden lg:flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-400 text-[18px]">person</span>
                    <CustomSelect value={filterUser} onChange={e => setFilterUser(e.target.value)}
                      searchable={true}
                      className="px-2.5 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50 min-w-[140px] h-8">
                      <option value="">Tất cả nhân viên</option>
                      {engineers.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </CustomSelect>
                  </div>
                )}

                {/* Desktop Search for Attendance */}
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-2 text-slate-400 text-sm pointer-events-none">search</span>
                  <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none h-8 w-24 md:w-28 lg:w-36 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  )}
                </div>

                {/* Export file for Attendance */}
                {filteredLogs.length > 0 && (
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="flex items-center justify-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-lg border border-emerald-200 transition-colors shadow-xs cursor-pointer h-8"
                      title="Xuất file"
                    >
                      <span className="material-symbols-outlined text-[15px]">file_download</span>
                      <span>Xuất file</span>
                      <span className="material-symbols-outlined text-xs">expand_more</span>
                    </button>
                    {showExportMenu && (
                      <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    )}
                    {showExportMenu && (
                      <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in duration-100">
                        <button
                          onClick={() => { setShowExportMenu(false); handleExportMonthlyTitsmart(); }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          title="Xuất bảng chấm công Excel theo mẫu TITSMART"
                        >
                          <span className="material-symbols-outlined text-base text-emerald-600">grid_on</span>
                          Excel (.xlsx)
                        </button>
                        <button
                          onClick={() => { setShowExportMenu(false); handleExportExcel('csv'); }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base text-teal-600">csv</span>
                          CSV (.csv)
                        </button>
                        <button
                          onClick={() => { setShowExportMenu(false); window.print(); }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base text-red-600">picture_as_pdf</span>
                          PDF (.pdf)
                        </button>
                        <button
                          onClick={() => { setShowExportMenu(false); handleExportExcel('docx'); }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base text-blue-600">description</span>
                          Word (.docx)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {canViewAll && (
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(true)}
                    className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition-colors shrink-0 h-8 cursor-pointer shadow-xs active:scale-95"
                    title="Cài đặt hình thức chấm công (Theo ca / GPS / Thời gian)"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span className="hidden sm:inline">Cài đặt chấm công</span>
                  </button>
                )}

                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="flex items-center justify-center gap-1.5 px-2 sm:px-2.5 py-1 bg-primary hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-sm transition-colors shrink-0 h-8 cursor-pointer active:scale-95"
                  title="Chấm công"
                >
                  <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                  <span className="hidden sm:inline">Chấm công</span>
                </button>
              </div>
            )
          ) : mainTab === 'leave' ? (
            <div className="flex items-center gap-2">
              {/* Desktop Date Filter for Leave */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-1.5 py-0.5 bg-slate-50 shadow-xs h-8">
                  <span className="text-slate-400 font-medium whitespace-nowrap text-[11px] ml-0.5">Từ</span>
                  <input
                    type="date"
                    value={leaveFilterDateFrom}
                    onChange={e => setLeaveFilterDateFrom(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs w-[88px] text-slate-700 cursor-pointer"
                  />
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-400 font-medium whitespace-nowrap text-[11px]">Đến</span>
                  <input
                    type="date"
                    value={leaveFilterDateTo}
                    onChange={e => setLeaveFilterDateTo(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs w-[88px] text-slate-700 cursor-pointer"
                  />
                  {(leaveFilterDateFrom || leaveFilterDateTo) && (
                    <button
                      type="button"
                      onClick={() => { setLeaveFilterDateFrom(''); setLeaveFilterDateTo(''); }}
                      className="text-slate-400 hover:text-slate-600 px-0.5 text-xs font-bold"
                      title="Xóa lọc ngày"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop Search for Leave */}
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-2 text-slate-400 text-sm pointer-events-none">search</span>
                <input
                  type="text"
                  placeholder="Tìm kiếm nghỉ phép..."
                  value={leaveSearchQuery}
                  onChange={e => setLeaveSearchQuery(e.target.value)}
                  className="pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none h-8 w-24 md:w-28 lg:w-40 transition-colors"
                />
                {leaveSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLeaveSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                )}
              </div>

              {leaves.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowLeaveExportMenu(!showLeaveExportMenu)}
                    className="flex items-center justify-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-lg border border-emerald-200 transition-colors shadow-xs cursor-pointer h-8"
                    title="Xuất file"
                  >
                    <span className="material-symbols-outlined text-[15px]">file_download</span>
                    <span>Xuất file</span>
                    <span className="material-symbols-outlined text-xs">expand_more</span>
                  </button>
                  {showLeaveExportMenu && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowLeaveExportMenu(false)} />
                  )}
                  {showLeaveExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in duration-100">
                      <button
                        onClick={() => { setShowLeaveExportMenu(false); handleExportLeavesExcel('xlsx'); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-green-600">grid_on</span>
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => { setShowLeaveExportMenu(false); handleExportLeavesExcel('csv'); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-teal-600">csv</span>
                        CSV (.csv)
                      </button>
                      <button
                        onClick={() => { setShowLeaveExportMenu(false); window.print(); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-red-600">picture_as_pdf</span>
                        PDF (.pdf)
                      </button>
                      <button
                        onClick={() => { setShowLeaveExportMenu(false); handleExportLeavesExcel('docx'); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-blue-600">description</span>
                        Word (.docx)
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => { setShowLeaveModal(true); setModalError(null); }}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1 bg-primary hover:bg-blue-800 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm transition-colors shrink-0 cursor-pointer active:scale-95 h-8"
                title="Tạo đơn xin nghỉ"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Tạo đơn xin nghỉ</span>
              </button>
            </div>
          ) : mainTab === 'adjustment' ? (
            <div className="flex items-center gap-1.5 lg:gap-2">
              {/* Desktop Filter Bar for Adjustment Tab */}
              <div className="flex items-center gap-1.5 lg:gap-2">
                <CustomSelect
                  value={adjTypeFilter}
                  onChange={e => setAdjTypeFilter(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none w-24 md:w-28 lg:w-32 h-8"
                >
                  <option value="">Tất cả loại bù</option>
                  <option value="Bù vào ca">Bù vào ca</option>
                  <option value="Bù ra ca">Bù ra ca</option>
                  <option value="Bù cả ngày">Bù cả ngày</option>
                </CustomSelect>

                <div className="hidden lg:flex items-center gap-1 border border-slate-200 rounded-lg px-1.5 py-0.5 bg-slate-50 shadow-xs h-8">
                  <span className="text-slate-400 font-medium whitespace-nowrap text-[11px] ml-0.5">Từ</span>
                  <input
                    type="date"
                    value={adjFilterDateFrom}
                    onChange={e => setAdjFilterDateFrom(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs w-[78px] xl:w-[88px] text-slate-700 cursor-pointer"
                  />
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-400 font-medium whitespace-nowrap text-[11px]">Đến</span>
                  <input
                    type="date"
                    value={adjFilterDateTo}
                    onChange={e => setAdjFilterDateTo(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs w-[78px] xl:w-[88px] text-slate-700 cursor-pointer"
                  />
                  {(adjFilterDateFrom || adjFilterDateTo) && (
                    <button type="button" onClick={() => { setAdjFilterDateFrom(''); setAdjFilterDateTo(''); }} className="text-slate-400 hover:text-slate-600 px-0.5 text-xs font-bold" title="Xóa lọc ngày">✕</button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-2 text-slate-400 text-sm pointer-events-none">search</span>
                  <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={adjSearchQuery}
                    onChange={e => setAdjSearchQuery(e.target.value)}
                    className="pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none h-8 w-20 md:w-24 lg:w-32 transition-colors"
                  />
                  {adjSearchQuery && (
                    <button type="button" onClick={() => setAdjSearchQuery('')} className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  )}
                </div>
              </div>

              {displayedAdjustments.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowAdjExportMenu(!showAdjExportMenu)}
                    className="flex items-center justify-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-lg border border-emerald-200 transition-colors shadow-xs cursor-pointer h-8"
                    title="Xuất file"
                  >
                    <span className="material-symbols-outlined text-[15px]">file_download</span>
                    <span className="hidden xl:inline">Xuất file</span>
                    <span className="material-symbols-outlined text-xs">expand_more</span>
                  </button>
                  {showAdjExportMenu && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowAdjExportMenu(false)} />
                  )}
                  {showAdjExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in duration-100">
                      <button
                        onClick={() => { setShowAdjExportMenu(false); handleExportAdjustmentsExcel('xlsx'); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-green-600">grid_on</span>
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => { setShowAdjExportMenu(false); handleExportAdjustmentsExcel('csv'); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-teal-600">csv</span>
                        CSV (.csv)
                      </button>
                      <button
                        onClick={() => { setShowAdjExportMenu(false); window.print(); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-red-600">picture_as_pdf</span>
                        PDF (.pdf)
                      </button>
                      <button
                        onClick={() => { setShowAdjExportMenu(false); handleExportAdjustmentsExcel('docx'); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-blue-600">description</span>
                        Word (.docx)
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowAdjModal(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1 bg-primary hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-sm transition-colors shrink-0 cursor-pointer active:scale-95 h-8 whitespace-nowrap"
                title="Tạo yêu cầu chấm công bù"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Tạo bù công</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {mainTab === 'attendance' ? (
        attendanceSubTab === 'timesheet' ? (
          /* BẢNG CHẤM CÔNG & LƯƠNG TRỰC TIẾP TRONG TAB CHẤM CÔNG */
          <div className="flex-1 w-full max-w-full overflow-y-auto bg-slate-50 flex flex-col">
            {/* Mobile sub-tab switcher for Attendance */}
            <div className="bg-white border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2 sm:hidden shrink-0">
              <div className="flex items-center gap-1 bg-blue-50/80 p-0.5 rounded-md border border-blue-200/80 text-xs">
                <button
                  type="button"
                  onClick={() => setAttendanceSubTab('timesheet')}
                  className="px-2.5 py-0.5 rounded font-bold text-xs bg-primary text-white shadow-xs"
                >
                  Bảng chấm công
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceSubTab('logs')}
                  className="px-2.5 py-0.5 rounded font-bold text-xs text-slate-600 hover:text-slate-900"
                >
                  Nhật ký vào/ra
                </button>
              </div>

              <button
                onClick={() => setShowCheckInModal(true)}
                className="flex items-center justify-center gap-1 px-2.5 py-1 bg-primary text-white font-bold text-xs rounded-lg shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">fingerprint</span>
                Chấm công
              </button>
            </div>

            <MonthlyPayrollTab
              logs={logs}
              leaves={leaves}
              adjustments={adjustments}
              showToast={showToast}
              isAdmin={isAdmin}
            />
          </div>
        ) : (
          <div className="flex-1 w-full max-w-full overflow-hidden flex flex-col bg-slate-50">
            {/* Mobile sub-tab switcher for Attendance */}
            <div className="bg-white border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2 sm:hidden shrink-0">
              <div className="flex items-center gap-1 bg-blue-50/80 p-0.5 rounded-md border border-blue-200/80 text-xs">
                <button
                  type="button"
                  onClick={() => setAttendanceSubTab('timesheet')}
                  className="px-2.5 py-0.5 rounded font-bold text-xs text-slate-600 hover:text-slate-900"
                >
                  Bảng chấm công
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceSubTab('logs')}
                  className="px-2.5 py-0.5 rounded font-bold text-xs bg-primary text-white shadow-xs"
                >
                  Nhật ký vào/ra
                </button>
              </div>
            </div>

            {/* Check-in / Check-out & Search Bar (Mobile only) */}
          <div className="bg-white border-b border-slate-200 shadow-xs shrink-0 md:hidden">
            <div className="px-3 py-2 sm:px-4 sm:py-2 flex items-center justify-between gap-2">
              {canViewAll ? (
                <div className="inline-flex md:hidden items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs font-bold shrink-0">
                  <button
                    onClick={() => setTab('my')}
                    className={`px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-md text-[10px] sm:text-xs transition-all ${tab === 'my' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                  >Của tôi</button>
                  <button
                    onClick={() => setTab('all')}
                    className={`px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-md text-[10px] sm:text-xs transition-all ${tab === 'all' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                  >Tất cả</button>
                </div>
              ) : <div />}

              {canViewAll && (
                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  className="flex items-center justify-center p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 transition-colors shrink-0 h-8 cursor-pointer active:scale-95"
                  title="Cài đặt hình thức chấm công"
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                </button>
              )}

              <button
                onClick={() => setShowCheckInModal(true)}
                className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1 bg-primary hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-sm transition-colors shrink-0 h-8 cursor-pointer active:scale-95"
                title="Chấm công"
              >
                <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                <span className="hidden sm:inline">Chấm công</span>
              </button>
            </div>

            {/* Mobile Search Filter */}
            <div className="px-3 pb-2 flex items-center gap-2">
              <div className="flex-1 relative items-center min-w-0">
                <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-sm pointer-events-none">search</span>
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none h-8 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Attendance Table Area */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white">
            <PullToRefresh
              onRefresh={async () => {
                await Promise.all([fetchLogs(true), fetchLeaves(true)]);
              }}
              className="flex-1"
            >
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Đang tải lịch sử chấm công...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Chưa có bản ghi chấm công nào.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase sticky top-0 z-10 text-[10px] sm:text-xs">
                      <th className="px-2 py-2 sm:p-3 leading-tight break-words">Nhân viên</th>
                      <th className="px-2 py-2 sm:p-3 leading-tight break-words">Hình thức / Ca</th>
                      <th className="px-2 py-2 sm:p-3 leading-tight break-words">Thời gian</th>
                      <th className="px-2 py-2 sm:p-3 leading-tight break-words">Vị trí GPS</th>
                      <th className="px-2 py-2 sm:p-3 leading-tight break-words">Dự án</th>
                      <th className="px-2 py-2 sm:p-3 leading-tight break-words">Ghi chú</th>
                      <th className="px-2 py-2 sm:p-3 text-center leading-tight break-words">Hình ảnh</th>
                      {isAdmin && <th className="px-2 py-2 sm:p-3 text-center w-10 sm:w-12 leading-tight">TT</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-800">{log.userName}</td>
                        <td className="p-3 whitespace-nowrap">
                          {log.shiftName ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 text-xs">{log.shiftName}</span>
                              {log.shiftStatus === 'late' && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Trễ {log.shiftLateMinutes || ''}p
                                </span>
                              )}
                              {log.shiftStatus === 'on_time' && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Đúng giờ
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 font-medium text-xs">Theo giờ</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-700 font-medium whitespace-nowrap">
                          {formatDateTime(log.checkInTime)}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {log.checkInLat && log.checkInLng ? (
                            <a
                              href={getGoogleMapsLink(log.checkInLat, log.checkInLng)}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                log.workLocationType === 'field'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                  : log.workLocationType === 'remote'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                                  : log.checkInWithinRadius === false
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                              title={`Xem vị trí trên Google Maps (${log.checkInLocationName || ''} - Cách VP ${formatDistance(log.checkInDistanceMeters)})`}
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {log.workLocationType === 'field' ? 'foundation' : log.workLocationType === 'remote' ? 'commute' : 'location_on'}
                              </span>
                              <span>
                                {log.workLocationType === 'field'
                                  ? '🏗️ Công trường'
                                  : log.workLocationType === 'remote'
                                  ? '🚗 Công tác'
                                  : `${formatDistance(log.checkInDistanceMeters)} ${log.checkInWithinRadius === false ? '(Ngoài BK)' : ''}`}
                              </span>
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 max-w-[200px] truncate" title={log.projectName}>
                          {log.projectName || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="p-3 text-slate-600 max-w-[200px] truncate" title={log.notes}>
                          {log.notes || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {log.checkInImage || log.checkOutImage ? (
                            <button
                              onClick={() => setViewImage(log.checkInImage || log.checkOutImage || null)}
                              className="inline-flex items-center gap-1 text-primary hover:text-blue-700 transition-colors bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-[11px] font-bold cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[13px]">image</span>
                              <span>Xem ảnh</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-center whitespace-nowrap">
                            <button onClick={() => setDeleteId(log.id)} className="w-7 h-7 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </PullToRefresh>
          </div>
        </div>
        )
      ) : mainTab === 'leave' ? (
        /* Tab Xin nghỉ phép */
        <div className="flex-1 w-full max-w-full overflow-hidden flex flex-col bg-slate-50">
          {/* Mobile-only Toolbar Bar (On Desktop, controls are neatly in the top header) */}
          <div className="md:hidden px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0 shadow-xs relative z-10">
            {canViewAll ? (
              <div className="inline-flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs font-bold shrink-0">
                <button
                  onClick={() => setTab('my')}
                  className={`px-2 py-0.5 rounded-md text-[10px] transition-all ${tab === 'my' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                >Của tôi</button>
                <button
                  onClick={() => setTab('all')}
                  className={`px-2 py-0.5 rounded-md text-[10px] transition-all ${tab === 'all' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                >Tất cả</button>
              </div>
            ) : null}



            {/* Mobile Search Bar in Leave Tab */}
            <div className="flex-1 relative flex items-center min-w-0">
              <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-sm pointer-events-none">search</span>
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={leaveSearchQuery}
                onChange={e => setLeaveSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none h-8 transition-colors"
              />
              {leaveSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLeaveSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {leaves.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowLeaveExportMenu(!showLeaveExportMenu)}
                    className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg border border-emerald-200 transition-colors shadow-xs cursor-pointer"
                    title="Xuất file"
                  >
                    <span className="material-symbols-outlined text-[17px]">file_download</span>
                  </button>
                  {showLeaveExportMenu && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowLeaveExportMenu(false)} />
                  )}
                  {showLeaveExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in duration-100">
                      <button
                        onClick={() => { setShowLeaveExportMenu(false); handleExportLeavesExcel('xlsx'); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-green-600">grid_on</span>
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => { setShowLeaveExportMenu(false); handleExportLeavesExcel('csv'); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-teal-600">csv</span>
                        CSV (.csv)
                      </button>
                      <button
                        onClick={() => { setShowLeaveExportMenu(false); window.print(); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-red-600">picture_as_pdf</span>
                        PDF (.pdf)
                      </button>
                      <button
                        onClick={() => { setShowLeaveExportMenu(false); handleExportLeavesExcel('docx'); }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-blue-600">description</span>
                        Word (.docx)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Add Leave Button (Mobile only: icon-only) */}
              <button
                onClick={() => { setShowLeaveModal(true); setModalError(null); }}
                className="w-8 h-8 flex items-center justify-center bg-primary hover:bg-blue-800 text-white font-bold rounded-lg shadow-xs transition-all shrink-0 active:scale-95 cursor-pointer"
                title="Tạo đơn xin nghỉ"
              >
                <span className="material-symbols-outlined text-[19px]">add</span>
              </button>
            </div>
          </div>

          <PullToRefresh
            onRefresh={async () => {
              await Promise.all([fetchLeaves(true), fetchLogs(true)]);
            }}
            className="flex-1 bg-slate-50 md:bg-white flex flex-col"
          >
            {/* Widget Thống kê Quỹ Phép Năm & Tình hình Bù trừ Lũy kế - Dạng Toolbar phẳng đồng bộ TITSmart */}
            {myLeaveBalance && (
              <div className="mx-3 sm:mx-6 py-2 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Chọn Nhân viên nếu ở tab Tất cả */}
                  {canViewAll && tab === 'all' && (
                    <div className="w-36">
                      <CustomSelect
                        value={leaveSelectedUser}
                        onChange={e => setLeaveSelectedUser(e.target.value)}
                        className="px-2 py-0.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50 outline-none h-7"
                      >
                        <option value="me">👤 {user?.name}</option>
                        {engineers.map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </CustomSelect>
                    </div>
                  )}
                </div>

                {/* Dải Badges số liệu nằm ngang cực kỳ gọn gàng */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Lũy kế:</span>
                    <span>{myLeaveBalance.totalAccruedToDate} / 12</span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                    <span className="text-[10px] text-emerald-600 font-semibold uppercase">Đã dùng:</span>
                    <span>{myLeaveBalance.totalPaidLeaveUsed} ngày</span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
                    <span className="text-[10px] text-blue-600 font-semibold uppercase">Khả dụng:</span>
                    <span>{myLeaveBalance.currentRemainingLeave} ngày</span>
                  </div>

                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    myLeaveBalance.totalUnpaidLeave > 0
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    <span className="text-[10px] opacity-75 font-semibold uppercase">Vắng (V):</span>
                    <span>{myLeaveBalance.totalUnpaidLeave} ngày</span>
                  </div>
                </div>
              </div>
            )}
            {leavesLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span className="text-xs font-semibold text-slate-500">Đang tải danh sách nghỉ phép...</span>
              </div>
            ) : displayedLeaves.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-4xl text-slate-300">event_busy</span>
                <span>Chưa có đơn xin nghỉ phép nào.</span>
              </div>
            ) : (
              <>
                {/* Mobile View: Cards */}
                <div className="block md:hidden p-3 space-y-2.5">
                  {displayedLeaves.map((l, idx) => {
                    const isMatch = Boolean(highlightLeaveId && l.id === highlightLeaveId);
                    const { canReviewStep1, canReviewStep2 } = checkCanReviewLeave(l);

                    return (
                      <div
                        key={l.id}
                        onClick={() => setIsHighlightActive(false)}
                        className={`p-3.5 bg-white rounded-xl border transition-all shadow-2xs space-y-2.5 ${
                          isMatch
                            ? 'bg-amber-100/60 border-amber-400 font-medium'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800">{l.userName}</h4>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {formatDate(l.startDate)} → {formatDate(l.endDate)} ({l.totalDays} ngày{l.session === 'MORNING' ? ' • Sáng' : l.session === 'AFTERNOON' ? ' • Chiều' : ''})
                              </p>
                            </div>
                          </div>
                          <div>
                            {l.status === 'PENDING_STEP1' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Chờ Quản lý duyệt
                              </span>
                            )}
                            {l.status === 'PENDING' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {l.step1ReviewerId ? 'Chờ Quản lý duyệt' : 'Chờ Lãnh đạo duyệt'}
                              </span>
                            )}
                            {l.status === 'APPROVED_STEP1' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                Quản lý đã duyệt • Chờ Lãnh đạo
                              </span>
                            )}
                            {l.status === 'APPROVED' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Đã duyệt hoàn tất
                              </span>
                            )}
                            {l.status === 'REJECTED' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">
                                Từ chối
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="font-semibold text-slate-500">Loại nghỉ:</span>
                            <span className="font-bold text-slate-800">{l.leaveType}</span>
                          </div>
                          <div className="text-slate-600">
                            <span className="font-semibold text-slate-500">Lý do: </span>
                            <span>{l.reason}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200/60 text-[11px]">
                            <div>
                              <span className="text-slate-400 font-semibold block">Quản lý duyệt:</span>
                              {l.step1ReviewerName ? (
                                <div>
                                  <span className="font-bold text-slate-700">{l.step1ReviewerName}</span>
                                  {l.step1ReviewedAt ? (
                                    <span className="ml-1 text-[10px] font-bold text-emerald-600">✓ Đã duyệt</span>
                                  ) : (
                                    <span className="ml-1 text-[10px] text-amber-600">(Đang chờ)</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">Lãnh đạo duyệt:</span>
                              {l.step2ReviewerName || (l.reviewerName && !l.step1ReviewerName) ? (
                                <div>
                                  <span className="font-bold text-slate-700">{getStep2ReviewerDisplayName(l.step2ReviewerName || l.reviewerName)}</span>
                                  {l.status === 'APPROVED' ? (
                                    <span className="ml-1 text-[10px] font-bold text-emerald-600">✓ Đã duyệt</span>
                                  ) : (
                                    <span className="ml-1 text-[10px] text-slate-400">(Chờ duyệt)</span>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <span className="font-semibold text-slate-700">{highestRankDisplayName}</span>
                                  {l.status === 'APPROVED' ? (
                                    <span className="ml-1 text-[10px] font-bold text-emerald-600">✓ Đã duyệt</span>
                                  ) : l.status === 'APPROVED_STEP1' ? (
                                    <span className="ml-1 text-[10px] font-bold text-amber-600">(Chờ duyệt)</span>
                                  ) : (
                                    <span className="ml-1 text-[10px] text-slate-400 italic">—</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {l.followerNames && l.followerNames.length > 0 && (
                            <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px] text-primary">visibility</span>
                                <span>Người theo dõi:</span>
                              </span>
                              <span className="font-bold text-primary truncate max-w-[200px]">
                                {l.followerNames.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Thao tác trên Mobile */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          {canReviewStep1 && (
                            <>
                              <button
                                onClick={() => { setReviewLeave(l); setReviewStep(1); setReviewAction('APPROVE'); setReviewNote(''); }}
                                className="px-3 py-1.5 bg-blue-50 text-primary hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
                                title="Quản lý duyệt"
                              >
                                Duyệt
                              </button>
                              <button
                                onClick={() => { setReviewLeave(l); setReviewStep(1); setReviewAction('REJECT'); setReviewNote(''); }}
                                className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold border border-rose-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
                                title="Quản lý không duyệt"
                              >
                                Không duyệt
                              </button>
                            </>
                          )}
                          {canReviewStep2 && (
                            <>
                              <button
                                onClick={() => { setReviewLeave(l); setReviewStep(2); setReviewAction('APPROVE'); setReviewNote(''); }}
                                className="px-3 py-1.5 bg-primary text-white hover:bg-blue-800 rounded-lg text-xs font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
                                title="Lãnh đạo duyệt"
                              >
                                Duyệt
                              </button>
                              <button
                                onClick={() => { setReviewLeave(l); setReviewStep(2); setReviewAction('REJECT'); setReviewNote(''); }}
                                className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold border border-rose-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
                                title="Lãnh đạo không duyệt"
                              >
                                Không duyệt
                              </button>
                            </>
                          )}
                          {(isAdmin || l.userId === user?.id || (user?.username && l.userName === user.name)) && (
                            <button
                              onClick={() => handleDeleteLeave(l.id)}
                              className="w-7 h-7 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Xóa đơn"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase sticky top-0 z-10">
                        <th className="p-3">Nhân viên</th>
                        <th className="p-3">Loại nghỉ</th>
                        <th className="p-3">Thời gian nghỉ</th>
                        <th className="p-3 text-center">Số ngày</th>
                        <th className="p-3 min-w-[200px] max-w-[320px]">Lý do</th>
                        <th className="p-3">Người theo dõi</th>
                        <th className="p-3 text-center">Trạng thái</th>
                        <th className="p-3">Quản lý duyệt</th>
                        <th className="p-3">Lãnh đạo duyệt</th>
                        <th className="p-3 text-center w-24">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedLeaves.map((l) => {
                        const isMatch = Boolean(highlightLeaveId && l.id === highlightLeaveId);
                        const { canReviewStep1, canReviewStep2 } = checkCanReviewLeave(l);

                        return (
                        <tr 
                          key={l.id} 
                          onClick={() => setIsHighlightActive(false)}
                          className={`transition-colors ${
                            isMatch
                              ? 'highlighted-leave-row bg-amber-100/60 hover:bg-amber-100/80 border-l-4 border-l-amber-500 border-y border-amber-300/70 ring-1 ring-inset ring-amber-300/50 font-medium'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-3 font-bold text-slate-800">{l.userName}</td>
                          <td className="p-3 font-semibold text-slate-700">{l.leaveType}</td>
                          <td className="p-3 whitespace-nowrap text-slate-700">
                            {formatDate(l.startDate)} → {formatDate(l.endDate)}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span className="font-bold text-slate-800">{l.totalDays} ngày</span>
                            {l.session === 'MORNING' && (
                              <span className="block text-[10px] font-bold text-amber-700 bg-amber-50 rounded px-1 mt-0.5 border border-amber-200">Sáng</span>
                            )}
                            {l.session === 'AFTERNOON' && (
                              <span className="block text-[10px] font-bold text-blue-700 bg-blue-50 rounded px-1 mt-0.5 border border-blue-200">Chiều</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700 min-w-[200px] max-w-[320px] whitespace-normal break-words leading-relaxed">
                            {l.reason}
                          </td>
                          {/* Cột Người theo dõi */}
                          <td className="p-3 text-slate-600 max-w-[160px]">
                            {l.followerNames && l.followerNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1" title={l.followerNames.join(', ')}>
                                {l.followerNames.map((fn, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-primary border border-blue-200/80 rounded-md text-[10px] font-medium"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">person</span>
                                    <span className="truncate max-w-[100px]">{fn}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {l.status === 'PENDING_STEP1' && (
                              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Chờ Quản lý duyệt
                              </span>
                            )}
                            {l.status === 'PENDING' && (
                              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {l.step1ReviewerId ? 'Chờ Quản lý duyệt' : 'Chờ Lãnh đạo duyệt'}
                              </span>
                            )}
                            {l.status === 'APPROVED_STEP1' && (
                              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                Quản lý đã duyệt • Chờ Lãnh đạo
                              </span>
                            )}
                            {l.status === 'APPROVED' && (
                              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Đã duyệt hoàn tất
                              </span>
                            )}
                            {l.status === 'REJECTED' && (
                              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-red-50 text-red-800 border border-red-200">
                                Từ chối
                              </span>
                            )}
                          </td>
                          {/* Cột Quản lý */}
                          <td className="p-3 text-slate-600">
                            {l.step1ReviewerName ? (
                              <div>
                                <span className="font-bold text-slate-800">{l.step1ReviewerName}</span>
                                {l.step1ReviewedAt ? (
                                  <span className="ml-1 text-[10px] font-bold text-emerald-600">✓ Đã duyệt</span>
                                ) : l.status === 'REJECTED' ? (
                                  <span className="ml-1 text-[10px] font-bold text-red-600">✗ Từ chối</span>
                                ) : (
                                  <span className="ml-1 text-[10px] font-medium text-amber-600">(Đang chờ)</span>
                                )}
                                {l.step1ReviewNote && <p className="text-[11px] text-slate-500 italic truncate max-w-[150px]" title={l.step1ReviewNote}>{l.step1ReviewNote}</p>}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          {/* Cột Lãnh đạo duyệt */}
                          <td className="p-3 text-slate-600">
                            {l.step2ReviewerName || (l.reviewerName && !l.step1ReviewerName) ? (
                              <div>
                                <span className="font-bold text-slate-800">{getStep2ReviewerDisplayName(l.step2ReviewerName || l.reviewerName)}</span>
                                {l.status === 'APPROVED' ? (
                                  <span className="ml-1 text-[10px] font-bold text-emerald-600">✓ Phê duyệt</span>
                                ) : l.status === 'REJECTED' && !l.step1ReviewedAt ? (
                                  <span className="ml-1 text-[10px] font-bold text-red-600">✗ Từ chối</span>
                                ) : (
                                  <span className="ml-1 text-[10px] font-medium text-slate-400">(Chờ duyệt)</span>
                                )}
                                {(l.step2ReviewNote || l.reviewNote) && <p className="text-[11px] text-slate-500 italic truncate max-w-[150px]" title={l.step2ReviewNote || l.reviewNote}>{l.step2ReviewNote || l.reviewNote}</p>}
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-slate-700">{highestRankDisplayName}</span>
                                {l.status === 'APPROVED_STEP1' ? (
                                  <span className="ml-1 text-[10px] font-bold text-amber-600 animate-pulse">(Chờ duyệt)</span>
                                ) : l.status === 'APPROVED' ? (
                                  <span className="ml-1 text-[10px] font-bold text-emerald-600">✓ Đã duyệt</span>
                                ) : (
                                  <span className="ml-1 text-[10px] text-slate-400 italic">—</span>
                                )}
                              </div>
                            )}
                          </td>
                          {/* Thao tác */}
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {canReviewStep1 && (
                                <>
                                  <button
                                    onClick={() => { setReviewLeave(l); setReviewStep(1); setReviewAction('APPROVE'); setReviewNote(''); }}
                                    className="px-2.5 py-1 bg-blue-50 text-primary hover:bg-blue-100 rounded text-[11px] font-bold border border-blue-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
                                    title="Quản lý duyệt đơn"
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    onClick={() => { setReviewLeave(l); setReviewStep(1); setReviewAction('REJECT'); setReviewNote(''); }}
                                    className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[11px] font-bold border border-rose-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
                                    title="Quản lý không duyệt / từ chối"
                                  >
                                    Không duyệt
                                  </button>
                                </>
                              )}
                              {canReviewStep2 && (
                                <>
                                  <button
                                    onClick={() => { setReviewLeave(l); setReviewStep(2); setReviewAction('APPROVE'); setReviewNote(''); }}
                                    className="px-2.5 py-1 bg-primary text-white hover:bg-blue-800 rounded text-[11px] font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
                                    title="Lãnh đạo phê duyệt đơn"
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    onClick={() => { setReviewLeave(l); setReviewStep(2); setReviewAction('REJECT'); setReviewNote(''); }}
                                    className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[11px] font-bold border border-rose-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
                                    title="Lãnh đạo không duyệt / từ chối"
                                  >
                                    Không duyệt
                                  </button>
                                </>
                              )}
                              {(isAdmin || l.userId === user?.id || (user?.username && l.userName === user.name)) && (
                                <button
                                  onClick={() => handleDeleteLeave(l.id)}
                                  className="w-7 h-7 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Xóa đơn"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </PullToRefresh>
        </div>
      ) : mainTab === 'adjustment' ? (
        /* Tab Chấm công bù */
        <div className="flex-1 w-full max-w-full overflow-hidden flex flex-col bg-slate-50">
          {/* Mobile-only Toolbar Bar */}
          <div className="md:hidden px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0 shadow-xs relative z-10">
            {canViewAll ? (
              <div className="inline-flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs font-bold shrink-0">
                <button
                  onClick={() => setTab('my')}
                  className={`px-2 py-0.5 rounded-md text-[10px] transition-all ${tab === 'my' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                >Của tôi</button>
                <button
                  onClick={() => setTab('all')}
                  className={`px-2 py-0.5 rounded-md text-[10px] transition-all ${tab === 'all' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                >Tất cả</button>
              </div>
            ) : null}

            {/* Mobile Search Bar in Adjustment Tab */}
            <div className="flex-1 relative flex items-center min-w-0">
              <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-sm pointer-events-none">search</span>
              <input
                type="text"
                placeholder="Tìm kiếm bù công..."
                value={adjSearchQuery}
                onChange={e => setAdjSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none h-8 transition-colors"
              />
              {adjSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAdjSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setShowAdjModal(true)}
              className="w-8 h-8 flex items-center justify-center bg-primary hover:bg-blue-800 text-white font-bold rounded-lg shadow-xs transition-all shrink-0 active:scale-95 cursor-pointer"
              title="Tạo yêu cầu chấm công bù"
            >
              <span className="material-symbols-outlined text-[19px]">add</span>
            </button>
          </div>



          {/* Adjustment List / Table Area */}
          <PullToRefresh
            onRefresh={async () => {
              await Promise.all([fetchAdjustments(), fetchLogs(true)]);
            }}
            className="flex-1 bg-slate-50 md:bg-white"
          >
            {displayedAdjustments.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-4xl text-slate-300">edit_calendar</span>
                <span>Chưa có yêu cầu chấm công bù nào.</span>
              </div>
            ) : (
              <>
                {/* Mobile View Cards */}
                <div className="block md:hidden p-3 space-y-2.5">
                  {displayedAdjustments.map(adj => {
                    const { canReview1, canReview2 } = checkCanReviewAdj(adj);

                    return (
                      <div key={adj.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900 text-xs">{adj.userName}</span>
                            <span className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">{adj.adjustmentType}</span>
                          </div>
                          {adj.status === 'PENDING_STEP1' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Chờ Quản lý</span>}
                          {adj.status === 'PENDING' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Chờ duyệt</span>}
                          {adj.status === 'APPROVED_STEP1' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">QL đã duyệt</span>}
                          {adj.status === 'APPROVED' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Đã duyệt hoàn tất</span>}
                          {adj.status === 'REJECTED' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">Từ chối</span>}
                        </div>

                        <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <p><strong className="text-slate-700">Ngày tạo:</strong> <span className="text-blue-600 font-semibold">{formatDateTime(adj.createdAt)}</span></p>
                          <p><strong className="text-slate-700">Ngày bù:</strong> {formatDate(adj.adjustmentDate)}</p>
                          {adj.checkInTime && <p><strong className="text-slate-700">Giờ vào:</strong> {formatTime(adj.checkInTime)}</p>}
                          {adj.checkOutTime && <p><strong className="text-slate-700">Giờ ra:</strong> {formatTime(adj.checkOutTime)}</p>}
                          {adj.projectName && <p><strong className="text-slate-700">Dự án:</strong> {adj.projectName}</p>}
                          <p><strong className="text-slate-700">Lý do:</strong> {adj.reason}</p>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <span className="text-slate-400">Tạo: {formatDate(adj.createdAt)}</span>
                          <div className="flex items-center gap-1.5">
                            {canReview1 && (
                              <button
                                onClick={() => { setReviewAdj(adj); setReviewAdjStep(1); setReviewAdjNote(''); }}
                                className="px-2.5 py-1 bg-blue-50 text-primary font-bold rounded border border-blue-200 text-xs"
                              >
                                QL Duyệt
                              </button>
                            )}
                            {canReview2 && (
                              <button
                                onClick={() => { setReviewAdj(adj); setReviewAdjStep(2); setReviewAdjNote(''); }}
                                className="px-2.5 py-1 bg-primary text-white font-bold rounded text-xs"
                              >
                                Duyệt
                              </button>
                            )}
                            {(isAdmin || adj.userId === user?.id) && (
                              <button onClick={() => setDeleteAdjId(adj.id)} className="p-1 text-slate-400 hover:text-red-500">
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View Table: Full Width tràn viền giống Nghỉ phép */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase sticky top-0 z-10 text-[10px]">
                        <th className="p-3 w-40 whitespace-nowrap">Nhân viên</th>
                        <th className="p-3 w-28 whitespace-nowrap">Loại bù</th>
                        <th className="p-3 w-32 whitespace-nowrap">Ngày tạo</th>
                        <th className="p-3 w-28 whitespace-nowrap">Ngày cần bù</th>
                        <th className="p-3 w-32 whitespace-nowrap">Giờ vào/ra</th>
                        <th className="p-3 w-36 whitespace-nowrap">Dự án</th>
                        <th className="p-3 min-w-[160px]">Lý do giải trình</th>
                        <th className="p-3 text-center w-36 whitespace-nowrap">Trạng thái</th>
                        <th className="p-3 w-36 whitespace-nowrap">Quản lý duyệt</th>
                        <th className="p-3 w-36 whitespace-nowrap">Ban Giám Đốc</th>
                        <th className="p-3 text-center w-28 whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedAdjustments.map(adj => {
                        const { canReview1, canReview2 } = checkCanReviewAdj(adj);

                        return (
                          <tr key={adj.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-bold text-slate-900">{adj.userName}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                {adj.adjustmentType}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 whitespace-nowrap font-medium text-[11px]">
                              {formatDateTime(adj.createdAt)}
                            </td>
                            <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{formatDate(adj.adjustmentDate)}</td>
                            <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                              {adj.checkInTime ? formatTime(adj.checkInTime) : '—'}
                              {' → '}
                              {adj.checkOutTime ? formatTime(adj.checkOutTime) : '—'}
                            </td>
                            <td className="p-3 text-slate-600 max-w-[150px] truncate" title={adj.projectName}>{adj.projectName || '—'}</td>
                            <td className="p-3 text-slate-600 max-w-[200px] truncate" title={adj.reason}>{adj.reason}</td>
                            <td className="p-3 text-center whitespace-nowrap">
                              {adj.status === 'PENDING_STEP1' && <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Chờ Quản lý duyệt</span>}
                              {adj.status === 'PENDING' && <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Chờ duyệt</span>}
                              {adj.status === 'APPROVED_STEP1' && <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">Quản lý đã duyệt • Chờ BGD</span>}
                              {adj.status === 'APPROVED' && <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Đã duyệt hoàn tất</span>}
                              {adj.status === 'REJECTED' && <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">Từ chối</span>}
                            </td>
                            <td className="p-3 text-slate-600">
                              {adj.step1ReviewerName ? (
                                <div>
                                  <span className="font-bold text-slate-800">{adj.step1ReviewerName}</span>
                                  {adj.step1ReviewedAt ? <span className="ml-1 text-[10px] font-bold text-emerald-600">✓ Đã duyệt</span> : <span className="ml-1 text-[10px] text-amber-600">(Đang chờ)</span>}
                                  {adj.step1ReviewNote && <p className="text-[11px] text-slate-500 italic truncate max-w-[130px]">{adj.step1ReviewNote}</p>}
                                </div>
                              ) : <span className="text-slate-400 italic">—</span>}
                            </td>
                            <td className="p-3 text-slate-600">
                              {adj.step2ReviewerName ? (
                                <div>
                                  <span className="font-bold text-slate-800">{getStep2ReviewerDisplayName(adj.step2ReviewerName)}</span>
                                  {adj.status === 'APPROVED' ? <span className="ml-1 text-[10px] font-bold text-emerald-600">✓ Phê duyệt</span> : <span className="ml-1 text-[10px] text-slate-400">(Chờ)</span>}
                                  {adj.step2ReviewNote && <p className="text-[11px] text-slate-500 italic truncate max-w-[130px]">{adj.step2ReviewNote}</p>}
                                </div>
                              ) : <span className="text-slate-400 italic">—</span>}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {canReview1 && (
                                  <button
                                    onClick={() => { setReviewAdj(adj); setReviewAdjStep(1); setReviewAdjNote(''); }}
                                    className="px-2 py-1 bg-blue-50 text-primary hover:bg-blue-100 rounded text-[11px] font-bold border border-blue-200 cursor-pointer"
                                  >QL Duyệt</button>
                                )}
                                {canReview2 && (
                                  <button
                                    onClick={() => { setReviewAdj(adj); setReviewAdjStep(2); setReviewAdjNote(''); }}
                                    className="px-2 py-1 bg-primary text-white hover:bg-blue-800 rounded text-[11px] font-bold cursor-pointer"
                                  >Duyệt</button>
                                )}
                                {(isAdmin || adj.userId === user?.id) && (
                                  <button onClick={() => setDeleteAdjId(adj.id)} className="w-7 h-7 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </PullToRefresh>
        </div>
      ) : mainTab === 'payroll' ? (
        /* Tab Bảng công & Lương (Ký xác nhận) */
        <div className="flex-1 w-full max-w-full overflow-y-auto bg-slate-50">
          <MonthlyPayrollTab
            logs={logs}
            leaves={leaves}
            adjustments={adjustments}
            showToast={showToast}
            isAdmin={isAdmin}
          />
        </div>
      ) : null}

      {/* Modal Tạo yêu cầu chấm công bù */}
      <Modal isOpen={showAdjModal} onClose={() => setShowAdjModal(false)} title="Tạo yêu cầu chấm công bù" icon="edit_calendar" size="lg">
        <div className="space-y-4 py-2">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">error</span>
              <span className="font-semibold">{modalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Loại chấm công bù</label>
              <CustomSelect value={adjType} onChange={e => setAdjType(e.target.value as AttendanceAdjustmentType)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                <option value="Bù vào ca">Bù vào ca (Quên check-in đầu ca)</option>
                <option value="Bù ra ca">Bù ra ca (Quên check-out cuối ca)</option>
                <option value="Bù cả ngày">Bù cả ngày (Cả ngày đi công tác / không check-in)</option>
              </CustomSelect>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày cần bù</label>
              <input type="date" value={adjDate} onChange={e => setAdjDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          {(adjType === 'Bù vào ca' || adjType === 'Bù cả ngày') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Giờ vào ca (yêu cầu bổ sung)</label>
              <input type="time" value={adjInTime} onChange={e => setAdjInTime(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary" />
            </div>
          )}

          {(adjType === 'Bù ra ca' || adjType === 'Bù cả ngày') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Giờ ra ca (yêu cầu bổ sung)</label>
              <input type="time" value={adjOutTime} onChange={e => setAdjOutTime(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary" />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Dự án làm việc (tùy chọn)</label>
            <CustomSelect value={adjProject} onChange={e => setAdjProject(e.target.value)} searchable={true} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              <option value="">-- Không thuộc dự án cụ thể --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </CustomSelect>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lý do giải trình <span className="text-red-500">*</span></label>
            <textarea rows={3} value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="Nhập lý do cụ thể (vd: đi công tác công trường, điện thoại hỏng, làm việc ngoài cơ quan...)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
          </div>

          {/* Gom Quản lý trực tiếp duyệt & Người theo dõi lên cùng 1 hàng giống đơn xin nghỉ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            {/* Ô Quản lý trực tiếp duyệt (Bước 1 - Tùy chọn) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    <span className="material-symbols-outlined text-[16px] text-primary">person_check</span>
                    <span>Quản lý trực tiếp duyệt</span>
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">(Tùy chọn)</span>
                </label>
                <CustomSelect
                  value={adjStep1ReviewerId}
                  onChange={e => {
                    setAdjStep1ReviewerId(e.target.value);
                    if (modalError) setModalError(null);
                  }}
                  searchable={true}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="">-- Để trống (Chuyển thẳng lên người có cấp bậc cao nhất duyệt) --</option>
                  {step1Reviewers.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.title || r.role || 'Quản lý'})
                    </option>
                  ))}
                </CustomSelect>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-1">* Để trống thì chuyển thẳng lên người có cấp bậc cao nhất duyệt</p>
            </div>

            {/* Ô Người theo dõi (Follow / CC) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
                  <span>Người theo dõi (Follow / CC)</span>
                </span>
                <span className="text-[10px] font-normal text-slate-400">(Tùy chọn)</span>
              </label>

              <div className="space-y-2">
                <CustomSelect
                  value=""
                  onChange={e => {
                    const val = e.target.value;
                    if (val && !adjFollowerIds.includes(val)) {
                      setAdjFollowerIds(prev => [...prev, val]);
                    }
                  }}
                  searchable={true}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="">+ Chọn người theo dõi / thông báo...</option>
                  {engineers
                    .filter(eng => eng.id !== user?.id && !adjFollowerIds.includes(eng.id))
                    .map(eng => (
                      <option key={eng.id} value={eng.id}>
                        {eng.name} ({eng.role || eng.title || 'Nhân viên'})
                      </option>
                    ))}
                </CustomSelect>

                {/* Danh sách người theo dõi đã chọn dạng chip */}
                {adjFollowerIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {adjFollowerIds.map(fid => {
                      const eng = engineers.find(e => e.id === fid);
                      return (
                        <span
                          key={fid}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50/90 text-primary border border-blue-200/80 rounded-lg text-xs font-semibold animate-in fade-in"
                        >
                          <span className="material-symbols-outlined text-[13px]">person</span>
                          <span>{eng?.name || fid}</span>
                          <button
                            type="button"
                            onClick={() => setAdjFollowerIds(prev => prev.filter(id => id !== fid))}
                            className="w-3.5 h-3.5 rounded-full bg-blue-200/70 hover:bg-red-100 hover:text-red-600 inline-flex items-center justify-center transition-colors text-slate-600 cursor-pointer"
                            title="Bỏ chọn"
                          >
                            <span className="material-symbols-outlined text-[10px]">close</span>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button onClick={() => setShowAdjModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 text-sm">Hủy</button>
            <button onClick={handleCreateAdjustment} disabled={isSubmitting || !adjReason.trim()} className="px-5 py-2 bg-primary text-white font-bold rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50 shadow-xs">Gửi yêu cầu bù công</button>
          </div>
        </div>
      </Modal>

      {/* Modal Duyệt Chấm công bù */}
      <Modal isOpen={!!reviewAdj} onClose={() => setReviewAdj(null)} title={reviewAdjStep === 1 ? 'Xét duyệt bù công (Quản lý)' : 'Phê duyệt bù công (Ban Giám Đốc)'} icon="rate_review" size="md">
        {reviewAdj && (
          <div className="space-y-4 py-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <p><span className="font-bold text-slate-700">Nhân viên:</span> <strong className="text-slate-900">{reviewAdj.userName}</strong></p>
              <p><span className="font-bold text-slate-700">Loại bù:</span> {reviewAdj.adjustmentType}</p>
              <p><span className="font-bold text-slate-700">Ngày tạo đơn:</span> <span className="text-blue-600 font-semibold">{formatDateTime(reviewAdj.createdAt)}</span></p>
              <p><span className="font-bold text-slate-700">Ngày cần bù:</span> <strong className="text-slate-900">{formatDate(reviewAdj.adjustmentDate)}</strong></p>
              <p><span className="font-bold text-slate-700">Giờ vào/ra:</span> {reviewAdj.checkInTime ? formatTime(reviewAdj.checkInTime) : '—'} → {reviewAdj.checkOutTime ? formatTime(reviewAdj.checkOutTime) : '—'}</p>
              <p><span className="font-bold text-slate-700">Lý do:</span> {reviewAdj.reason}</p>
              {(() => {
                const adjDayStr = String(reviewAdj.adjustmentDate || '').slice(0, 10);
                const matchingLeave = leaves.find(l => {
                  if (l.userId !== reviewAdj.userId) return false;
                  if (l.status !== 'APPROVED' && l.status !== 'APPROVED_STEP1') return false;
                  const s = String(l.startDate || '').slice(0, 10);
                  const e = String(l.endDate || '').slice(0, 10);
                  return adjDayStr >= s && adjDayStr <= e;
                });
                if (matchingLeave) {
                  return (
                    <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-1.5 font-medium">
                      <span className="material-symbols-outlined text-[15px] text-emerald-600 mt-0.5 shrink-0">check_circle</span>
                      <span>
                        Ngày này nhân sự từng xin <strong>{matchingLeave.leaveType}</strong>. Sau khi duyệt hoàn tất, hệ thống sẽ <strong>tự động hoàn trả lại ngày nghỉ phép</strong> vào Quỹ phép năm.
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ý kiến / Ghi chú duyệt</label>
              <textarea rows={2} value={reviewAdjNote} onChange={e => setReviewAdjNote(e.target.value)} placeholder="Nhập ghi chú ý kiến phê duyệt..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button onClick={() => handleReviewAdjustment('REJECTED')} disabled={isSubmitting} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-200">Từ chối</button>
              <button onClick={() => handleReviewAdjustment('APPROVED')} disabled={isSubmitting} className="px-5 py-2 bg-primary text-white font-bold rounded-lg text-sm hover:bg-blue-800 shadow-sm">Duyệt</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={deleteAdjId !== null}
        onClose={() => setDeleteAdjId(null)}
        onConfirm={handleConfirmDeleteAdj}
        title="Xác nhận xóa yêu cầu"
        message="Bạn có chắc chắn muốn xóa yêu cầu chấm công bù này?"
        confirmText="Xóa yêu cầu"
        icon="delete"
      />

      {/* Modal tạo đơn xin nghỉ phép */}
      <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Tạo đơn xin nghỉ phép" icon="event_busy" size="lg">
        <div className="space-y-4 py-2">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">error</span>
              <span className="font-semibold">{modalError}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Loại nghỉ phép</label>
            <CustomSelect
              value={leaveType}
              onChange={e => setLeaveType(e.target.value as LeaveType)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="Nghỉ phép năm">Nghỉ phép năm</option>
              <option value="Nghỉ bệnh">Nghỉ bệnh</option>
              <option value="Nghỉ việc riêng">Nghỉ việc riêng</option>
              <option value="Nghỉ không lương">Nghỉ không lương</option>
              <option value="Khác">Khác</option>
            </CustomSelect>
          </div>
          {/* Chế độ thời gian nghỉ: Nghỉ theo ngày hoặc Nghỉ nửa ngày (1 buổi) */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Thời lượng xin nghỉ</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setLeaveDurationType('FULL_DAY');
                    setLeaveSession('ALL_DAY');
                  }}
                  className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    leaveDurationType === 'FULL_DAY'
                      ? 'bg-white text-primary shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">calendar_month</span>
                  <span>Nghỉ theo ngày</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeaveDurationType('HALF_DAY');
                    if (leaveSession === 'ALL_DAY') setLeaveSession('MORNING');
                    setLeaveEndDate(leaveStartDate);
                  }}
                  className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    leaveDurationType === 'HALF_DAY'
                      ? 'bg-white text-primary shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">schedule</span>
                  <span>Nghỉ 1 buổi</span>
                </button>
              </div>
            </div>

            {leaveDurationType === 'HALF_DAY' ? (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày nghỉ</label>
                  <input
                    type="date"
                    value={leaveStartDate}
                    onChange={e => {
                      setLeaveStartDate(e.target.value);
                      setLeaveEndDate(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Chọn buổi nghỉ</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLeaveSession('MORNING')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        leaveSession === 'MORNING'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">wb_sunny</span>
                      <span>Buổi sáng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveSession('AFTERNOON')}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        leaveSession === 'AFTERNOON'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">dark_mode</span>
                      <span>Buổi chiều</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Từ ngày</label>
                    <input
                      type="date"
                      value={leaveStartDate}
                      onChange={e => {
                        setLeaveStartDate(e.target.value);
                        if (e.target.value > leaveEndDate) setLeaveEndDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Đến ngày</label>
                    <input
                      type="date"
                      value={leaveEndDate}
                      onChange={e => {
                        setLeaveEndDate(e.target.value);
                        if (e.target.value < leaveStartDate) setLeaveStartDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gom Quản lý trực tiếp duyệt & Người theo dõi lên cùng 1 hàng */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Ô Quản lý trực tiếp duyệt (Bước 1 - Tùy chọn) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    <span className="material-symbols-outlined text-[16px] text-primary">person_check</span>
                    <span>Quản lý trực tiếp duyệt</span>
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">(Tùy chọn)</span>
                </label>
                <CustomSelect
                  value={step1ReviewerId}
                  onChange={e => {
                    setStep1ReviewerId(e.target.value);
                    if (modalError) setModalError(null);
                  }}
                  searchable={true}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="">-- Để trống (Chuyển thẳng lên người có cấp bậc cao nhất duyệt) --</option>
                  {step1Reviewers.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.title || r.role || 'Quản lý'})
                    </option>
                  ))}
                </CustomSelect>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-1">* Để trống thì chuyển thẳng lên người có cấp bậc cao nhất duyệt</p>
            </div>

            {/* Ô Người theo dõi (Follow / CC) */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
                  <span>Người theo dõi (Follow / CC)</span>
                </span>
                <span className="text-[10px] font-normal text-slate-400">(Tùy chọn)</span>
              </label>

              <div className="space-y-2">
                <CustomSelect
                  value=""
                  onChange={e => {
                    const val = e.target.value;
                    if (val && !followerIds.includes(val)) {
                      setFollowerIds(prev => [...prev, val]);
                    }
                  }}
                  searchable={true}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="">+ Chọn người theo dõi / thông báo...</option>
                  {engineers
                    .filter(eng => eng.id !== user?.id && !followerIds.includes(eng.id))
                    .map(eng => (
                      <option key={eng.id} value={eng.id}>
                        {eng.name} ({eng.role || eng.title || 'Nhân viên'})
                      </option>
                    ))}
                </CustomSelect>

                {/* Danh sách người theo dõi đã chọn dạng chip */}
                {followerIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {followerIds.map(fid => {
                      const eng = engineers.find(e => e.id === fid);
                      return (
                        <span
                          key={fid}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50/90 text-primary border border-blue-200/80 rounded-lg text-xs font-semibold animate-in fade-in"
                        >
                          <span className="material-symbols-outlined text-[13px]">person</span>
                          <span>{eng?.name || fid}</span>
                          <button
                            type="button"
                            onClick={() => setFollowerIds(prev => prev.filter(id => id !== fid))}
                            className="w-3.5 h-3.5 rounded-full bg-blue-200/70 hover:bg-red-100 hover:text-red-600 inline-flex items-center justify-center transition-colors text-slate-600 cursor-pointer"
                            title="Bỏ chọn"
                          >
                            <span className="material-symbols-outlined text-[10px]">close</span>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lý do xin nghỉ</label>
            <textarea
              rows={3}
              value={leaveReason}
              onChange={e => setLeaveReason(e.target.value)}
              placeholder="Nhập lý do cụ thể..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              onClick={() => setShowLeaveModal(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-200"
            >
              Hủy
            </button>
            <button
              onClick={handleCreateLeave}
              disabled={isSubmitting || !leaveReason.trim()}
              className="px-5 py-2 bg-primary text-white font-bold rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50"
            >
              Gửi đơn xin nghỉ
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Duyệt đơn xin nghỉ phép */}
      <Modal
        isOpen={!!reviewLeave}
        onClose={() => setReviewLeave(null)}
        title={
          reviewAction === 'REJECT'
            ? `Không duyệt đơn xin nghỉ (${reviewStep === 1 ? 'Quản lý' : 'Lãnh đạo'})`
            : `Phê duyệt đơn xin nghỉ (${reviewStep === 1 ? 'Quản lý' : 'Lãnh đạo'})`
        }
        icon={reviewAction === 'REJECT' ? 'cancel' : 'rate_review'}
        size="md"
      >
        {reviewLeave && (
          <div className="space-y-4 py-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <p><span className="font-bold text-slate-700">Nhân viên làm đơn:</span> <strong className="text-slate-900">{reviewLeave.userName}</strong></p>
              <p><span className="font-bold text-slate-700">Loại nghỉ:</span> {reviewLeave.leaveType}</p>
              <p><span className="font-bold text-slate-700">Thời gian nghỉ:</span> {formatDate(reviewLeave.startDate)} → {formatDate(reviewLeave.endDate)} ({reviewLeave.totalDays} ngày{reviewLeave.session === 'MORNING' ? ' - Buổi sáng' : reviewLeave.session === 'AFTERNOON' ? ' - Buổi chiều' : ''})</p>
              <div className="text-slate-800 leading-relaxed">
                <span className="font-bold text-slate-700">Lý do xin nghỉ:</span> {reviewLeave.reason}
              </div>
              {reviewStep === 2 && reviewLeave.step1ReviewerName && (
                <div className="pt-2 border-t border-slate-200/80 text-slate-800">
                  <p><span className="font-bold text-primary">Quản lý đã duyệt:</span> {reviewLeave.step1ReviewerName} {reviewLeave.step1ReviewedAt && `(${formatDate(reviewLeave.step1ReviewedAt)})`}</p>
                  {reviewLeave.step1ReviewNote && <p className="italic text-slate-600">Ý kiến Quản lý: "{reviewLeave.step1ReviewNote}"</p>}
                </div>
              )}
            </div>

            {/* Chuyển đổi trạng thái xử lý Duyệt / Không duyệt trong Modal */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setReviewAction('APPROVE')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  reviewAction === 'APPROVE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                <span>Phê duyệt đơn</span>
              </button>
              <button
                type="button"
                onClick={() => setReviewAction('REJECT')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  reviewAction === 'REJECT'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">cancel</span>
                <span>Không duyệt đơn</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {reviewAction === 'REJECT' ? (
                  <span>
                    Lý do / Bình luận không duyệt <span className="text-rose-500">*</span>
                  </span>
                ) : (
                  <span>Ý kiến / Ghi chú phê duyệt (tùy chọn)</span>
                )}
              </label>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder={
                  reviewAction === 'REJECT'
                    ? 'Nhập lý do không duyệt (bình luận sẽ được gửi thông báo trực tiếp đến nhân viên)...'
                    : (reviewStep === 1 ? 'Ghi chú ý kiến của quản lý trực tiếp...' : 'Ghi chú phê duyệt của Lãnh đạo...')
                }
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none transition-all ${
                  reviewAction === 'REJECT'
                    ? 'border-rose-300 focus:ring-2 focus:ring-rose-400 bg-rose-50/20'
                    : 'border-slate-200 focus:ring-2 focus:ring-primary'
                }`}
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setReviewLeave(null)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-lg text-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>
              {reviewAction === 'REJECT' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!reviewNote.trim()) {
                      showToast('Vui lòng nhập lý do/bình luận không duyệt!', 'warning');
                      return;
                    }
                    handleReviewLeave('REJECTED');
                  }}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                  <span>Xác nhận không duyệt</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReviewLeave('APPROVED')}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary hover:bg-blue-800 text-white font-bold rounded-lg text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Xác nhận duyệt</span>
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* View Image Modal */}
      <Modal isOpen={!!viewImage} onClose={() => setViewImage(null)} title="Ảnh hiện trường" icon="image" size="lg">
        {viewImage && (
          <div className="flex flex-col gap-4">
            <div className="bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center min-h-[300px]">
              <img src={viewImage} alt="Attendance" className="max-w-full max-h-[70vh] object-contain" />
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button onClick={() => setViewImage(null)} className="px-5 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors text-sm">
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Chấm công Modal */}
      <Modal isOpen={showCheckInModal} onClose={() => setShowCheckInModal(false)} title="Chấm công" icon="fingerprint" size="md">
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">
            Thời gian chấm công: <span className="font-bold text-slate-800">{formatTime(new Date().toISOString())} {formatDate(new Date().toISOString())}</span>
          </p>

          {/* CHỌN DỰ ÁN / CÔNG TRÌNH */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dự án / Công trình:
            </label>
            <CustomSelect
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              searchable={true}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none bg-white font-medium"
            >
              <option value="">-- Chọn dự án / công trình --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.location ? `(${p.location})` : ''}
                </option>
              ))}
            </CustomSelect>
          </div>

          {/* ĐỊNH VỊ GPS SO SÁNH TRỰC TIẾP VỚI ĐỊA ĐIỂM DỰ ÁN */}
          {attendanceConfig.gpsRequirement !== 'none' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Kiểm tra vị trí GPS:
                </label>
                <button
                  type="button"
                  onClick={handleTriggerGpsScan}
                  disabled={isGpsScanning}
                  className="text-[11px] font-bold text-primary hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[14px] ${isGpsScanning ? 'animate-spin' : ''}`}>sync</span>
                  {isGpsScanning ? 'Đang quét...' : 'Lấy lại vị trí'}
                </button>
              </div>

              {isGpsScanning ? (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
                  <span className="text-xs text-blue-800 font-medium">Đang xác định tọa độ GPS của thiết bị...</span>
                </div>
              ) : gpsData ? (() => {
                const currentSelectedProj = projects.find(p => p.id === selectedProject || p.code === selectedProject);
                if (!currentSelectedProj) {
                  return (
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs flex items-center justify-between">
                      <span>Vui lòng chọn Dự án ở trên để đối chiếu khoảng cách GPS.</span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {gpsData.lat.toFixed(5)}, {gpsData.lng.toFixed(5)}
                      </span>
                    </div>
                  );
                }

                const hasProjectCoords = currentSelectedProj.latitude !== undefined && currentSelectedProj.longitude !== undefined;
                const targetRadius = currentSelectedProj.radiusMeters || 500;

                const distanceToTarget = hasProjectCoords
                  ? calculateDistanceMeters(gpsData.lat, gpsData.lng, currentSelectedProj.latitude!, currentSelectedProj.longitude!)
                  : null;

                const isWithinRadius = distanceToTarget !== null 
                  ? distanceToTarget <= targetRadius 
                  : true; // Nếu dự án chưa có tọa độ, cho phép lưu vết thực địa

                return (
                  <div className={`p-3 rounded-lg border ${
                    distanceToTarget !== null
                      ? (isWithinRadius
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                          : attendanceConfig.gpsRequirement === 'strict'
                          ? 'bg-red-50/80 border-red-300 text-red-950'
                          : 'bg-amber-50/80 border-amber-300 text-amber-950')
                      : 'bg-blue-50/80 border-blue-300 text-blue-950'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        {currentSelectedProj.name}
                      </span>
                      {distanceToTarget !== null ? (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          isWithinRadius
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {isWithinRadius ? 'Trong phạm vi' : `Ngoài bán kính (${formatDistance(distanceToTarget)})`}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                          Lưu vết thực địa
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[11px] mt-1.5 flex flex-wrap items-center gap-1.5 text-slate-700">
                      <span>Tọa độ của bạn: <b>{gpsData.lat.toFixed(5)}, {gpsData.lng.toFixed(5)}</b></span>
                      {distanceToTarget !== null && (
                        <span className="font-semibold text-slate-600">
                          (Cách dự án <b>{formatDistance(distanceToTarget)}</b> / bán kính ≤ {targetRadius}m)
                        </span>
                      )}
                    </div>

                    {!hasProjectCoords && (
                      <div className="text-[10.5px] text-blue-800 mt-1.5 bg-blue-100/70 p-1.5 rounded">
                        Dự án này chưa lưu tọa độ GPS cố định. Hệ thống sẽ ghi nhận tọa độ GPS thực tế của bạn.
                      </div>
                    )}
                  </div>
                );
              })() : gpsError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0 text-red-500">warning</span>
                  <div>
                    <div className="font-bold">Không thể lấy vị trí GPS</div>
                    <div className="text-[11px] text-red-600 mt-0.5">{gpsError}</div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ảnh hiện trường / hình ảnh {attendanceConfig.requirePhoto ? '(*)' : '(tùy chọn)'}
            </label>
            <div className="flex items-center gap-3">
              {checkInImage ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                  <img src={checkInImage} alt="preview" className="w-full h-full object-cover" />
                  <button onClick={() => setCheckInImage(null)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[10px]">close</span>
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:text-primary hover:border-primary transition text-xs cursor-pointer">
                  <span className="material-symbols-outlined text-base">add_a_photo</span>
                  Chọn ảnh {attendanceConfig.requirePhoto ? 'bắt buộc' : ''}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú (tùy chọn)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Nhập ghi chú công việc..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
          <button onClick={() => setShowCheckInModal(false)}
            className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors text-sm cursor-pointer">
            Hủy
          </button>
          <button 
            onClick={handleCheckIn} 
            disabled={
              isSubmitting || 
              (attendanceConfig.gpsRequirement === 'strict' && workLocationType === 'office' && (!gpsData || !gpsData.isWithinRadius)) ||
              (attendanceConfig.requirePhoto && !checkInImage)
            }
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-blue-800 text-white font-bold rounded-lg disabled:opacity-50 transition-colors text-sm cursor-pointer shadow-sm"
          >
            {isSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <span className="material-symbols-outlined text-lg">fingerprint</span>}
            Xác nhận Chấm công
          </button>
        </div>
      </Modal>

      {/* Admin Attendance Config Modal */}
      <AttendanceConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={attendanceConfig}
        onSave={handleSaveAttendanceConfig}
      />

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Xác nhận xóa"
        message="Bạn có chắc chắn muốn xóa bản ghi chấm công này?"
        confirmText="Xóa"
        icon="delete"
      />

      <ConfirmModal
        isOpen={deleteLeaveId !== null}
        onClose={() => setDeleteLeaveId(null)}
        onConfirm={handleConfirmDeleteLeave}
        title="Xác nhận xóa đơn"
        message="Bạn có chắc chắn muốn xóa đơn nghỉ phép này?"
        confirmText="Xóa đơn"
        icon="delete"
      />

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};
