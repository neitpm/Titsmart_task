import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore } from '../services/authStore';
import { Task, TaskPriority, TaskStatus, isTaskActuallyDone } from '../types';
import { Modal } from '../components/common/Modal';
import { Toast } from '../components/common/Toast';
import { CustomSelect } from '../components/common/CustomSelect';
import { getTaskTimeBounds } from '../utils/taskPeriodFilter';
import { getEngineersForProject } from '../utils/projectMemberUtils';

type PlanViewMode = 'month' | 'week' | 'list';

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
  const fetchTasks = useRealtimeStore((state) => state.fetchTasks);
  const fetchProjects = useRealtimeStore((state) => state.fetchProjects);
  const fetchEngineers = useRealtimeStore((state) => state.fetchEngineers);
  const user = useAuthStore((state) => state.user);

  // Tự động load dữ liệu nếu chưa có
  useEffect(() => {
    if (tasks.length === 0) fetchTasks();
    if (projects.length === 0) fetchProjects();
    if (engineers.length === 0) fetchEngineers();
  }, []);

  // Xác định dự án hiện tại
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

  // Danh sách nhân sự phụ trách khả dụng trong dự án
  const projectEngineers = useMemo(() => {
    return getEngineersForProject(currentProject?.code || projectId, engineers, projects);
  }, [currentProject, projectId, engineers, projects]);

  // Bộ lọc & Chế độ xem
  const [viewMode, setViewMode] = useState<PlanViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'issue'>('all');

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
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'warning' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3000);
  };

  // Lọc danh sách công việc/kế hoạch thuộc riêng dự án này
  const projectTasks = useMemo(() => {
    const pCodeUpper = String(projectCode).trim().toUpperCase();
    return tasks.filter((t) => {
      const tProjUpper = String(t.projectCode || '').trim().toUpperCase();
      return tProjUpper === pCodeUpper;
    });
  }, [tasks, projectCode]);

  // Tính toán các chỉ số thống kê tổng quan (KPI mini bar)
  const stats = useMemo(() => {
    const todayStr = formatDateToYMD(new Date());
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let inProgress = 0;
    let completed = 0;

    projectTasks.forEach((t) => {
      const isDone = isTaskActuallyDone(t);
      if (isDone) {
        completed++;
        return;
      }

      inProgress++;
      const bounds = getTaskTimeBounds(t);
      const dueDate = bounds.dueDate || '';

      if (dueDate) {
        if (dueDate < todayStr) {
          overdue++;
        } else if (dueDate === todayStr) {
          today++;
        } else {
          // Tính sắp đến hạn trong vòng 3 ngày tới
          const diffDays = Math.ceil(
            (new Date(dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays > 0 && diffDays <= 3) {
            upcoming++;
          }
        }
      }
    });

    return { overdue, today, upcoming, inProgress, completed, total: projectTasks.length };
  }, [projectTasks]);

  // Lọc theo tìm kiếm, người phụ trách, trạng thái
  const filteredTasks = useMemo(() => {
    return projectTasks.filter((t) => {
      // Tìm kiếm
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = String(t.name || '').toLowerCase().includes(query);
        const matchAssignee = String(t.assignedEngineerName || '').toLowerCase().includes(query);
        if (!matchName && !matchAssignee) return false;
      }

      // Người phụ trách
      if (assigneeFilter !== 'all') {
        const matchesAssignee =
          t.assignedEngineerId === assigneeFilter ||
          t.assignedEngineerName === assigneeFilter ||
          (t as any).assigneeId === assigneeFilter;
        if (!matchesAssignee) return false;
      }

      // Trạng thái
      if (statusFilter !== 'all') {
        const isDone = isTaskActuallyDone(t);
        if (statusFilter === 'completed' && !isDone) return false;
        if (statusFilter === 'in_progress' && (isDone || t.status === 'Chưa làm')) return false;
        if (statusFilter === 'pending' && t.status !== 'Chưa làm') return false;
        if (statusFilter === 'issue' && !t.issue && t.issueStatus !== 'Chưa xử lý') return false;
      }

      return true;
    });
  }, [projectTasks, searchQuery, assigneeFilter, statusFilter]);

  // Xử lý tạo Kế hoạch mới
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
        createdAt: new Date().toISOString(),
      };

      await addTask(newTaskData);
      showToast('Đã lên kế hoạch thành công!', 'success');
      setIsModalOpen(false);

      // Reset form
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
    <div className="flex flex-col flex-1 h-full bg-slate-50 overflow-hidden">
      {/* Toast */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* 1. Thanh tiêu đề & Action Bar phẳng, chuẩn rounded-md */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="border-l-4 border-primary pl-2.5">
            <h2 className="text-sm md:text-base font-bold text-slate-900 truncate">
              Kế hoạch: <span className="text-primary">{projectName}</span>
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Mã dự án: <span className="font-mono font-semibold text-slate-700">{projectCode}</span> • Tổng số:{' '}
              <b>{stats.total}</b> công việc
            </p>
          </div>
        </div>

        {/* Nút Lên kế hoạch & Chế độ xem */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Chuyển chế độ xem Tháng / Tuần / Danh sách */}
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Danh sách
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer ${
                viewMode === 'week' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tuần
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer ${
                viewMode === 'month' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tháng
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">add_task</span>
            <span>Lên kế hoạch</span>
          </button>
        </div>
      </div>

      {/* 2. Thanh tổng quan mini KPI (Quá hạn, Hôm nay, Sắp đến hạn, Đang thực hiện, Hoàn thành) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-3 md:px-5 py-2 bg-slate-100/70 border-b border-slate-200 shrink-0 text-xs font-medium">
        <div className="flex items-center gap-2 p-2 rounded-md bg-white border border-slate-200 shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Quá hạn</div>
            <div className="text-sm font-extrabold text-rose-600">{stats.overdue}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-md bg-white border border-slate-200 shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Hôm nay</div>
            <div className="text-sm font-extrabold text-amber-600">{stats.today}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-md bg-white border border-slate-200 shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Sắp đến hạn</div>
            <div className="text-sm font-extrabold text-orange-600">{stats.upcoming}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-md bg-white border border-slate-200 shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Đang thực hiện</div>
            <div className="text-sm font-extrabold text-blue-600">{stats.inProgress}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-md bg-white border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Hoàn thành</div>
            <div className="text-sm font-extrabold text-emerald-600">{stats.completed}</div>
          </div>
        </div>
      </div>

      {/* 3. Bộ lọc phẳng (Tìm kiếm, Người phụ trách, Trạng thái) */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-5 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên việc, nhân sự..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white transition-all h-[32px]"
          />
        </div>

        {/* Lọc theo Nhân sự phụ trách */}
        <CustomSelect
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="h-[32px] min-w-[150px] rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả nhân sự</option>
          {projectEngineers.map((eng) => (
            <option key={eng.id} value={eng.id}>
              {eng.name} ({eng.role || 'Nhân sự'})
            </option>
          ))}
        </CustomSelect>

        {/* Lọc theo Trạng thái */}
        <CustomSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-[32px] min-w-[140px] rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-primary"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="in_progress">Đang thực hiện</option>
          <option value="completed">Đã hoàn thành</option>
          <option value="pending">Chờ thực hiện</option>
          <option value="issue">Có vướng mắc</option>
        </CustomSelect>
      </div>

      {/* 4. Vùng hiển thị Kế hoạch theo chế độ (Danh sách / Tuần / Tháng) */}
      <div className="flex-1 overflow-auto p-3 md:p-5 custom-scrollbar">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white border border-slate-200 rounded-md p-6 text-center shadow-2xs">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
            <p className="text-sm font-bold text-slate-700">Chưa có kế hoạch công việc nào</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Bạn có thể nhấn nút <b>"Lên kế hoạch"</b> ở trên để tạo công việc mới cho dự án này.
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* CHẾ ĐỘ DANH SÁCH BẢNG PHẲNG */
          <div className="bg-white border border-slate-200 rounded-md shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                <tr>
                  <th className="p-2.5 pl-3">Nội dung kế hoạch / Công việc</th>
                  <th className="p-2.5">Người phụ trách</th>
                  <th className="p-2.5">Bắt đầu</th>
                  <th className="p-2.5">Hạn hoàn thành</th>
                  <th className="p-2.5 text-center">Ưu tiên</th>
                  <th className="p-2.5 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const bounds = getTaskTimeBounds(task);
                  const isDone = isTaskActuallyDone(task);
                  const todayStr = formatDateToYMD(new Date());
                  const isOverdue = !isDone && bounds.dueDate && bounds.dueDate < todayStr;
                  const displayStartDate = task.startDate ? formatDateVN(task.startDate) : '—';
                  const displayDueDate = bounds.dueDate ? formatDateVN(bounds.dueDate) : '—';

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 pl-3 font-semibold text-slate-900 max-w-md">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isDone ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-blue-500'
                            }`}
                          />
                          <span className="truncate" title={task.name}>
                            {task.name}
                          </span>
                        </div>
                        {task.notes && (
                          <div className="text-[10.5px] text-slate-500 font-normal mt-0.5 truncate pl-4">
                            {task.notes}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                          <span>{task.assignedEngineerName || 'Chưa giao'}</span>
                        </div>
                      </td>
                      <td className="p-2.5 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {displayStartDate}
                      </td>
                      <td className="p-2.5 whitespace-nowrap font-mono text-[11px]">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                          {displayDueDate}
                        </span>
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${
                            task.priority === 'High'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : task.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {task.priority === 'High'
                            ? 'Ưu tiên cao'
                            : task.priority === 'Medium'
                            ? 'Bình thường'
                            : 'Thấp'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${
                            isDone
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isOverdue
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {isDone ? 'Hoàn thành' : isOverdue ? 'Quá hạn' : 'Đang làm'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* CHẾ ĐỘ THÁNG / TUẦN DẠNG THẺ PHẲNG */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTasks.map((task) => {
              const bounds = getTaskTimeBounds(task);
              const isDone = isTaskActuallyDone(task);
              const todayStr = formatDateToYMD(new Date());
              const isOverdue = !isDone && bounds.dueDate && bounds.dueDate < todayStr;
              const displayDueDate = bounds.dueDate ? formatDateVN(bounds.dueDate) : '—';

              return (
                <div
                  key={task.id}
                  className="p-3 bg-white border border-slate-200 rounded-md shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isOverdue
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {isDone ? 'Hoàn thành' : isOverdue ? 'Quá hạn' : 'Đang làm'}
                      </span>
                      <span className="text-[10.5px] font-mono text-slate-500 font-semibold">
                        {displayDueDate}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2" title={task.name}>
                      {task.name}
                    </h4>

                    {task.notes && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{task.notes}</p>
                    )}
                  </div>

                  <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                      <span className="truncate">{task.assignedEngineerName || 'Chưa giao'}</span>
                    </div>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-sm ${
                        task.priority === 'High'
                          ? 'bg-rose-100 text-rose-800'
                          : task.priority === 'Medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {task.priority === 'High' ? 'P1' : task.priority === 'Medium' ? 'P2' : 'P3'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Modal Lên kế hoạch: Tự gán sẵn mã dự án */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Lên kế hoạch dự án"
        icon="add_task"
        size="md"
      >
        <form onSubmit={handleCreatePlan} className="space-y-3.5 py-1">
          {/* Dự án (Khóa sẵn dự án đang mở) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Dự án công trình:</label>
            <div className="p-2.5 rounded-md border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>{projectName}</span>
              <span className="font-mono text-[11px] text-primary font-bold">{projectCode}</span>
            </div>
          </div>

          {/* Tên nội dung kế hoạch */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nội dung công việc / Kế hoạch (*):
            </label>
            <input
              type="text"
              required
              placeholder="Nhập tên công việc cần triển khai..."
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-primary focus:outline-none bg-white font-medium"
            />
          </div>

          {/* Người phụ trách */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Người phụ trách:</label>
            <CustomSelect
              value={formAssigneeId}
              onChange={(e) => setFormAssigneeId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-primary focus:outline-none bg-white font-medium"
            >
              <option value="">-- Chọn nhân sự thực hiện --</option>
              {projectEngineers.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name} ({eng.role || 'Nhân sự'})
                </option>
              ))}
            </CustomSelect>
          </div>

          {/* Ngày bắt đầu & Hạn hoàn thành */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày bắt đầu:</label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-primary focus:outline-none bg-white cursor-pointer font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hạn hoàn thành:</label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-primary focus:outline-none bg-white cursor-pointer font-medium"
              />
            </div>
          </div>

          {/* Mức độ ưu tiên */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ ưu tiên:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormPriority('Low')}
                className={`py-1.5 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                  formPriority === 'Low'
                    ? 'bg-slate-100 border-slate-400 text-slate-800 ring-1 ring-slate-400'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Thấp
              </button>
              <button
                type="button"
                onClick={() => setFormPriority('Medium')}
                className={`py-1.5 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                  formPriority === 'Medium'
                    ? 'bg-blue-50 border-primary text-primary ring-1 ring-primary'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Bình thường
              </button>
              <button
                type="button"
                onClick={() => setFormPriority('High')}
                className={`py-1.5 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                  formPriority === 'High'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-400'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Ưu tiên cao
              </button>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú bổ sung:</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Yêu cầu cụ thể, tài liệu tham khảo..."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-primary focus:outline-none bg-white resize-none"
            />
          </div>

          {/* Nút hành động modal */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? 'Đang tạo...' : 'Lưu kế hoạch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
