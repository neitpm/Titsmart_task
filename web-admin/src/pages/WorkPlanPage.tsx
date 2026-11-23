import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore, isDirector, isSystemAdmin } from '../services/authStore';
import { Task, TaskPriority, TaskStatus, isTaskActuallyDone } from '../types';
import { Modal } from '../components/common/Modal';
import { Toast } from '../components/common/Toast';
import { CustomSelect } from '../components/common/CustomSelect';
import { getTaskTimeBounds } from '../utils/taskPeriodFilter';

type CalendarViewMode = 'month' | 'week' | 'agenda';

const padZero = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const formatDateToYMD = (d: Date): string => {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
};

const formatDateVN = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export interface DeadlineAlertConfig {
  days: number;
  hours: number;
  minutes: number;
}

const DEFAULT_ALERT_CONFIG: DeadlineAlertConfig = {
  days: 3,
  hours: 0,
  minutes: 0,
};

const ALERT_PRESETS = [
  { label: '30 phút', days: 0, hours: 0, minutes: 30 },
  { label: '1 giờ', days: 0, hours: 1, minutes: 0 },
  { label: '2 giờ', days: 0, hours: 2, minutes: 0 },
  { label: '12 giờ', days: 0, hours: 12, minutes: 0 },
  { label: '1 ngày', days: 1, hours: 0, minutes: 0 },
  { label: '2 ngày', days: 2, hours: 0, minutes: 0 },
  { label: '3 ngày', days: 3, hours: 0, minutes: 0 },
  { label: '7 ngày', days: 7, hours: 0, minutes: 0 },
];

const loadAlertConfig = (): DeadlineAlertConfig => {
  try {
    const savedConfig = localStorage.getItem('titsmart_deadline_alert_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      const days = Math.max(0, parseInt(parsed.days, 10) || 0);
      const hours = Math.max(0, Math.min(23, parseInt(parsed.hours, 10) || 0));
      const minutes = Math.max(0, Math.min(59, parseInt(parsed.minutes, 10) || 0));
      if (days > 0 || hours > 0 || minutes > 0) {
        return { days, hours, minutes };
      }
    }
    const legacyDays = localStorage.getItem('titsmart_deadline_alert_days');
    if (legacyDays) {
      const d = parseInt(legacyDays, 10);
      if (!isNaN(d) && d > 0) return { days: d, hours: 0, minutes: 0 };
    }
  } catch {}
  return DEFAULT_ALERT_CONFIG;
};

const formatAlertConfigLabel = (config: DeadlineAlertConfig): string => {
  const parts: string[] = [];
  if (config.days > 0) parts.push(`${config.days} ngày`);
  if (config.hours > 0) parts.push(`${config.hours} giờ`);
  if (config.minutes > 0) parts.push(`${config.minutes} phút`);
  return parts.length > 0 ? parts.join(' ') : '0 phút';
};

const getAlertConfigTotalMinutes = (config: DeadlineAlertConfig): number => {
  return (config.days * 24 * 60) + (config.hours * 60) + config.minutes;
};

const parseTargetDueDate = (dueStr?: string | null): Date | null => {
  if (!dueStr) return null;
  const s = String(dueStr).trim();
  if (!s) return null;

  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  if (s.includes(' ')) {
    const d = new Date(s.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return d;
  }

  const ymdParts = s.split('-');
  if (ymdParts.length === 3) {
    const y = parseInt(ymdParts[0], 10);
    const m = parseInt(ymdParts[1], 10) - 1;
    const d = parseInt(ymdParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 23, 59, 59, 999);
    }
  }

  const dmyParts = s.split('/');
  if (dmyParts.length === 3) {
    const d = parseInt(dmyParts[0], 10);
    const m = parseInt(dmyParts[1], 10) - 1;
    const y = parseInt(dmyParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 23, 59, 59, 999);
    }
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const getDiffDays = (targetYMD: string, baseYMD: string): number => {
  const target = new Date(`${targetYMD}T00:00:00Z`).getTime();
  const base = new Date(`${baseYMD}T00:00:00Z`).getTime();
  return Math.round((target - base) / (1000 * 60 * 60 * 24));
};

export const WorkPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const tasks = useRealtimeStore((state) => state.tasks);
  const projects = useRealtimeStore((state) => state.projects);
  const engineers = useRealtimeStore((state) => state.engineers);
  const fetchProjects = useRealtimeStore((state) => state.fetchProjects);
  const fetchEngineers = useRealtimeStore((state) => state.fetchEngineers);
  const addTask = useRealtimeStore((state) => state.addTask);
  const updateTask = useRealtimeStore((state) => state.updateTask);
  const updateTaskProgress = useRealtimeStore((state) => state.updateTaskProgress);
  const logActivity = useRealtimeStore((state) => state.logActivity);
  const user = useAuthStore((state) => state.user);
  const canViewSharedPlans = isDirector(user) || isSystemAdmin(user) || user?.role === 'admin' || user?.role === 'pm' || user?.companyRole === 'company_admin';

  // The work-plan page can be opened directly, so make sure its selectors
  // are populated even when the Personnel/Projects pages have not been opened.
  useEffect(() => {
    void Promise.all([fetchProjects(), fetchEngineers()]).catch((error) => {
      console.warn('Không thể tải danh sách dự án và nhân sự cho kế hoạch:', error);
    });
  }, [fetchProjects, fetchEngineers]);

  // User configurable deadline alert threshold (days, hours, minutes)
  const [alertConfig, setAlertConfig] = useState<DeadlineAlertConfig>(loadAlertConfig);
  const [tempConfig, setTempConfig] = useState<DeadlineAlertConfig>(alertConfig);
  const [showAlertSetting, setShowAlertSetting] = useState(false);

  useEffect(() => {
    if (showAlertSetting) {
      setTempConfig(alertConfig);
    }
  }, [showAlertSetting, alertConfig]);

  const handleSaveAlertConfig = () => {
    const totalMin = getAlertConfigTotalMinutes(tempConfig);
    if (totalMin <= 0) {
      triggerToast('Vui lòng nhập thời gian cảnh báo trước lớn hơn 0!', 'warning');
      return;
    }
    setAlertConfig(tempConfig);
    try {
      localStorage.setItem('titsmart_deadline_alert_config', JSON.stringify(tempConfig));
      const totalDays = tempConfig.days + (tempConfig.hours / 24) + (tempConfig.minutes / 1440);
      localStorage.setItem('titsmart_deadline_alert_days', String(Math.ceil(totalDays) || 1));
      window.dispatchEvent(new Event('titsmart_alert_config_changed'));
    } catch {}
    triggerToast(`Đã lưu mức cảnh báo: Sắp đến hạn trước ${formatAlertConfigLabel(tempConfig)}`, 'success');
    setShowAlertSetting(false);
  };

  const handleQuickPreset = (preset: { days: number; hours: number; minutes: number }) => {
    setTempConfig(preset);
  };

  // View mode
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    try {
      const saved = localStorage.getItem('titsmart_workplan_view_mode') as CalendarViewMode;
      if (saved === 'month' || saved === 'week' || saved === 'agenda') return saved;
    } catch {}
    return 'month';
  });

  const handleSetViewMode = (mode: CalendarViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('titsmart_workplan_view_mode', mode);
    } catch {}
  };

  // Current calendar navigation date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Filters
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [planScope, setPlanScope] = useState<'all_projects' | 'project' | 'personal'>('personal');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'due_today' | 'due_soon' | 'in_progress' | 'completed'>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Toast
  const [toastState, setToastState] = useState({
    show: false,
    message: '',
    type: 'success' as 'success' | 'info' | 'warning'
  });
  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastState({ show: true, message, type });
    setTimeout(() => setToastState({ show: false, message: '', type: 'success' }), 3000);
  };

  // Modal: Add Plan / Task
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formProjectCode, setFormProjectCode] = useState('');
  const [formAssigneeId, setFormAssigneeId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('Medium');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal: Day detail in Month View
  const [dayDetailModalDate, setDayDetailModalDate] = useState<string | null>(null);

  // Modal: Task Detail View / Quick Update
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);

  // Today string
  const todayStr = useMemo(() => formatDateToYMD(new Date()), []);

  // Set default form values when opening Add Modal
  const openAddModal = (targetDate?: string) => {
    const initDate = targetDate || todayStr;
    setFormName('');
    setFormProjectCode(projects[0]?.code || 'KE_HOACH_CONG_TY');
    setFormAssigneeId(user?.id || (engineers[0]?.id || ''));
    setFormStartDate(initDate);
    setFormDueDate(initDate);
    setFormPriority('Medium');
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  // Submit new Plan / Task
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      triggerToast('Vui lòng nhập tên công việc / kế hoạch', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetProject = projects.find((p) => p.code === formProjectCode);
      const targetAssignee = engineers.find((e) => e.id === formAssigneeId);

      const creatorName = user?.name || user?.username || 'Quản lý';
      const assignerId = user?.id || '';

      const newTaskData: Omit<Task, 'id'> = {
        stt: String((tasks || []).length + 1),
        code: `PLAN-${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        projectCode: formProjectCode || 'KE_HOACH_CONG_TY',
        projectName: targetProject?.name || 'Kế hoạch chung công ty',
        volume: 1,
        unit: 'Hạng mục',
        progress: 0,
        status: 'Đang làm',
        purchaseStatus: 'Không có hàng',
        constrStatus: 'Đang triển khai',
        isDone: false,
        isSectionHeader: false,
        sectionName: 'Kế hoạch làm việc',
        assignedEngineerId: targetAssignee?.id || user?.id,
        assignedEngineerName: targetAssignee?.name || user?.name || creatorName,
        assignerId: assignerId,
        assignerName: creatorName,
        startDate: formStartDate || undefined,
        dueDate: formDueDate || undefined,
        priority: formPriority,
        notes: formNotes.trim() ? `[Kế hoạch mới] ${formNotes.trim()}` : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: creatorName
      };

      await addTask(newTaskData);
      logActivity(
        `Đã lên kế hoạch công việc mới: "${formName.trim()}" (Hạn: ${formatDateVN(formDueDate)})`,
        targetProject?.name || 'Kế hoạch chung'
      );

      triggerToast('Đã thêm kế hoạch công việc thành công!', 'success');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to create plan task:', err);
      triggerToast('Lỗi khi lưu kế hoạch công việc', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick toggle completion
  const handleToggleTaskDone = async (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentlyDone = isTaskActuallyDone(task);
    const nextDone = !currentlyDone;
    const nextProgress = nextDone ? 1 : 0;
    const nextStatus: TaskStatus = nextDone ? 'Hoàn thành' : 'Đang làm';

    try {
      if (updateTaskProgress) {
        updateTaskProgress(task.id, nextProgress, nextDone);
      } else {
        updateTask(task.id, {
          isDone: nextDone,
          progress: nextProgress,
          status: nextStatus,
          completedAt: nextDone ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || user?.username || 'Người dùng'
        });
      }

      logActivity(
        nextDone ? `Đã hoàn thành công việc: "${task.name}"` : `Mở lại công việc: "${task.name}"`,
        task.projectName || task.projectCode
      );

      triggerToast(nextDone ? `Đã hoàn thành: "${task.name}"` : `Đã chuyển về đang làm: "${task.name}"`, 'success');

      // Update selected modal if open
      if (selectedTaskDetail && selectedTaskDetail.id === task.id) {
        setSelectedTaskDetail({
          ...selectedTaskDetail,
          isDone: nextDone,
          progress: nextProgress,
          status: nextStatus
        });
      }
    } catch (err) {
      console.error('Toggle task done failed:', err);
      triggerToast('Không thể cập nhật trạng thái', 'warning');
    }
  };

  // Map and analyze tasks
  const analyzedTasks = useMemo(() => {
    const list = tasks.filter((t) => !t.isSectionHeader && t.name && t.name.trim());
    const totalAlertMin = getAlertConfigTotalMinutes(alertConfig);
    const now = new Date();

    return list.map((task) => {
      const bounds = getTaskTimeBounds(task);
      const isDone = isTaskActuallyDone(task);
      const rawDue = task.dueDate || bounds.dueDate || '';
      const dueYMD = bounds.dueDate || (task.dueDate ? String(task.dueDate).split('T')[0] : '');
      const startYMD = bounds.acceptedDate || (task.startDate ? String(task.startDate).split('T')[0] : '');

      let diffDays: number | null = null;
      let diffMinutes: number | null = null;
      let deadlineStatus: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'completed' | 'no_due' = 'no_due';

      if (isDone) {
        deadlineStatus = 'completed';
      } else if (rawDue) {
        const targetDate = parseTargetDueDate(rawDue);
        if (targetDate) {
          const diffMs = targetDate.getTime() - now.getTime();
          diffMinutes = Math.floor(diffMs / 60000);
          diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          if (diffMs < 0) {
            deadlineStatus = 'overdue';
          } else if (diffMinutes <= totalAlertMin) {
            deadlineStatus = 'due_soon';
          } else if (targetDate.toDateString() === now.toDateString()) {
            deadlineStatus = 'due_today';
          } else {
            deadlineStatus = 'upcoming';
          }
        }
      }

      return {
        ...task,
        dueYMD,
        startYMD,
        isDone,
        diffDays,
        diffMinutes,
        deadlineStatus
      };
    });
  }, [tasks, todayStr, alertConfig]);

  // Statistics for KPIs & Alerts
  const stats = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let dueSoon = 0;
    let upcoming = 0;
    let completed = 0;
    let total = analyzedTasks.length;

    analyzedTasks.forEach((t) => {
      if (t.isDone) {
        completed++;
      } else if (t.deadlineStatus === 'overdue') {
        overdue++;
      } else if (t.deadlineStatus === 'due_today') {
        dueToday++;
      } else if (t.deadlineStatus === 'due_soon') {
        dueSoon++;
      } else if (t.deadlineStatus === 'upcoming') {
        upcoming++;
      }
    });

    return { overdue, dueToday, dueSoon, upcoming, completed, total };
  }, [analyzedTasks]);

  // Filtered task list
  const personalIdentityKeys = useMemo(() => {
    const keys = new Set<string>();
    const addKey = (value?: string | null) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized) keys.add(normalized);
    };

    addKey(user?.id);
    addKey(user?.username);
    addKey(user?.email);
    addKey(user?.name);

    // The account ID and the personnel ID can differ in older local data.
    // Include every linked personnel identity so personal plans remain visible.
    engineers.forEach((engineer) => {
      const sameUser = [engineer.id, engineer.authUserId, engineer.username, engineer.email, engineer.name]
        .some((value) => {
          const normalized = String(value || '').trim().toLowerCase();
          return normalized && keys.has(normalized);
        });
      if (sameUser) {
        addKey(engineer.id);
        addKey(engineer.authUserId);
        addKey(engineer.username);
        addKey(engineer.email);
        addKey(engineer.name);
      }
    });

    return keys;
  }, [engineers, user]);

  const filteredTasks = useMemo(() => {
    return analyzedTasks.filter((t) => {
      const currentUserId = String(user?.id || '').toLowerCase();
      const currentUserName = String(user?.name || '').trim().toLowerCase();
      const currentUsername = String(user?.username || '').trim().toLowerCase();
      const assigneeId = String(t.assignedEngineerId || '').toLowerCase();
      const assigneeName = String(t.assignedEngineerName || '').split('|')[0].trim().toLowerCase();
      const assignerId = String(t.assignerId || '').toLowerCase();
      const assignerName = String(t.assignerName || '').trim().toLowerCase();

      if (planScope === 'personal') {
        const isMine = personalIdentityKeys.has(assigneeId) || personalIdentityKeys.has(assignerId) ||
          (currentUserName && (assigneeName === currentUserName || assignerName === currentUserName));
        if (!isMine) return false;
      } else if (planScope === 'project') {
        if (!t.projectCode || t.projectCode === 'KE_HOACH_CONG_TY') return false;
      }

      // Filter by project
      if (selectedProject !== 'all' && t.projectCode !== selectedProject) {
        return false;
      }

      // Filter by assignee
      if (selectedAssignee === 'me') {
        const uId = String(user?.id || '').toLowerCase();
        const uName = String(user?.name || '').toLowerCase();
        const uUsername = String(user?.username || '').toLowerCase();
        const aId = String(t.assignedEngineerId || '').toLowerCase();
        const aName = String(t.assignedEngineerName || '').toLowerCase();

        const match =
          (uId && aId === uId) ||
          (uUsername && aId === uUsername) ||
          (uName && aName === uName) ||
          (uName && aName.includes(uName));
        if (!match) return false;
      } else if (selectedAssignee !== 'all') {
        if (t.assignedEngineerId !== selectedAssignee && t.assignedEngineerName !== selectedAssignee) {
          return false;
        }
      }

      // Filter by deadline / status
      if (statusFilter === 'overdue' && (t.isDone || t.deadlineStatus !== 'overdue')) return false;
      if (statusFilter === 'due_today' && (t.isDone || t.deadlineStatus !== 'due_today')) return false;
      if (statusFilter === 'due_soon' && (t.isDone || t.deadlineStatus !== 'due_soon')) return false;
      if (statusFilter === 'in_progress' && (t.isDone || t.deadlineStatus === 'overdue')) return false;
      if (statusFilter === 'completed' && !t.isDone) return false;

      // Filter by search keyword
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const matchName = t.name.toLowerCase().includes(q);
        const matchCode = (t.code || '').toLowerCase().includes(q);
        const matchProject = (t.projectName || t.projectCode || '').toLowerCase().includes(q);
        const matchAssignee = (t.assignedEngineerName || '').toLowerCase().includes(q);
        const matchNotes = (t.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchProject && !matchAssignee && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [analyzedTasks, selectedProject, selectedAssignee, planScope, statusFilter, searchKeyword, user, personalIdentityKeys]);

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const goToPrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const goToNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar Month Grid Generation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday as start of week (0 = Monday, ..., 6 = Sunday)
    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInCurrentMonth = lastDayOfMonth.getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      tasks: typeof filteredTasks;
    }> = [];

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dStr = formatDateToYMD(prevDate);
      days.push({
        dateStr: dStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        tasks: filteredTasks.filter((t) => t.dueYMD === dStr || t.startYMD === dStr)
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const thisDate = new Date(year, month, d);
      const dStr = formatDateToYMD(thisDate);
      days.push({
        dateStr: dStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        tasks: filteredTasks.filter((t) => t.dueYMD === dStr || t.startYMD === dStr)
      });
    }

    // Next month filler days to complete rows (up to 35 or 42 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dStr = formatDateToYMD(nextDate);
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        tasks: filteredTasks.filter((t) => t.dueYMD === dStr || t.startYMD === dStr)
      });
    }

    return days;
  }, [year, month, filteredTasks, todayStr]);

  // Week View Days (Monday to Sunday)
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const dayOfWeek = (d.getDay() + 6) % 7; // 0: Mon, 6: Sun
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek);

    const week: Array<{
      dayName: string;
      dateStr: string;
      displayDate: string;
      isToday: boolean;
      tasks: typeof filteredTasks;
    }> = [];

    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      const dStr = formatDateToYMD(cur);
      week.push({
        dayName: dayNames[i],
        dateStr: dStr,
        displayDate: `${cur.getDate()}/${cur.getMonth() + 1}`,
        isToday: dStr === todayStr,
        tasks: filteredTasks.filter((t) => t.dueYMD === dStr || t.startYMD === dStr)
      });
    }

    return week;
  }, [currentDate, filteredTasks, todayStr]);

  // Agenda Groups
  const agendaGroups = useMemo(() => {
    const overdueList: typeof filteredTasks = [];
    const todayList: typeof filteredTasks = [];
    const tomorrowList: typeof filteredTasks = [];
    const thisWeekList: typeof filteredTasks = [];
    const nextWeekList: typeof filteredTasks = [];
    const futureList: typeof filteredTasks = [];
    const noDueList: typeof filteredTasks = [];

    filteredTasks.forEach((t) => {
      if (!t.dueYMD) {
        noDueList.push(t);
        return;
      }
      if (t.isDone) {
        futureList.push(t);
        return;
      }

      const diff = t.diffDays !== null ? t.diffDays : getDiffDays(t.dueYMD, todayStr);
      if (diff < 0) {
        overdueList.push(t);
      } else if (diff === 0) {
        todayList.push(t);
      } else if (diff === 1) {
        tomorrowList.push(t);
      } else if (diff <= 7) {
        thisWeekList.push(t);
      } else if (diff <= 14) {
        nextWeekList.push(t);
      } else {
        futureList.push(t);
      }
    });

    // Sort overdue from most overdue to least
    overdueList.sort((a, b) => (a.diffDays || 0) - (b.diffDays || 0));
    todayList.sort((a, b) => a.name.localeCompare(b.name));
    tomorrowList.sort((a, b) => a.name.localeCompare(b.name));
    thisWeekList.sort((a, b) => (a.diffDays || 0) - (b.diffDays || 0));
    nextWeekList.sort((a, b) => (a.diffDays || 0) - (b.diffDays || 0));

    return [
      { key: 'overdue', label: 'CÔNG VIỆC QUÁ HẠN (CẦN XỬ LÝ NGAY)', icon: 'warning', color: 'rose', items: overdueList },
      { key: 'today', label: 'HÔM NAY', icon: 'today', color: 'amber', items: todayList },
      { key: 'tomorrow', label: 'NGÀY MAI', icon: 'event', color: 'blue', items: tomorrowList },
      { key: 'this_week', label: 'TRONG TUẦN NÀY (2-7 NGÀY TỚI)', icon: 'date_range', color: 'indigo', items: thisWeekList },
      { key: 'next_week', label: 'TUẦN TỚI (8-14 NGÀY TỚI)', icon: 'calendar_month', color: 'slate', items: nextWeekList },
      { key: 'future', label: 'KẾ HOẠCH XA HƠN & TƯƠNG LAI', icon: 'forward', color: 'slate', items: futureList },
      { key: 'no_due', label: 'CHƯA ĐẶT THỜI HẠN (CẦN LÊN LỊCH)', icon: 'schedule', color: 'slate', items: noDueList }
    ].filter((g) => g.items.length > 0);
  }, [filteredTasks, todayStr]);

  // Priority color badge helper
  const getPriorityBadge = (p?: TaskPriority) => {
    switch (p) {
      case 'High':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-700 border border-rose-200">Ưu tiên cao</span>;
      case 'Low':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200">Thấp</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">Bình thường</span>;
    }
  };

  // Status Chip Badge helper for Month View
  const renderTaskChip = (task: typeof filteredTasks[0]) => {
    let bgClass = 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
    let icon = 'fiber_manual_record';

    if (task.isDone) {
      bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through opacity-75';
      icon = 'check_circle';
    } else if (task.deadlineStatus === 'overdue') {
      bgClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse hover:bg-rose-100';
      icon = 'warning';
    } else if (task.deadlineStatus === 'due_today') {
      bgClass = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold hover:bg-amber-100';
      icon = 'schedule';
    } else if (task.deadlineStatus === 'due_soon') {
      bgClass = 'bg-sky-50 text-sky-800 border-sky-200 font-medium hover:bg-sky-100';
      icon = 'alarm';
    }

    return (
      <button
        key={task.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTaskDetail(task);
        }}
        className={`w-full text-left px-1.5 py-1 rounded text-[11px] leading-tight border transition-all truncate flex items-center gap-1 shadow-2xs mb-1 cursor-pointer ${bgClass}`}
        title={`${task.name} - ${task.projectName || task.projectCode} (${task.assignedEngineerName || 'Chưa giao'})`}
      >
        <span className="material-symbols-outlined text-[12px] shrink-0">{icon}</span>
        <span className="truncate flex-1">
          <span className="font-bold">{task.projectName || task.projectCode || 'Kế hoạch chung'}</span>
          <span className="mx-1 text-slate-400">·</span>
          {task.name}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden">
      {/* Toast */}
      <Toast
        show={toastState.show}
        message={toastState.message}
        type={toastState.type}
        onClose={() => setToastState((prev) => ({ ...prev, show: false }))}
      />

      {/* TOP HEADER BAR (Đồng bộ chuẩn ứng dụng, h-12, bg-white, border-b border-slate-200) */}
      <div 
        className="border-b border-slate-200 bg-white shadow-sm px-3 md:px-6 md:pr-20 py-2.5 md:py-0 md:h-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 md:gap-2 relative z-40 shrink-0 no-drag-region electron-no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:gap-4 w-full md:w-auto min-w-0">
          <div className="flex items-center justify-between gap-2 shrink-0 h-7 sm:h-8 md:h-auto pr-12 md:pr-0">
            <h1 className="page-title text-sm md:text-base font-extrabold text-slate-900 border-l-4 border-primary pl-2 shrink-0">
              Lịch & Kế hoạch
            </h1>
          </div>
        </div>

        {/* Right Controls: Cài đặt cảnh báo và Chuyển đổi Tháng/Tuần/Lộ trình */}
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap justify-between md:justify-end w-full md:w-auto">
          {/* Cài đặt cảnh báo thời hạn */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAlertSetting(!showAlertSetting)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors shadow-2xs cursor-pointer ${
                stats.overdue > 0 || stats.dueSoon > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Tùy chỉnh thời gian cảnh báo sắp đến thời hạn công việc (Ngày - Giờ - Phút)"
            >
              <span className="material-symbols-outlined text-base text-amber-500">notifications_active</span>
              <span>Cảnh báo: <span className="font-black text-primary underline">{formatAlertConfigLabel(alertConfig)}</span></span>
              <span className="material-symbols-outlined text-sm">tune</span>
            </button>

            {/* Alert setting popover */}
            {showAlertSetting && (
              <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[95vw] bg-white rounded-xl shadow-2xl border border-slate-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-500 text-base">notifications_active</span>
                    <span>Cài đặt cảnh báo thời hạn</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAlertSetting(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  Hệ thống sẽ chủ động cảnh báo màu vàng cam khi công việc còn cách hạn hoàn thành:
                </p>

                {/* Tùy biến Ngày - Giờ - Phút */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-3">
                  <div className="text-[11px] font-semibold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Tùy chỉnh thời gian trước hạn:</span>
                    <span className="text-primary font-bold">{formatAlertConfigLabel(tempConfig)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1 text-center">Ngày</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={tempConfig.days === 0 ? '' : tempConfig.days}
                          placeholder="0"
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                            setTempConfig(prev => ({ ...prev, days: val }));
                          }}
                          className="w-full text-center px-1 py-1.5 pr-6 rounded-md border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">ng</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1 text-center">Giờ</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={tempConfig.hours === 0 ? '' : tempConfig.hours}
                          placeholder="0"
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                            setTempConfig(prev => ({ ...prev, hours: val }));
                          }}
                          className="w-full text-center px-1 py-1.5 pr-6 rounded-md border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">giờ</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1 text-center">Phút</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={tempConfig.minutes === 0 ? '' : tempConfig.minutes}
                          placeholder="0"
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                            setTempConfig(prev => ({ ...prev, minutes: val }));
                          }}
                          className="w-full text-center px-1 py-1.5 pr-6 rounded-md border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">ph</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chọn nhanh */}
                <div className="mb-3">
                  <div className="text-[10px] text-slate-500 mb-1.5 font-medium">Hoặc bấm chọn nhanh mốc phổ biến:</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ALERT_PRESETS.map((p) => {
                      const isSel = tempConfig.days === p.days && tempConfig.hours === p.hours && tempConfig.minutes === p.minutes;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => handleQuickPreset(p)}
                          className={`px-1.5 py-1 rounded text-[10px] font-bold transition-all text-center cursor-pointer ${
                            isSel
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nút thao tác */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAlertSetting(false)}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer text-center"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAlertConfig}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary/90 shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">check</span>
                    Lưu cài đặt
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 italic text-center mt-2">
                  Cài đặt lưu riêng cho tài khoản của bạn
                </div>
              </div>
            )}
          </div>

          {/* Phạm vi kế hoạch */}
          <div className="flex items-center border-b border-slate-200 gap-1">
            <button type="button" onClick={() => { setPlanScope('personal'); setSelectedProject('all'); }} className={`px-3 py-1.5 border-b-2 text-xs font-bold transition-colors ${planScope === 'personal' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Kế hoạch cá nhân</button>
            {canViewSharedPlans && <>
              <button type="button" onClick={() => setPlanScope('project')} className={`px-3 py-1.5 border-b-2 text-xs font-bold transition-colors ${planScope === 'project' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Kế hoạch dự án</button>
            </>}
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex rounded-md bg-slate-100 p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => handleSetViewMode('month')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                viewMode === 'month' ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">calendar_view_month</span>
              <span>Tháng</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('week')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                viewMode === 'week' ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">calendar_view_week</span>
              <span>Tuần</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('agenda')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                viewMode === 'agenda' ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">view_agenda</span>
              <span>Lộ trình</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => openAddModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-base">add_task</span>
            <span>Lên kế hoạch</span>
          </button>

        </div>
      </div>

      {/* SCROLLABLE BODY: Chức năng cuộn mượt mà toàn bộ nội dung */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 p-1 sm:p-2 md:p-2.5 space-y-3 custom-scrollbar">

        {/* Proactive Alert Banner (Displays if Overdue or Due Soon) */}
        {(stats.overdue > 0 || stats.dueSoon > 0 || stats.dueToday > 0) && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-amber-600 text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">alarm</span>
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>Cảnh báo thời hạn công việc:</span>
                  {stats.overdue > 0 && (
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold">
                      {stats.overdue} Quá hạn
                    </span>
                  )}
                  {stats.dueToday > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-[11px] font-bold">
                      {stats.dueToday} Đến hạn hôm nay
                    </span>
                  )}
                  {stats.dueSoon > 0 && (
                    <span className="px-2 py-0.5 rounded bg-slate-700 text-white text-[11px] font-bold">
                      {stats.dueSoon} Sắp đến hạn (≤ {formatAlertConfigLabel(alertConfig)})
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Vui lòng kiểm tra tiến độ các công việc sắp đến hạn hoặc quá hạn để kịp thời hoàn thành đúng cam kết.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              {stats.overdue > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
                  className="px-3 py-1.5 rounded-md text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer"
                >
                  Xem việc quá hạn ({stats.overdue})
                </button>
              )}
              {stats.dueSoon > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'due_soon' ? 'all' : 'due_soon')}
                  className="px-3 py-1.5 rounded-md text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer"
                >
                  Xem việc sắp đến hạn ({stats.dueSoon})
                </button>
              )}
            </div>
          </div>
        )}

        {/* KPI Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Card: Quá hạn */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              statusFilter === 'overdue'
                ? 'bg-rose-100/90 border-rose-400 ring-1 ring-rose-400'
                : 'bg-white hover:bg-rose-50/50 border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-700 uppercase">Quá hạn</span>
              <span className="material-symbols-outlined text-rose-600 text-lg">warning</span>
            </div>
            <div className="text-2xl font-black text-rose-700 mt-1">{stats.overdue}</div>
            <div className="text-[10px] text-rose-600 font-medium mt-0.5">Cần xử lý gấp</div>
          </button>

          {/* Card: Hạn hôm nay */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'due_today' ? 'all' : 'due_today')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              statusFilter === 'due_today'
                ? 'bg-amber-100/90 border-amber-400 ring-1 ring-amber-400'
                : 'bg-white hover:bg-amber-50/50 border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase">Hạn hôm nay</span>
              <span className="material-symbols-outlined text-amber-600 text-lg">today</span>
            </div>
            <div className="text-2xl font-black text-amber-700 mt-1">{stats.dueToday}</div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">Hoàn thành trong ngày</div>
          </button>

          {/* Card: Sắp đến hạn */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'due_soon' ? 'all' : 'due_soon')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              statusFilter === 'due_soon'
                ? 'bg-blue-100/90 border-blue-400 ring-1 ring-blue-400'
                : 'bg-white hover:bg-blue-50/50 border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 uppercase">Sắp đến hạn</span>
              <span className="material-symbols-outlined text-blue-600 text-lg">alarm</span>
            </div>
            <div className="text-2xl font-black text-blue-700 mt-1">{stats.dueSoon}</div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">Trong vòng ≤ {formatAlertConfigLabel(alertConfig)}</div>
          </button>

          {/* Card: Kế hoạch tương lai */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              statusFilter === 'in_progress'
                ? 'bg-indigo-100/90 border-indigo-400 ring-1 ring-indigo-400'
                : 'bg-white hover:bg-indigo-50/50 border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-700 uppercase">Đang triển khai</span>
              <span className="material-symbols-outlined text-indigo-600 text-lg">pending_actions</span>
            </div>
            <div className="text-2xl font-black text-indigo-700 mt-1">{stats.upcoming}</div>
            <div className="text-[10px] text-indigo-600 font-medium mt-0.5">Kế hoạch những ngày tới</div>
          </button>

          {/* Card: Đã hoàn thành */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              statusFilter === 'completed'
                ? 'bg-emerald-100/90 border-emerald-400 ring-1 ring-emerald-400'
                : 'bg-white hover:bg-emerald-50/50 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase">Đã hoàn thành</span>
              <span className="material-symbols-outlined text-emerald-600 text-lg">task_alt</span>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{stats.completed}</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Tất cả việc đã xong</div>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm kế hoạch, công việc..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-primary focus:bg-white font-medium"
              />
            </div>

            {/* Filter: Dự án */}
            <div className="w-56 min-w-[180px]">
              <CustomSelect
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                searchable={true}
                placeholder="-- Tất cả dự án --"
                className="w-full h-[32px] text-xs bg-slate-50 border border-slate-200 rounded-md font-bold text-slate-700"
              >
                <option value="all">Tất cả dự án</option>
                <option value="KE_HOACH_CONG_TY">Kế hoạch chung công ty</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </CustomSelect>
            </div>

            {/* Filter: Phân công */}
            <div className="w-52 min-w-[170px]">
              <CustomSelect
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                searchable={true}
                placeholder="-- Tất cả người phụ trách --"
                className="w-full h-[32px] text-xs bg-slate-50 border border-slate-200 rounded-md font-bold text-slate-700"
              >
                <option value="all">Tất cả người phụ trách</option>
                <option value="me">Việc của tôi</option>
                {engineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name} ({eng.title || eng.role || 'Kỹ sư'})
                  </option>
                ))}
              </CustomSelect>
            </div>

            {/* Filter: Trạng thái */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md font-bold text-slate-700 focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="overdue">Quá hạn</option>
              <option value="due_today">Hạn hôm nay</option>
              <option value="due_soon">Sắp đến hạn (≤ {formatAlertConfigLabel(alertConfig)})</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="completed">Đã hoàn thành</option>
            </select>

            {/* Reset Filter Button */}
            {(selectedProject !== 'all' || selectedAssignee !== 'all' || statusFilter !== 'all' || searchKeyword) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProject('all');
                  setSelectedAssignee('all');
                  setStatusFilter('all');
                  setSearchKeyword('');
                }}
                className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-md font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                <span>Đặt lại bộ lọc</span>
              </button>
            )}
          </div>

          {/* Navigation Controls (Month / Week) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              Hôm nay
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={viewMode === 'week' ? goToPrevWeek : goToPrevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                title={viewMode === 'week' ? 'Tuần trước' : 'Tháng trước'}
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>

              <span className="text-xs sm:text-sm font-black text-slate-800 px-2 min-w-[140px] text-center">
                {viewMode === 'week' ? (
                  `Tuần ${weekDays[0]?.displayDate} - ${weekDays[6]?.displayDate}`
                ) : (
                  `Tháng ${month + 1} / ${year}`
                )}
              </span>

              <button
                type="button"
                onClick={viewMode === 'week' ? goToNextWeek : goToNextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                title={viewMode === 'week' ? 'Tuần sau' : 'Tháng sau'}
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Mode 1: Lịch Tháng (Month View) */}
        {viewMode === 'month' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center font-bold text-xs text-slate-600 py-2.5 select-none">
              <div className="text-slate-700">Thứ 2</div>
              <div className="text-slate-700">Thứ 3</div>
              <div className="text-slate-700">Thứ 4</div>
              <div className="text-slate-700">Thứ 5</div>
              <div className="text-slate-700">Thứ 6</div>
              <div className="text-blue-600">Thứ 7</div>
              <div className="text-rose-600">Chủ nhật</div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[600px]">
              {calendarDays.map((cell) => {
                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => openAddModal(cell.dateStr)}
                    className={`min-h-[110px] p-1.5 sm:p-2 transition-all flex flex-col group relative cursor-pointer ${
                      cell.isToday
                        ? 'bg-blue-50/40 ring-1 ring-inset ring-primary/40'
                        : cell.isCurrentMonth
                        ? 'bg-white hover:bg-slate-50/80'
                        : 'bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    {/* Date Number & Top Bar */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-black rounded w-6 h-6 flex items-center justify-center ${
                          cell.isToday
                            ? 'bg-primary text-white shadow-2xs'
                            : cell.isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Small Quick Add Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddModal(cell.dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded bg-blue-100 hover:bg-primary text-primary hover:text-white flex items-center justify-center text-xs"
                        title="Thêm kế hoạch / công việc cho ngày này"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                      </button>
                    </div>

                    {/* Tasks in this day */}
                    <div className="flex-1 space-y-1 overflow-hidden">
                      {cell.tasks.slice(0, 3).map((task) => renderTaskChip(task))}

                      {/* Show +X more tasks if > 3 */}
                      {cell.tasks.length > 3 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDayDetailModalDate(cell.dateStr);
                          }}
                          className="w-full text-center py-0.5 text-[10px] font-bold text-primary hover:underline bg-blue-50/60 rounded cursor-pointer"
                        >
                          + {cell.tasks.length - 3} việc khác
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View Mode 2: Lịch Tuần (Week View) */}
        {viewMode === 'week' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {weekDays.map((col) => (
                <div
                  key={col.dateStr}
                  className={`flex flex-col min-h-[500px] ${
                    col.isToday ? 'bg-blue-50/30' : 'bg-white'
                  }`}
                >
                  {/* Day Column Header */}
                  <div
                    className={`p-3 border-b border-slate-200 text-center ${
                      col.isToday ? 'bg-primary text-white' : 'bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider">{col.dayName}</div>
                    <div className={`text-base font-black ${col.isToday ? 'text-white' : 'text-slate-900'}`}>
                      {col.displayDate}
                    </div>
                    {col.isToday && (
                      <span className="inline-block px-2 py-0.5 mt-1 text-[10px] font-bold rounded bg-white/20 text-white">
                        Hôm nay
                      </span>
                    )}
                  </div>

                  {/* Tasks List for Day */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[700px]">
                    {col.tasks.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs italic">
                        Chưa có lịch
                      </div>
                    ) : (
                      col.tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskDetail(task)}
                          className={`p-2.5 rounded-md border transition-all shadow-2xs hover:shadow-xs cursor-pointer ${
                            task.isDone
                              ? 'bg-slate-50 border-slate-200 opacity-70'
                              : task.deadlineStatus === 'overdue'
                              ? 'bg-rose-50 border-rose-300'
                              : task.deadlineStatus === 'due_today'
                              ? 'bg-amber-50 border-amber-300'
                              : 'bg-white border-slate-200 hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold text-slate-500 truncate max-w-[110px]">
                              {task.projectName || task.projectCode}
                            </span>
                            {getPriorityBadge(task.priority)}
                          </div>

                          <div
                            className={`text-xs font-bold text-slate-800 leading-tight ${
                              task.isDone ? 'line-through text-slate-500' : ''
                            }`}
                          >
                            {task.name}
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="truncate flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-slate-400">person</span>
                              {task.assignedEngineerName || 'Chưa giao'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleToggleTaskDone(task, e)}
                              className={`p-1 rounded transition-colors ${
                                task.isDone
                                  ? 'text-emerald-600 hover:bg-emerald-100'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100'
                              }`}
                              title={task.isDone ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
                            >
                              <span className="material-symbols-outlined text-base">
                                {task.isDone ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add task button for this day */}
                  <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => openAddModal(col.dateStr)}
                      className="w-full py-1.5 px-2 rounded text-[11px] font-bold text-slate-600 hover:text-primary hover:bg-blue-50 border border-dashed border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>+ Thêm việc</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Mode 3: Lộ trình / Danh sách Kế hoạch (Agenda View) */}
        {viewMode === 'agenda' && (
          <div className="space-y-3">
            {agendaGroups.length === 0 ? (
              <div className="bg-white rounded-lg p-12 text-center border border-slate-200 shadow-xs">
                <span className="material-symbols-outlined text-5xl text-slate-300">event_busy</span>
                <p className="text-sm font-bold text-slate-600 mt-2">Không tìm thấy công việc nào phù hợp</p>
                <p className="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc thêm kế hoạch mới</p>
                <button
                  type="button"
                  onClick={() => openAddModal()}
                  className="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-md shadow-xs"
                >
                  + Lên kế hoạch ngay
                </button>
              </div>
            ) : (
              agendaGroups.map((group) => (
                <div
                  key={group.key}
                  className={`bg-white rounded-lg border shadow-xs overflow-hidden ${
                    group.key === 'overdue'
                      ? 'border-rose-300 ring-1 ring-rose-300'
                      : group.key === 'today'
                      ? 'border-amber-300 ring-1 ring-amber-300'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Group Header */}
                  <div
                    className={`px-4 py-2.5 flex items-center justify-between border-b ${
                      group.key === 'overdue'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : group.key === 'today'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">{group.icon}</span>
                      <span className="text-xs sm:text-sm font-black tracking-wide">{group.label}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/80 shadow-2xs">
                      {group.items.length} việc
                    </span>
                  </div>

                  {/* Group Items */}
                  <div className="divide-y divide-slate-100">
                    {group.items.map((task) => {
                      const isOverdue = task.deadlineStatus === 'overdue';
                      const isToday = task.deadlineStatus === 'due_today';
                      const isDueSoon = task.deadlineStatus === 'due_soon';

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskDetail(task)}
                          className="p-3 sm:p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Checkbox toggle */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleTaskDone(task, e)}
                              className={`mt-0.5 p-1 rounded transition-colors shrink-0 ${
                                task.isDone
                                  ? 'text-emerald-600 hover:bg-emerald-100'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100'
                              }`}
                              title={task.isDone ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
                            >
                              <span className="material-symbols-outlined text-2xl">
                                {task.isDone ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {task.projectName || task.projectCode}
                                </span>
                                {getPriorityBadge(task.priority)}

                                {isOverdue && (
                                  <span className="px-2 py-0.5 text-[10px] font-black rounded bg-rose-100 text-rose-700 border border-rose-300">
                                    Trễ {Math.abs(task.diffDays || 0)} ngày
                                  </span>
                                )}
                                {isToday && (
                                  <span className="px-2 py-0.5 text-[10px] font-black rounded bg-amber-100 text-amber-800 border border-amber-300">
                                    Hạn hôm nay
                                  </span>
                                )}
                                {isDueSoon && (
                                  <span className="px-2 py-0.5 text-[10px] font-black rounded bg-blue-100 text-blue-700 border border-blue-300">
                                    Còn {task.diffDays} ngày
                                  </span>
                                )}
                              </div>

                              <div
                                className={`text-sm font-bold text-slate-800 leading-snug ${
                                  task.isDone ? 'line-through text-slate-400' : ''
                                }`}
                              >
                                {task.name}
                              </div>

                              {task.notes && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">
                                  {task.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Meta & Assignee */}
                          <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0 self-end sm:self-center">
                            <div className="text-right">
                              <div className="font-bold text-slate-700 flex items-center gap-1 justify-end">
                                <span className="material-symbols-outlined text-sm text-slate-400">person</span>
                                <span>{task.assignedEngineerName || 'Chưa phân công'}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 justify-end mt-0.5">
                                <span className="material-symbols-outlined text-xs">event</span>
                                <span>Hạn: {formatDateVN(task.dueYMD)}</span>
                              </div>
                            </div>

                            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal: + Lên kế hoạch mới */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Lên kế hoạch & Tạo công việc mới"
        icon="add_task"
        size="lg"
      >
        <form onSubmit={handleCreatePlan} className="space-y-4 py-2">
          {/* Tên công việc */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên kế hoạch / công việc <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="VD: Kiểm tra bản vẽ thi công trạm 110kV..."
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Thuộc Dự án */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dự án / Phân loại <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={formProjectCode}
                onChange={(e) => setFormProjectCode(e.target.value)}
                searchable={true}
                placeholder="-- Chọn dự án --"
                className="w-full h-[36px] text-sm border border-slate-300 rounded-md bg-white font-medium"
              >
                <option value="KE_HOACH_CONG_TY">Kế hoạch chung công ty</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </CustomSelect>
            </div>

            {/* Người thực hiện */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Người chịu trách nhiệm <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                value={formAssigneeId}
                onChange={(e) => setFormAssigneeId(e.target.value)}
                searchable={true}
                placeholder="-- Chọn người chịu trách nhiệm --"
                className="w-full h-[36px] text-sm border border-slate-300 rounded-md bg-white font-medium"
              >
                {engineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name} ({eng.title || eng.role || 'Kỹ sư'})
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Ngày bắt đầu */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ngày bắt đầu
              </label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary bg-white font-medium cursor-pointer"
              />
            </div>

            {/* Hạn hoàn thành */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hạn hoàn thành (Deadline) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary bg-white font-medium cursor-pointer"
              />
            </div>

            {/* Mức độ ưu tiên */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mức độ ưu tiên
              </label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary bg-white font-medium cursor-pointer"
              >
                <option value="High">Ưu tiên cao</option>
                <option value="Medium">Bình thường</option>
                <option value="Low">Thấp</option>
              </select>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú / Kế hoạch chi tiết
            </label>
            <textarea
              rows={3}
              placeholder="Nhập nội dung cần chuẩn bị hoặc lưu ý cho những ngày tới..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary font-medium resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-1.5 text-xs font-bold text-white bg-primary hover:bg-blue-700 rounded-md transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu kế hoạch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Day Detail (when clicked +X more tasks in Month View) */}
      {dayDetailModalDate && (
        <Modal
          isOpen={Boolean(dayDetailModalDate)}
          onClose={() => setDayDetailModalDate(null)}
          title={`Công việc ngày ${formatDateVN(dayDetailModalDate)}`}
          icon="calendar_today"
          size="md"
        >
          <div className="space-y-2 py-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                Tổng cộng:{' '}
                {
                  filteredTasks.filter(
                    (t) => t.dueYMD === dayDetailModalDate || t.startYMD === dayDetailModalDate
                  ).length
                }{' '}
                công việc
              </span>
              <button
                type="button"
                onClick={() => {
                  const target = dayDetailModalDate;
                  setDayDetailModalDate(null);
                  openAddModal(target);
                }}
                className="px-2.5 py-1 text-xs font-bold text-primary hover:bg-blue-50 rounded-md flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Thêm việc ngày này</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {filteredTasks
                .filter((t) => t.dueYMD === dayDetailModalDate || t.startYMD === dayDetailModalDate)
                .map((task) => (
                  <div
                    key={task.id}
                    onClick={() => {
                      setDayDetailModalDate(null);
                      setSelectedTaskDetail(task);
                    }}
                    className="p-2.5 rounded-md border border-slate-200 hover:border-primary/50 transition-all flex items-center justify-between gap-2 cursor-pointer bg-white"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{task.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="truncate">{task.projectName || task.projectCode}</span>
                        <span>•</span>
                        <span>{task.assignedEngineerName || 'Chưa giao'}</span>
                      </div>
                    </div>
                    {getPriorityBadge(task.priority)}
                  </div>
                ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Task Detail & Quick Reschedule / Complete */}
      {selectedTaskDetail && (
        <Modal
          isOpen={Boolean(selectedTaskDetail)}
          onClose={() => setSelectedTaskDetail(null)}
          title="Chi tiết kế hoạch công việc"
          icon="event_note"
          size="lg"
        >
          <div className="space-y-4 py-2">
            {/* Header info */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-primary">
                  {selectedTaskDetail.projectName || selectedTaskDetail.projectCode}
                </span>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(selectedTaskDetail.priority)}
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      selectedTaskDetail.isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : selectedTaskDetail.status === 'Đang làm'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {selectedTaskDetail.isDone ? 'Đã hoàn thành' : (selectedTaskDetail.status || 'Đang triển khai')}
                  </span>
                </div>
              </div>

              <h2 className="text-base font-black text-slate-800 leading-snug">
                {selectedTaskDetail.name}
              </h2>
            </div>

            {/* Date and Assignee info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-white border border-slate-200 rounded-md">
                <div className="text-slate-400 font-bold mb-1">Người phụ trách</div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-primary">person</span>
                  <span>{selectedTaskDetail.assignedEngineerName || 'Chưa phân công'}</span>
                </div>
              </div>

              <div className="p-2.5 bg-white border border-slate-200 rounded-md">
                <div className="text-slate-400 font-bold mb-1">Người giao / Lên lịch</div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-slate-500">assignment_ind</span>
                  <span>{selectedTaskDetail.assignerName || 'Hệ thống'}</span>
                </div>
              </div>

              <div className="p-2.5 bg-white border border-slate-200 rounded-md">
                <div className="text-slate-400 font-bold mb-1">Ngày bắt đầu</div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-slate-500">play_arrow</span>
                  <span>{formatDateVN(selectedTaskDetail.startDate)}</span>
                </div>
              </div>

              <div className="p-2.5 bg-white border border-slate-200 rounded-md">
                <div className="text-slate-400 font-bold mb-1">Hạn hoàn thành (Deadline)</div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-rose-500">event</span>
                  <span>{formatDateVN(selectedTaskDetail.dueDate)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedTaskDetail.notes && (
              <div className="p-2.5 bg-white border border-slate-200 rounded-md">
                <div className="text-xs font-bold text-slate-400 mb-1">Ghi chú / Nội dung</div>
                <div className="text-xs text-slate-700 whitespace-pre-line">
                  {selectedTaskDetail.notes}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedTaskDetail(null);
                  if (selectedTaskDetail.projectCode && selectedTaskDetail.projectCode !== 'KE_HOACH_CONG_TY') {
                    const matchedProj = projects.find((p) => p.code === selectedTaskDetail.projectCode);
                    if (matchedProj) {
                      navigate(`/projects/${matchedProj.id}/tasks`);
                      return;
                    }
                  }
                  navigate('/task-assignment');
                }}
                className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                <span>Xem tại trang công việc</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleTaskDone(selectedTaskDetail)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                    selectedTaskDetail.isDone
                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {selectedTaskDetail.isDone ? 'replay' : 'task_alt'}
                  </span>
                  <span>
                    {selectedTaskDetail.isDone ? 'Đánh dấu chưa xong' : 'Xác nhận hoàn thành'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default WorkPlanPage;
