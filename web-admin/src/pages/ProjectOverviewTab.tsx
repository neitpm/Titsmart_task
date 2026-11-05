import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore, hasPermission } from '../services/authStore';
import { isTaskSectionHeaderItem, isTaskActuallyDone, getTaskEffectiveProgress } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';

export const ProjectOverviewTab: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projects = useRealtimeStore(s => s.projects);
  const tasks = useRealtimeStore(s => s.tasks);
  const expenses = useRealtimeStore(s => s.expenses);
  const engineers = useRealtimeStore(s => s.engineers);
  const materialPlans = useRealtimeStore(s => s.materialPlans);
  const materials = useRealtimeStore(s => s.materials);
  const fetchMaterials = useRealtimeStore(s => s.fetchMaterials);
  const documentTracks = useRealtimeStore(s => s.documentTracks);
  const fieldLogs = useRealtimeStore(s => s.fieldLogs);

  const user = useAuthStore(s => s.user);

  const isAdmin = user?.role === 'admin' || user?.role === 'Quản trị viên' || user?.role === 'pm' || user?.username === 'admin';
  const canAssignTasks = isAdmin || hasPermission(user, 'ASSIGN_TASKS');
  const canViewTasks = isAdmin || hasPermission(user, 'VIEW_TASKS');

  const project = useMemo(() => {
    if (!projectId) return undefined;
    const normKey = String(projectId).trim().toUpperCase();
    return projects.find(p => {
      const pCode = String(p.code || '').trim().toUpperCase();
      const pId = String(p.id || '').trim().toUpperCase();
      const pName = String(p.name || '').trim().toUpperCase();
      return pCode === normKey || pId === normKey || pName === normKey;
    });
  }, [projectId, projects]);

  React.useEffect(() => {
    if (project) {
      fetchMaterials(project.code || project.id);
    }
  }, [project?.id, project?.code, fetchMaterials]);

  const pCodeUpper = useMemo(() => String(project?.code || '').trim().toUpperCase(), [project?.code]);
  const pIdUpper = useMemo(() => String(project?.id || '').trim().toUpperCase(), [project?.id]);
  const pNameUpper = useMemo(() => String(project?.name || '').trim().toUpperCase(), [project?.name]);

  const isProjectMatch = React.useCallback((codeOrId?: string) => {
    if (!project) return false;
    const u = String(codeOrId || '').trim().toUpperCase();
    return Boolean(u && (u === pCodeUpper || u === pIdUpper || u === pNameUpper));
  }, [project, pCodeUpper, pIdUpper, pNameUpper]);

  // --- 1. TIẾN ĐỘ ---
  const projTasks = useMemo(() => {
    return tasks.filter(t => isProjectMatch(t.projectCode) && !isTaskSectionHeaderItem(t));
  }, [tasks, isProjectMatch]);
  
  const isTaskCompleted = React.useCallback((t: typeof tasks[number]) => {
    return isTaskActuallyDone(t);
  }, []);

  const actualTotalTasks = projTasks.length > 0 ? projTasks.length : (project?.totalTasks || 0);
  const actualCompletedTasks = projTasks.length > 0 
    ? projTasks.filter(isTaskCompleted).length 
    : (project?.completedTasks || 0);

  const calculatedPercent = useMemo(() => {
    if (projTasks.length === 0) return project?.progressPercent || 0;
    const totalProgressSum = projTasks.reduce((sum, t) => {
      return sum + Math.round(getTaskEffectiveProgress(t) * 100);
    }, 0);
    return Math.round(totalProgressSum / projTasks.length);
  }, [projTasks, project?.progressPercent]);

  const totalTasks = actualTotalTasks;
  const completedTasks = actualCompletedTasks;
  const progressPercent = Math.min(100, Math.max(0, calculatedPercent));

  // --- 2. VẬT TƯ & CHI PHÍ ---
  const projExpenses = useMemo(() => expenses.filter(e => isProjectMatch(e.projectCode)), [expenses, isProjectMatch]);
  // Loại trừ dòng "Chuyển quỹ đến..." (không phải chi tiêu thực - chỉ là chuyển nội bộ)
  const isTransferOut = (e: { content?: string }) =>
    String(e.content || '').trim().toLowerCase().startsWith('chuyển quỹ đến') ||
    String(e.content || '').trim().toLowerCase().startsWith('chuyen quy den');
  const totalExpense = useMemo(() =>
    projExpenses.filter(e => !isTransferOut(e)).reduce((sum, e) => sum + (e.totalAmount || 0), 0),
  [projExpenses]);
  const contractValue = project?.contractValue || 0;
  const budgetPercent = contractValue > 0 ? Math.min(Math.round((totalExpense / contractValue) * 100), 100) : 0;

  // --- 3. HỒ SƠ ---
  const projDocs = useMemo(() => {
    return documentTracks 
      ? documentTracks.filter(d => isProjectMatch(d.projectCode) || isProjectMatch(d.projectId)) 
      : [];
  }, [documentTracks, isProjectMatch]);
  const totalDocs = projDocs.length;

  const isDocCompleted = React.useCallback((d: typeof documentTracks[number]) => {
    if (d.isCompleted) return true;
    const st = String(d.docStatus || '').toLowerCase();
    return st.includes('ký') || 
           st.includes('đủ') || 
           st.includes('hoàn thành') || 
           st.includes('duyệt') || 
           st.includes('đã nhận') ||
           st === 'done' || 
           st === 'approved';
  }, []);

  const completedDocs = useMemo(() => projDocs.filter(isDocCompleted).length, [projDocs, isDocCompleted]);
  const docPercent = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

  // --- 4. KHO DỰ ÁN ---
  const projMaterialPlans = useMemo(() => materialPlans ? materialPlans.filter(m => isProjectMatch(m.projectCode)) : [], [materialPlans, isProjectMatch]);
  const projWarehouseMaterials = useMemo(() => materials ? materials.filter(m => isProjectMatch(m.projectCode)) : [], [materials, isProjectMatch]);

  const totalMatEstimate = useMemo(() => projMaterialPlans.reduce((sum, m) => sum + (m.contractVolume || 0), 0), [projMaterialPlans]);
  
  // Tính tổng số lượng vật tư đang có trong Kho thực tế (materials)
  const totalWarehouseStock = useMemo(() => projWarehouseMaterials.reduce((sum, m) => sum + (m.currentStock ?? m.volume ?? 0), 0), [projWarehouseMaterials]);

  // Hiển thị chính xác tổng tồn kho thực tế của Kho dự án (nếu Kho rỗng thì hiển thị 0)
  const totalMatActual = totalWarehouseStock;

  const matPercent = totalMatEstimate > 0 
    ? Math.min(Math.round((totalMatActual / totalMatEstimate) * 100), 100) 
    : (totalMatActual > 0 ? 100 : 0);

  // --- 5. NHẬT KÝ HIỆN TRƯỜNG ---
  const projLogs = useMemo(() => fieldLogs ? fieldLogs.filter(l => isProjectMatch(l.projectCode)) : [], [fieldLogs, isProjectMatch]);
  const totalLogs = projLogs.length;

  // --- 6. NHÂN SỰ ---
  const assignedEngineers = useMemo(() => {
    if (!project) return [];
    const isAdminAccount = (eng: any) => {
      const roleLower = String(eng.role || '').trim().toLowerCase();
      const usernameLower = String(eng.username || eng.email || '').trim().toLowerCase();
      const nameLower = String(eng.name || '').trim().toLowerCase();
      return roleLower === 'admin' || roleLower === 'quản trị viên' || usernameLower === 'admin' || nameLower === 'admin' || nameLower === 'quản trị viên';
    };

    const memberNamesFromEngineers = engineers
      .filter((eng) => {
        if (isAdminAccount(eng)) return false;
        const isMember = (Array.isArray(project?.members) && project.members.includes(eng.id)) ||
                         (Array.isArray(project?.memberIds) && project.memberIds.includes(eng.id));
        const hasCode = Array.isArray(eng.projectCodes) && eng.projectCodes.some(c => isProjectMatch(c));
        const hasManaged = eng.managedProjects?.some(p => isProjectMatch(p.code || p.name));
        const hasMemberProj = eng.memberProjects?.some(p => isProjectMatch(p.code || p.name));
        return isMember || hasCode || hasManaged || hasMemberProj;
      })
      .map((eng) => eng.name);

    // Bổ sung nhân sự đã được giao công việc trong dự án
    const memberNamesFromTasks: string[] = [];
    projTasks.forEach(t => {
      const rawEngName = String(t.assignedEngineerName || '').trim();
      const rawEngId = String(t.assignedEngineerId || '').trim();
      if (rawEngId) {
        const eng = engineers.find(e => e.id === rawEngId);
        if (eng && !isAdminAccount(eng)) {
          memberNamesFromTasks.push(eng.name);
        }
      }
      if (rawEngName) {
        const parts = rawEngName.split('|')[0].split(',').map(n => n.trim()).filter(Boolean);
        parts.forEach(pName => {
          if (pName.toLowerCase() !== 'admin' && pName.toLowerCase() !== 'quản trị viên') {
            memberNamesFromTasks.push(pName);
          }
        });
      }
    });

    let managerNames: string[] = [];
    if (project?.managerName && project.managerName !== 'Chưa phân công') {
      managerNames = project.managerName
        .split(',')
        .map(s => s.trim())
        .filter(s => Boolean(s) && s.toLowerCase() !== 'admin' && s.toLowerCase() !== 'quản trị viên');
    }

    return Array.from(new Set([...memberNamesFromEngineers, ...memberNamesFromTasks, ...managerNames]));
  }, [engineers, project, projTasks, isProjectMatch]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // --- CHART DATA ---
  const taskStatusData = useMemo(() => {
    const uncompleted = projTasks.filter(t => !isTaskCompleted(t));
    const pendingCount = uncompleted.filter(t => {
      const st = String(t.status || '').trim();
      return st === 'Chưa làm' || (!t.progress && !t.constrStatus && !t.purchaseStatus);
    }).length;
    const inProgressCount = uncompleted.filter(t => {
      const st = String(t.status || '').trim();
      return st === 'Đang làm' || (t.progress && t.progress > 0 && t.progress < 1) || (st !== 'Chờ nghiệm thu' && st !== 'Chưa làm');
    }).length;
    const waitingReviewCount = uncompleted.filter(t => String(t.status || '').trim() === 'Chờ nghiệm thu').length;

    return [
      { name: 'Chưa làm', value: pendingCount, color: '#94a3b8' },
      { name: 'Đang làm', value: inProgressCount, color: '#3b82f6' },
      { name: 'Chờ nghiệm thu', value: waitingReviewCount, color: '#f59e0b' },
      { name: 'Hoàn thành', value: completedTasks, color: '#10b981' },
    ].filter(d => d.value > 0);
  }, [projTasks, completedTasks, isTaskCompleted]);

  const costChartData = useMemo(() => [
    { name: 'Ngân sách', value: contractValue, color: '#94a3b8' },
    { name: 'Đã chi', value: totalExpense, color: '#10b981' }
  ], [contractValue, totalExpense]);

  const recentLogs = useMemo(() => [...projLogs].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 4), [projLogs]);

  // --- 7. CÔNG VIỆC NHÂN VIÊN ---
  const assignedTasks = useMemo(() => projTasks.filter(t => t.assignedEngineerId || t.assignedEngineerName || (t.followerIds && t.followerIds.length > 0)), [projTasks]);
  const totalAssignedTasks = assignedTasks.length;
  const completedAssignedTasks = useMemo(() => assignedTasks.filter(isTaskCompleted).length, [assignedTasks, isTaskCompleted]);
  const assignedTaskPercent = totalAssignedTasks > 0 ? Math.round((completedAssignedTasks / totalAssignedTasks) * 100) : 0;

  // --- 8. THỐNG KÊ CÔNG VIỆC THEO TỪNG NHÂN VIÊN ---
  const cleanStaffName = (raw?: string) => {
    if (!raw) return '';
    return raw.split('|')[0].trim();
  };

  const engineerWorkloadList = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      role: string;
      avatar?: string;
      phone?: string;
      totalTasks: number;
      completedTasks: number;
      inProgressTasks: number;
      pendingTasks: number;
      completionRate: number;
    }>();

    // 1. Thêm các nhân sự thuộc dự án
    engineers.forEach(eng => {
      const isMember = (Array.isArray(project?.members) && project.members.includes(eng.id)) ||
                       (Array.isArray(project?.memberIds) && project.memberIds.includes(eng.id)) ||
                       (Array.isArray(eng.projectCodes) && eng.projectCodes.some(c => isProjectMatch(c))) ||
                       assignedEngineers.some(ae => cleanStaffName(ae).toLowerCase() === cleanStaffName(eng.name).toLowerCase());
      
      const roleLower = String(eng.role || '').toLowerCase();
      const cleanName = cleanStaffName(eng.name);
      const nameLower = cleanName.toLowerCase();
      const userLower = String(eng.username || '').toLowerCase();
      if (roleLower === 'admin' || roleLower === 'quản trị viên' || nameLower === 'admin' || userLower === 'admin' || !nameLower) return;

      if (isMember) {
        const key = nameLower;
        if (!map.has(key)) {
          map.set(key, {
            id: eng.id,
            name: cleanName,
            role: eng.role || 'Kỹ sư',
            avatar: eng.avatar,
            phone: eng.phone,
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            pendingTasks: 0,
            completionRate: 0,
          });
        }
      }
    });

    // 2. Quét tất cả công việc của dự án để tính số liệu cho nhân viên
    projTasks.forEach(t => {
      const rawEngName = String(t.assignedEngineerName || '').trim();
      const rawEngId = String(t.assignedEngineerId || '').trim();
      const isDone = isTaskCompleted(t);
      const st = String(t.status || '').trim().toLowerCase();
      const isProg = st === 'đang làm' || st === 'in_progress';

      // Phân tích định dạng: "Tên 1, Tên 2 | id1, id2"
      const parts = rawEngName.split('|');
      const namesPart = parts[0] || '';
      const idsPart = parts[1] || '';

      const names = namesPart.split(',').map(n => cleanStaffName(n)).filter(Boolean);
      const ids = idsPart.split(',').map(i => i.trim()).filter(Boolean);

      const targetEntries: { name: string; engObj?: any }[] = [];

      if (names.length > 0) {
        names.forEach((name, idx) => {
          const associatedId = ids[idx] || (names.length === 1 ? rawEngId : undefined);
          const engObj = engineers.find(e => 
            (associatedId && e.id === associatedId) || 
            cleanStaffName(e.name).toLowerCase() === name.toLowerCase()
          );
          targetEntries.push({
            name: engObj ? cleanStaffName(engObj.name) : name,
            engObj
          });
        });
      } else if (rawEngId) {
        const engObj = engineers.find(e => e.id === rawEngId);
        if (engObj) {
          targetEntries.push({
            name: cleanStaffName(engObj.name),
            engObj
          });
        }
      }

      // Tránh tính trùng lặp cùng 1 người trong cùng 1 task
      const handledKeys = new Set<string>();

      targetEntries.forEach(({ name, engObj }) => {
        const cleanName = cleanStaffName(name);
        const key = cleanName.toLowerCase();
        if (!key || key === 'admin' || key === 'quản trị viên' || handledKeys.has(key)) return;
        handledKeys.add(key);

        if (!map.has(key)) {
          map.set(key, {
            id: engObj?.id || key,
            name: cleanName,
            role: engObj?.role || 'Kỹ sư',
            avatar: engObj?.avatar,
            phone: engObj?.phone,
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            pendingTasks: 0,
            completionRate: 0,
          });
        }

        const item = map.get(key)!;
        item.totalTasks += 1;
        if (isDone) {
          item.completedTasks += 1;
        } else if (isProg) {
          item.inProgressTasks += 1;
        } else {
          item.pendingTasks += 1;
        }
      });
    });

    return Array.from(map.values()).map(item => ({
      ...item,
      completionRate: item.totalTasks > 0 ? Math.round((item.completedTasks / item.totalTasks) * 100) : 0,
    })).sort((a, b) => b.totalTasks - a.totalTasks || b.completedTasks - a.completedTasks);
  }, [engineers, projTasks, project, assignedEngineers]);

  if (!project) {
    return <div className="p-6 text-center text-slate-500">Không tìm thấy thông tin dự án.</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-y-auto bg-slate-50 flex-1">
      {/* OPTION B: THANH METRIC RIBBON LIỀN MẠCH (DASHBOARD RIBBON) */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 divide-y sm:divide-y-0 divide-slate-100 xl:divide-x divide-slate-100">
          
          {/* 1. Tiến độ công việc */}
          <div
            onClick={() => canViewTasks && navigate(`/projects/${project.id}/tasks`)}
            className={`p-3.5 sm:p-4 flex flex-col justify-between transition-colors ${canViewTasks ? 'cursor-pointer hover:bg-slate-50/80 group' : 'cursor-default'}`}
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-blue-600 transition-colors truncate">
                Tiến độ
              </span>
              <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">fact_check</span>
              </span>
            </div>
            <div className="my-1">
              <div className="text-2xl font-black text-slate-900 leading-none">{progressPercent}%</div>
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">{completedTasks}/{totalTasks} công việc</p>
            </div>
          </div>

          {/* 2. Công việc nhân viên */}
          <div
            onClick={() => {
              if (canAssignTasks) navigate(`/task-assignment?tab=project_tasks&status=in_progress&project=${encodeURIComponent(project.code)}`);
              else if (canViewTasks) navigate(`/projects/${project.id}/tasks?status=in_progress`);
            }}
            className={`p-3.5 sm:p-4 flex flex-col justify-between transition-colors ${(canAssignTasks || canViewTasks) ? 'cursor-pointer hover:bg-slate-50/80 group' : 'cursor-default'}`}
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-primary transition-colors truncate">
                Giao việc
              </span>
              <span className="w-6 h-6 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">assignment_ind</span>
              </span>
            </div>
            <div className="my-1">
              <div className="text-2xl font-black text-slate-900 leading-none">{assignedTaskPercent}%</div>
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${assignedTaskPercent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">{completedAssignedTasks}/{totalAssignedTasks} đã giao</p>
            </div>
          </div>

          {/* 3. Vật tư & Chi phí */}
          <div
            onClick={() => navigate(`/projects/${project.id}/cost-plan`)}
            className="p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer hover:bg-slate-50/80 group transition-colors"
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-emerald-600 transition-colors truncate">
                Vật tư & Chi phí
              </span>
              <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">account_balance_wallet</span>
              </span>
            </div>
            <div className="my-1">
              <div className="text-lg sm:text-xl font-black text-slate-900 leading-none truncate" title={formatCurrency(totalExpense)}>
                {formatCurrency(totalExpense)}
              </div>
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${budgetPercent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">{budgetPercent}% hợp đồng</p>
            </div>
          </div>

          {/* 4. Hồ sơ */}
          <div
            onClick={() => navigate(`/projects/${project.id}/documents`)}
            className="p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer hover:bg-slate-50/80 group transition-colors"
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-rose-600 transition-colors truncate">
                Hồ sơ
              </span>
              <span className="w-6 h-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">file_present</span>
              </span>
            </div>
            <div className="my-1">
              <div className="text-2xl font-black text-slate-900 leading-none">{totalDocs}</div>
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-rose-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${docPercent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">{completedDocs}/{totalDocs} hoàn thành</p>
            </div>
          </div>

          {/* 5. Kho Dự Án */}
          <div
            onClick={() => navigate(`/projects/${project.id}/inventory`)}
            className="p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer hover:bg-slate-50/80 group transition-colors"
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-amber-600 transition-colors truncate">
                Kho dự án
              </span>
              <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">inventory_2</span>
              </span>
            </div>
            <div className="my-1">
              <div className="text-2xl font-black text-slate-900 leading-none truncate" title={totalMatActual.toLocaleString('vi-VN')}>
                {totalMatActual.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${matPercent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">Dự toán: {totalMatEstimate.toLocaleString('vi-VN')}</p>
            </div>
          </div>

          {/* 6. Nhật ký hiện trường */}
          <div
            onClick={() => navigate(`/projects/${project.id}/field-logs`)}
            className="p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer hover:bg-slate-50/80 group transition-colors"
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-purple-600 transition-colors truncate">
                Nhật ký
              </span>
              <span className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">add_a_photo</span>
              </span>
            </div>
            <div className="my-1">
              <div className="text-2xl font-black text-slate-900 leading-none">{totalLogs}</div>
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, totalLogs * 10)}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">bản ghi nhật ký</p>
            </div>
          </div>

          {/* 7. Nhân sự tham gia */}
          <div className="p-3.5 sm:p-4 flex flex-col justify-between transition-colors group cursor-default">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-indigo-600 transition-colors truncate">
                Nhân sự
              </span>
              <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">groups</span>
              </span>
            </div>
            <div className="my-1">
              <div className="text-2xl font-black text-slate-900 leading-none">{assignedEngineers.length}</div>
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, assignedEngineers.length * 15)}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">kỹ sư / cán bộ</p>
            </div>
          </div>

        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-slate-400">donut_large</span>
            Trạng thái Công việc
          </h3>
          <div className="h-[250px]">
            {taskStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius="50%"
                    outerRadius="80%"
                    dataKey="value"
                    stroke="none"
                    cursor="pointer"
                    onClick={(entry: any) => {
                      if (!canAssignTasks && !canViewTasks) return;
                      const statusMap: Record<string, string> = {
                        'Đang làm': 'in_progress',
                        'Chưa làm': 'pending',
                        'Chờ nghiệm thu': 'review',
                        'Hoàn thành': 'completed',
                      };
                      const status = statusMap[entry?.name] || 'all';
                      if (canAssignTasks) {
                        navigate(`/task-assignment?tab=project_tasks&status=${status}&project=${encodeURIComponent(project.code)}`);
                      } else {
                        navigate(`/projects/${project.id}/tasks?status=${status}`);
                      }
                    }}
                  >
                    {taskStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip wrapperStyle={{ fontSize: '11px' }} />
                  <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu công việc</div>
            )}
          </div>
        </div>

        {/* Info Detail */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-slate-400">info</span>
            Thông tin chi tiết
          </h3>
          <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Mã dự án</p>
              <p className="font-bold text-slate-800 mt-1">{project.code}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Khách hàng</p>
              <p className="font-bold text-slate-800 mt-1">{project.client || '---'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Địa điểm</p>
              <p className="font-bold text-slate-800 mt-1">{project.location || '---'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Quản lý dự án</p>
              <p className="font-bold text-slate-800 mt-1">{project.managerName || 'Chưa phân công'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Trạng thái</p>
              <p className="font-bold text-slate-800 mt-1">
                {project.status === 'active' ? 'Đang triển khai' : project.status === 'completed' ? 'Hoàn thành' : 'Tạm dừng'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* WIDGETS DƯỚI CÙNG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-slate-400">bar_chart</span>
            Biểu đồ Chi phí
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={80}>
                  {costChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Field Logs Timeline */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-slate-400">history</span>
              Nhật ký hiện trường gần đây
            </h3>
            <button onClick={() => navigate(`/projects/${project.id}/field-logs`)} className="text-xs font-semibold text-primary hover:underline">
              Xem tất cả
            </button>
          </div>
          <div className="space-y-4">
            {recentLogs.length > 0 ? recentLogs.map((log, idx) => (
              <div key={log.id} className="relative pl-6">
                {/* Timeline line */}
                {idx !== recentLogs.length - 1 && (
                  <div className="absolute left-1.5 top-5 bottom-[-16px] w-px bg-slate-200"></div>
                )}
                {/* Dot */}
                <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-primary border-2 border-white shadow-sm"></div>
                {/* Content */}
                <div className="text-[11px] text-slate-500 mb-1">{new Date(log.timestamp).toLocaleString('vi-VN')}</div>
                <div className="text-sm text-slate-700 font-medium line-clamp-2">{log.note || 'Không có nội dung'}</div>
                {log.images && log.images.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {log.images.slice(0, 3).map((img, i) => (
                      <div key={i} className="w-10 h-10 rounded border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-400 text-sm">image</span>
                      </div>
                    ))}
                    {log.images.length > 3 && (
                      <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-500 font-medium">
                        +{log.images.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )) : (
              <div className="text-sm text-slate-400 italic text-center py-4">Chưa có nhật ký nào</div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION: CÔNG VIỆC NHÂN VIÊN */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-slate-400">assignment_ind</span>
            Công việc nhân viên ({engineerWorkloadList.length})
          </h3>
          <div className="flex items-center gap-4">
            {canAssignTasks && (
              <button
                onClick={() => navigate(`/task-assignment?tab=project_tasks&status=in_progress&project=${encodeURIComponent(project.code)}`)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">tune</span>
                Bảng phân công
              </button>
            )}
            {canViewTasks && (
              <button
                onClick={() => navigate(`/projects/${project.id}/tasks`)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">list_alt</span>
                Tất cả công việc
              </button>
            )}
          </div>
        </div>

        {engineerWorkloadList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-1">
            {engineerWorkloadList.map((eng, idx) => (
              <div
                key={eng.id || idx}
                onClick={() => {
                  if (canAssignTasks) {
                    navigate(`/task-assignment?tab=project_tasks&status=in_progress&project=${encodeURIComponent(project.code)}&highlight=${encodeURIComponent(eng.name)}`);
                  } else if (canViewTasks) {
                    navigate(`/projects/${project.id}/tasks`);
                  }
                }}
                className={`bg-slate-50 hover:bg-white rounded-xl p-4 border border-slate-200 transition-all flex flex-col justify-between group ${
                  (canAssignTasks || canViewTasks) ? 'cursor-pointer hover:border-primary/40 hover:shadow-md' : 'cursor-default'
                }`}
              >
                {/* Employee Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-primary/20">
                      {eng.avatar ? (
                        <img src={eng.avatar} alt={eng.name} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        eng.name.split(' ').slice(-2).map(n => n[0]).join('').toUpperCase() || 'NV'
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 truncate group-hover:text-primary transition-colors" title={eng.name}>
                        {eng.name}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">{eng.role || 'Kỹ sư'}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    eng.completionRate === 100 && eng.totalTasks > 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : eng.completionRate > 0
                      ? 'bg-blue-100 text-blue-700'
                      : eng.totalTasks > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {eng.totalTasks > 0 ? `${eng.completionRate}%` : 'Chưa giao'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="my-2">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-500 font-medium">Tiến độ hoàn thành</span>
                    <span className="font-bold text-slate-700">{eng.completedTasks}/{eng.totalTasks} việc</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        eng.completionRate === 100
                          ? 'bg-emerald-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${eng.totalTasks > 0 ? eng.completionRate : 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Task Breakdown Badges */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-200/60 text-center">
                  <div className="bg-emerald-50/80 rounded px-1 py-1">
                    <span className="block text-[10px] text-emerald-600 font-semibold">Xong</span>
                    <span className="text-xs font-bold text-emerald-700">{eng.completedTasks}</span>
                  </div>
                  <div className="bg-blue-50/80 rounded px-1 py-1">
                    <span className="block text-[10px] text-blue-600 font-semibold">Đang làm</span>
                    <span className="text-xs font-bold text-blue-700">{eng.inProgressTasks}</span>
                  </div>
                  <div className="bg-slate-100 rounded px-1 py-1">
                    <span className="block text-[10px] text-slate-500 font-semibold">Chưa làm</span>
                    <span className="text-xs font-bold text-slate-700">{eng.pendingTasks}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">group_off</span>
            <p className="text-sm font-medium text-slate-500">Chưa có nhân sự nào được phân công công việc trong dự án này</p>
            <button
              onClick={() => navigate(`/task-assignment?highlight=${encodeURIComponent(project.name || project.code)}`)}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Phân công công việc ngay
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
