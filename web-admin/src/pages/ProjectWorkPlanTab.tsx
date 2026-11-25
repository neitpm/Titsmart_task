import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore } from '../services/authStore';
import { Task, TaskPriority, TaskStatus, isTaskActuallyDone } from '../types';
import { Modal } from '../components/common/Modal';
import { Toast } from '../components/common/Toast';
import { CustomSelect } from '../components/common/CustomSelect';
import { getTaskTimeBounds } from '../utils/taskPeriodFilter';
import { getEngineersForProject } from '../utils/projectMemberUtils';

type PlanViewMode = 'list' | 'week' | 'month';
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

  // Bộ lọc & Chế độ xem
  const [viewMode, setViewMode] = useState<PlanViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatusType>('all');
  const [showChart, setShowChart] = useState(false);

  // Modal Lập kế hoạch mới
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAssigneeId, setFormAssigneeId] = useState('');
  const [formStartDate, setFormStartDate] = useState(formatDateToYMD(new Date()));
  const [formDueDate, setFormDueDate] = useState(formatDateToYMD(new Date()));
  const [formPriority, setFormPriority] = useState<TaskPriority>('Medium');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({
    show: false,
    message: '',
    type: 'info'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ show: true, message, type });
  };

  // Tất cả công việc thuộc riêng dự án đang mở
  const projectTasks = useMemo(() => {
    if (!projectCode) return [];
    const pCodeNorm = String(projectCode).trim().toLowerCase();
    return tasks.filter((t) => {
      const tCode = String(t.projectCode || '').trim().toLowerCase();
      const tId = String((t as any).projectId || '').trim().toLowerCase();
      return tCode === pCodeNorm || tId === pCodeNorm;
    });
  }, [tasks, projectCode]);

  // Thống kê KPI tóm tắt (Tổng việc, Quá hạn, Hôm nay, Đang làm, Hoàn thành)
  const stats = useMemo(() => {
    const todayStr = formatDateToYMD(new Date());
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
  }, [projectTasks]);

  // Dữ liệu biểu đồ phân bổ theo nhân sự
  const assigneeChartData = useMemo(() => {
    const map: Record<string, { name: string; total: number; done: number; inProgress: number }> = {};
    projectTasks.forEach((t) => {
      const name = t.assignedEngineerName || 'Chưa giao';
      if (!map[name]) map[name] = { name, total: 0, done: 0, inProgress: 0 };
      map[name].total += 1;
      if (isTaskActuallyDone(t)) map[name].done += 1;
      else if (t.status === 'Đang làm') map[name].inProgress += 1;
    });
    return Object.values(map).slice(0, 8);
  }, [projectTasks]);

  // Lọc danh sách công việc
  const filteredTasks = useMemo(() => {
    const todayStr = formatDateToYMD(new Date());

    return projectTasks.filter((t) => {
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

      const isDone = isTaskActuallyDone(t);
      const bounds = getTaskTimeBounds(t);
      const due = bounds.dueDate ? bounds.dueDate.split('T')[0] : '';

      if (statusFilter === 'completed') return isDone;
      if (statusFilter === 'in_progress') return !isDone && (t.status === 'Đang làm' || (t.progress && t.progress > 0));
      if (statusFilter === 'overdue') return !isDone && due && due < todayStr;
      if (statusFilter === 'today') return !isDone && due === todayStr;
      if (statusFilter === 'upcoming') {
        if (isDone || !due || due <= todayStr) return false;
        const diffDays = Math.ceil((new Date(due).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
        return diffDays <= 3;
      }
      if (statusFilter === 'issue') return Boolean(t.issue || t.issueStatus === 'Chưa xử lý');

      return true;
    });
  }, [projectTasks, searchQuery, assigneeFilter, statusFilter]);

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

  return (
    <div className="flex flex-col flex-1 h-full bg-slate-50 overflow-hidden select-text">
      {/* Toast */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* DASHBOARD RIBBON SÁT MÉP: 5 KPI Card chính (Bo nhẹ rounded-md, không gradient, bấm để lọc) */}
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

      {/* BIỂU ĐỒ TIẾN ĐỘ & KHỐI LƯỢNG (HIỂN THỊ KHI CÓ DỮ LIỆU & CÓ NÚT BẬT/TẮT) */}
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

      {/* THANH ĐIỀU HƯỚNG BỘ LỌC SÁT MÉP */}
      <div className="bg-white border-b border-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Bộ lọc bên trái */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          {/* Ô tìm kiếm */}
          <div className="relative min-w-[170px] max-w-xs flex-1">
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
            className="h-[30px] min-w-[140px] rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-primary"
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
            className="h-[30px] min-w-[130px] rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-primary"
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
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              <span>Xóa lọc</span>
            </button>
          )}
        </div>

        {/* Nút hành động bên phải: Toggle biểu đồ, chuyển view, nút tạo */}
        <div className="flex items-center gap-1.5 shrink-0">
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

          {/* Chuyển chế độ xem Tháng / Tuần / Danh sách */}
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold h-[30px] items-center">
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
              onClick={() => setViewMode('month')}
              className={`px-2 py-0.5 rounded-sm transition-all cursor-pointer h-[24px] ${
                viewMode === 'month'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tháng
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-xs transition-colors cursor-pointer h-[30px]"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Lên kế hoạch</span>
          </button>
        </div>
      </div>

      {/* KHÔNG GIAN BẢNG / NỘI DUNG SÁT MÉP HOÀN TOÀN (0 PADDING) */}
      <div className="flex-1 w-full overflow-x-auto overflow-y-auto custom-scrollbar bg-white min-w-0">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-center p-6">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-1.5">event_busy</span>
            <p className="text-xs font-bold text-slate-700">Không tìm thấy công việc phù hợp</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Thử thay đổi bộ lọc hoặc bấm nút <b>"Lên kế hoạch"</b> để thêm công việc mới.
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* CHẾ ĐỘ DANH SÁCH BẢNG SÁT MÉP HOÀN TOÀN (FULL-BLEED TABLE) */
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
              {filteredTasks.map((task, index) => {
                const bounds = getTaskTimeBounds(task);
                const isDone = isTaskActuallyDone(task);
                const todayStr = formatDateToYMD(new Date());
                const isOverdue = !isDone && bounds.dueDate && bounds.dueDate < todayStr;
                const displayStartDate = task.startDate ? formatDateVN(task.startDate) : '—';
                const displayDueDate = bounds.dueDate ? formatDateVN(bounds.dueDate) : '—';

                return (
                  <tr key={task.id} className="hover:bg-blue-50/40 transition-colors">
                    {/* STT */}
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10.5px]">
                      {index + 1}
                    </td>

                    {/* Tên công việc / Kế hoạch - sạch sẽ, không chấm tròn AI */}
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
                      <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
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
                          isDone
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isOverdue
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {isDone ? 'Hoàn thành' : isOverdue ? 'Quá hạn' : task.status || 'Đang làm'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* CHẾ ĐỘ TUẦN / THÁNG (SÁT MÉP VÀ GỌN GÀNG) */
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredTasks.map((task) => {
              const bounds = getTaskTimeBounds(task);
              const isDone = isTaskActuallyDone(task);
              const todayStr = formatDateToYMD(new Date());
              const isOverdue = !isDone && bounds.dueDate && bounds.dueDate < todayStr;
              const displayDueDate = bounds.dueDate ? formatDateVN(bounds.dueDate) : '—';

              return (
                <div
                  key={task.id}
                  className="p-2.5 bg-white border border-slate-200 rounded-md shadow-2xs hover:border-primary/50 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-sm border ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isOverdue
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {isDone ? 'Hoàn thành' : isOverdue ? 'Quá hạn' : 'Đang làm'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-semibold">{displayDueDate}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">{task.name}</h4>
                    {task.notes && (
                      <p className="text-[10.5px] text-slate-500 mt-1 line-clamp-2">{task.notes}</p>
                    )}
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                    <span className="truncate">{task.assignedEngineerName || 'Chưa giao'}</span>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-sm ${
                        task.priority === 'High' ? 'text-rose-600' : 'text-slate-500'
                      }`}
                    >
                      {task.priority === 'High' ? 'Ưu tiên' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL TẠO KẾ HOẠCH MỚI (Tự động khóa projectCode) */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Lên kế hoạch dự án"
          size="md"
        >
          <form onSubmit={handleCreatePlan} className="space-y-3.5 py-1">
            {/* Thông tin dự án được khóa cố định */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dự án áp dụng</label>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-800">
                <span className="material-symbols-outlined text-sm text-primary">lock</span>
                <span className="font-bold text-primary">{projectName}</span>
                <span className="text-slate-400 font-mono text-[11px]">({projectCode})</span>
              </div>
            </div>

            {/* Tên kế hoạch / công việc */}
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

            {/* Người phụ trách */}
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

            {/* Ngày bắt đầu & Hạn hoàn thành */}
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

            {/* Mức độ ưu tiên */}
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

            {/* Ghi chú */}
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

            {/* Buttons */}
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
