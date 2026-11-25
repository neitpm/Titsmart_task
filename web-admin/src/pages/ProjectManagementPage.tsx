

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore, hasPermission, canManageItem } from '../services/authStore';
import {
  Project,
  Task,
  isTaskSectionHeaderItem,
  isTaskActuallyDone,
  getTaskEffectiveProgress,
  ProjectPriority,
  getProjectPriorityWeight,
  getProjectPriorityInfo,
  PROJECT_PRIORITY_OPTIONS
} from '../types';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Toast } from '../components/common/Toast';
import { OcrUploadPanel } from '../components/common/OcrUploadPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import { WebOcrExtractedData } from '../services/webOcrService';
import { AuditInfoCell } from '../components/common/AuditInfoCell';
import { isUserMemberOfProject } from '../utils/projectMemberUtils';
import { isNotificationForUser } from '../components/common/NotificationBell';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { CustomSelect } from '../components/common/CustomSelect';
import { useUIStore } from '../services/uiStore';
import { geocodeAddress, getCurrentDeviceLocation } from '../utils/geocodingUtils';

const todayStamp = () => new Date().toISOString().split('T')[0];

const TEXT = {
  unassigned: 'Chưa phân công',
  projectManagement: 'Tất cả dự án',
  projectSubtitle: 'Tổng quan thông tin và tiến độ của tất cả các dự án',
  searchProject: 'Tìm kiếm dự án...',
  createProject: 'Tạo dự án mới',
  active: '\u0110ang tri\u1ec3n khai',
  completed: 'Ho\u00e0n th\u00e0nh',
  onHold: 'T\u1ea1m d\u1eebng',
  noProjectFound: 'Kh\u00f4ng c\u00f3 d\u1ef1 \u00e1n ph\u00f9 h\u1ee3p',
  noProject: 'Ch\u01b0a c\u00f3 d\u1ef1 \u00e1n n\u00e0o',
  deleteProject: 'Xóa dự án',
  cancel: 'H\u1ee7y',
  create: 'T\u1ea1o D\u1ef1 \u00e1n',
  importProjectTitle: 'Nh\u1eadp file / Kh\u1edfi t\u1ea1o D\u1ef1 \u00e1n',
  noProjectInFile: 'Kh\u00f4ng t\u00ecm th\u1ea5y d\u00f2ng C\u00f4ng tr\u00ecnh/D\u1ef1 \u00e1n trong file. H\u00e3y ki\u1ec3m tra l\u1ea1i file ho\u1eb7c nh\u1eadp th\u1ee7 c\u00f4ng.',
  importedToForm: '\u0110\u00e3 l\u1ea5y th\u00f4ng tin c\u00f4ng tr\u00ecnh v\u00e0o form d\u1ef1 \u00e1n. Ki\u1ec3m tra v\u00e0 l\u01b0u n\u1ebfu \u0111\u00fang.',
  createFailed: 'Kh\u00f4ng t\u1ea1o \u0111\u01b0\u1ee3c d\u1ef1 \u00e1n, n\u00ean ch\u01b0a import \u0111\u1ea7u m\u1ee5c.',
  created: '\u0110\u00e3 t\u1ea1o d\u1ef1 \u00e1n',
  deleted: '\u0110\u00e3 x\u00f3a d\u1ef1 \u00e1n',
  taskStatus: 'Ch\u01b0a l\u00e0m',
  purchaseStatus: 'Ch\u01b0a \u0111\u1eb7t h\u00e0ng',
  constructionStatus: 'Ch\u01b0a thi c\u00f4ng',
  importNote: 'Import t\u1eeb ph\u1ee5 l\u1ee5c d\u1ef1 \u00e1n',
  materialSyncNote: '\u0110\u1ed3ng b\u1ed9 t\u1eeb ph\u1ee5 l\u1ee5c khi t\u1ea1o d\u1ef1 \u00e1n',
};

export type ProjectViewMode = 'grid' | 'compact_grid' | 'table' | 'table_detailed' | 'kanban';

export const sanitizeProjectCode = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 50);
};

const slugProjectCode = (value: string) => {
  const normalized = sanitizeProjectCode(value);
  return normalized || `PRJ-${Math.floor(Math.random() * 1000)}`;
};

const normalizeLabel = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u0111\u0110]/g, 'd').toLowerCase();

const getImportedFieldValue = (data: WebOcrExtractedData, labels: string[]) => {
  const normalizedLabels = labels.map(normalizeLabel);
  return data.fields.find((field) => normalizedLabels.some((label) => normalizeLabel(field.label).includes(label)))?.value || '';
};

const deriveProjectsFromTasks = (tasks: Task[]): Project[] => {
  const projectMap = new Map<string, Project>();
  const progressMap = new Map<string, number>();

  tasks.forEach((task) => {
    if (!task.projectCode) return;
    const isSec = isTaskSectionHeaderItem(task);
    const isDone = isTaskActuallyDone(task);
    const taskProg = getTaskEffectiveProgress(task);
    const current = projectMap.get(task.projectCode);

    if (!current) {
      projectMap.set(task.projectCode, {
        id: 'derived-' + task.projectCode,
        code: task.projectCode,
        name: task.projectName || task.projectCode,
        location: '',
        progressPercent: 0,
        status: 'active',
        totalTasks: isSec ? 0 : 1,
        completedTasks: !isSec && isDone ? 1 : 0,
        issueTasksCount: task.issue ? 1 : 0,
        managerName: TEXT.unassigned,
        activeTeams: 0,
      });
      progressMap.set(task.projectCode, isSec ? 0 : taskProg);
      return;
    }
    if (isSec) return;
    current.totalTasks += 1;
    current.completedTasks += isDone ? 1 : 0;
    current.issueTasksCount += task.issue ? 1 : 0;
    progressMap.set(task.projectCode, (progressMap.get(task.projectCode) || 0) + taskProg);
  });
  return Array.from(projectMap.values()).map((project) => ({
    ...project,
    progressPercent: project.totalTasks > 0 ? Math.round(((progressMap.get(project.code) || 0) / project.totalTasks) * 100) : 0,
  }));
};

export const ProjectManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const projects = useRealtimeStore((state) => state.projects);
  const tasks = useRealtimeStore((state) => state.tasks);
  const engineers = useRealtimeStore((state) => state.engineers);
  const notifications = useRealtimeStore((state) => state.notifications);
  const markNotificationRead = useRealtimeStore((state) => state.markNotificationRead);
  const addProject = useRealtimeStore((state) => state.addProject);
  const addNotification = useRealtimeStore((state) => state.addNotification);
  const addTasksBatch = useRealtimeStore((state) => state.addTasksBatch);
  const addMaterialPlan = useRealtimeStore((state) => state.addMaterialPlan);
  const addPurchasingPlan = useRealtimeStore((state) => state.addPurchasingPlan);
  const addMaterialPlansBatch = useRealtimeStore((state) => state.addMaterialPlansBatch);
  const addPurchasingsBatch = useRealtimeStore((state) => state.addPurchasingsBatch);
  const deleteProject = useRealtimeStore((state) => state.deleteProject);
  const addEngineer = useRealtimeStore((state) => state.addEngineer);
  const updateEngineer = useRealtimeStore((state) => state.updateEngineer);
  const logActivity = useRealtimeStore((state) => state.logActivity);
  const materialPlans = useRealtimeStore((state) => state.materialPlans);
  const purchasingPlans = useRealtimeStore((state) => state.purchasingPlans);
  const expenses = useRealtimeStore((state) => state.expenses);
  const laborPayrolls = useRealtimeStore((state) => state.laborPayrolls);
  const updateProject = useRealtimeStore((state) => state.updateProject);
  const fetchProjects = useRealtimeStore((state) => state.fetchProjects);
  const fetchEngineers = useRealtimeStore((state) => state.fetchEngineers);
  const isFetchingProjects = useRealtimeStore((state) => state.isFetchingProjects);

  const currentUser = useAuthStore(state => state.user);

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>(() => {
    const s = searchParams.get('status');
    if (s === 'all' || s === 'active' || s === 'completed' || s === 'on_hold') {
      return s;
    }
    return 'active';
  });

  useEffect(() => {
    const s = searchParams.get('status');
    if (s && (s === 'all' || s === 'active' || s === 'completed' || s === 'on_hold')) {
      if (s !== statusFilter) {
        setStatusFilter(s);
      }
    }
  }, [searchParams]);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Dùng cấu hình kiểu hiển thị chung trong Cài đặt giao diện.
  const viewMode = useUIStore(s => s.appViewMode) as ProjectViewMode;
  const setAppViewMode = useUIStore(s => s.setAppViewMode);
  const handleViewModeChange = (mode: ProjectViewMode) => setAppViewMode(mode);
  const tablePaginationMode = useUIStore(s => s.tablePaginationMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(24);
  const [projectVisibleLimit, setProjectVisibleLimit] = useState<number>(24);
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'name_asc' | 'name_desc' | 'progress_desc' | 'progress_asc'>('latest');

  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [notifOpenProjectId, setNotifOpenProjectId] = useState<string | null>(null);
  const suppressProjectCardNavigationRef = useRef(false);
  const [priorityFilter, setPriorityFilter] = useState<'all' | ProjectPriority>('all');
  const [newProjPriority, setNewProjPriority] = useState<ProjectPriority>('normal');
  const [editProjPriority, setEditProjPriority] = useState<ProjectPriority>('normal');
  const [quickPriorityMenuProjectId, setQuickPriorityMenuProjectId] = useState<string | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [toastState, setToastState] = useState({ show: false, message: '', type: 'success' as 'success' | 'info' | 'warning' });
  const [newProjName, setNewProjName] = useState('');
  const [newProjCode, setNewProjCode] = useState('');
  const [newProjLocation, setNewProjLocation] = useState('');
  const [newProjLatitude, setNewProjLatitude] = useState<string>('');
  const [newProjLongitude, setNewProjLongitude] = useState<string>('');
  const [newProjRadiusMeters, setNewProjRadiusMeters] = useState<number>(500);
  const [isGeocodingNew, setIsGeocodingNew] = useState(false);
  const [newProjClient, setNewProjClient] = useState('');
  const [newProjCategory, setNewProjCategory] = useState('');
  const [newProjNotes, setNewProjNotes] = useState('');
  const [selectedEngineerIds, setSelectedEngineerIds] = useState<string[]>([]);
  const [newProjManagerId, setNewProjManagerId] = useState<string>('');
  const [editProjManagerId, setEditProjManagerId] = useState<string>('');
  const [pendingProjectTasks, setPendingProjectTasks] = useState<NonNullable<WebOcrExtractedData['tableTasks']>>([]);
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const toggleEngineerId = (id: string) => {
    setSelectedEngineerIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastState({ show: true, message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastState(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  useEffect(() => {
    if (!quickPriorityMenuProjectId) return;
    const handleOutsideClick = () => setQuickPriorityMenuProjectId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [quickPriorityMenuProjectId]);

  const handleQuickChangePriority = async (projectId: string, priority: ProjectPriority, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setQuickPriorityMenuProjectId(null);
    try {
      await updateProject(projectId, { priority });
      triggerToast(`Đã đổi mức độ ưu tiên dự án sang "${getProjectPriorityInfo(priority).label}"`, 'success');
    } catch (err) {
      console.error(err);
      triggerToast('Lỗi khi đổi mức độ ưu tiên dự án', 'warning');
    }
  };

  const resolveProjectMemberNames = (project: Project) => {
    const pCodeUpper = (project.code || '').trim().toUpperCase();
    const pIdUpper = (project.id || '').trim().toUpperCase();
    const pNameUpper = (project.name || '').trim().toUpperCase();

    const memberNamesFromEngineers = engineers
      .filter((eng) => {
        // Check if engineer.id is in project.members or project.memberIds
        const isMember = (Array.isArray(project.members) && project.members.includes(eng.id)) ||
                         (Array.isArray(project.memberIds) && project.memberIds.includes(eng.id));
        // Check if engineer has project.code, project.id, or project.name in eng.projectCodes
        const hasCode = Array.isArray(eng.projectCodes) && eng.projectCodes.some(c => {
          const u = (c || '').trim().toUpperCase();
          return u && (u === pCodeUpper || u === pIdUpper || u === pNameUpper);
        });
        // Check managedProjects or memberProjects array
        const hasManaged = eng.managedProjects?.some(p => {
          const u = (p.code || p.name || '').trim().toUpperCase();
          return u && (u === pCodeUpper || u === pIdUpper || u === pNameUpper);
        });
        const hasMemberProj = eng.memberProjects?.some(p => {
          const u = (p.code || p.name || '').trim().toUpperCase();
          return u && (u === pCodeUpper || u === pIdUpper || u === pNameUpper);
        });

        return isMember || hasCode || hasManaged || hasMemberProj;
      })
      .map((eng) => eng.name);

    // Fallback: parse project.managerName if set and non-default
    let extraNames: string[] = [];
    if (project.managerName && project.managerName !== TEXT.unassigned) {
      extraNames = project.managerName.split(',').map(s => s.trim()).filter(Boolean);
    }

    return Array.from(new Set([...memberNamesFromEngineers, ...extraNames]));
  };

  const allEnhancedProjects = useMemo(() => {
    const norm = (s?: string) => String(s || '').trim().toUpperCase();
    const derivedProjects = deriveProjectsFromTasks(tasks);

    // Merge database projects and derived projects
    const seenKeys = new Set<string>();
    const merged: Project[] = [];

    [...projects, ...derivedProjects].forEach((proj) => {
      const codeKey = norm(proj.code);
      const idKey = norm(proj.id);
      const nameKey = norm(proj.name);

      if ((codeKey && seenKeys.has(codeKey)) || (idKey && seenKeys.has(idKey))) {
        return;
      }
      if (codeKey) seenKeys.add(codeKey);
      if (idKey) seenKeys.add(idKey);
      merged.push(proj);
    });

    const finalMerged = merged
      .filter((proj) => norm(proj.code) !== 'COMPANY')
      .filter((proj) => isUserMemberOfProject(currentUser, proj, engineers));
    
    return finalMerged.map((project) => {
      const pCodeUpper = (project.code || '').trim().toUpperCase();
      const pIdUpper = (project.id || '').trim().toUpperCase();
      const pNameUpper = (project.name || '').trim().toUpperCase();
      const isProjectItem = (item: any) => {
        const u = (item.projectCode || item.projectId || '').trim().toUpperCase();
        const n = (item.projectName || '').trim().toUpperCase();
        return (u && (u === pCodeUpper || u === pIdUpper)) || (n && pNameUpper && n === pNameUpper);
      };

      const projectTasks = tasks.filter((task) => isProjectItem(task) && !isTaskSectionHeaderItem(task));
      const totalTasks = projectTasks.length || project.totalTasks;
      const completedTasks = projectTasks.filter((task) => isTaskActuallyDone(task)).length || project.completedTasks;
      const memberNames = resolveProjectMemberNames(project);

      let progress = project.progressPercent;
      if (projectTasks.length > 0) {
        const totalProgress = projectTasks.reduce((sum, task) => sum + getTaskEffectiveProgress(task), 0);
        progress = Math.round((totalProgress / projectTasks.length) * 100);
      }

      const projMaterialPlans = materialPlans.filter((plan) => isProjectItem(plan));
      const totalMaterials = projMaterialPlans.length;
      const completedMaterials = projMaterialPlans.filter((plan) => {
        const status = (plan.progressStatus || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const ordered = (plan.orderedStatus || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return status.includes('hoan thanh') || ordered.includes('nhan du') || status.includes('da co hang') || status.includes('da giao');
      }).length;
      const materialProgress = totalMaterials > 0 ? Math.round((completedMaterials / totalMaterials) * 100) : 0;

      const projPurchasings = purchasingPlans.filter((item) => isProjectItem(item));
      const projExpenses = expenses.filter((item) => isProjectItem(item));
      const projLabors = laborPayrolls.filter((item) => isProjectItem(item));

      const totalPurchasing = projPurchasings.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
      const totalExp = projExpenses.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
      const totalLab = projLabors.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
      const totalCost = totalPurchasing + totalExp + totalLab;
      const missingDocsCount = projMaterialPlans.filter((plan) => !plan.docCo).length + projMaterialPlans.filter((plan) => !plan.docCq).length;

      // Chỉ ghi nhận người và thời gian khi thực sự chỉnh sửa thông tin Dự án
      const effectiveUpdatedBy = (project.updatedBy && project.updatedBy !== 'Hệ thống') ? project.updatedBy : '';
      const effectiveUpdatedAt = project.updatedAt || '';

      // Lấy danh sách thông báo đã đọc của tài khoản hiện tại từ per-user local storage
      const readStorageKey = `buildcore_read_notifs_${currentUser?.id || currentUser?.username || 'guest'}`;
      let localReadIds = new Set<string>();
      try {
        const raw = localStorage.getItem(readStorageKey);
        if (raw) localReadIds = new Set(JSON.parse(raw));
      } catch {}

      // Đếm số thông báo chưa đọc thuộc riêng dự án này theo quyền của user
      const projectUnreadNotifCount = notifications.filter((notif) => {
        if (notif.read || localReadIds.has(notif.id)) return false;
        if (!isNotificationForUser(notif, currentUser, engineers, tasks)) return false;

        const notifProj = String((notif as any).projectCode || (notif as any).projectId || '').trim().toUpperCase();
        if (notifProj && (notifProj === pCodeUpper || notifProj === pIdUpper)) return true;

        const notifLink = String(notif.link || '').toLowerCase();
        const pCodeLower = (project.code || '').trim().toLowerCase();
        const pIdLower = (project.id || '').trim().toLowerCase();
        if (pCodeLower && notifLink.includes(pCodeLower)) return true;
        if (pIdLower && notifLink.includes(pIdLower)) return true;

        const notifText = `${notif.title || ''} ${notif.message || ''}`.toLowerCase();
        const pNameLower = (project.name || '').trim().toLowerCase();
        if (pNameLower && pNameLower.length >= 4 && notifText.includes(pNameLower)) return true;
        if (pCodeLower && pCodeLower.length >= 3 && notifText.includes(pCodeLower)) return true;

        return false;
      }).length;

      return {
        ...project,
        updatedBy: effectiveUpdatedBy,
        updatedAt: effectiveUpdatedAt,
        status: progress >= 100 ? 'completed' : project.status,
        totalTasks,
        completedTasks,
        progress,
        memberNames,
        totalMaterials,
        completedMaterials,
        materialProgress,
        totalCost,
        missingDocsCount,
        unreadNotifCount: projectUnreadNotifCount
      };
    });
  }, [projects, tasks, materialPlans, purchasingPlans, expenses, laborPayrolls, engineers, notifications, currentUser]);


  const isProjectInDateRange = (project: any, fromDate: string, toDate: string) => {
    if (!fromDate && !toDate) return true;
    
    // Lọc chính xác theo ngày tạo dự án (createdAt / created_at / startDate làm fallback)
    const pCreated = (project.createdAt || project.created_at || project.startDate)
      ? String(project.createdAt || project.created_at || project.startDate).slice(0, 10)
      : '';

    if (!pCreated) return true;

    // Khoảng lọc ngày tạo: từ fromDate đến toDate
    if (fromDate && pCreated < fromDate) return false;
    if (toDate && pCreated > toDate) return false;

    return true;
  };

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    allEnhancedProjects.forEach((p) => {
      const cat = (p.category || '').trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allEnhancedProjects]);

  const counts = useMemo(() => {
    const q = normalizeLabel(searchQuery.trim());
    const filteredBySearch = allEnhancedProjects.filter((project) => {
      if (!isProjectInDateRange(project, filterDateFrom, filterDateTo)) return false;
      if (priorityFilter !== 'all' && (project.priority || 'normal') !== priorityFilter) return false;
      if (categoryFilter !== 'all') {
        const pCat = (project.category || '').trim().toLowerCase();
        if (pCat !== categoryFilter.toLowerCase()) return false;
      }
      if (!q) return true;
      return [project.name, project.code, project.location, project.client, project.category, project.notes, project.managerName, project.memberNames.join(' ')]
        .some((value) => normalizeLabel(String(value || '')).includes(q));
    });
    return {
      all: filteredBySearch.length,
      active: filteredBySearch.filter(p => p.status === 'active').length,
      completed: filteredBySearch.filter(p => p.status === 'completed').length,
    };
  }, [allEnhancedProjects, searchQuery, filterDateFrom, filterDateTo, categoryFilter, priorityFilter]);

  const enhancedProjects = useMemo(() => {
    const q = normalizeLabel(searchQuery.trim());
    
    return allEnhancedProjects.filter((project) => {
      const matchStatus = statusFilter === 'all' || project.status === statusFilter;
      if (!matchStatus) return false;
      if (priorityFilter !== 'all' && (project.priority || 'normal') !== priorityFilter) return false;
      if (!isProjectInDateRange(project, filterDateFrom, filterDateTo)) return false;
      if (categoryFilter !== 'all') {
        const pCat = (project.category || '').trim().toLowerCase();
        if (pCat !== categoryFilter.toLowerCase()) return false;
      }

      if (!q) return true;
      return [project.name, project.code, project.location, project.client, project.category, project.notes, project.managerName, project.memberNames.join(' ')]
        .some((value) => normalizeLabel(String(value || '')).includes(q));
    }).sort((a, b) => {
      // 1. Luôn ưu tiên theo cấp bậc ưu tiên (Cấp 1 > Cấp 2 > Cấp 3 > Cấp 4) lên trước
      const prioWeightA = getProjectPriorityWeight(a.priority);
      const prioWeightB = getProjectPriorityWeight(b.priority);
      if (prioWeightA !== prioWeightB) {
        return prioWeightA - prioWeightB;
      }

      if (sortBy === 'progress_desc') return (b.progress || 0) - (a.progress || 0);
      if (sortBy === 'progress_asc') return (a.progress || 0) - (b.progress || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true });
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '', 'vi', { numeric: true });

      const getTimestamp = (p: any) => {
        const time = new Date(p.createdAt || p.created_at || p.updatedAt || p.updated_at || p.startDate || 0).getTime();
        return isNaN(time) ? 0 : time;
      };
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);

      if (sortBy === 'oldest') {
        if (timeA !== timeB) return timeA - timeB;
        return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true });
      }

      // Ưu tiên dự án mới nhất (thời gian tạo / cập nhật lớn nhất) lên đầu
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true });
    });
  }, [allEnhancedProjects, searchQuery, statusFilter, categoryFilter, filterDateFrom, filterDateTo, sortBy, priorityFilter]);

  // Reset về trang 1 khi thay đổi bất kỳ bộ lọc hoặc chế độ sắp xếp nào
  useEffect(() => {
    setCurrentPage(1);
    setProjectVisibleLimit(24);
  }, [searchQuery, statusFilter, categoryFilter, priorityFilter, filterDateFrom, filterDateTo, sortBy, pageSize]);

  const totalPages = Math.max(1, Math.ceil(enhancedProjects.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProjects = useMemo(() => {
    if (tablePaginationMode === 'infinite') {
      return enhancedProjects.slice(0, projectVisibleLimit);
    }
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return enhancedProjects.slice(startIndex, startIndex + pageSize);
  }, [enhancedProjects, safeCurrentPage, pageSize, tablePaginationMode, projectVisibleLimit]);



  const openProjectTasks = (project: Project) => navigate(`/projects/${project.id}`);

  const applyImportedProject = (data: WebOcrExtractedData) => {
    const projectName = data.projectName || getImportedFieldValue(data, ['cong trinh', 'ten cong trinh', 'du an', 'goi thau']);
    if (!projectName) {
      triggerToast(TEXT.noProjectInFile, 'warning');
      return;
    }
    const location = data.location || getImportedFieldValue(data, ['dia diem cong trinh', 'dia diem xay dung', 'dia diem', 'vi tri', 'dia chi']);
    const client = getImportedFieldValue(data, ['chu dau tu', 'khach hang', 'ben giao thau']);
    const category = getImportedFieldValue(data, ['phan loai', 'loai cong trinh', 'loai du an']);
    const notes = getImportedFieldValue(data, ['hang muc', 'hạng mục']);
    setNewProjName(projectName);
    setNewProjCode(slugProjectCode(projectName));
    setNewProjLocation(location);
    setNewProjClient(client);
    setNewProjCategory(category || notes);
    setNewProjNotes(notes);
    setPendingProjectTasks(data.tableTasks || []);
    setIsNewProjectModalOpen(true);
    triggerToast(data.tableTasks?.length ? `${TEXT.importedToForm} (${data.tableTasks.length} \u0111\u1ea7u m\u1ee5c)` : TEXT.importedToForm, 'info');
  };

  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newProjName.trim()) return;

    const code = newProjCode.trim() ? sanitizeProjectCode(newProjCode) : slugProjectCode(newProjName);

    // Kiểm tra cảnh báo trùng lặp Tên dự án hoặc Mã dự án
    const normNewCode = code.toUpperCase().replace(/[-_]/g, '');
    const normNewName = normalizeLabel(newProjName.trim()).replace(/\s+/g, '');
    const duplicateProject = projects.find((p) => {
      const pCode = (p.code || '').toUpperCase().replace(/[-_]/g, '');
      const pName = normalizeLabel(p.name || '').replace(/\s+/g, '');
      return (normNewCode && pCode === normNewCode) || (normNewName && pName === normNewName);
    });

    if (duplicateProject) {
      triggerToast(`Cảnh báo: Dự án hoặc Mã dự án "${code}" đã tồn tại trong hệ thống (${duplicateProject.name})! Vui lòng kiểm tra lại để tránh trùng lặp.`, 'warning');
      return;
    }

    setLoading(true);
    setLoadingMessage('Đang tạo dự án...');
    try {
      let finalLat = parseFloat(newProjLatitude);
      let finalLng = parseFloat(newProjLongitude);

      // Tự động tìm tọa độ ngầm nếu chưa có tọa độ nhưng có địa chỉ
      if ((isNaN(finalLat) || isNaN(finalLng)) && newProjLocation.trim().length >= 3) {
        try {
          const geoRes = await geocodeAddress(newProjLocation.trim());
          if (geoRes) {
            finalLat = geoRes.latitude;
            finalLng = geoRes.longitude;
          }
        } catch {
          // Bỏ qua lỗi ngầm
        }
      }

      const selectedEngineers = engineers.filter(eng => selectedEngineerIds.includes(eng.id));
      const managerEng = engineers.find(eng => eng.id === newProjManagerId);
      const managerName = managerEng ? managerEng.name : TEXT.unassigned;
      const managerId = managerEng ? managerEng.id : undefined;

      const newProject: Omit<Project, 'id'> = {
        code,
        name: newProjName.trim(),
        client: newProjClient.trim() || undefined,
        location: newProjLocation.trim(),
        latitude: !isNaN(finalLat) ? finalLat : undefined,
        longitude: !isNaN(finalLng) ? finalLng : undefined,
        radiusMeters: newProjRadiusMeters > 0 ? newProjRadiusMeters : 500,
      category: newProjCategory.trim() || undefined,
      priority: newProjPriority || 'normal',
      notes: newProjNotes.trim() || undefined,
      progressPercent: 0,
      status: 'active',
      activeTeams: 0,
      totalTasks: 0,
      completedTasks: 0,
      issueTasksCount: 0,
      managerId: managerId,
      managerName: managerName,
      members: selectedEngineerIds,
      memberIds: selectedEngineerIds,
      startDate: todayStamp(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const createdProject = await addProject(newProject);
    if (!createdProject) {
      triggerToast(TEXT.createFailed, 'warning');
      return;
    }

    // Cập nhật projectCodes cho các kỹ sư được gán vào dự án
    if (selectedEngineerIds.length > 0) {
      const engineerPromises = selectedEngineerIds.map(engId => {
        const eng = engineers.find(e => e.id === engId);
        if (eng) {
          const currentCodes = Array.isArray(eng.projectCodes) ? eng.projectCodes : [];
          if (!currentCodes.includes(code)) {
            return updateEngineer(engId, {
              name: eng.name,
              projectCodes: [...currentCodes, code],
              permissions: eng.permissions,
            });
          }
        }
        return Promise.resolve();
      });
      await Promise.all(engineerPromises);
    }

    if (pendingProjectTasks.length > 0) {
      let orderCounter = 0;
      let currentMainSectionId: string | undefined = undefined;
      let currentSubSectionId: string | undefined = undefined;
      const sttIdMap = new Map<string, string>();




      const tasksWithIds = pendingProjectTasks.map((item, index) => {
        const taskId = crypto.randomUUID();
        return {
          ...item,
          id: taskId,
        };
      });

      tasksWithIds.forEach(item => {
        if (item.stt) sttIdMap.set(item.stt.trim(), item.id);
      });

      const existingTaskKeys = new Set(tasks.filter((task) => task.projectCode === code).map((task) => `${task.parentId || 'root'}|${task.stt.trim()}|${task.name.trim().toLowerCase()}`));

      const importedTasks: Task[] = [];

      tasksWithIds.forEach((item, index) => {

        const sttVal = (item.stt || '').trim();
        const isSection = item.isSectionHeader;

        let parentId = undefined;
        if (isSection) {
          const isMainLevelHeader = /^[A-Z]{1,2}$/i.test(sttVal) || /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/i.test(sttVal) || sttVal.startsWith('PHẦN') || item.name.toUpperCase().startsWith('PHẦN ');
          if (isMainLevelHeader) {
            currentMainSectionId = item.id;
            currentSubSectionId = undefined; // Reset sub section khi gặp Main Section mới (VD: B, II, III)
            parentId = undefined; // Main Section (A, B, I, II, III) nằm ở cấp Root cao nhất
          } else {
            // Check if this sub-section has a dot parent (VD: 33.1 -> 33)
            let foundDottedParent = false;
            if (sttVal.includes('.')) {
              const parts = sttVal.split('.');
              parts.pop();
              const parentStt = parts.join('.');
              if (sttIdMap.has(parentStt)) {
                parentId = sttIdMap.get(parentStt);
                foundDottedParent = true;
              }
            }
            if (!foundDottedParent) {
              parentId = currentMainSectionId;
            }
            currentSubSectionId = item.id;
          }
        } else {
          // Tìm parent theo dấu chấm gần nhất (VD: 33.1.1 -> 33.1)
          let foundDottedParent = false;
          if (sttVal.includes('.')) {
            const parts = sttVal.split('.');
            parts.pop();
            const parentStt = parts.join('.');
            if (sttIdMap.has(parentStt)) {
              parentId = sttIdMap.get(parentStt);
              foundDottedParent = true;
            }
          }
          
          if (!foundDottedParent) {
            parentId = currentSubSectionId || currentMainSectionId;
          }
        }

        const key = `${parentId || 'root'}|${item.stt.trim()}|${item.name.trim().toLowerCase()}`;
        if (existingTaskKeys.has(key)) return;
        existingTaskKeys.add(key);

        importedTasks.push({
          id: item.id,
          parentId: parentId,
          stt: item.stt || '',
          code: item.id,
          name: item.name,
          projectCode: code,
          projectName: newProject.name,
          volume: item.volume || 0,
          unit: item.unit || '',
          progress: 0,
          status: TEXT.taskStatus as Task['status'],
          purchaseStatus: isSection ? '' : TEXT.purchaseStatus,
          constrStatus: isSection ? '' : TEXT.constructionStatus,
          issue: '',
          issueStatus: '',
          isDone: false,
          isSectionHeader: isSection,
          sectionName: isSection ? item.name : (importedTasks.slice().reverse().find((t) => t.isSectionHeader)?.name || ''),
          notes: item.notes || '',
          assignedEngineerId: '',
          assignedEngineerName: '',
        });
      });

      if (importedTasks.length > 0) await addTasksBatch(importedTasks);

      const existingMaterialPlanKeys = new Set(
        materialPlans
          .filter((plan) => plan.projectCode === code)
          .map((plan) => `${String(plan.stt || '').trim()}|${String(plan.jobContent || '').trim().toLowerCase()}`)
      );
      const newMaterialPlans = [];
      for (const [index, item] of tasksWithIds.filter((item) => item.name?.trim()).entries()) {
        const key = `${String(item.stt || '').trim()}|${String(item.name || '').trim().toLowerCase()}`;
        if (existingMaterialPlanKeys.has(key)) continue;
        existingMaterialPlanKeys.add(key);

        const matchingTask = importedTasks.find(t => t.id === item.id);
        const rowId = item.id;
        const parentId = matchingTask ? matchingTask.parentId : undefined;
        const isSection = matchingTask ? matchingTask.isSectionHeader : false;

        const supplyScope: 'contractor' | 'owner' | 'unknown' = item.supplyScope === 'owner' ? 'owner' : item.supplyScope === 'contractor' ? 'contractor' : 'unknown';
        const orderTag = `[order:${String(++orderCounter).padStart(5, '0')}]`;
        newMaterialPlans.push({
          id: rowId,
          parentId: parentId,
          projectCode: code,
          stt: item.stt || '',
          jobContent: item.name,
          unit: item.unit || '',
          contractVolume: item.volume || 0,
          techSpecModel: item.techSpecModel || '',
          techSpecOrigin: item.techSpecOrigin || '',
          progressStatus: '',
          orderedVolume: 0,
          orderedStatus: '',
          expectedDate: '',
          issueContent: '',
          issueStatus: '',
          docCo: false,
          docCq: false,
          docFireInspection: false,
          dispatchToSite: false,
          supplyScope,
          notes: [orderTag, isSection ? '[section]' : '', supplyScope !== 'unknown' ? `[${supplyScope}]` : '', item.notes].filter(Boolean).join(' | '),
        });
      }
      if (newMaterialPlans.length > 0) {
        await addMaterialPlansBatch(newMaterialPlans);
      }

      const existingPurchasingKeys = new Set(
        purchasingPlans
          .filter((plan) => plan.projectCode === code)
          .map((plan) => `${String(plan.stt || '').trim()}|${String(plan.content || '').trim().toLowerCase()}`)
      );
      const newPurchasingPlans = [];
      for (const [index, item] of tasksWithIds.filter((item) => item.name?.trim()).entries()) {
        const key = `${String(item.stt || '').trim()}|${String(item.name || '').trim().toLowerCase()}`;
        if (existingPurchasingKeys.has(key)) continue;
        existingPurchasingKeys.add(key);

        const matchingTask = importedTasks.find(t => t.id === item.id);
        const rowId = item.id;
        const parentId = matchingTask ? matchingTask.parentId : undefined;
        const isSection = matchingTask ? matchingTask.isSectionHeader : false;

        const orderTag = `[order:${String(++orderCounter).padStart(5, '0')}]`;
        newPurchasingPlans.push({
          id: rowId,
          parentId: parentId,
          projectCode: code,
          stt: item.stt || '',
          content: item.name,
          unit: item.unit || '',
          volumeContract: item.volume || 0,
          volumeOrder: item.volume || 0,
          unitPrice: item.unitPrice || 0,
          vatRate: item.vatRate !== undefined ? item.vatRate : 10,
          vatAmount: item.vatAmount || 0,
          totalAmount: item.totalAmount || 0,
          prepayPercent: 0,
          prepayAmount: 0,
          remainingAmount: item.totalAmount || 0,
          orderStatus: TEXT.purchaseStatus,
          contractStatus: 'Đã có phụ lục',
          invoiceStatus: 'Chưa xuất',
          notes: [orderTag, isSection ? '[section]' : '', item.notes].filter(Boolean).join(' | '),
        });
      }
      if (newPurchasingPlans.length > 0) {
        await addPurchasingsBatch(newPurchasingPlans);
      }
    }

    logActivity(`Tạo dự án mới: ${newProject.name}`, newProject.name);
    
    // Bắn thông báo đến nhân sự được gán vào dự án và Quản trị viên
    if (addNotification) {
      const creatorName = currentUser?.name || currentUser?.username || 'Quản lý';
      const creatorId = currentUser?.id || '';
      const targetEngineerIds = (selectedEngineerIds || []).map(id => String(id).trim()).filter(Boolean);
      await addNotification({
        title: `Dự án mới: [${newProject.code}] ${newProject.name}`,
        message: `${creatorName} vừa tạo dự án mới: "${newProject.name}" (${newProject.code}).`,
        type: `project_created:::${encodeURIComponent(newProject.code)}:::${targetEngineerIds.join(',')}`,
        link: `/projects/${encodeURIComponent(newProject.code)}`,
        senderId: creatorId,
        senderName: creatorName,
        createdById: creatorId,
        createdByName: creatorName,
      }).catch(err => console.error('Failed to notify project creation:', err));
    }

    triggerToast(`${TEXT.created} ${newProject.name}${pendingProjectTasks.length ? ' và import đầu mục' : ''}`, 'success');
    await Promise.all([fetchProjects(), fetchEngineers()]).catch(() => {});
    setIsNewProjectModalOpen(false);
    setNewProjName('');
    setNewProjCode('');
    setNewProjLocation('');
    setNewProjLatitude('');
    setNewProjLongitude('');
    setNewProjRadiusMeters(500);
    setNewProjClient('');
    setNewProjCategory('');
    setNewProjNotes('');
    setSelectedEngineerIds([]);
    setPendingProjectTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const [editProjName, setEditProjName] = useState('');
  const [editProjLocation, setEditProjLocation] = useState('');
  const [editProjLatitude, setEditProjLatitude] = useState<string>('');
  const [editProjLongitude, setEditProjLongitude] = useState<string>('');
  const [editProjRadiusMeters, setEditProjRadiusMeters] = useState<number>(500);
  const [isGeocodingEdit, setIsGeocodingEdit] = useState(false);
  const [editProjClient, setEditProjClient] = useState('');
  const [editProjCategory, setEditProjCategory] = useState('');
  const [editProjNotes, setEditProjNotes] = useState('');
  const [editSelectedEngineerIds, setEditSelectedEngineerIds] = useState<string[]>([]);
  const [editPendingProjectTasks, setEditPendingProjectTasks] = useState<NonNullable<WebOcrExtractedData['tableTasks']>>([]);

  const applyImportedProjectToEdit = (data: WebOcrExtractedData) => {
    const projectName = data.projectName || getImportedFieldValue(data, ['cong trinh', 'ten cong trinh', 'du an', 'goi thau']);
    if (projectName) {
      setEditProjName(projectName);
    }
    const location = data.location || getImportedFieldValue(data, ['dia diem cong trinh', 'dia diem xay dung', 'dia diem', 'vi tri', 'dia chi']);
    if (location) setEditProjLocation(location);
    const client = getImportedFieldValue(data, ['chu dau tu', 'khach hang', 'ben giao thau']);
    if (client) setEditProjClient(client);
    const category = getImportedFieldValue(data, ['phan loai', 'loai cong trinh', 'loai du an']);
    if (category) setEditProjCategory(category);
    const notes = getImportedFieldValue(data, ['hang muc', 'hạng mục']);
    if (notes) setEditProjNotes(notes);

    if (data.tableTasks && data.tableTasks.length > 0) {
      setEditPendingProjectTasks(data.tableTasks);
      triggerToast(`Đã nhận ${data.tableTasks.length} đầu mục công việc từ phụ lục. Nhấn "Lưu thay đổi" để đồng bộ vào dự án!`, 'info');
    } else {
      triggerToast('Đã trích xuất thông tin từ file vào form dự án.', 'info');
    }
  };

  const toggleEditEngineerId = (id: string) => {
    setEditSelectedEngineerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const openEditModal = (project: Project) => {
    setProjectToEdit(project);
    setEditPendingProjectTasks([]);
    setEditProjName(project.name);
    setEditProjLocation(project.location || '');
    setEditProjLatitude(project.latitude !== undefined ? String(project.latitude) : '');
    setEditProjLongitude(project.longitude !== undefined ? String(project.longitude) : '');
    setEditProjRadiusMeters(project.radiusMeters || 500);
    setEditProjClient(project.client || '');
    setEditProjCategory(project.category || '');
    setEditProjPriority(project.priority || 'normal');
    setEditProjNotes(project.notes || '');

    // Resolve engineers from the engineers array by ID, code, or name matching
    const pCodeUpper = (project.code || '').trim().toUpperCase();
    const pIdUpper = (project.id || '').trim().toUpperCase();
    const managerNames = project.managerName ? project.managerName.split(',').map(s => s.trim().toUpperCase()) : [];

    const assignedEngineers = engineers
      .filter(eng => {
        const engNameUpper = (eng.name || '').trim().toUpperCase();
        const hasCode = Array.isArray(eng.projectCodes) && eng.projectCodes.some(c => {
          const u = (c || '').trim().toUpperCase();
          return u && (u === pCodeUpper || u === pIdUpper);
        });
        const isMember = (Array.isArray(project.members) && project.members.includes(eng.id)) ||
                         (Array.isArray(project.memberIds) && project.memberIds.includes(eng.id));
        const matchesManagerName = managerNames.includes(engNameUpper);
        return hasCode || isMember || matchesManagerName;
      })
      .map(eng => eng.id);

    const allMemberIds = Array.from(new Set([...(project.members || []), ...(project.memberIds || []), ...assignedEngineers]));
    setEditSelectedEngineerIds(allMemberIds);

    const foundManagerId = (project.managerId && engineers.some(e => e.id === project.managerId))
      ? project.managerId
      : (project.managerName && project.managerName !== TEXT.unassigned
          ? engineers.find(e => project.managerName?.split(',').map(s => s.trim().toUpperCase()).includes((e.name || '').toUpperCase()))?.id || ''
          : '');
    setEditProjManagerId(foundManagerId);
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToEdit) return;
    if (!editProjName.trim()) return;

    setLoading(true);
    setLoadingMessage('Đang cập nhật dự án...');
    try {
      const managerEng = engineers.find(eng => eng.id === editProjManagerId);
      const managerName = managerEng ? managerEng.name : TEXT.unassigned;
      const managerId = managerEng ? managerEng.id : undefined;

      let parsedEditLat = parseFloat(editProjLatitude);
      let parsedEditLng = parseFloat(editProjLongitude);

      // Tự động tìm tọa độ nếu người dùng đổi địa chỉ mà chưa có tọa độ
      const trimmedEditLocation = editProjLocation.trim();
      const locationChanged = trimmedEditLocation !== (projectToEdit.location || '').trim();
      if ((isNaN(parsedEditLat) || isNaN(parsedEditLng) || locationChanged) && trimmedEditLocation.length >= 3) {
        if (locationChanged || isNaN(parsedEditLat) || isNaN(parsedEditLng)) {
          try {
            const geoRes = await geocodeAddress(trimmedEditLocation);
            if (geoRes) {
              parsedEditLat = geoRes.latitude;
              parsedEditLng = geoRes.longitude;
            }
          } catch {
            // Bỏ qua lỗi ngầm
          }
        }
      }

      const payload = {
        name: editProjName.trim(),
        location: trimmedEditLocation,
        latitude: !isNaN(parsedEditLat) ? parsedEditLat : undefined,
        longitude: !isNaN(parsedEditLng) ? parsedEditLng : undefined,
        radiusMeters: editProjRadiusMeters > 0 ? editProjRadiusMeters : 500,
        client: editProjClient.trim() || undefined,
        category: editProjCategory.trim() || undefined,
        priority: editProjPriority || 'normal',
        notes: editProjNotes.trim() || undefined,
        managerId: managerId,
        managerName: managerName,
        members: editSelectedEngineerIds,
        memberIds: editSelectedEngineerIds,
        updatedBy: user?.name || user?.username || 'Hệ thống',
        updatedAt: new Date().toISOString(),
      };

      await updateProject(projectToEdit.id, payload);

      // Update engineer project codes in parallel only if changed
      const projCodeUpper = (projectToEdit.code || '').trim().toUpperCase();
      const projIdUpper = (projectToEdit.id || '').trim().toUpperCase();
      const engUpdates: Promise<any>[] = [];

      for (const eng of engineers) {
        const currentCodes = Array.isArray(eng.projectCodes) ? eng.projectCodes : [];
        const isSelected = editSelectedEngineerIds.includes(eng.id);
        const hasCode = currentCodes.some(c => {
          const u = (c || '').trim().toUpperCase();
          return u === projCodeUpper || u === projIdUpper;
        });

        if (isSelected && !hasCode) {
          const newCodes = [...currentCodes, projectToEdit.code || projectToEdit.id];
          engUpdates.push(updateEngineer(eng.id, { name: eng.name, projectCodes: newCodes, permissions: eng.permissions }));
        } else if (!isSelected && hasCode) {
          const newCodes = currentCodes.filter(c => {
            const u = (c || '').trim().toUpperCase();
            return u !== projCodeUpper && u !== projIdUpper;
          });
          engUpdates.push(updateEngineer(eng.id, { name: eng.name, projectCodes: newCodes, permissions: eng.permissions }));
        }
      }

      if (engUpdates.length > 0) {
        await Promise.all(engUpdates);
      }

      // Đồng bộ các đầu mục công việc, vật tư, mua sắm từ phụ lục vào dự án nếu có
      if (editPendingProjectTasks.length > 0) {
        const code = projectToEdit.code || projectToEdit.id;
        const projName = editProjName.trim() || projectToEdit.name;
        let orderCounter = 0;
        let currentMainSectionId: string | undefined = undefined;
        let currentSubSectionId: string | undefined = undefined;
        const sttIdMap = new Map<string, string>();

        const tasksWithIds = editPendingProjectTasks.map((item) => {
          const taskId = crypto.randomUUID();
          return {
            ...item,
            id: taskId,
          };
        });

        tasksWithIds.forEach(item => {
          if (item.stt) sttIdMap.set(item.stt.trim(), item.id);
        });

        const existingTaskKeys = new Set(tasks.filter((task) => task.projectCode === code).map((task) => `${task.parentId || 'root'}|${task.stt.trim()}|${task.name.trim().toLowerCase()}`));
        const importedTasks: Task[] = [];

        tasksWithIds.forEach((item) => {
          const sttVal = (item.stt || '').trim();
          const isSection = item.isSectionHeader;

          let parentId = undefined;
          if (isSection) {
            const isMainLevelHeader = /^[A-Z]{1,2}$/i.test(sttVal) || /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/i.test(sttVal) || sttVal.startsWith('PHẦN') || item.name.toUpperCase().startsWith('PHẦN ');
            if (isMainLevelHeader) {
              currentMainSectionId = item.id;
              currentSubSectionId = undefined;
              parentId = undefined;
            } else {
              let foundDottedParent = false;
              if (sttVal.includes('.')) {
                const parts = sttVal.split('.');
                parts.pop();
                const parentStt = parts.join('.');
                if (sttIdMap.has(parentStt)) {
                  parentId = sttIdMap.get(parentStt);
                  foundDottedParent = true;
                }
              }
              if (!foundDottedParent) {
                parentId = currentMainSectionId;
              }
              currentSubSectionId = item.id;
            }
          } else {
            let foundDottedParent = false;
            if (sttVal.includes('.')) {
              const parts = sttVal.split('.');
              parts.pop();
              const parentStt = parts.join('.');
              if (sttIdMap.has(parentStt)) {
                parentId = sttIdMap.get(parentStt);
                foundDottedParent = true;
              }
            }
            if (!foundDottedParent) {
              parentId = currentSubSectionId || currentMainSectionId;
            }
          }

          const key = `${parentId || 'root'}|${item.stt.trim()}|${item.name.trim().toLowerCase()}`;
          if (existingTaskKeys.has(key)) return;
          existingTaskKeys.add(key);

          importedTasks.push({
            id: item.id,
            parentId: parentId,
            stt: item.stt || '',
            code: item.id,
            name: item.name,
            projectCode: code,
            projectName: projName,
            volume: item.volume || 0,
            unit: item.unit || '',
            progress: 0,
            status: TEXT.taskStatus as Task['status'],
            purchaseStatus: isSection ? '' : TEXT.purchaseStatus,
            constrStatus: isSection ? '' : TEXT.constructionStatus,
            issue: '',
            issueStatus: '',
            isDone: false,
            isSectionHeader: isSection,
            sectionName: isSection ? item.name : (importedTasks.slice().reverse().find((t) => t.isSectionHeader)?.name || ''),
            notes: item.notes || '',
            assignedEngineerId: '',
            assignedEngineerName: '',
          });
        });

        if (importedTasks.length > 0) {
          await addTasksBatch(importedTasks);
        }

        const existingMaterialPlanKeys = new Set(
          materialPlans
            .filter((plan) => plan.projectCode === code)
            .map((plan) => `${String(plan.stt || '').trim()}|${String(plan.jobContent || '').trim().toLowerCase()}`)
        );
        const newMaterialPlans = [];
        for (const item of tasksWithIds.filter((item) => item.name?.trim())) {
          const key = `${String(item.stt || '').trim()}|${String(item.name || '').trim().toLowerCase()}`;
          if (existingMaterialPlanKeys.has(key)) continue;
          existingMaterialPlanKeys.add(key);

          const matchingTask = importedTasks.find(t => t.id === item.id);
          const rowId = item.id;
          const parentId = matchingTask ? matchingTask.parentId : undefined;
          const isSection = matchingTask ? matchingTask.isSectionHeader : false;

          const supplyScope: 'contractor' | 'owner' | 'unknown' = item.supplyScope === 'owner' ? 'owner' : item.supplyScope === 'contractor' ? 'contractor' : 'unknown';
          const orderTag = `[order:${String(++orderCounter).padStart(5, '0')}]`;
          newMaterialPlans.push({
            id: rowId,
            parentId: parentId,
            projectCode: code,
            stt: item.stt || '',
            jobContent: item.name,
            unit: item.unit || '',
            contractVolume: item.volume || 0,
            techSpecModel: item.techSpecModel || '',
            techSpecOrigin: item.techSpecOrigin || '',
            progressStatus: '',
            orderedVolume: 0,
            orderedStatus: '',
            expectedDate: '',
            issueContent: '',
            issueStatus: '',
            docCo: false,
            docCq: false,
            docFireInspection: false,
            dispatchToSite: false,
            supplyScope,
            notes: [orderTag, isSection ? '[section]' : '', supplyScope !== 'unknown' ? `[${supplyScope}]` : '', item.notes].filter(Boolean).join(' | '),
          });
        }
        if (newMaterialPlans.length > 0) {
          await addMaterialPlansBatch(newMaterialPlans);
        }

        const existingPurchasingKeys = new Set(
          purchasingPlans
            .filter((plan) => plan.projectCode === code)
            .map((plan) => `${String(plan.stt || '').trim()}|${String(plan.content || '').trim().toLowerCase()}`)
        );
        const newPurchasingPlans = [];
        for (const item of tasksWithIds.filter((item) => item.name?.trim())) {
          const key = `${String(item.stt || '').trim()}|${String(item.name || '').trim().toLowerCase()}`;
          if (existingPurchasingKeys.has(key)) continue;
          existingPurchasingKeys.add(key);

          const matchingTask = importedTasks.find(t => t.id === item.id);
          const rowId = item.id;
          const parentId = matchingTask ? matchingTask.parentId : undefined;
          const isSection = matchingTask ? matchingTask.isSectionHeader : false;

          const orderTag = `[order:${String(++orderCounter).padStart(5, '0')}]`;
          newPurchasingPlans.push({
            id: rowId,
            parentId: parentId,
            projectCode: code,
            stt: item.stt || '',
            content: item.name,
            unit: item.unit || '',
            volumeContract: item.volume || 0,
            volumeOrder: item.volume || 0,
            unitPrice: item.unitPrice || 0,
            vatRate: item.vatRate !== undefined ? item.vatRate : 10,
            vatAmount: item.vatAmount || 0,
            totalAmount: item.totalAmount || 0,
            prepayPercent: 0,
            prepayAmount: 0,
            remainingAmount: item.totalAmount || 0,
            orderStatus: TEXT.purchaseStatus,
            contractStatus: 'Đã có phụ lục',
            invoiceStatus: 'Chưa xuất',
            notes: [orderTag, isSection ? '[section]' : '', item.notes].filter(Boolean).join(' | '),
          });
        }
        if (newPurchasingPlans.length > 0) {
          await addPurchasingsBatch(newPurchasingPlans);
        }
      }

      await Promise.all([fetchProjects(), fetchEngineers()]).catch(() => {});

      logActivity(`Cập nhật thông tin dự án: ${editProjName.trim()}`, editProjName.trim());
      triggerToast(`Đã cập nhật dự án \"${projectToEdit.name}\"${editPendingProjectTasks.length ? ` và đồng bộ ${editPendingProjectTasks.length} đầu mục phụ lục` : ''} thành công!`, 'success');
      setProjectToEdit(null);
      setEditPendingProjectTasks([]);
    } catch (error) {
      console.error(error);
      triggerToast('Lỗi khi cập nhật dự án', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setLoading(true);
    setLoadingMessage('Đang xóa vĩnh viễn dự án...');
    try {
      await deleteProject(projectToDelete.id);
      setProjectToDelete(null);
      triggerToast(TEXT.deleted, 'success');
    } catch (err: any) {
      console.error('Delete project failed', err);
      triggerToast('Lỗi khi xóa dự án: ' + (err?.message || 'Vui lòng thử lại'), 'warning');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const statusLabel: Record<Project['status'], string> = { active: TEXT.active, completed: TEXT.completed, on_hold: TEXT.onHold };
  const statusTone: Record<Project['status'], string> = {
    active: 'project-status project-status--active',
    completed: 'project-status project-status--completed',
    on_hold: 'project-status project-status--hold',
  };

  return (
    <div className="project-management-page flex flex-col flex-1 h-full bg-slate-50 relative overflow-hidden">
      <LoadingSpinner loading={loading} message={loadingMessage} />
      <Toast show={toastState.show} message={toastState.message} type={toastState.type} />

      <header className="border-b border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between gap-2 relative z-10 shrink-0 no-drag-region electron-no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="page-title text-sm md:text-base font-extrabold text-slate-900 border-l-4 border-primary pl-2 shrink-0">
            Tất cả dự án
          </span>
          <span className="material-symbols-outlined text-slate-400 text-[13px] shrink-0 select-none">
            arrow_forward_ios
          </span>
          <h1 className="text-sm md:text-base font-bold text-slate-700 shrink-0">
            {statusFilter === 'active' ? 'Đang triển khai' : statusFilter === 'completed' ? 'Hoàn thành' : 'Tất cả'}
            <span className="ml-1.5 text-xs font-bold text-slate-500">
              ({statusFilter === 'active' ? counts.active : statusFilter === 'completed' ? counts.completed : counts.all})
            </span>
          </h1>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 relative z-10 shrink-0">
        {/* Nhóm bộ lọc bên trái: Phân loại + Ưu tiên + Ngày */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">

          {/* Bộ lọc phân loại dự án */}
          <CustomSelect
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-[34px] min-w-[135px] max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-2xs outline-none focus:border-primary shrink-0"
            title="Lọc theo phân loại dự án"
          >
            <option value="all">-- Phân loại: Tất cả --</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </CustomSelect>

          {/* Bộ lọc mức độ ưu tiên (Cấp bậc) */}
          <CustomSelect
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="h-[34px] min-w-[135px] max-w-[165px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-2xs outline-none focus:border-primary shrink-0"
            title="Lọc theo mức độ ưu tiên dự án"
          >
            <option value="all">-- Ưu tiên: Tất cả --</option>
            <option value="urgent">🔥 Cấp 1 - Trọng điểm</option>
            <option value="high">⚡ Cấp 2 - Ưu tiên cao</option>
            <option value="normal">Cấp 3 - Tiêu chuẩn</option>
            <option value="low">Cấp 4 - Ưu tiên thấp</option>
          </CustomSelect>

          {/* Bộ lọc dải ngày (Từ ngày ... Đến ngày ...) */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 h-[34px] shadow-2xs text-xs shrink-0">
            <span className="text-slate-400 font-medium whitespace-nowrap text-[11px] ml-0.5">Từ</span>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-[96px] text-slate-700 cursor-pointer font-medium"
            />
            <span className="text-slate-300">|</span>
            <span className="text-slate-400 font-medium whitespace-nowrap text-[11px]">Đến</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-[96px] text-slate-700 cursor-pointer font-medium"
            />
            {(filterDateFrom || filterDateTo) && (
              <button
                type="button"
                onClick={() => {
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 ml-0.5 rounded cursor-pointer"
                title="Xóa bộ lọc ngày"
              >
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Nhóm thao tác bên phải: Ô tìm kiếm + Nút Tạo dự án mới */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="relative w-44 sm:w-52 md:w-60 flex items-center min-w-0">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={TEXT.searchProject}
              className="w-full pl-8 pr-7 h-[34px] border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50 hover:bg-slate-100/80 focus:bg-white font-medium transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
          {hasPermission(user, "CREATE_PROJECTS") && (
            <button
                type="button"
                onClick={() => {
                  setNewProjName('');
                  setNewProjCode('');
                  setNewProjLocation('');
                  setNewProjLatitude('');
                  setNewProjLongitude('');
                  setNewProjRadiusMeters(500);
                  setNewProjClient('');
                  setNewProjCategory('');
                  setNewProjPriority('normal');
                  setNewProjNotes('');
                  setNewProjManagerId('');
                  setSelectedEngineerIds([]);
                  setPendingProjectTasks([]);
                  setIsNewProjectModalOpen(true);
                }}
                title={TEXT.createProject}
                className="flex items-center justify-center gap-1 bg-primary text-white px-3 h-[34px] rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Tạo dự án mới</span>
              </button>
          )}
        </div>
      </section>

      <PullToRefresh
        onRefresh={async () => {
          await fetchProjects();
        }}
        onScroll={(e) => {
          if (tablePaginationMode !== 'infinite') return;
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          if (scrollHeight - (scrollTop + clientHeight) < 350) {
            setProjectVisibleLimit(prev => (prev < enhancedProjects.length ? Math.min(enhancedProjects.length, prev + 24) : prev));
          }
        }}
        className={`flex-1 ${viewMode === 'table' || viewMode === 'table_detailed' ? 'p-0' : 'p-2 sm:p-3 pb-6 md:p-4 md:pb-6'}`}
      >
        {(isFetchingProjects && projects.length === 0 && tasks.length === 0) ? (
          <div className="text-center py-16 m-2 bg-white border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
            <h3 className="mt-3 font-bold text-slate-700">Đang tải dữ liệu...</h3>
            <p className="text-slate-500 text-sm mt-1">Vui lòng chờ trong giây lát</p>
          </div>
        ) : enhancedProjects.length === 0 ? (
          <div className="text-center py-16 m-2 bg-white border border-dashed border-slate-300 rounded-xl">
            <span className="material-symbols-outlined text-5xl text-slate-300">folder_open</span>
            <h3 className="mt-3 font-bold text-slate-700">{searchQuery ? TEXT.noProjectFound : TEXT.noProject}</h3>
          </div>
        ) : (
          <div className={`flex flex-col ${viewMode === 'table' || viewMode === 'table_detailed' ? 'gap-0' : 'gap-4'}`}>
            {/* Chế độ xem 1: Lưới Thẻ (Grid Cards) */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                {paginatedProjects.map((project, idx) => {
                  const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                  const prioInfo = getProjectPriorityInfo(project.priority);
                  const barColor = project.progress >= 100 ? 'bg-emerald-500'
                    : project.progress >= 60 ? 'bg-blue-500'
                    : project.progress >= 30 ? 'bg-amber-400' : 'bg-slate-300';
                  const statusCfg = project.status === 'completed'
                    ? { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
                    : project.status === 'on_hold'
                      ? { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
                      : { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
                  return (
                    <div
                      key={project.id}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          suppressProjectCardNavigationRef.current ||
                          target.closest('button') ||
                          target.closest('[data-modal-root="true"]')
                        ) {
                          suppressProjectCardNavigationRef.current = false;
                          return;
                        }
                        openProjectTasks(project);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') openProjectTasks(project); }}
                      className={`group relative flex flex-col bg-white rounded-xl border ${
                        prioInfo.value === 'urgent'
                          ? 'border-red-300 ring-1 ring-red-400/80 shadow-xs shadow-red-100'
                          : prioInfo.value === 'high'
                            ? 'border-amber-300 ring-1 ring-amber-400/60'
                            : 'border-slate-200 shadow-xs'
                      } hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200 overflow-hidden`}
                    >
                      {/* Top accent bar */}
                      <div className={`h-1 w-full ${barColor}`} />

                      <div className="flex flex-col gap-2.5 sm:gap-3 p-3.5 sm:p-4 flex-1">
                        {/* Header: số + tên */}
                        <div className="flex items-start gap-2.5 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500 font-extrabold text-xs mt-0.5">
                            {String(globalIdx + 1).padStart(2, '0')}
                          </div>
                          <div className="flex-1 bg-blue-50 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between gap-2 min-w-0 transition-[padding] pr-20 sm:pr-2 sm:group-hover:pr-24">
                            <p className="font-bold text-primary text-sm leading-snug line-clamp-2" title={project.name}>
                              {project.name}
                            </p>
                            {Boolean((project as any).unreadNotifCount && (project as any).unreadNotifCount > 0) && (
                              <div 
                                className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200/80 font-extrabold text-[11px] px-2 py-0.5 rounded-full shadow-2xs shrink-0 self-start mt-0.5 group-hover:hidden"
                                title={`Có ${(project as any).unreadNotifCount} cập nhật mới trong dự án`}
                              >
                                <span className="material-symbols-outlined text-[13px] text-rose-500">notifications</span>
                                <span>{(project as any).unreadNotifCount}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Badge trạng thái + Cấp bậc ưu tiên */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Priority badge with quick-dropdown */}
                          <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setQuickPriorityMenuProjectId(quickPriorityMenuProjectId === project.id ? null : project.id)}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold border transition-all hover:scale-105 active:scale-95 cursor-pointer ${prioInfo.badgeClass}`}
                              title="Nhấn để đổi cấp bậc ưu tiên"
                            >
                              <span className="material-symbols-outlined text-[13px]">{prioInfo.icon}</span>
                              <span>{prioInfo.shortLabel}</span>
                              <span className="material-symbols-outlined text-[10px] opacity-70">arrow_drop_down</span>
                            </button>
                            {quickPriorityMenuProjectId === project.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute left-0 top-full mt-1 z-30 w-52 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex flex-col gap-1 text-left animate-in fade-in zoom-in-95 duration-100"
                              >
                                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Đổi mức ưu tiên
                                </div>
                                {PROJECT_PRIORITY_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={(e) => handleQuickChangePriority(project.id, opt.value, e)}
                                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer ${
                                      (project.priority || 'normal') === opt.value ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'
                                    }`}
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
                                      <span>{opt.shortLabel}</span>
                                      <span className="text-[10px] opacity-75">({opt.subLabel})</span>
                                    </span>
                                    {(project.priority || 'normal') === opt.value && (
                                      <span className="material-symbols-outlined text-sm text-blue-600">check</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {statusLabel[project.status]}
                          </span>
                          {project.location && (
                            <span className="text-[11px] text-slate-400 truncate max-w-[180px]">{project.location}</span>
                          )}
                        </div>

                        {/* Chủ đầu tư */}
                        {(project as any).client && (
                          <p className="text-[11px] text-slate-500 truncate">
                            <span className="font-semibold text-slate-400">CĐT: </span>
                            {(project as any).client}
                          </p>
                        )}

                        {project.category && (
                          <p className="text-[11px] text-slate-500 truncate mt-[-4px]" title={project.category}>
                            <span className="font-semibold text-slate-400">Phân loại: </span>
                            <span className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium text-[10.5px] border border-blue-100">
                              {project.category}
                            </span>
                          </p>
                        )}

                        {project.notes && (
                          <p className="text-[11px] text-slate-500 truncate mt-[-4px]" title={project.notes}>
                            <span className="font-semibold text-slate-400">Hạng mục: </span>
                            {project.notes}
                          </p>
                        )}

                        {/* Nhân sự dự án */}
                        <div className="mt-1 pt-1 border-t border-slate-100/50">
                          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-400 mr-0.5">Nhân sự:</span>
                            {project.memberNames?.length ? (
                              <>
                                {project.memberNames.slice(0, 3).map((name, i) => (
                                  <div key={i} className="inline-flex items-center gap-1 bg-sky-50/70 border border-sky-100 rounded-full pr-2 pl-0.5 py-0.5 max-w-[130px]">
                                    <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                                      <span className="material-symbols-outlined text-[10px]">person</span>
                                    </span>
                                    <span className="text-[10px] font-semibold text-sky-700 truncate">
                                      {name}
                                    </span>
                                  </div>
                                ))}
                                {project.memberNames.length > 3 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
                                    +{project.memberNames.length - 3}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="italic text-[11px] text-slate-400">Chưa có</span>
                            )}
                          </div>
                        </div>

                        {/* Tiến độ */}
                        <div className="mt-auto pt-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-slate-400">Tiến độ</span>
                            <span className={`text-xs font-extrabold ${
                              project.progress >= 100 ? 'text-emerald-600'
                              : project.progress >= 60 ? 'text-blue-600'
                              : project.progress > 0 ? 'text-amber-600' : 'text-slate-400'
                            }`}>{project.progress}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                              style={{ width: `${project.progress}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Nút sửa/xóa/thông báo — hiện khi hover trên desktop, luôn hiện trên mobile */}
                      <div
                        className="absolute top-[18px] right-3 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20 bg-white/95 backdrop-blur-xs px-1 py-0.5 rounded-lg border border-slate-200 shadow-xs"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                          {/* Nút chuông thông báo */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              suppressProjectCardNavigationRef.current = true;
                              window.setTimeout(() => {
                                suppressProjectCardNavigationRef.current = false;
                              }, 0);
                              setNotifOpenProjectId(project.id);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Xem toàn bộ thay đổi của dự án"
                            className="relative rounded p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">notifications</span>
                            {Boolean((project as any).unreadNotifCount && (project as any).unreadNotifCount > 0) && (
                              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                                {(project as any).unreadNotifCount > 9 ? '9+' : (project as any).unreadNotifCount}
                              </span>
                            )}
                          </button>
                          {canManageItem(user, project, "EDIT_PROJECTS") && (<button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Sửa tên dự án"
                            className="rounded p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>)}
                          {canManageItem(user, project, "DELETE_PROJECTS") && (<button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setProjectToDelete(project); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title={TEXT.deleteProject}
                            aria-label="Xóa dự án"
                            className="rounded p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>)}
                      </div>
                      {/* Bộ điều khiển modal cho nút chuông; không ẩn bằng display:none vì modal cần được render */}
                      <AuditInfoCell
                          updatedBy={project.updatedBy}
                          updatedAt={project.updatedAt}
                          projectCode={project.code}
                          forceOpen={notifOpenProjectId === project.id}
                          onForceOpenHandled={() => setNotifOpenProjectId(null)}
                          hideTrigger
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Chế độ xem 2: Thẻ Thu Gọn (Compact Grid Cards) */}
            {viewMode === 'compact_grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {paginatedProjects.map((project, idx) => {
                  const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                  const prioInfo = getProjectPriorityInfo(project.priority);
                  const barColor = project.progress >= 100 ? 'bg-emerald-500'
                    : project.progress >= 60 ? 'bg-blue-500'
                    : project.progress >= 30 ? 'bg-amber-400' : 'bg-slate-300';
                  const statusCfg = project.status === 'completed'
                    ? { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
                    : project.status === 'on_hold'
                      ? { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
                      : { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };

                  return (
                    <div
                      key={project.id}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          suppressProjectCardNavigationRef.current ||
                          target.closest('button') ||
                          target.closest('[data-modal-root="true"]')
                        ) {
                          suppressProjectCardNavigationRef.current = false;
                          return;
                        }
                        openProjectTasks(project);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') openProjectTasks(project); }}
                      className={`group relative flex flex-col bg-white rounded-xl border ${
                        prioInfo.value === 'urgent'
                          ? 'border-red-300 ring-1 ring-red-400/80 shadow-2xs shadow-red-50'
                          : prioInfo.value === 'high'
                            ? 'border-amber-300 ring-1 ring-amber-400/60'
                            : 'border-slate-200 shadow-2xs'
                      } hover:shadow-md hover:border-primary/40 cursor-pointer transition-all duration-200 overflow-hidden p-3`}
                    >
                      {/* Thanh màu tiến độ trên đầu */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${barColor}`} />

                      {/* Hàng 1: Mã dự án & Ưu tiên & Trạng thái & Chuông */}
                      <div className="flex items-center justify-between gap-1 mb-2 pt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="font-mono text-[10px] font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 truncate">
                            {project.code || `#${globalIdx + 1}`}
                          </span>
                          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-extrabold border ${prioInfo.badgeClass}`} title={prioInfo.label}>
                            <span className="material-symbols-outlined text-[11px]">{prioInfo.icon}</span>
                            {prioInfo.shortLabel}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[9px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} shrink-0`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {statusLabel[project.status]}
                          </span>
                        </div>

                        {Boolean((project as any).unreadNotifCount && (project as any).unreadNotifCount > 0) && (
                          <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-extrabold bg-rose-50 text-rose-600 rounded-full border border-rose-200 shrink-0">
                            {(project as any).unreadNotifCount}
                          </span>
                        )}
                      </div>

                      {/* Hàng 2: Tên dự án */}
                      <h3 className="font-bold text-slate-900 text-xs sm:text-[13px] leading-snug line-clamp-2 hover:text-primary transition-colors mb-2" title={project.name}>
                        {project.name}
                      </h3>

                      {/* Hàng 3: Phân loại / PM */}
                      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 mb-2.5">
                        <span className="truncate" title={project.category || (project as any).client || 'Dự án'}>
                          📁 {project.category || (project as any).client || 'Chung'}
                        </span>
                        {project.managerName && (
                          <span className="truncate font-medium text-slate-600 shrink-0 max-w-[110px]" title={`Quản lý: ${project.managerName}`}>
                            👤 {project.managerName}
                          </span>
                        )}
                      </div>

                      {/* Hàng 4: Tiến độ & Việc */}
                      <div className="mt-auto pt-1 border-t border-slate-100 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">
                            {project.completedTasks}/{project.totalTasks} việc
                          </span>
                          <span className={`font-extrabold ${
                            project.progress >= 100 ? 'text-emerald-600'
                            : project.progress >= 60 ? 'text-blue-600'
                            : project.progress > 0 ? 'text-amber-600' : 'text-slate-400'
                          }`}>
                            {project.progress}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${project.progress}%` }} />
                        </div>
                      </div>

                      {/* Thao tác nút nhỏ trên góc khi hover */}
                      <div
                        className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 px-1 py-0.5 rounded-lg border border-slate-200 shadow-xs z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            suppressProjectCardNavigationRef.current = true;
                            window.setTimeout(() => {
                              suppressProjectCardNavigationRef.current = false;
                            }, 0);
                            setNotifOpenProjectId(project.id);
                          }}
                          title="Xem thay đổi"
                          className="p-1 text-slate-400 hover:text-amber-500 transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">notifications</span>
                        </button>
                        {canManageItem(user, project, "EDIT_PROJECTS") && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                            title="Sửa tên dự án"
                            className="p-1 text-slate-400 hover:text-blue-500 transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        )}
                        {canManageItem(user, project, "DELETE_PROJECTS") && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setProjectToDelete(project); }}
                            title="Xóa dự án"
                            className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Chế độ xem 2: Bảng Danh Sách Gọn (Compact Table View) - Tối ưu 500+ dự án */}
            {viewMode === 'table' && (
              <div className="bg-white border-b border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs min-w-[950px]">
                    <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200">STT</th>
                        <th className="py-2.5 px-3 w-32 border-r border-slate-200">Mã dự án</th>
                        <th className="py-2.5 px-3 w-28 text-center border-r border-slate-200">Ưu tiên</th>
                        <th className="py-2.5 px-4 min-w-[200px] border-r border-slate-200">Tên dự án</th>
                        <th className="py-2.5 px-3 w-36 border-r border-slate-200">Phân loại / CĐT</th>
                        <th className="py-2.5 px-3 w-48 border-r border-slate-200">Nhân sự</th>
                        <th className="py-2.5 px-3 w-32 text-center border-r border-slate-200">Tiến độ</th>
                        <th className="py-2.5 px-3 w-28 text-center border-r border-slate-200">Trạng thái</th>
                        <th className="py-2.5 px-3 w-28 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {paginatedProjects.map((project, idx) => {
                        const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                        const prioInfo = getProjectPriorityInfo(project.priority);
                        const statusCfg = project.status === 'completed'
                          ? { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
                          : project.status === 'on_hold'
                            ? { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
                            : { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };

                        const barColor = project.progress >= 100 ? 'bg-emerald-500'
                          : project.progress >= 60 ? 'bg-blue-500'
                          : project.progress >= 30 ? 'bg-amber-400' : 'bg-slate-300';

                        return (
                          <tr
                            key={project.id}
                            onClick={() => openProjectTasks(project)}
                            className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                          >
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500 border-r border-slate-200">
                              {String(globalIdx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-[11px] font-bold text-slate-600 truncate max-w-[130px]">
                              {project.code || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200" onClick={(e) => e.stopPropagation()}>
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() => setQuickPriorityMenuProjectId(quickPriorityMenuProjectId === project.id ? null : project.id)}
                                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-extrabold border transition-all hover:scale-105 active:scale-95 cursor-pointer ${prioInfo.badgeClass}`}
                                  title="Nhấn để đổi cấp bậc ưu tiên"
                                >
                                  <span className="material-symbols-outlined text-[12px]">{prioInfo.icon}</span>
                                  <span>{prioInfo.shortLabel}</span>
                                  <span className="material-symbols-outlined text-[10px] opacity-70">arrow_drop_down</span>
                                </button>
                                {quickPriorityMenuProjectId === project.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 w-52 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex flex-col gap-1 text-left animate-in fade-in zoom-in-95 duration-100"
                                  >
                                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Đổi mức ưu tiên
                                    </div>
                                    {PROJECT_PRIORITY_OPTIONS.map((opt) => (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={(e) => handleQuickChangePriority(project.id, opt.value, e)}
                                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer ${
                                          (project.priority || 'normal') === opt.value ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'
                                        }`}
                                      >
                                        <span className="flex items-center gap-1.5">
                                          <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
                                          <span>{opt.shortLabel}</span>
                                          <span className="text-[10px] opacity-75">({opt.subLabel})</span>
                                        </span>
                                        {(project.priority || 'normal') === opt.value && (
                                          <span className="material-symbols-outlined text-sm text-blue-600">check</span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 border-r border-slate-200">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-primary hover:underline leading-snug line-clamp-1" title={project.name}>
                                  {project.name}
                                </span>
                                {Boolean((project as any).unreadNotifCount && (project as any).unreadNotifCount > 0) && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold bg-rose-50 text-rose-600 rounded-full border border-rose-200 shrink-0">
                                    {(project as any).unreadNotifCount}
                                  </span>
                                )}
                              </div>
                              {project.location && (
                                <div className="text-[11px] text-slate-400 truncate max-w-[280px]">
                                  {project.location}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              {project.category ? (
                                <span className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold text-[10px] border border-blue-100 max-w-[130px] truncate" title={project.category}>
                                  {project.category}
                                </span>
                              ) : (project as any).client ? (
                                <span className="text-[11px] text-slate-600 truncate block" title={(project as any).client}>
                                  {(project as any).client}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic font-normal text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              {project.memberNames?.length ? (
                                <div className="flex items-center gap-1 truncate max-w-[180px]" title={project.memberNames.join(', ')}>
                                  <span className="font-semibold text-slate-700 truncate text-[11px]">
                                    {project.memberNames[0]}
                                  </span>
                                  {project.memberNames.length > 1 && (
                                    <span className="text-[10px] px-1 py-0.2 bg-slate-100 text-slate-600 rounded-full font-bold shrink-0">
                                      +{project.memberNames.length - 1}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px] font-normal">Chưa có</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200">
                              <div className="flex flex-col items-center gap-1 w-24 mx-auto">
                                <span className={`text-[11px] font-extrabold ${
                                  project.progress >= 100 ? 'text-emerald-600'
                                  : project.progress >= 60 ? 'text-blue-600'
                                  : project.progress > 0 ? 'text-amber-600' : 'text-slate-400'
                                }`}>
                                  {project.progress}%
                                </span>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${project.progress}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                {statusLabel[project.status]}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNotifOpenProjectId(project.id);
                                  }}
                                  title="Xem toàn bộ thay đổi của dự án"
                                  className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">notifications</span>
                                </button>
                                {canManageItem(user, project, "EDIT_PROJECTS") && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                                    title="Sửa tên dự án"
                                    className="p-1 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                  </button>
                                )}
                                {canManageItem(user, project, "DELETE_PROJECTS") && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setProjectToDelete(project); }}
                                    title="Xóa dự án"
                                    className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
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
              </div>
            )}

            {/* Chế độ xem 4: Dạng Bảng Chi Tiết (Detailed Table) */}
            {viewMode === 'table_detailed' && (
              <div className="bg-white border-b border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs min-w-[1200px]">
                    <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200">STT</th>
                        <th className="py-2.5 px-3 w-28 border-r border-slate-200">Mã DA</th>
                        <th className="py-2.5 px-3 w-28 text-center border-r border-slate-200">Ưu tiên</th>
                        <th className="py-2.5 px-4 min-w-[220px] border-r border-slate-200">Tên dự án & Địa điểm</th>
                        <th className="py-2.5 px-3 w-36 border-r border-slate-200">Phân loại / CĐT</th>
                        <th className="py-2.5 px-3 w-40 border-r border-slate-200">Quản lý / PM</th>
                        <th className="py-2.5 px-3 w-36 border-r border-slate-200">Nhân sự</th>
                        <th className="py-2.5 px-3 w-28 text-center border-r border-slate-200">Công việc</th>
                        <th className="py-2.5 px-3 w-32 text-center border-r border-slate-200">Tiến độ</th>
                        <th className="py-2.5 px-3 w-32 text-right border-r border-slate-200">Tổng chi phí</th>
                        <th className="py-2.5 px-3 w-28 text-center border-r border-slate-200">Trạng thái</th>
                        <th className="py-2.5 px-3 w-28 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {paginatedProjects.map((project, idx) => {
                        const globalIdx = (safeCurrentPage - 1) * pageSize + idx;
                        const prioInfo = getProjectPriorityInfo(project.priority);
                        const statusCfg = project.status === 'completed'
                          ? { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
                          : project.status === 'on_hold'
                            ? { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
                            : { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };

                        const barColor = project.progress >= 100 ? 'bg-emerald-500'
                          : project.progress >= 60 ? 'bg-blue-500'
                          : project.progress >= 30 ? 'bg-amber-400' : 'bg-slate-300';

                        return (
                          <tr
                            key={project.id}
                            onClick={() => openProjectTasks(project)}
                            className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                          >
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500 border-r border-slate-200">
                              {String(globalIdx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-[11px] font-bold text-slate-600 truncate max-w-[120px]">
                              {project.code || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200" onClick={(e) => e.stopPropagation()}>
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() => setQuickPriorityMenuProjectId(quickPriorityMenuProjectId === project.id ? null : project.id)}
                                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-extrabold border transition-all hover:scale-105 active:scale-95 cursor-pointer ${prioInfo.badgeClass}`}
                                  title="Nhấn để đổi cấp bậc ưu tiên"
                                >
                                  <span className="material-symbols-outlined text-[12px]">{prioInfo.icon}</span>
                                  <span>{prioInfo.shortLabel}</span>
                                  <span className="material-symbols-outlined text-[10px] opacity-70">arrow_drop_down</span>
                                </button>
                                {quickPriorityMenuProjectId === project.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 w-52 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex flex-col gap-1 text-left animate-in fade-in zoom-in-95 duration-100"
                                  >
                                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Đổi mức ưu tiên
                                    </div>
                                    {PROJECT_PRIORITY_OPTIONS.map((opt) => (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={(e) => handleQuickChangePriority(project.id, opt.value, e)}
                                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer ${
                                          (project.priority || 'normal') === opt.value ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'
                                        }`}
                                      >
                                        <span className="flex items-center gap-1.5">
                                          <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
                                          <span>{opt.shortLabel}</span>
                                          <span className="text-[10px] opacity-75">({opt.subLabel})</span>
                                        </span>
                                        {(project.priority || 'normal') === opt.value && (
                                          <span className="material-symbols-outlined text-sm text-blue-600">check</span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 border-r border-slate-200">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-primary hover:underline leading-snug line-clamp-1" title={project.name}>
                                  {project.name}
                                </span>
                                {Boolean((project as any).unreadNotifCount && (project as any).unreadNotifCount > 0) && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold bg-rose-50 text-rose-600 rounded-full border border-rose-200 shrink-0">
                                    {(project as any).unreadNotifCount}
                                  </span>
                                )}
                              </div>
                              {project.location && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[280px]">
                                  📍 {project.location}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              {project.category ? (
                                <span className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold text-[10px] border border-blue-100 max-w-[130px] truncate" title={project.category}>
                                  {project.category}
                                </span>
                              ) : (project as any).client ? (
                                <span className="text-[11px] text-slate-600 truncate block" title={(project as any).client}>
                                  {(project as any).client}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic font-normal text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700">
                              {project.managerName ? (
                                <span className="font-semibold text-slate-800 text-[11px] truncate block" title={project.managerName}>
                                  👤 {project.managerName}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Chưa gán</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              {project.memberNames?.length ? (
                                <div className="flex items-center gap-1 truncate max-w-[160px]" title={project.memberNames.join(', ')}>
                                  <span className="font-semibold text-slate-700 truncate text-[11px]">
                                    {project.memberNames[0]}
                                  </span>
                                  {project.memberNames.length > 1 && (
                                    <span className="text-[10px] px-1 py-0.2 bg-slate-100 text-slate-600 rounded-full font-bold shrink-0">
                                      +{project.memberNames.length - 1}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">0 người</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 font-semibold text-slate-700">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] border border-slate-200">
                                {project.completedTasks} / {project.totalTasks}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200">
                              <div className="flex flex-col items-center gap-1 w-24 mx-auto">
                                <span className={`text-[11px] font-extrabold ${
                                  project.progress >= 100 ? 'text-emerald-600'
                                  : project.progress >= 60 ? 'text-blue-600'
                                  : project.progress > 0 ? 'text-amber-600' : 'text-slate-400'
                                }`}>
                                  {project.progress}%
                                </span>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${project.progress}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right border-r border-slate-200 font-mono text-[11px] font-bold text-slate-700">
                              {project.totalCost > 0 ? `${project.totalCost.toLocaleString('vi-VN')} đ` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                {statusLabel[project.status]}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setNotifOpenProjectId(project.id); }}
                                  title="Xem toàn bộ thay đổi của dự án"
                                  className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">notifications</span>
                                </button>
                                {canManageItem(user, project, "EDIT_PROJECTS") && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                                    title="Sửa tên dự án"
                                    className="p-1 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                  </button>
                                )}
                                {canManageItem(user, project, "DELETE_PROJECTS") && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setProjectToDelete(project); }}
                                    title="Xóa dự án"
                                    className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
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
              </div>
            )}

            {/* Chế độ xem 5: Dạng Bảng Kanban (Kanban Board by Status) */}
            {viewMode === 'kanban' && (() => {
              const kanbanCols: { key: Project['status']; title: string; dot: string }[] = [
                { key: 'active', title: 'Đang triển khai', dot: 'bg-blue-500' },
                { key: 'on_hold', title: 'Tạm dừng / Chờ', dot: 'bg-amber-500' },
                { key: 'completed', title: 'Đã hoàn thành', dot: 'bg-emerald-500' },
              ];

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 items-start">
                  {kanbanCols.map((col) => {
                    const colProjects = enhancedProjects.filter(p => p.status === col.key);

                    return (
                      <div key={col.key} className="flex flex-col bg-slate-100/70 border border-slate-200 rounded-xl p-3 min-h-[400px]">
                        {/* Header cột */}
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                            <h3 className="font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wide">
                              {col.title}
                            </h3>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-white border border-slate-200 text-slate-700 shadow-2xs">
                            {colProjects.length}
                          </span>
                        </div>

                        {/* Danh sách thẻ trong cột */}
                        <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-270px)] custom-scrollbar pr-0.5">
                          {colProjects.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-lg bg-white/50">
                              Không có dự án nào
                            </div>
                          ) : (
                            colProjects.map((project) => {
                              const prioInfo = getProjectPriorityInfo(project.priority);
                              const barColor = project.progress >= 100 ? 'bg-emerald-500'
                                : project.progress >= 60 ? 'bg-blue-500'
                                : project.progress >= 30 ? 'bg-amber-400' : 'bg-slate-300';

                              return (
                                <div
                                  key={project.id}
                                  onClick={() => openProjectTasks(project)}
                                  className={`group relative bg-white border ${
                                    prioInfo.value === 'urgent'
                                      ? 'border-red-300 ring-1 ring-red-400/80 shadow-2xs shadow-red-50'
                                      : prioInfo.value === 'high'
                                        ? 'border-amber-300 ring-1 ring-amber-400/60'
                                        : 'border-slate-200'
                                  } rounded-xl p-3 shadow-2xs hover:shadow-md hover:border-primary/50 transition-all cursor-pointer flex flex-col gap-2`}
                                >
                                  {/* Mã dự án + Ưu tiên + Thông báo */}
                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 truncate">
                                        {project.code || 'DA'}
                                      </span>
                                      <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-extrabold border ${prioInfo.badgeClass}`} title={prioInfo.label}>
                                        <span className="material-symbols-outlined text-[11px]">{prioInfo.icon}</span>
                                        {prioInfo.shortLabel}
                                      </span>
                                    </div>
                                    {Boolean((project as any).unreadNotifCount && (project as any).unreadNotifCount > 0) && (
                                      <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold bg-rose-50 text-rose-600 rounded-full border border-rose-200">
                                        {(project as any).unreadNotifCount} mới
                                      </span>
                                    )}
                                  </div>

                                  {/* Tên dự án */}
                                  <h4 className="font-bold text-slate-800 text-xs leading-snug line-clamp-2 hover:text-primary transition-colors" title={project.name}>
                                    {project.name}
                                  </h4>

                                  {/* Phân loại & PM */}
                                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                                    <span className="truncate">
                                      {project.category || (project as any).client || 'Chung'}
                                    </span>
                                    {project.managerName && (
                                      <span className="truncate text-slate-600 font-medium shrink-0 max-w-[100px]" title={project.managerName}>
                                        👤 {project.managerName}
                                      </span>
                                    )}
                                  </div>

                                  {/* Tiến độ */}
                                  <div className="pt-1.5 border-t border-slate-100 flex flex-col gap-1">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-slate-400">{project.completedTasks}/{project.totalTasks} việc</span>
                                      <span className="font-extrabold text-slate-700">{project.progress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${project.progress}%` }} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Thanh Phân Trang Tinh Gọn (Pagination Toolbar) */}
            {enhancedProjects.length > 0 && viewMode !== 'kanban' && (() => {
              const isTableStyle = viewMode === 'table' || viewMode === 'table_detailed';
              if (tablePaginationMode === 'infinite') {
                return null;
              }

              return (
                <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 px-3 sm:px-4 py-2 sm:py-2.5 ${isTableStyle ? 'rounded-none border-x-0 mx-0 mt-0' : 'rounded-xl mt-2'} shadow-xs text-xs font-semibold text-slate-600`}>
                  <div className="flex items-center gap-2">
                    <span>
                      Hiển thị <strong className="text-slate-800">{enhancedProjects.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1} - {Math.min(safeCurrentPage * pageSize, enhancedProjects.length)}</strong> / <strong className="text-slate-800">{enhancedProjects.length}</strong> dự án
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage(1)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 shadow-xs cursor-pointer"
                    >
                      Đầu
                    </button>
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 shadow-xs cursor-pointer"
                    >
                      Trước
                    </button>
                    <span className="px-2.5 font-bold text-slate-700 whitespace-nowrap">
                      Trang {safeCurrentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 shadow-xs cursor-pointer"
                    >
                      Sau
                    </button>
                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 shadow-xs cursor-pointer"
                    >
                      Cuối
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </PullToRefresh>

      <Modal isOpen={Boolean(projectToDelete)} onClose={() => setProjectToDelete(null)} title={TEXT.deleteProject}>
        <div className="space-y-4">
          <p>Bạn chắc chắn muốn xóa dự án <strong>{projectToDelete?.name}</strong>?</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setProjectToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-100">{TEXT.cancel}</button>
            <button type="button" onClick={handleDeleteProject} className="px-5 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">{TEXT.deleteProject}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(projectToEdit)} onClose={() => { setProjectToEdit(null); setEditPendingProjectTasks([]); }} title="Cập nhật dự án">
        <form onSubmit={async (e) => { e.preventDefault(); if (loading || isSubmittingRef.current) return; isSubmittingRef.current = true; setLoading(true); try { await handleEditProject(e); } finally { isSubmittingRef.current = false; setLoading(false); } }} className="space-y-4">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <OcrUploadPanel onExtracted={applyImportedProjectToEdit} />
            <p className="mt-2 text-xs text-slate-500">
              Có thể nhập file phụ lục (Excel, PDF, DOCX, Ảnh) để cập nhật thông tin dự án và đồng bộ các đầu mục công việc, vật tư, mua sắm vào dự án.
            </p>
            {editPendingProjectTasks.length > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-xs text-primary border border-blue-200 font-semibold">
                <span>✓ Đã trích xuất {editPendingProjectTasks.length} đầu mục từ phụ lục. Nhấn "Lưu thay đổi" để đồng bộ ngay.</span>
                <button
                  type="button"
                  onClick={() => setEditPendingProjectTasks([])}
                  className="text-xs font-bold text-rose-600 hover:underline ml-2"
                >
                  Hủy bỏ
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tên Dự án / Công trình mới *</label>
            <input required value={editProjName} onChange={(e) => setEditProjName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mã Dự án</label>
              <input value={projectToEdit?.code || ''} disabled className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-lg cursor-not-allowed text-slate-500" title="Không thể đổi mã dự án sau khi tạo" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Địa điểm công trình</label>
              <div className="flex gap-1.5">
                <input
                  value={editProjLocation}
                  onChange={(e) => setEditProjLocation(e.target.value)}
                  placeholder="Nhập địa chỉ, tỉnh/thành phố..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                />
                <button
                  type="button"
                  title="Tìm tọa độ từ địa chỉ đã nhập"
                  disabled={isGeocodingEdit || !editProjLocation.trim()}
                  onClick={async () => {
                    if (!editProjLocation.trim()) return;
                    setIsGeocodingEdit(true);
                    try {
                      const res = await geocodeAddress(editProjLocation);
                      if (res) {
                        setEditProjLatitude(String(res.latitude));
                        setEditProjLongitude(String(res.longitude));
                        triggerToast(`Đã tìm thấy tọa độ: ${res.latitude.toFixed(5)}, ${res.longitude.toFixed(5)}`, 'success');
                      } else {
                        triggerToast('Không tìm thấy tọa độ cho địa chỉ này. Bạn có thể kiểm tra lại tên đường, quận/huyện, tỉnh thành.', 'warning');
                      }
                    } catch {
                      triggerToast('Lỗi khi tra cứu tọa độ địa chỉ', 'warning');
                    } finally {
                      setIsGeocodingEdit(false);
                    }
                  }}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isGeocodingEdit ? 'animate-spin' : ''}`}>
                    {isGeocodingEdit ? 'sync' : 'search'}
                  </span>
                  <span>{isGeocodingEdit ? 'Đang tìm...' : 'Tìm tọa độ'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tọa độ GPS & Bán kính chấm công (Hiển thị tự động theo địa chỉ, không cho sửa tay) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-slate-500">pin_drop</span>
                Tọa độ GPS & Bán kính chấm công công trường
              </span>
              {editProjLatitude && editProjLongitude ? (
                <a
                  href={`https://www.google.com/maps?q=${editProjLatitude},${editProjLongitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <span>Xem trên Google Maps</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Vĩ độ (Latitude)</label>
                <div className="w-full px-2.5 py-1.5 border border-slate-200 bg-slate-100 rounded-md text-xs font-mono font-medium text-slate-700 select-all flex items-center min-h-[30px]">
                  {editProjLatitude ? editProjLatitude : <span className="text-slate-400 italic font-sans font-normal">Tự động lấy theo địa chỉ</span>}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kinh độ (Longitude)</label>
                <div className="w-full px-2.5 py-1.5 border border-slate-200 bg-slate-100 rounded-md text-xs font-mono font-medium text-slate-700 select-all flex items-center min-h-[30px]">
                  {editProjLongitude ? editProjLongitude : <span className="text-slate-400 italic font-sans font-normal">Tự động lấy theo địa chỉ</span>}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bán kính hợp lệ (mét)</label>
                <div className="w-full px-2.5 py-1.5 border border-slate-200 bg-slate-100 rounded-md text-xs font-mono font-medium text-slate-700 select-all flex items-center min-h-[30px]">
                  {editProjRadiusMeters || 500} m
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              * Tọa độ GPS được hệ thống tự động xác định từ địa chỉ công trình. Nhân sự chấm công trong phạm vi bán kính trên sẽ được tính là đúng vị trí.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Chủ đầu tư</label>
              <input value={editProjClient} onChange={(e) => setEditProjClient(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phân loại dự án</label>
              <input
                value={editProjCategory}
                onChange={(e) => setEditProjCategory(e.target.value)}
                placeholder="VD: Trạm biến áp 110kV, Đường dây, Nhà xưởng..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Hạng mục</label>
            <input
              value={editProjNotes}
              onChange={(e) => setEditProjNotes(e.target.value)}
              placeholder="Nhập hạng mục thực hiện..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Mức độ ưu tiên (Cấp bậc)</span>
              <span className="text-[11px] font-normal text-slate-400">Cấp bậc cao hơn sẽ hiển thị lên trước các dự án khác</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROJECT_PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditProjPriority(opt.value)}
                  className={`px-3 py-2 rounded-xl border text-left transition-all flex flex-col gap-0.5 cursor-pointer ${
                    editProjPriority === opt.value
                      ? `${opt.activeBg} ring-2 ${opt.ring} font-bold shadow-xs`
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
                    <span className="font-extrabold">{opt.shortLabel}</span>
                  </div>
                  <span className="text-[10px] opacity-80 truncate">{opt.subLabel}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Chỉ huy trưởng / Quản lý dự án</label>
            <CustomSelect
              value={editProjManagerId}
              onChange={(e) => {
                const val = e.target.value;
                setEditProjManagerId(val);
                if (val && !editSelectedEngineerIds.includes(val)) {
                  setEditSelectedEngineerIds(prev => [...prev, val]);
                }
              }}
              className="w-full text-xs font-semibold"
              placeholder="-- Chưa phân công --"
            >
              <option value="">-- Chưa phân công --</option>
              {engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name} {eng.title || eng.role ? `(${eng.title || eng.role})` : ''}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block font-bold text-slate-700">Nhân sự tham gia dự án</label>
              {engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').length > 0 && (
                <label className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-blue-700 cursor-pointer select-none bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors border border-blue-200">
                  <input
                    type="checkbox"
                    checked={
                      engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').length > 0 &&
                      engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').every(eng => editSelectedEngineerIds.includes(eng.id))
                    }
                    onChange={(e) => {
                      const validIds = engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').map(eng => eng.id);
                      if (e.target.checked) {
                        setEditSelectedEngineerIds(validIds);
                      } else {
                        setEditSelectedEngineerIds([]);
                      }
                    }}
                    className="accent-primary w-3.5 h-3.5 cursor-pointer rounded"
                  />
                  <span>Chọn tất cả</span>
                </label>
              )}
            </div>
            <div className={`max-h-36 overflow-y-auto border rounded-lg p-2 space-y-1.5 bg-slate-50 ${editSelectedEngineerIds.length === 0 ? 'border-red-200' : 'border-slate-200'}`}>
              {engineers.length === 0 && <p className="text-[11px] text-slate-400">Chưa có nhân sự nào.</p>}
              {engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').map((eng) => (
                <label key={eng.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={editSelectedEngineerIds.includes(eng.id)} onChange={() => toggleEditEngineerId(eng.id)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                  <span className="font-semibold text-slate-700">{eng.name}</span>
                  <span className="text-slate-400">({eng.title || 'Nhân viên'})</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setProjectToEdit(null)} className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-100">{TEXT.cancel}</button>
            <button type="submit" disabled={!editProjName.trim()} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">Lưu thay đổi</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isNewProjectModalOpen} onClose={() => setIsNewProjectModalOpen(false)} title={TEXT.importProjectTitle}>
        <form onSubmit={async (e) => { e.preventDefault(); if (loading || isSubmittingRef.current) return; isSubmittingRef.current = true; setLoading(true); try { await handleCreateProject(e); } finally { isSubmittingRef.current = false; setLoading(false); } }} className="space-y-4">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <OcrUploadPanel onExtracted={applyImportedProject} />
            <p className="mt-2 text-xs text-slate-500">Có thể nhập file để tự điền thông tin dự án và đầu mục công việc, hoặc nhập thủ công bên dưới.</p>
          </div>
          <div><label className="block font-bold text-slate-700 mb-1">Tên Dự án / Công trình mới *</label><input required value={newProjName} onChange={(event) => setNewProjName(event.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mã Dự án</label>
              <input
                value={newProjCode}
                onChange={(event) => {
                  const raw = event.target.value.toUpperCase();
                  // Tự động chuyển ký tự đặc biệt, dấu gạch chéo /, dấu cách thành dấu gạch nối -
                  const cleaned = raw.replace(/[^A-Z0-9_-]/g, '-').replace(/[-_]{2,}/g, '-');
                  setNewProjCode(cleaned);
                }}
                placeholder="Tự sinh nếu bỏ trống (VD: DA-2026-01)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">* Ký tự đặc biệt, dấu gạch chéo (/) và khoảng trắng tự động chuyển thành dấu gạch nối (-)</span>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Địa điểm công trình</label>
              <div className="flex gap-1.5">
                <input
                  value={newProjLocation}
                  onChange={(event) => setNewProjLocation(event.target.value)}
                  placeholder="Nhập địa chỉ, tỉnh/thành phố..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                />
                <button
                  type="button"
                  title="Tìm tọa độ từ địa chỉ đã nhập"
                  disabled={isGeocodingNew || !newProjLocation.trim()}
                  onClick={async () => {
                    if (!newProjLocation.trim()) return;
                    setIsGeocodingNew(true);
                    try {
                      const res = await geocodeAddress(newProjLocation);
                      if (res) {
                        setNewProjLatitude(String(res.latitude));
                        setNewProjLongitude(String(res.longitude));
                        triggerToast(`Đã tìm thấy tọa độ: ${res.latitude.toFixed(5)}, ${res.longitude.toFixed(5)}`, 'success');
                      } else {
                        triggerToast('Không tìm thấy tọa độ cho địa chỉ này. Bạn có thể kiểm tra lại tên đường, quận/huyện, tỉnh thành.', 'warning');
                      }
                    } catch {
                      triggerToast('Lỗi khi tra cứu tọa độ địa chỉ', 'warning');
                    } finally {
                      setIsGeocodingNew(false);
                    }
                  }}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isGeocodingNew ? 'animate-spin' : ''}`}>
                    {isGeocodingNew ? 'sync' : 'search'}
                  </span>
                  <span>{isGeocodingNew ? 'Đang tìm...' : 'Tìm tọa độ'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tọa độ GPS & Bán kính chấm công (Hiển thị tự động theo địa chỉ, không cho sửa tay) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-slate-500">pin_drop</span>
                Tọa độ GPS & Bán kính chấm công công trường
              </span>
              {newProjLatitude && newProjLongitude ? (
                <a
                  href={`https://www.google.com/maps?q=${newProjLatitude},${newProjLongitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <span>Xem trên Google Maps</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Vĩ độ (Latitude)</label>
                <div className="w-full px-2.5 py-1.5 border border-slate-200 bg-slate-100 rounded-md text-xs font-mono font-medium text-slate-700 select-all flex items-center min-h-[30px]">
                  {newProjLatitude ? newProjLatitude : <span className="text-slate-400 italic font-sans font-normal">Tự động lấy theo địa chỉ</span>}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kinh độ (Longitude)</label>
                <div className="w-full px-2.5 py-1.5 border border-slate-200 bg-slate-100 rounded-md text-xs font-mono font-medium text-slate-700 select-all flex items-center min-h-[30px]">
                  {newProjLongitude ? newProjLongitude : <span className="text-slate-400 italic font-sans font-normal">Tự động lấy theo địa chỉ</span>}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bán kính hợp lệ (mét)</label>
                <div className="w-full px-2.5 py-1.5 border border-slate-200 bg-slate-100 rounded-md text-xs font-mono font-medium text-slate-700 select-all flex items-center min-h-[30px]">
                  {newProjRadiusMeters || 500} m
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              * Tọa độ GPS được hệ thống tự động xác định từ địa chỉ công trình. Nhân sự chấm công trong phạm vi bán kính trên sẽ được tính là đúng vị trí.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block font-bold text-slate-700 mb-1">Chủ đầu tư</label><input value={newProjClient} onChange={(event) => setNewProjClient(event.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" /></div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phân loại dự án</label>
              <input
                value={newProjCategory}
                onChange={(event) => setNewProjCategory(event.target.value)}
                placeholder="VD: Trạm biến áp 110kV, Đường dây, Nhà xưởng..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Hạng mục</label>
            <input
              value={newProjNotes}
              onChange={(event) => setNewProjNotes(event.target.value)}
              placeholder="Nhập hạng mục thực hiện..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Mức độ ưu tiên (Cấp bậc)</span>
              <span className="text-[11px] font-normal text-slate-400">Cấp bậc cao hơn sẽ hiển thị lên trước các dự án khác</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROJECT_PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewProjPriority(opt.value)}
                  className={`px-3 py-2 rounded-xl border text-left transition-all flex flex-col gap-0.5 cursor-pointer ${
                    newProjPriority === opt.value
                      ? `${opt.activeBg} ring-2 ${opt.ring} font-bold shadow-xs`
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
                    <span className="font-extrabold">{opt.shortLabel}</span>
                  </div>
                  <span className="text-[10px] opacity-80 truncate">{opt.subLabel}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Chỉ huy trưởng / Quản lý dự án</label>
            <CustomSelect
              value={newProjManagerId}
              onChange={(e) => {
                const val = e.target.value;
                setNewProjManagerId(val);
                if (val && !selectedEngineerIds.includes(val)) {
                  setSelectedEngineerIds(prev => [...prev, val]);
                }
              }}
              className="w-full text-xs font-semibold"
              placeholder="-- Chưa phân công --"
            >
              <option value="">-- Chưa phân công --</option>
              {engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name} {eng.title || eng.role ? `(${eng.title || eng.role})` : ''}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block font-bold text-slate-700">Nhân sự tham gia dự án</label>
              {engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').length > 0 && (
                <label className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-blue-700 cursor-pointer select-none bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors border border-blue-200">
                  <input
                    type="checkbox"
                    checked={
                      engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').length > 0 &&
                      engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').every(eng => selectedEngineerIds.includes(eng.id))
                    }
                    onChange={(e) => {
                      const validIds = engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').map(eng => eng.id);
                      if (e.target.checked) {
                        setSelectedEngineerIds(validIds);
                      } else {
                        setSelectedEngineerIds([]);
                      }
                    }}
                    className="accent-primary w-3.5 h-3.5 cursor-pointer rounded"
                  />
                  <span>Chọn tất cả</span>
                </label>
              )}
            </div>
            <div className={`max-h-36 overflow-y-auto border rounded-lg p-2 space-y-1.5 bg-slate-50 ${selectedEngineerIds.length === 0 ? 'border-red-200' : 'border-slate-200'}`}>
              {engineers.length === 0 && <p className="text-[11px] text-slate-400">Chưa có nhân sự nào.</p>}
              {engineers.filter(eng => eng.username !== 'admin' && eng.role !== 'Quản trị viên').map((eng) => (
                <label key={eng.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={selectedEngineerIds.includes(eng.id)} onChange={() => toggleEngineerId(eng.id)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                  <span className="font-semibold text-slate-700">{eng.name}</span>
                  <span className="text-slate-400">({eng.title || 'Nhân viên'})</span>
                </label>
              ))}
            </div>
          </div>
          {pendingProjectTasks.length > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold">
              <span>Hệ thống đã đọc {pendingProjectTasks.length} công việc từ file đính kèm.</span>
              <button
                type="button"
                onClick={() => setPendingProjectTasks([])}
                className="text-red-600 hover:underline font-bold text-[11px] ml-2"
                title="Bỏ qua danh sách công việc từ file, chỉ tạo dự án rỗng"
              >
                Xóa file đính kèm
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setIsNewProjectModalOpen(false); setPendingProjectTasks([]); }} className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-100">{TEXT.cancel}</button><button type="submit" disabled={loading}  className="px-5 py-2 bg-primary text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50">{TEXT.create}</button></div>
        </form>
      </Modal>
    </div>
  );
};
