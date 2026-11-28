import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore, hasPermission } from '../services/authStore';
import { isTaskSectionHeaderItem, isTaskActuallyDone, getTaskEffectiveProgress, PurchaseRequest } from '../types';
import { calculateProjectFinancialPerformance } from '../utils/financialPerformanceUtils';
import { api } from '../services/apiSupabase';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ComposedChart, 
  RadialBarChart, 
  RadialBar, 
  Treemap 
} from 'recharts';

interface ChartBoxProps {
  title: string;
  badge?: React.ReactNode;
  icon?: string;
  onAction?: () => void;
  actionText?: string;
  children: React.ReactNode;
}

const ChartBox: React.FC<ChartBoxProps> = ({ title, badge, icon, onAction, actionText, children }) => (
  <div className="flex flex-col bg-white rounded-lg border border-slate-200 shadow-2xs h-[320px] min-w-0 w-full overflow-hidden">
    <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-2 flex items-center justify-between min-w-0 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="material-symbols-outlined text-base text-slate-500">{icon}</span>}
        <span className="text-xs font-bold text-slate-800 uppercase tracking-tight truncate" title={title}>{title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {onAction && actionText && (
          <button onClick={onAction} className="text-xs font-semibold text-primary hover:underline">
            {actionText}
          </button>
        )}
      </div>
    </div>
    <div className="flex-1 w-full h-[270px] min-w-0 p-2.5 overflow-hidden relative">
      {children}
    </div>
  </div>
);

export const ProjectOverviewTab: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projects = useRealtimeStore(s => s.projects);
  const tasks = useRealtimeStore(s => s.tasks);
  const expenses = useRealtimeStore(s => s.expenses);
  const engineers = useRealtimeStore(s => s.engineers);
  const materialPlans = useRealtimeStore(s => s.materialPlans);
  const purchasingPlans = useRealtimeStore(s => s.purchasingPlans);
  const laborPayrolls = useRealtimeStore(s => s.laborPayrolls);
  const materials = useRealtimeStore(s => s.materials);
  const fetchMaterials = useRealtimeStore(s => s.fetchMaterials);
  const fetchAccounting = useRealtimeStore(s => s.fetchAccounting);
  const documentTracks = useRealtimeStore(s => s.documentTracks);
  const fieldLogs = useRealtimeStore(s => s.fieldLogs);
  const issues = useRealtimeStore(s => s.issues);

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

  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [procurementViewMode, setProcurementViewMode] = useState<'items' | 'volume'>('volume');

  useEffect(() => {
    let isMounted = true;
    api.purchaseRequests.getAll().then(list => {
      if (isMounted && Array.isArray(list)) {
        setPurchaseRequests(list);
      }
    }).catch(err => {
      console.error('Failed to load purchase requests for overview:', err);
    });
    return () => { isMounted = false; };
  }, [project?.id, project?.code]);

  const pCodeUpper = useMemo(() => String(project?.code || '').trim().toUpperCase(), [project?.code]);
  const pIdUpper = useMemo(() => String(project?.id || '').trim().toUpperCase(), [project?.id]);
  const pNameUpper = useMemo(() => String(project?.name || '').trim().toUpperCase(), [project?.name]);

  const isProjectMatch = React.useCallback((codeOrId?: string) => {
    if (!project) return false;
    const u = String(codeOrId || '').trim().toUpperCase();
    return Boolean(u && (u === pCodeUpper || u === pIdUpper || u === pNameUpper));
  }, [project, pCodeUpper, pIdUpper, pNameUpper]);

  // ==========================================
  // 1. TIẾN ĐỘ & CÔNG VIỆC
  // ==========================================
  const projTasks = useMemo(() => {
    return tasks.filter(t => isProjectMatch(t.projectCode) && !isTaskSectionHeaderItem(t));
  }, [tasks, isProjectMatch]);
  
  const isTaskCompleted = React.useCallback((t: typeof tasks[number]) => {
    return isTaskActuallyDone(t);
  }, []);

  const totalTasks = projTasks.length > 0 ? projTasks.length : (project?.totalTasks || 0);
  const completedTasks = projTasks.length > 0 ? projTasks.filter(isTaskCompleted).length : (project?.completedTasks || 0);

  const calculatedPercent = useMemo(() => {
    if (projTasks.length === 0) return project?.progressPercent || 0;
    const totalProgressSum = projTasks.reduce((sum, t) => sum + Math.round(getTaskEffectiveProgress(t) * 100), 0);
    return Math.round(totalProgressSum / projTasks.length);
  }, [projTasks, project?.progressPercent]);

  const progressPercent = Math.min(100, Math.max(0, calculatedPercent));

  // Trạng thái công việc
  const taskStatusCounts = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let review = 0;
    let completed = completedTasks;
    let overdue = 0;

    const now = new Date();
    projTasks.forEach(t => {
      const isDone = isTaskCompleted(t);
      if (!isDone) {
        if (t.dueDate && new Date(t.dueDate).getTime() < now.getTime()) {
          overdue++;
        }
        const st = String(t.status || '').trim().toLowerCase();
        if (st === 'chờ nghiệm thu' || st === 'review') review++;
        else if (st === 'đang làm' || st === 'in_progress' || (t.progress && t.progress > 0)) inProgress++;
        else pending++;
      }
    });

    return { pending, inProgress, review, completed, overdue };
  }, [projTasks, completedTasks, isTaskCompleted]);

  // Biểu đồ vành khuyên Donut Chart (Trạng thái công việc)
  const taskDonutData = useMemo(() => [
    { name: 'Hoàn thành', value: taskStatusCounts.completed, color: '#10b981' },
    { name: 'Đang làm', value: taskStatusCounts.inProgress, color: '#3b82f6' },
    { name: 'Chờ nghiệm thu', value: taskStatusCounts.review, color: '#f59e0b' },
    { name: 'Chưa làm', value: taskStatusCounts.pending, color: '#94a3b8' },
  ].filter(d => d.value > 0), [taskStatusCounts]);

  // Biểu đồ cột ngang (Tiến độ theo phân mục / sectionName)
  const sectionProgressData = useMemo(() => {
    const map = new Map<string, { total: number; done: number; progSum: number }>();
    projTasks.forEach(t => {
      const sec = t.sectionName || 'Hạng mục chung';
      if (!map.has(sec)) map.set(sec, { total: 0, done: 0, progSum: 0 });
      const item = map.get(sec)!;
      item.total++;
      if (isTaskCompleted(t)) item.done++;
      item.progSum += Math.round(getTaskEffectiveProgress(t) * 100);
    });

    return Array.from(map.entries())
      .map(([name, val]) => ({
        name: name.length > 18 ? name.slice(0, 16) + '...' : name,
        fullName: name,
        progress: Math.round(val.progSum / val.total),
        completed: val.done,
        total: val.total
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [projTasks, isTaskCompleted]);

  // ==========================================
  // 2. TÀI CHÍNH, GIÁ VỐN & LỢI NHUẬN (P&L)
  // ==========================================
  const financialMetrics = useMemo(() => {
    return calculateProjectFinancialPerformance(
      project || null,
      purchasingPlans,
      expenses,
      laborPayrolls,
      documentTracks,
      materialPlans
    );
  }, [project, purchasingPlans, expenses, laborPayrolls, documentTracks, materialPlans]);

  const contractVal = project?.contractValue || financialMetrics.totalApprovedRevenue || 0;
  const revenueAccepted = financialMetrics.acceptedRevenue || financialMetrics.totalApprovedRevenue || contractVal;
  const totalCost = financialMetrics.totalActualCost || 0;
  const grossProfit = financialMetrics.actualEstimatedProfit || (revenueAccepted - totalCost);
  const marginPct = financialMetrics.actualGrossMarginPercent || (revenueAccepted > 0 ? (grossProfit / revenueAccepted) * 100 : 0);

  // Biểu đồ so sánh Ngân sách HĐ vs Doanh thu NT vs Chi phí (Grouped Column)
  const financialComparisonData = useMemo(() => [
    {
      category: 'Tài chính Dự án',
      'Hợp đồng gốc': contractVal,
      'Đã nghiệm thu': revenueAccepted,
      'Chi phí thực tế': totalCost,
      'Lợi nhuận gộp': Math.max(0, grossProfit)
    }
  ], [contractVal, revenueAccepted, totalCost, grossProfit]);

  // Biểu đồ cơ cấu chi phí (Donut / Pie)
  const costBreakdownData = useMemo(() => [
    { name: 'Vật tư mua sắm', value: financialMetrics.actualPurchasingCommitted, color: '#0284c7' },
    { name: 'Nhân công', value: financialMetrics.actualLaborCost, color: '#8b5cf6' },
    { name: 'Chi phí QLDA & khác', value: financialMetrics.actualExpenseCost + financialMetrics.allocatedGeneralCost, color: '#f59e0b' },
  ].filter(d => d.value > 0), [financialMetrics]);

  // Biểu đồ xu hướng dòng tiền / chi phí theo tháng (Area Chart)
  const monthlyExpenseTrendData = useMemo(() => {
    const projExpenses = expenses.filter(e => isProjectMatch(e.projectCode));
    const map = new Map<string, number>();

    // Khởi tạo 6 tháng gần nhất
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
      map.set(key, 0);
    }

    projExpenses.forEach(e => {
      const dateStr = e.date || (e as any).createdAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const key = `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
        if (map.has(key)) {
          map.set(key, (map.get(key) || 0) + (e.totalAmount || 0));
        }
      }
    });

    return Array.from(map.entries()).map(([month, amount]) => ({
      month,
      'Chi phí thực chi': amount
    }));
  }, [expenses, isProjectMatch]);

  // ==========================================
  // 3. KHO DỰ ÁN & CUNG ỨNG VẬT TƯ
  // ==========================================
  const projWarehouseMaterials = useMemo(() => materials ? materials.filter(m => isProjectMatch(m.projectCode)) : [], [materials, isProjectMatch]);
  const totalStockCount = projWarehouseMaterials.length;
  const totalStockQty = useMemo(() => projWarehouseMaterials.reduce((sum, m) => sum + (m.currentStock ?? m.volume ?? 0), 0), [projWarehouseMaterials]);

  // Dữ liệu đặt hàng vật tư & thiết bị dự án (Material Plans & Purchasing Plans)
  const projMaterialPlans = useMemo(() => {
    if (!materialPlans) return [];
    return materialPlans.filter(p => isProjectMatch(p.projectCode) && !(p as any).isHeader && !(p as any).isCategory);
  }, [materialPlans, isProjectMatch]);
  const projPurchasingPlans = useMemo(() => purchasingPlans ? purchasingPlans.filter(p => isProjectMatch(p.projectCode)) : [], [purchasingPlans, isProjectMatch]);

  // Map liên kết Yêu cầu mua hàng (Purchase Requests)
  const itemPurchaseRequestMap = useMemo(() => {
    const map = new Map<string, { request: PurchaseRequest; itemQuantity: number }>();
    const norm = (s?: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const sortedRequests = [...purchaseRequests].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    sortedRequests.forEach(req => {
      if (!req.items || !Array.isArray(req.items)) return;
      req.items.forEach(it => {
        const qty = Number(it.quantity || 0);
        const info = { request: req, itemQuantity: qty };
        if (it.id) map.set(it.id, info);
        if (it.stt || it.name) {
          const key = `${norm(it.stt)}|${norm(it.name)}`;
          map.set(key, info);
        }
      });
    });

    return map;
  }, [purchaseRequests]);

  // Thống kê trạng thái đặt hàng (Donut Chart & Metrics) chi tiết theo CẢ Số chủng loại VÀ Khối lượng
  const orderStatusSummary = useMemo(() => {
    let totalItems = 0;
    let itemsOrdered = 0;
    let itemsRemaining = 0;

    let totalContractVolume = 0;
    let totalOrderedVolume = 0;
    let totalRemainingVolume = 0;

    let daCoHangCount = 0;
    let daDatHangCount = 0;
    let dangDatHangCount = 0;
    let dangGiaoCount = 0;
    let chuaDatHangCount = 0;
    let khacCount = 0;

    let daCoHangVol = 0;
    let daDatHangVol = 0;
    let dangDatHangVol = 0;
    let dangGiaoVol = 0;
    let chuaDatHangVol = 0;
    let khacVol = 0;

    const norm = (s?: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

    projMaterialPlans.forEach(p => {
      totalItems++;

      // Khối lượng hợp đồng (tổng kế hoạch)
      const contractVol = Number(p.contractVolume ?? (p as any).volume ?? 0);
      totalContractVolume += contractVol;

      // Tìm thông tin yêu cầu mua hàng liên kết nếu có
      const prKey = `${norm(p.stt)}|${norm(p.jobContent || (p as any).name)}`;
      const linkedPR = itemPurchaseRequestMap.get(p.id) || itemPurchaseRequestMap.get(prKey);

      // Khối lượng đã đặt/đề nghị mua trong đợt này
      let ordVol = 0;
      if (p.orderedVolume !== undefined && p.orderedVolume !== null && p.orderedVolume > 0) {
        ordVol = Number(p.orderedVolume);
      } else if (linkedPR && linkedPR.itemQuantity > 0) {
        ordVol = Number(linkedPR.itemQuantity);
      } else if (p.orderedStatus === 'Đã có hàng' || p.orderedStatus === 'Đã đặt hàng' || p.orderedStatus === 'Đang giao') {
        ordVol = contractVol;
      }

      totalOrderedVolume += ordVol;
      const remVol = Math.max(0, contractVol - ordVol);
      totalRemainingVolume += remVol;

      // Trạng thái đặt hàng
      let st = (p.orderedStatus || 'Chưa đặt hàng').trim();
      if (linkedPR?.request?.status) {
        const prStatus = linkedPR.request.status as string;
        if (prStatus === 'APPROVED' || prStatus === 'ORDERED') {
          st = 'Đã đặt hàng';
        } else if (prStatus === 'PENDING_CHECK' || prStatus === 'CHECKED_WAITING_APPROVAL' || prStatus === 'DRAFT' || prStatus === 'SUBMITTED') {
          st = 'Đang đặt hàng';
        }
      }

      if (st === 'Đã có hàng') {
        daCoHangCount++;
        daCoHangVol += contractVol;
        itemsOrdered++;
      } else if (st === 'Đã đặt hàng') {
        daDatHangCount++;
        daDatHangVol += ordVol > 0 ? ordVol : contractVol;
        itemsOrdered++;
      } else if (st === 'Đang đặt hàng') {
        dangDatHangCount++;
        dangDatHangVol += ordVol > 0 ? ordVol : contractVol;
        itemsOrdered++;
      } else if (st === 'Đang giao') {
        dangGiaoCount++;
        dangGiaoVol += ordVol > 0 ? ordVol : contractVol;
        itemsOrdered++;
      } else if (st === 'Chưa đặt hàng') {
        chuaDatHangCount++;
        chuaDatHangVol += contractVol;
        itemsRemaining++;
      } else {
        khacCount++;
        khacVol += contractVol;
      }
    });

    if (totalItems > 0 && itemsOrdered + itemsRemaining < totalItems) {
      itemsRemaining = totalItems - itemsOrdered;
    }

    const volumePercent = totalContractVolume > 0 ? Math.round((totalOrderedVolume / totalContractVolume) * 100) : 0;
    const itemsPercent = totalItems > 0 ? Math.round((itemsOrdered / totalItems) * 100) : 0;

    // Donut data phân theo Khối lượng (Volume)
    const donutDataVolume = [
      { name: 'Đã mua / Đã đặt', value: Math.round(totalOrderedVolume * 10) / 10, color: '#3b82f6' },
      { name: 'Còn lại chưa mua', value: Math.round(totalRemainingVolume * 10) / 10, color: '#f59e0b' },
    ].filter(d => d.value > 0);

    // Donut data phân theo Chi tiết Trạng thái
    const donutDataItems = [
      { name: 'Đã có hàng', value: daCoHangCount, color: '#10b981' },
      { name: 'Đang giao / Đã đặt', value: daDatHangCount + dangGiaoCount, color: '#3b82f6' },
      { name: 'Đang đặt hàng', value: dangDatHangCount, color: '#f59e0b' },
      { name: 'Chưa đặt hàng', value: chuaDatHangCount, color: '#94a3b8' },
      { name: 'Khác', value: khacCount, color: '#8b5cf6' },
    ].filter(d => d.value > 0);

    return {
      totalItems,
      itemsOrdered,
      itemsRemaining,
      itemsPercent,
      totalContractVolume,
      totalOrderedVolume,
      totalRemainingVolume,
      volumePercent,
      daCoHangCount,
      daDatHangCount,
      dangGiaoCount,
      dangDatHangCount,
      chuaDatHangCount,
      donutDataVolume,
      donutDataItems
    };
  }, [projMaterialPlans, itemPurchaseRequestMap]);

  // Biểu đồ cơ cấu chủng loại vật tư theo nhóm (Treemap hoặc Column)
  const materialCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    projWarehouseMaterials.forEach(m => {
      const cat = m.category || m.systemGroup || 'Vật tư chính';
      map.set(cat, (map.get(cat) || 0) + (m.currentStock ?? m.volume ?? 1));
    });

    return Array.from(map.entries()).map(([name, size]) => ({
      name,
      value: size
    })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [projWarehouseMaterials]);

  // ==========================================
  // 4. HỒ SƠ PHÁP LÝ & NGHIỆM THU
  // ==========================================
  const projDocs = useMemo(() => documentTracks ? documentTracks.filter(d => isProjectMatch(d.projectCode) || isProjectMatch(d.projectId)) : [], [documentTracks, isProjectMatch]);
  const totalDocs = projDocs.length;

  const isDocCompleted = React.useCallback((d: typeof documentTracks[number]) => {
    if (d.isCompleted) return true;
    const st = String(d.docStatus || '').toLowerCase();
    return st.includes('ký') || st.includes('đủ') || st.includes('hoàn thành') || st.includes('duyệt') || st.includes('đã nhận') || st === 'done' || st === 'approved';
  }, []);

  const completedDocs = useMemo(() => projDocs.filter(isDocCompleted).length, [projDocs, isDocCompleted]);
  const pendingDocs = totalDocs - completedDocs;
  const docPercent = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

  // Biểu đồ so sánh hồ sơ Đã duyệt vs Đang chờ xử lý theo phân loại (Stacked Bar)
  const documentTypeData = useMemo(() => {
    const map = new Map<string, { done: number; pending: number }>();
    projDocs.forEach(d => {
      const type = d.docType || (d as any).category || 'Hồ sơ thi công';
      if (!map.has(type)) map.set(type, { done: 0, pending: 0 });
      const item = map.get(type)!;
      if (isDocCompleted(d)) item.done++;
      else item.pending++;
    });

    return Array.from(map.entries()).map(([type, counts]) => ({
      type: type.length > 15 ? type.slice(0, 13) + '...' : type,
      'Đã duyệt / Ký': counts.done,
      'Đang xử lý': counts.pending
    })).slice(0, 5);
  }, [projDocs, isDocCompleted]);

  // ==========================================
  // 5. HIỆN TRƯỜNG & SỰ CỐ
  // ==========================================
  const projLogs = useMemo(() => fieldLogs ? fieldLogs.filter(l => isProjectMatch(l.projectCode)) : [], [fieldLogs, isProjectMatch]);
  const projIssues = useMemo(() => issues ? issues.filter(i => isProjectMatch(i.projectCode)) : [], [issues, isProjectMatch]);
  const unresolvedIssues = useMemo(() => projIssues.filter(i => i.status !== 'RESOLVED'), [projIssues]);

  // ==========================================
  // 6. PHÂN CÔNG NHÂN SỰ & TẢI CÔNG VIỆC
  // ==========================================
  const cleanStaffName = (raw?: string) => (!raw ? '' : raw.split('|')[0].trim());

  const assignedEngineers = useMemo(() => {
    if (!project) return [];
    const isAdminAccount = (eng: any) => {
      const r = String(eng.role || '').toLowerCase();
      const u = String(eng.username || eng.email || '').toLowerCase();
      const n = String(eng.name || '').toLowerCase();
      return r === 'admin' || r === 'quản trị viên' || u === 'admin' || n === 'admin';
    };

    const names = new Set<string>();
    engineers.forEach(eng => {
      if (isAdminAccount(eng)) return;
      const isMem = (Array.isArray(project.members) && project.members.includes(eng.id)) ||
                    (Array.isArray(project.memberIds) && project.memberIds.includes(eng.id)) ||
                    (Array.isArray(eng.projectCodes) && eng.projectCodes.some(c => isProjectMatch(c)));
      if (isMem) names.add(eng.name);
    });

    projTasks.forEach(t => {
      const rawName = String(t.assignedEngineerName || '').trim();
      if (rawName) {
        rawName.split('|')[0].split(',').map(cleanStaffName).filter(Boolean).forEach(n => {
          if (n.toLowerCase() !== 'admin') names.add(n);
        });
      }
    });

    return Array.from(names);
  }, [engineers, project, projTasks, isProjectMatch]);

  // Biểu đồ KPI Công việc nhân sự (Bar chart so sánh Xong vs Đang làm)
  const staffKpiData = useMemo(() => {
    const map = new Map<string, { done: number; inProgress: number; total: number }>();
    
    projTasks.forEach(t => {
      const rawName = String(t.assignedEngineerName || '').trim();
      const isDone = isTaskCompleted(t);
      const isProg = String(t.status || '').toLowerCase().includes('đang');

      if (rawName) {
        const names = rawName.split('|')[0].split(',').map(cleanStaffName).filter(Boolean);
        names.forEach(name => {
          if (name.toLowerCase() === 'admin') return;
          if (!map.has(name)) map.set(name, { done: 0, inProgress: 0, total: 0 });
          const item = map.get(name)!;
          item.total++;
          if (isDone) item.done++;
          else if (isProg) item.inProgress++;
        });
      }
    });

    return Array.from(map.entries())
      .map(([name, v]) => ({
        name: name.length > 12 ? name.slice(0, 10) + '...' : name,
        fullName: name,
        'Hoàn thành': v.done,
        'Đang làm': v.inProgress,
        'Tổng việc': v.total
      }))
      .sort((a, b) => b['Tổng việc'] - a['Tổng việc'])
      .slice(0, 6);
  }, [projTasks, isTaskCompleted]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  const formatShortCurrency = (val: number) => {
    if (Math.abs(val) >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)} tỷ`;
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} tr`;
    return val.toLocaleString('vi-VN') + ' đ';
  };

  if (!project) {
    return <div className="p-6 text-center text-slate-500">Không tìm thấy thông tin dự án.</div>;
  }

  return (
    <div className="p-0 m-0 space-y-2 overflow-y-auto bg-slate-50 flex-1 pb-8 w-full">

      {/* TOP EXECUTIVE METRIC RIBBON */}
      <div className="bg-white border-b border-slate-200 shadow-2xs w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 divide-slate-100 lg:divide-x divide-slate-100">
          
          <div onClick={() => canViewTasks && navigate(`/projects/${project.id}/tasks`)} className="p-3.5 flex flex-col justify-between cursor-pointer hover:bg-blue-50/40 group">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-blue-600 truncate">1. Tiến độ việc</span>
              <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">fact_check</span>
              </span>
            </div>
            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">{progressPercent}%</span>
              {taskStatusCounts.overdue > 0 && <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{taskStatusCounts.overdue} trễ</span>}
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">{completedTasks}/{totalTasks} việc xong</p>
            </div>
          </div>

          <div onClick={() => navigate(`/projects/${project.id}/cost-plan`)} className="p-3.5 flex flex-col justify-between cursor-pointer hover:bg-emerald-50/40 group">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-emerald-600 truncate">2. Doanh thu NT</span>
              <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">request_quote</span>
              </span>
            </div>
            <div className="my-1">
              <div className="text-lg font-black text-slate-900 leading-none truncate" title={formatCurrency(revenueAccepted)}>
                {formatShortCurrency(revenueAccepted)}
              </div>
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${contractVal ? Math.min(100, Math.round((revenueAccepted / contractVal) * 100)) : 100}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">HĐ: {formatShortCurrency(contractVal)}</p>
            </div>
          </div>

          <div onClick={() => navigate(`/projects/${project.id}/cost-plan`)} className="p-3.5 flex flex-col justify-between cursor-pointer hover:bg-indigo-50/40 group">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-indigo-600 truncate">3. Chi phí / Lãi P&L</span>
              <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">trending_up</span>
              </span>
            </div>
            <div className="my-1 flex items-baseline justify-between gap-1">
              <span className="text-lg font-black text-slate-900 leading-none truncate" title={formatCurrency(totalCost)}>
                {formatShortCurrency(totalCost)}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${grossProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {marginPct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1">
              <p className={`text-[10px] font-semibold truncate ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                Lãi gộp: {formatShortCurrency(grossProfit)}
              </p>
            </div>
          </div>

          <div onClick={() => navigate(`/projects/${project.id}/inventory`)} className="p-3.5 flex flex-col justify-between cursor-pointer hover:bg-amber-50/40 group">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-amber-600 truncate">4. Kho dự án</span>
              <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">inventory_2</span>
              </span>
            </div>
            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">{totalStockCount}</span>
              <span className="text-xs text-slate-400 font-semibold">mã ({totalStockQty.toLocaleString('vi-VN')} đv)</span>
            </div>
            <div className="mt-1">
              <p className="text-[10px] text-slate-400 font-semibold truncate">Tồn kho đang kiểm soát</p>
            </div>
          </div>

          <div onClick={() => navigate(`/projects/${project.id}/documents`)} className="p-3.5 flex flex-col justify-between cursor-pointer hover:bg-rose-50/40 group">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-rose-600 truncate">5. Hồ sơ A-B</span>
              <span className="w-6 h-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">file_present</span>
              </span>
            </div>
            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">{docPercent}%</span>
              <span className="text-xs text-slate-400 font-semibold">({completedDocs}/{totalDocs})</span>
            </div>
            <div className="mt-1">
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                <div className="bg-rose-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${docPercent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">Còn {pendingDocs} hồ sơ chưa duyệt</p>
            </div>
          </div>

          <div onClick={() => navigate(`/projects/${project.id}/field-logs`)} className="p-3.5 flex flex-col justify-between cursor-pointer hover:bg-purple-50/40 group">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-purple-600 truncate">6. Hiện trường & Sự cố</span>
              <span className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">campaign</span>
              </span>
            </div>
            <div className="my-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">{projLogs.length}</span>
              <span className="text-xs text-slate-400 font-semibold">nhật ký</span>
              {unresolvedIssues.length > 0 && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">{unresolvedIssues.length} sự cố</span>}
            </div>
            <div className="mt-1">
              <p className="text-[10px] text-slate-500 font-semibold truncate">{assignedEngineers.length} nhân sự thi công</p>
            </div>
          </div>

        </div>
      </div>

      {/* CONTAINER CHÍNH */}
      <div className="p-0 m-0 space-y-2 w-full">

        {/* PROJECT INFO HEADER BAR */}
        <div className="bg-white border-y sm:border border-slate-200 sm:rounded-lg p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-black flex items-center justify-center text-xs">
              {project.code?.slice(0, 3) || 'DA'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{project.name}</span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded">{project.code}</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${project.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                  {project.status === 'active' ? 'Đang triển khai' : 'Hoàn thành'}
                </span>
              </div>
              <p className="text-slate-500 text-[11px] mt-0.5">
                CĐT: <strong className="text-slate-700">{project.client || '---'}</strong> • Địa điểm: <strong className="text-slate-700">{project.location || '---'}</strong> • Chỉ huy trưởng / PM: <strong className="text-slate-700">{project.managerName || 'Chưa phân công'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/projects/${project.id}/plan`)} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">calendar_month</span> Kế hoạch
            </button>
            <button onClick={() => navigate(`/projects/${project.id}/diagram`)} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">architecture</span> Sơ đồ
            </button>
          </div>
        </div>

        {/* HỆ THỐNG BIỂU ĐỒ ĐIỀU HÀNH TOÀN DIỆN (GRID 6 BIỂU ĐỒ - 3 CỘT x 2 HÀNG) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 w-full px-0">

          {/* BIỂU ĐỒ 1: CƠ CẤU & TỶ LỆ TRẠNG THÁI CÔNG VIỆC (Donut Chart) */}
          <ChartBox 
            title="1. Cơ cấu Trạng thái Công việc" 
            icon="donut_large"
            actionText="Chi tiết"
            onAction={() => navigate(`/projects/${project.id}/tasks`)}
            badge={<span className="text-[11px] font-bold text-slate-500">{totalTasks} việc</span>}
          >
            {taskDonutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={taskDonutData} cx="50%" cy="48%" innerRadius="50%" outerRadius="78%" dataKey="value" stroke="none">
                    {taskDonutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip wrapperStyle={{ fontSize: '11px' }} />
                  <Legend verticalAlign="bottom" height={30} iconSize={9} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Chưa có công việc</div>
            )}
          </ChartBox>

          {/* BIỂU ĐỒ 2: TIẾN ĐỘ THI CÔNG THEO HẠNG MỤC (Horizontal Bar Chart) */}
          <ChartBox 
            title="2. Tiến độ theo Phân mục chính (%)" 
            icon="align_horizontal_left"
            actionText="Xem việc"
            onAction={() => navigate(`/projects/${project.id}/tasks`)}
            badge={<span className="text-[11px] font-bold text-blue-600">{progressPercent}% tổng thể</span>}
          >
            {sectionProgressData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionProgressData} layout="vertical" margin={{ top: 5, right: 35, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val: number) => [`${val}%`, 'Tiến độ']} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="progress" fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Chưa có dữ liệu phân mục</div>
            )}
          </ChartBox>

          {/* BIỂU ĐỒ 3: SO SÁNH GIÁ TRỊ TÀI CHÍNH (Grouped Column Chart) */}
          <ChartBox 
            title="3. So sánh Doanh thu - Chi phí - Lãi gộp" 
            icon="bar_chart"
            actionText="Bảng P&L"
            onAction={() => navigate(`/projects/${project.id}/cost-plan`)}
            badge={<span className={`text-[11px] font-bold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{marginPct.toFixed(1)}% lãi</span>}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialComparisonData} margin={{ top: 15, right: 15, left: 10, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatShortCurrency} axisLine={false} tickLine={false} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} wrapperStyle={{ fontSize: '11px' }} />
                <Legend verticalAlign="bottom" height={28} iconSize={9} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Hợp đồng gốc" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Bar dataKey="Đã nghiệm thu" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Bar dataKey="Chi phí thực tế" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Bar dataKey="Lợi nhuận gộp" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>

          {/* BIỂU ĐỒ 4: XU HƯỚNG DÒNG CHI THEO THỜI GIAN (Area Chart / Trend) */}
          <ChartBox 
            title="4. Xu hướng Chi phí 6 Tháng gần nhất" 
            icon="show_chart"
            actionText="Chi phí"
            onAction={() => navigate(`/projects/${project.id}/cost-plan?tab=EXPENSE`)}
            badge={<span className="text-[11px] font-bold text-slate-500">{formatShortCurrency(totalCost)}</span>}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyExpenseTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatShortCurrency} axisLine={false} tickLine={false} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="Chi phí thực chi" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#costGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>

          {/* BIỂU ĐỒ 5: HỒ SƠ PHÁP LÝ & DUYỆT NGHIỆM THU (Stacked Column Chart) */}
          <ChartBox 
            title="5. Phân bổ Hồ sơ A-B (Đã duyệt vs Đang xử lý)" 
            icon="file_present"
            actionText="Quản lý"
            onAction={() => navigate(`/projects/${project.id}/documents`)}
            badge={<span className="text-[11px] font-bold text-rose-600">{completedDocs}/{totalDocs} bộ</span>}
          >
            {documentTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={documentTypeData} margin={{ top: 10, right: 15, left: 0, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip wrapperStyle={{ fontSize: '11px' }} />
                  <Legend verticalAlign="bottom" height={28} iconSize={9} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Đã duyệt / Ký" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Đang xử lý" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Chưa có hồ sơ dự án</div>
            )}
          </ChartBox>

          {/* BIỂU ĐỒ 6: KPI & KHỐI LƯỢNG CÔNG VIỆC NHÂN SỰ (Grouped Bar Chart) */}
          <ChartBox 
            title="6. Tải công việc theo Kỹ sư / Cán bộ" 
            icon="groups"
            actionText="Phân công"
            onAction={() => navigate(`/task-assignment?tab=project_tasks&project=${encodeURIComponent(project.code)}`)}
            badge={<span className="text-[11px] font-bold text-slate-500">{assignedEngineers.length} nhân sự</span>}
          >
            {staffKpiData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffKpiData} margin={{ top: 10, right: 15, left: 0, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip wrapperStyle={{ fontSize: '11px' }} />
                  <Legend verticalAlign="bottom" height={28} iconSize={9} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Hoàn thành" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={25} />
                  <Bar dataKey="Đang làm" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Chưa có phân công việc</div>
            )}
          </ChartBox>

          {/* BIỂU ĐỒ 7: THỐNG KÊ ĐẶT HÀNG & CUNG ỨNG VẬT TƯ (Tỉ lệ đã mua vs còn lại) */}
          <ChartBox 
            title="7. Thống kê Đặt hàng & Mua sắm" 
            icon="shopping_cart_checkout"
            actionText="Xem chi tiết"
            onAction={() => navigate(`/projects/${project.id}/cost-plan`)}
            badge={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setProcurementViewMode(prev => prev === 'volume' ? 'items' : 'volume')}
                  className="px-2 py-0.5 text-[10px] font-semibold rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  title="Nhấn để chuyển đổi giữa thống kê theo Số lượng đặt và Phân loại trạng thái"
                >
                  {procurementViewMode === 'volume' ? '📊 Khối lượng' : '📋 Chủng loại'}
                </button>
                <span className="text-[11px] font-bold text-primary">
                  {procurementViewMode === 'volume' ? `${orderStatusSummary.volumePercent}% tiến độ mua` : `${orderStatusSummary.itemsPercent}% đã xử lý`}
                </span>
              </div>
            }
          >
            <div className="flex flex-col h-full">
              {/* Thẻ tóm tắt Số lượng mua / Còn lại */}
              <div className="grid grid-cols-3 gap-1.5 px-3 pt-2 pb-1 bg-slate-50 border-b border-slate-100 text-center shrink-0">
                <div className="bg-white p-1 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium">Tổng nhu cầu</div>
                  <div className="text-xs font-bold text-slate-800">
                    {procurementViewMode === 'volume'
                      ? orderStatusSummary.totalContractVolume.toLocaleString('vi-VN')
                      : `${orderStatusSummary.totalItems} vật tư`}
                  </div>
                </div>
                <div className="bg-blue-50/70 p-1 rounded border border-blue-200">
                  <div className="text-[10px] text-blue-700 font-medium">Đã mua / Đặt</div>
                  <div className="text-xs font-bold text-blue-700">
                    {procurementViewMode === 'volume'
                      ? orderStatusSummary.totalOrderedVolume.toLocaleString('vi-VN')
                      : `${orderStatusSummary.itemsOrdered} mục`}
                  </div>
                </div>
                <div className="bg-amber-50/70 p-1 rounded border border-amber-200">
                  <div className="text-[10px] text-amber-700 font-medium">Còn lại chưa mua</div>
                  <div className="text-xs font-bold text-amber-700">
                    {procurementViewMode === 'volume'
                      ? orderStatusSummary.totalRemainingVolume.toLocaleString('vi-VN')
                      : `${orderStatusSummary.itemsRemaining} mục`}
                  </div>
                </div>
              </div>

              {/* Biểu đồ Donut / Pie */}
              <div className="flex-1 min-h-0 relative">
                {(procurementViewMode === 'volume' ? orderStatusSummary.donutDataVolume : orderStatusSummary.donutDataItems).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={procurementViewMode === 'volume' ? orderStatusSummary.donutDataVolume : orderStatusSummary.donutDataItems} 
                        cx="50%" 
                        cy="46%" 
                        innerRadius="46%" 
                        outerRadius="72%" 
                        dataKey="value" 
                        stroke="none"
                      >
                        {(procurementViewMode === 'volume' ? orderStatusSummary.donutDataVolume : orderStatusSummary.donutDataItems).map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val: any) => [
                          typeof val === 'number' ? val.toLocaleString('vi-VN') : val, 
                          procurementViewMode === 'volume' ? 'Khối lượng' : 'Số đầu mục'
                        ]}
                        wrapperStyle={{ fontSize: '11px' }} 
                      />
                      <Legend verticalAlign="bottom" height={26} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">Chưa có dữ liệu đặt hàng</div>
                )}
              </div>
            </div>
          </ChartBox>

        </div>

        {/* BẢNG TỔNG HỢP CÔNG VIỆC TRỌNG TÂM & NHẬT KÝ HIỆN TRƯỜNG DƯỚI CÙNG */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Card: Công việc có hạn chót gần nhất */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-rose-600">alarm</span>
                  Công việc trọng tâm & Hạn xử lý
                </span>
                <button onClick={() => navigate(`/projects/${project.id}/tasks`)} className="text-xs font-semibold text-primary hover:underline">
                  Xem tất cả việc ({totalTasks})
                </button>
              </div>

              <div className="space-y-1.5">
                {projTasks.filter(t => !isTaskCompleted(t)).slice(0, 4).map(t => {
                  const isOver = t.dueDate && new Date(t.dueDate).getTime() < new Date().getTime();
                  return (
                    <div key={t.id} onClick={() => navigate(`/projects/${project.id}/tasks`)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded border border-slate-100 flex items-center justify-between text-xs cursor-pointer">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-semibold text-slate-800 truncate">{t.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Phụ trách: <strong className="text-slate-600">{cleanStaffName(t.assignedEngineerName) || 'Chưa giao'}</strong> • Hạn: <strong className={isOver ? 'text-rose-600' : 'text-slate-600'}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Không'}</strong>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${isOver ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                        {Math.round(getTaskEffectiveProgress(t) * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card: Nhật ký công trường & sự cố */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-purple-600">history_edu</span>
                  Nhật ký & Sự cố hiện trường mới nhất
                </span>
                <button onClick={() => navigate(`/projects/${project.id}/field-logs`)} className="text-xs font-semibold text-primary hover:underline">
                  Nhật ký ({projLogs.length})
                </button>
              </div>

              <div className="space-y-1.5">
                {projLogs.slice(0, 3).map(l => (
                  <div key={l.id} onClick={() => navigate(`/projects/${project.id}/field-logs`)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded border border-slate-100 text-xs cursor-pointer">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                      <span>{l.createdByName || 'Kỹ sư công trường'}</span>
                      <span>{new Date(l.timestamp).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p className="text-slate-700 font-medium truncate">{l.note || 'Không có mô tả'}</p>
                  </div>
                ))}
                {projLogs.length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-400">Chưa có nhật ký công trường</div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
