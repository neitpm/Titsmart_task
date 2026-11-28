import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore } from '../services/authStore';
import { Task, TaskPriority, TaskStatus, isTaskActuallyDone } from '../types';
import { Modal } from '../components/common/Modal';
import { Toast } from '../components/common/Toast';
import { CustomSelect } from '../components/common/CustomSelect';
import { getTaskTimeBounds } from '../utils/taskPeriodFilter';
import { getEngineersForProject } from '../utils/projectMemberUtils';

type PlanViewMode = 'month' | 'week' | 'list';
type FilterStatusType = 'all' | 'overdue' | 'today' | 'upcoming' | 'in_progress' | 'completed' | 'issue';

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

// Hàm nhận diện và loại trừ triệt để các dòng Đầu mục / Tiêu đề nhóm
const isTaskSectionHeader = (node: any) => {
  if (node?.isSectionHeader) return true;
  if (String(node?.notes || '').toLowerCase().includes('[section]')) return true;
  const vol = Number(node?.volume || 0);
  const unitVal = String(node?.unit || '').trim();
  const name = String(node?.name || '').trim();
  const stt = String(node?.stt || '').trim();
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

export const ProjectWorkPlanTab: React.FC = () => {
  const { projectId } = useParams();
  const projects = useRealtimeStore((state) => state.projects);
  const tasks = useRealtimeStore((state) => state.tasks);
  const engineers = useRealtimeStore((state) => state.engineers);
  const addTask = useRealtimeStore((state) => state.addTask);
  const updateTask = useRealtimeStore((state) => state.updateTask);
  const fetchTasks = useRealtimeStore((state) => state.fetchTasks);
  const fetchProjects = useRealtimeStore((state) => state.fetchProjects);
  const fetchEngineers = useRealtimeStore((state) => state.fetchEngineers);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (tasks.length === 0) fetchTasks();
    if (projects.length === 0) fetchProjects();
    if (engineers.length === 0) fetchEngineers();
  }, []);

  const currentProject = useMemo(() => {
    if (!projectId) return null;
    const decodedId = decodeURIComponent(projectId).trim().toLowerCase();
    return projects.find(
      (p) =>
        p.id?.toLowerCase() === decodedId ||
        p.code?.toLowerCase() === decodedId ||
        p.name?.toLowerCase() === decodedId
    );
  }, [projects, projectId]);

  const projectCode = currentProject?.code || projectId || '';
  const projectName = currentProject?.name || projectCode;

  const projectEngineers = useMemo(() => {
    return getEngineersForProject(currentProject?.code || projectId, engineers, projects);
  }, [currentProject, projectId, engineers, projects]);

  // Bộ lọc & Chế độ xem (Mặc định Month view như lịch người dùng yêu cầu)
  const [viewMode, setViewMode] = useState<PlanViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatusType>('all');
  const [showChart, setShowChart] = useState(true);

  // Modal Lập kế hoạch mới
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAssigneeId, setFormAssigneeId] = useState('');
  const [formStartDate, setFormStartDate] = useState(formatDateToYMD(new Date()));
  const [formDueDate, setFormDueDate] = useState(formatDateToYMD(new Date()));
  const [formPriority, setFormPriority] = useState<TaskPriority>('Medium');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Chi tiết công việc
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    show: false,
    message: '',
    type: 'info'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ show: true, message, type });
  };

  const todayStr = useMemo(() => formatDateToYMD(new Date()), []);

  // Lọc chỉ các công việc thực tế thuộc dự án (loại trừ toàn bộ đầu mục)
  const projectTasks = useMemo(() => {
    if (!projectCode) return [];
    const pCodeNorm = String(projectCode).trim().toLowerCase();
    return tasks.filter((t) => {
      if (isTaskSectionHeader(t)) return false;
      const tCode = String(t.projectCode || '').trim().toLowerCase();
      const tId = String((t as any).projectId || '').trim().toLowerCase();
      const isBelong = tCode === pCodeNorm || tId === pCodeNorm;
      return isBelong && Boolean(t.name && t.name.trim());
    });
  }, [tasks, projectCode]);

  // Thống kê KPI tóm tắt
  const stats = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let inProgress = 0;
    let completed = 0;

    projectTasks.forEach((t) => {
      const isDone = isTaskActuallyDone(t);
      const bounds = getTaskTimeBounds(t);
      const due = bounds.dueDate ? bounds.dueDate.split('T')[0] : '';

      if (isDone) {
        completed++;
      } else {
        if (t.status === 'Đang làm' || (t.progress && t.progress > 0)) {
          inProgress++;
        }
        if (due) {
          if (due < todayStr) {
            overdue++;
          } else if (due === todayStr) {
            today++;
          } else {
            const diffDays = Math.ceil((new Date(due).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
            if (diffDays <= 3) {
              upcoming++;
            }
          }
        }
      }
    });

    return {
      total: projectTasks.length,
      overdue,
      today,
      upcoming,
      inProgress,
      completed
    };
  }, [projectTasks, todayStr]);

  // Phân tích công việc kèm mốc thời gian YMD
  const analyzedTasks = useMemo(() => {
    return projectTasks.map((t) => {
      const bounds = getTaskTimeBounds(t);
      const isDone = isTaskActuallyDone(t);
      const dueYMD = bounds.dueDate || (t.dueDate ? String(t.dueDate).split('T')[0] : '');
      const startYMD = bounds.acceptedDate || (t.startDate ? String(t.startDate).split('T')[0] : '');
      const isOverdue = !isDone && Boolean(dueYMD && dueYMD < todayStr);
      const isToday = !isDone && dueYMD === todayStr;

      return {
        ...t,
        bounds,
        isDone,
        dueYMD,
        startYMD,
        isOverdue,
        isToday
      };
    });
  }, [projectTasks, todayStr]);

  // Lọc theo tìm kiếm, người phụ trách, trạng thái
  const filteredTasks = useMemo(() => {
    return analyzedTasks.filter((t) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = String(t.name || '').toLowerCase().includes(query);
        const matchAssignee = String(t.assignedEngineerName || '').toLowerCase().includes(query);
        if (!matchName && !matchAssignee) return false;
      }

      if (assigneeFilter !== 'all') {
        const matchesAssignee =
          t.assignedEngineerId === assigneeFilter ||
          t.assignedEngineerName === assigneeFilter ||
          (t as any).assigneeId === assigneeFilter;
        if (!matchesAssignee) return false;
      }

      if (statusFilter === 'completed') return t.isDone;
      if (statusFilter === 'in_progress') return !t.isDone && (t.status === 'Đang làm' || (t.progress && t.progress > 0));
      if (statusFilter === 'overdue') return t.isOverdue;
      if (statusFilter === 'today') return t.isToday;
      if (statusFilter === 'upcoming') {
        if (t.isDone || !t.dueYMD || t.dueYMD <= todayStr) return false;
        const diffDays = Math.ceil((new Date(t.dueYMD).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
        return diffDays <= 3;
      }
      if (statusFilter === 'issue') return Boolean(t.issue || t.issueStatus === 'Chưa xử lý');

      return true;
    });
  }, [analyzedTasks, searchQuery, assigneeFilter, statusFilter, todayStr]);

  // Dữ liệu biểu đồ theo nhân sự
  const assigneeChartData = useMemo(() => {
    const map: Record<string, { name: string; total: number; done: number; inProgress: number }> = {};
    filteredTasks.forEach((t) => {
      const name = t.assignedEngineerName || 'Chưa giao';
      if (!map[name]) map[name] = { name, total: 0, done: 0, inProgress: 0 };
      map[name].total += 1;
      if (t.isDone) map[name].done += 1;
      else if (t.status === 'Đang làm') map[name].inProgress += 1;
    });
    return Object.values(map).slice(0, 8);
  }, [filteredTasks]);

  // --- LOGIC LỊCH THÁNG (7 CỘT THỨ 2 -> CHỦ NHẬT) ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
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
  const goToToday = () => setCurrentDate(new Date());

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Bắt đầu từ Thứ 2 (0 = Thứ 2, ..., 6 = CN)
    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInCurrentMonth = lastDayOfMonth.getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      tasks: typeof filteredTasks;
    }> = [];

    // Ngày bù tháng trước
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

    // Ngày trong tháng hiện tại
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

    // Ngày bù tháng sau để đủ lưới
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

  // --- LOGIC LỊCH TUẦN (7 CỘT THỨ 2 -> CHỦ NHẬT) ---
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const dayOfWeek = (d.getDay() + 6) % 7;
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

  // Mở modal tạo công việc nhanh cho ngày cụ thể
  const openAddModal = (targetDate?: string) => {
    const target = targetDate || todayStr;
    setFormName('');
    setFormAssigneeId('');
    setFormStartDate(target);
    setFormDueDate(target);
    setFormPriority('Medium');
    setFormNotes('');
    setIsModalOpen(true);
  };

  // Tạo kế hoạch mới
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Vui lòng nhập nội dung kế hoạch / công việc!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedEngineer = engineers.find(
        (eng) => eng.id === formAssigneeId || eng.name === formAssigneeId
      );

      const newTaskData: Omit<Task, 'id'> = {
        name: formName.trim(),
        code: `TASK-${Date.now().toString().slice(-6)}`,
        stt: String(projectTasks.length + 1),
        projectCode: projectCode,
        projectName: projectName,
        volume: 1,
        unit: 'Công việc',
        progress: 0,
        assignedEngineerId: selectedEngineer?.id || formAssigneeId || undefined,
        assignedEngineerName: selectedEngineer?.name || (formAssigneeId ? formAssigneeId : undefined),
        startDate: formStartDate || undefined,
        dueDate: formDueDate || undefined,
        priority: formPriority,
        notes: formNotes.trim() || undefined,
        status: 'Chưa làm',
        purchaseStatus: 'Chưa đặt hàng',
        constrStatus: 'Chưa thi công',
        isDone: false,
        createdAt: new Date().toISOString()
      };

      await addTask(newTaskData);
      showToast('Đã lên kế hoạch thành công!', 'success');
      setIsModalOpen(false);

      setFormName('');
      setFormAssigneeId('');
      setFormStartDate(formatDateToYMD(new Date()));
      setFormDueDate(formatDateToYMD(new Date()));
      setFormPriority('Medium');
      setFormNotes('');
    } catch (err: any) {
      console.error('Lỗi khi tạo kế hoạch:', err);
      showToast('Không thể tạo kế hoạch: ' + (err?.message || 'Lỗi hệ thống'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle trạng thái hoàn thành trực tiếp
  const handleToggleTaskDone = async (task: Task) => {
    const currentDone = isTaskActuallyDone(task);
    const nextDone = !currentDone;
    const nextStatus: TaskStatus = nextDone ? 'Hoàn thành' : 'Đang làm';
    const nextProgress = nextDone ? 1 : 0.5;

    try {
      await updateTask(task.id, {
        isDone: nextDone,
        status: nextStatus,
        progress: nextProgress,
        completedAt: nextDone ? new Date().toISOString() : undefined
      });
      showToast(nextDone ? `Đã hoàn thành: "${task.name}"` : `Chuyển về đang làm: "${task.name}"`, 'success');
      if (selectedTaskDetail && selectedTaskDetail.id === task.id) {
        setSelectedTaskDetail({
          ...selectedTaskDetail,
          isDone: nextDone,
          status: nextStatus,
          progress: nextProgress
        });
      }
    } catch (err) {
      showToast('Không thể cập nhật trạng thái', 'error');
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full bg-slate-50 overflow-hidden select-text">
      {/* Toast */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* DASHBOARD RIBBON SÁT MÉP: 5 KPI Card chính (Bấm lọc trực tiếp) */}
      <div className="bg-white border-b border-slate-200 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {/* 1. Tổng công việc */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`p-2.5 sm:p-3 text-left transition-colors cursor-pointer flex flex-col justify-between ${
              statusFilter === 'all'
                ? 'bg-blue-50/70 border-b-2 border-primary'
                : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-tight">
              <span>Tổng kế hoạch</span>
              <span className="material-symbols-outlined text-[16px] text-slate-400">checklist</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{stats.total}</span>
              <span className="text-[11px] text-slate-400 font-medium">việc</span>
            </div>
          </button>

          {/* 2. Quá hạn */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
            className={`p-2.5 sm:p-3 text-left transition-colors cursor-pointer flex flex-col justify-between ${
              statusFilter === 'overdue'
                ? 'bg-rose-50 border-b-2 border-rose-500'
                : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-rose-600 uppercase tracking-tight">
              <span>Quá hạn</span>
              <span className="material-symbols-outlined text-[16px] text-rose-500">warning</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black leading-none ${stats.overdue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {stats.overdue}
              </span>
              <span className="text-[11px] text-rose-500 font-medium">{stats.overdue > 0 ? 'cần xử lý' : 'an toàn'}</span>
            </div>
          </button>

          {/* 3. Đến hạn hôm nay */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'today' ? 'all' : 'today')}
            className={`p-2.5 sm:p-3 text-left transition-colors cursor-pointer flex flex-col justify-between ${
              statusFilter === 'today'
                ? 'bg-amber-50 border-b-2 border-amber-500'
                : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-600 uppercase tracking-tight">
              <span>Hôm nay</span>
              <span className="material-symbols-outlined text-[16px] text-amber-500">today</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black leading-none ${stats.today > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {stats.today}
              </span>
              <span className="text-[11px] text-amber-500 font-medium">trong ngày</span>
            </div>
          </button>

          {/* 4. Đang làm */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
            className={`p-2.5 sm:p-3 text-left transition-colors cursor-pointer flex flex-col justify-between ${
              statusFilter === 'in_progress'
                ? 'bg-blue-50 border-b-2 border-blue-500'
                : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-blue-600 uppercase tracking-tight">
              <span>Đang thực hiện</span>
              <span className="material-symbols-outlined text-[16px] text-blue-500">pending_actions</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-blue-600 leading-none">{stats.inProgress}</span>
              <span className="text-[11px] text-blue-500 font-medium">đang chạy</span>
            </div>
          </button>

          {/* 5. Hoàn thành */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
            className={`p-2.5 sm:p-3 text-left transition-colors cursor-pointer flex flex-col justify-between col-span-2 sm:col-span-1 ${
              statusFilter === 'completed'
                ? 'bg-emerald-50 border-b-2 border-emerald-500'
                : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 uppercase tracking-tight">
              <span>Đã hoàn thành</span>
              <span className="material-symbols-outlined text-[16px] text-emerald-500">task_alt</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-600 leading-none">{stats.completed}</span>
              <span className="text-[11px] text-emerald-500 font-medium">
                {stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : '0%'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* BIỂU ĐỒ TIẾN ĐỘ & KHỐI LƯỢNG (HIỂN THỊ KHI BẬT) */}
      {showChart && (
        <div className="bg-white border-b border-slate-200 p-3 shrink-0 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-primary">bar_chart</span>
              <span>Khối lượng & Tiến độ theo người phụ trách</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowChart(false)}
              className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Thu gọn</span>
              <span className="material-symbols-outlined text-sm">expand_less</span>
            </button>
          </div>

          {assigneeChartData.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 font-medium">
              Chưa có dữ liệu phân công công việc để vẽ biểu đồ
            </div>
          ) : (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assigneeChartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="total" name="Tổng việc" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="inProgress" name="Đang làm" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="done" name="Hoàn thành" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* THANH ĐIỀU HƯỚNG BỘ LỌC & CHUYỂN THÁNG/TUẦN SÁT MÉP */}
      <div className="bg-white border-b border-slate-200 px-3 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        {/* Bộ lọc bên trái */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 flex-1 w-full sm:w-auto">
          {/* Ô tìm kiếm */}
          <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[15px]">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm theo tên việc, nhân sự..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-7 pr-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white transition-all h-[30px]"
            />
          </div>

          {/* Lọc theo Nhân sự phụ trách */}
          <CustomSelect
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="h-[30px] flex-1 sm:flex-none min-w-[120px] rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-primary"
          >
            <option value="all">Tất cả nhân sự</option>
            {projectEngineers.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </CustomSelect>

          {/* Lọc theo Trạng thái */}
          <CustomSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-[30px] flex-1 sm:flex-none min-w-[120px] rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-primary"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="in_progress">Đang làm</option>
            <option value="overdue">Quá hạn</option>
            <option value="today">Hôm nay</option>
            <option value="upcoming">Sắp đến hạn (≤ 3 ngày)</option>
            <option value="completed">Đã hoàn thành</option>
          </CustomSelect>

          {statusFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-0.5 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              <span>Xóa lọc</span>
            </button>
          )}
        </div>

        {/* Cụm điều khiển Tháng/Tuần và Chế độ xem bên phải */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-between w-full sm:w-auto overflow-x-auto pb-0.5 sm:pb-0">
          {/* Nút điều hướng tháng / tuần (khi ở chế độ Month hoặc Week) */}
          {viewMode !== 'list' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToToday}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer h-[30px]"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={viewMode === 'week' ? goToPrevWeek : goToPrevMonth}
                className="w-7 h-[30px] flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                title={viewMode === 'week' ? 'Tuần trước' : 'Tháng trước'}
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <span className="text-xs font-black text-slate-800 px-2 min-w-[110px] text-center select-none">
                {viewMode === 'week'
                  ? `Tuần ${weekDays[0]?.displayDate} - ${weekDays[6]?.displayDate}`
                  : `Tháng ${month + 1} / ${year}`}
              </span>
              <button
                type="button"
                onClick={viewMode === 'week' ? goToNextWeek : goToNextMonth}
                className="w-7 h-[30px] flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                title={viewMode === 'week' ? 'Tuần sau' : 'Tháng sau'}
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          )}

          {/* Nút bật/tắt biểu đồ */}
          <button
            type="button"
            onClick={() => setShowChart(!showChart)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer h-[30px] ${
              showChart
                ? 'bg-blue-50 text-primary border-blue-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Bật / tắt biểu đồ tiến độ"
          >
            <span className="material-symbols-outlined text-[15px]">bar_chart</span>
            <span className="hidden sm:inline">Biểu đồ</span>
          </button>

          {/* Chuyển 3 chế độ xem: Tháng / Tuần / Danh sách */}
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold h-[30px] items-center">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-2 py-0.5 rounded-sm transition-all cursor-pointer h-[24px] ${
                viewMode === 'month'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tháng
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-2 py-0.5 rounded-sm transition-all cursor-pointer h-[24px] ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tuần
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2 py-0.5 rounded-sm transition-all cursor-pointer h-[24px] ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Danh sách
            </button>
          </div>

          {/* Nút Lên kế hoạch */}
          <button
            type="button"
            onClick={() => openAddModal()}
            className="flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-xs transition-colors cursor-pointer h-[30px]"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Lên kế hoạch</span>
          </button>
        </div>
      </div>

      {/* VÙNG HIỂN THỊ NỘI DUNG SÁT MÉP 100% */}
      <div className="flex-1 w-full overflow-x-auto overflow-y-auto custom-scrollbar bg-white min-w-0">
        {/* CHẾ ĐỘ 1: LỊCH THÁNG (CHUẨN LƯỚI 7 CỘT THỨ 2 - CHỦ NHẬT) */}
        {viewMode === 'month' && (
          <div className="w-full h-full flex flex-col min-w-[750px] select-none">
            {/* Header các ngày trong tuần */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center font-bold text-xs py-2 select-none shrink-0">
              <div className="text-slate-700">Thứ 2</div>
              <div className="text-slate-700">Thứ 3</div>
              <div className="text-slate-700">Thứ 4</div>
              <div className="text-slate-700">Thứ 5</div>
              <div className="text-slate-700">Thứ 6</div>
              <div className="text-blue-600">Thứ 7</div>
              <div className="text-rose-600">Chủ nhật</div>
            </div>

            {/* Lưới các ngày trong tháng */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 flex-1 min-h-[550px]">
              {calendarDays.map((cell) => {
                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => openAddModal(cell.dateStr)}
                    className={`min-h-[100px] p-1.5 transition-all flex flex-col group relative cursor-pointer ${
                      cell.isToday
                        ? 'bg-blue-50/40 ring-1 ring-inset ring-primary/50'
                        : cell.isCurrentMonth
                        ? 'bg-white hover:bg-slate-50/80'
                        : 'bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    {/* Hàng số ngày & Nút + hover */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-black rounded w-6 h-6 flex items-center justify-center ${
                          cell.isToday
                            ? 'bg-primary text-white shadow-2xs font-extrabold'
                            : cell.isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Nút + nhanh khi hover vào ô ngày */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddModal(cell.dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded bg-blue-100 hover:bg-primary text-primary hover:text-white flex items-center justify-center text-xs cursor-pointer shadow-2xs"
                        title={`Thêm công việc cho ngày ${cell.dateStr}`}
                      >
                        <span className="material-symbols-outlined text-[13px]">add</span>
                      </button>
                    </div>

                    {/* Danh sách công việc của ngày */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[120px] custom-scrollbar">
                      {cell.tasks.slice(0, 3).map((task) => {
                        return (
                          <div
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskDetail(task);
                            }}
                            className={`p-1 rounded text-[10.5px] border transition-all cursor-pointer flex items-center justify-between gap-1 shadow-2xs ${
                              task.isDone
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 line-through opacity-75'
                                : task.isOverdue
                                ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                                : task.isToday
                                ? 'bg-amber-50 text-amber-900 border-amber-200 font-semibold'
                                : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                            }`}
                            title={`${task.name} (${task.assignedEngineerName || 'Chưa giao'})`}
                          >
                            <span className="truncate flex-1">{task.name}</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTaskDone(task);
                              }}
                              className={`material-symbols-outlined text-[13px] shrink-0 hover:text-primary ${
                                task.isDone ? 'text-emerald-600' : 'text-slate-400'
                              }`}
                              title={task.isDone ? 'Đã hoàn thành (bấm để mở lại)' : 'Bấm để đánh dấu hoàn thành'}
                            >
                              {task.isDone ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                          </div>
                        );
                      })}

                      {cell.tasks.length > 3 && (
                        <div className="text-[10px] text-primary font-bold text-center py-0.5 bg-blue-50/80 rounded">
                          + {cell.tasks.length - 3} việc khác
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHẾ ĐỘ 2: LỊCH TUẦN (7 CỘT THỨ 2 -> CHỦ NHẬT) */}
        {viewMode === 'week' && (
          <div className="w-full h-full flex flex-col min-w-[750px] select-none">
            <div className="grid grid-cols-7 divide-x divide-slate-200 flex-1 min-h-[550px]">
              {weekDays.map((col) => (
                <div
                  key={col.dateStr}
                  className={`flex flex-col min-h-[500px] ${
                    col.isToday ? 'bg-blue-50/20' : 'bg-white'
                  }`}
                >
                  {/* Tiêu đề ngày trong tuần */}
                  <div
                    className={`p-2 border-b border-slate-200 text-center select-none ${
                      col.isToday ? 'bg-primary text-white' : 'bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider">{col.dayName}</div>
                    <div className={`text-sm font-black ${col.isToday ? 'text-white' : 'text-slate-900'}`}>
                      {col.displayDate}
                    </div>
                  </div>

                  {/* Danh sách công việc trong ngày */}
                  <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {col.tasks.length === 0 ? (
                      <div className="text-center py-8 text-slate-300 text-[11px] italic">
                        Trống
                      </div>
                    ) : (
                      col.tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskDetail(task)}
                          className={`p-2 rounded-md border transition-all cursor-pointer shadow-2xs flex flex-col gap-1 ${
                            task.isDone
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : task.isOverdue
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-white hover:border-primary border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-bold leading-snug line-clamp-2">{task.name}</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTaskDone(task);
                              }}
                              className={`material-symbols-outlined text-[15px] shrink-0 cursor-pointer ${
                                task.isDone ? 'text-emerald-600' : 'text-slate-400 hover:text-primary'
                              }`}
                            >
                              {task.isDone ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            <span className="truncate">{task.assignedEngineerName || 'Chưa giao'}</span>
                            <span className={`font-bold ${task.isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                              {formatDateVN(task.dueYMD)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHẾ ĐỘ 3: DANH SÁCH BẢNG CHI TIẾT SÁT MÉP */}
        {viewMode === 'list' && (
          <table className="w-full text-left border-collapse text-[11px] min-w-[750px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10 select-none">
              <tr>
                <th className="py-2 px-3 w-12 text-center">STT</th>
                <th className="py-2 px-3">Tên kế hoạch / Công việc</th>
                <th className="py-2 px-3 w-40">Người phụ trách</th>
                <th className="py-2 px-3 w-28">Bắt đầu</th>
                <th className="py-2 px-3 w-28">Hạn hoàn thành</th>
                <th className="py-2 px-3 w-24 text-center">Ưu tiên</th>
                <th className="py-2 px-3 w-28 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-medium">
                    Không tìm thấy công việc phù hợp
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, index) => {
                  const displayStartDate = task.startDate ? formatDateVN(task.startDate) : '—';
                  const displayDueDate = task.dueYMD ? formatDateVN(task.dueYMD) : '—';

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTaskDetail(task)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    >
                      {/* STT */}
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10.5px]">
                        {index + 1}
                      </td>

                      {/* Tên công việc */}
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-800 leading-snug">{task.name}</div>
                        {task.notes && (
                          <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{task.notes}</div>
                        )}
                      </td>

                      {/* Người phụ trách */}
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px] flex items-center justify-center shrink-0">
                            {task.assignedEngineerName ? task.assignedEngineerName.charAt(0).toUpperCase() : '?'}
                          </span>
                          <span className="truncate">{task.assignedEngineerName || 'Chưa giao'}</span>
                        </div>
                      </td>

                      {/* Ngày bắt đầu */}
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap font-mono text-[10.5px]">
                        {displayStartDate}
                      </td>

                      {/* Hạn hoàn thành */}
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[10.5px]">
                        <span className={task.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                          {displayDueDate}
                        </span>
                      </td>

                      {/* Mức ưu tiên */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-sm border ${
                            task.priority === 'High'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : task.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {task.priority === 'High' ? 'Cao' : task.priority === 'Medium' ? 'Thường' : 'Thấp'}
                        </span>
                      </td>

                      {/* Trạng thái */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`text-[9.5px] font-bold px-2 py-0.5 rounded-sm border ${
                            task.isDone
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : task.isOverdue
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {task.isDone ? 'Hoàn thành' : task.isOverdue ? 'Quá hạn' : task.status || 'Đang làm'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL CHI TIẾT CÔNG VIỆC KHI BẤM VÀO ITEM */}
      {selectedTaskDetail && (
        <Modal
          isOpen={Boolean(selectedTaskDetail)}
          onClose={() => setSelectedTaskDetail(null)}
          title="Chi tiết kế hoạch công việc"
          size="md"
        >
          <div className="space-y-3 py-1">
            <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-mono text-primary font-bold">
                  {selectedTaskDetail.code || 'TASK'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${
                    selectedTaskDetail.isDone
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {selectedTaskDetail.isDone ? 'Đã hoàn thành' : selectedTaskDetail.status || 'Đang làm'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 leading-snug">{selectedTaskDetail.name}</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-white border border-slate-200 rounded-md">
                <span className="text-[10px] text-slate-400 font-bold block">Người phụ trách</span>
                <span className="font-semibold text-slate-800">{selectedTaskDetail.assignedEngineerName || 'Chưa giao'}</span>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-md">
                <span className="text-[10px] text-slate-400 font-bold block">Mức độ ưu tiên</span>
                <span className="font-semibold text-slate-800">{selectedTaskDetail.priority || 'Bình thường'}</span>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-md">
                <span className="text-[10px] text-slate-400 font-bold block">Ngày bắt đầu</span>
                <span className="font-mono text-slate-700">{formatDateVN(selectedTaskDetail.startDate)}</span>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-md">
                <span className="text-[10px] text-slate-400 font-bold block">Hạn hoàn thành</span>
                <span className="font-mono text-slate-700 font-bold">{formatDateVN(selectedTaskDetail.dueDate)}</span>
              </div>
            </div>

            {selectedTaskDetail.notes && (
              <div className="p-2 bg-white border border-slate-200 rounded-md text-xs">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Ghi chú</span>
                <p className="text-slate-700 whitespace-pre-line">{selectedTaskDetail.notes}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleToggleTaskDone(selectedTaskDetail)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  selectedTaskDetail.isDone
                    ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {selectedTaskDetail.isDone ? 'replay' : 'check_circle'}
                </span>
                <span>{selectedTaskDetail.isDone ? 'Mở lại việc' : 'Đánh dấu đã hoàn thành'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTaskDetail(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL TẠO KẾ HOẠCH MỚI */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Lên kế hoạch dự án"
          size="md"
        >
          <form onSubmit={handleCreatePlan} className="space-y-3 py-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dự án áp dụng</label>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-800">
                <span className="material-symbols-outlined text-sm text-primary">lock</span>
                <span className="font-bold text-primary">{projectName}</span>
                <span className="text-slate-400 font-mono text-[11px]">({projectCode})</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nội dung công việc <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Ví dụ: Thi công lắp đặt máy biến áp, kéo rải cáp ngầm..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Người phụ trách</label>
              <CustomSelect
                value={formAssigneeId}
                onChange={(e) => setFormAssigneeId(e.target.value)}
                className="w-full h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-primary"
              >
                <option value="">-- Chưa giao / Chọn sau --</option>
                {projectEngineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name} ({eng.role || 'Kỹ sư'})
                  </option>
                ))}
              </CustomSelect>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ngày bắt đầu</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded-md text-xs font-semibold focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hạn hoàn thành <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded-md text-xs font-semibold focus:border-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ ưu tiên</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Low', 'Medium', 'High'] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormPriority(p)}
                    className={`py-1.5 px-2 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                      formPriority === p
                        ? p === 'High'
                          ? 'bg-rose-50 border-rose-500 text-rose-700'
                          : p === 'Medium'
                          ? 'bg-amber-50 border-amber-500 text-amber-700'
                          : 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p === 'High' ? 'Ưu tiên cao' : p === 'Medium' ? 'Bình thường' : 'Thấp'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú bổ sung</label>
              <input
                type="text"
                placeholder="Ghi chú thêm về yêu cầu, vật tư hoặc địa điểm..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none h-8"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs font-bold bg-primary hover:bg-blue-700 text-white rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu kế hoạch'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
