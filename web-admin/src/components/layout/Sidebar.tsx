import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useRealtimeStore } from '../../services/realtimeStore';
import { useAuthStore, hasPermission, isSystemAdmin, isDirector } from '../../services/authStore';
import { useUIStore } from '../../services/uiStore';

import { NotificationBell } from '../common/NotificationBell';

interface SidebarProps {
  isExpanded?: boolean;
  toggleSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isExpanded: isExpandedProp, toggleSidebar: toggleSidebarProp }) => {
  const projects = useRealtimeStore((state) => state.projects);
  const notifications = useRealtimeStore((state) => state.notifications);
  const engineers = useRealtimeStore((state) => state.engineers || []);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { 
    sidebarHoverToExpand, 
    sidebarShowToggleButton, 
    isSidebarExpanded, 
    isSidebarHovered, 
    companyName,
    companySlogan,
    companyLogo,
    setIsSidebarHovered, 
    toggleSidebarExpanded 
  } = useUIStore();
  
  const location = useLocation();
  const match = location.pathname.match(/^\/projects\/([^\/]+)/);
  const currentProjectId = match && match[1] !== 'new' ? match[1] : null;
  const currentProject = projects.find(p => p.id === currentProjectId || p.code === currentProjectId);

  
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  
  const isExpanded = isExpandedProp !== undefined 
    ? isExpandedProp 
    : (isSidebarExpanded || isSidebarHovered);
  const toggleSidebar = toggleSidebarProp || toggleSidebarExpanded;
  const navigate = useNavigate();
  const isSystemAdminUser = isSystemAdmin(user);
  const isDirectorUser = isDirector(user);
  const isAdmin = isDirectorUser || isSystemAdminUser || user?.role === 'pm' || hasPermission(user, 'ASSIGN_TASKS');
  const defaultTaskPath = isAdmin ? '/task-assignment?tab=overview' : '/my-tasks';
  const sidebarRef = useRef<HTMLElement>(null);

  // Avatar người dùng hiện tại (nếu có cập nhật thì lấy, chưa cập nhật thì fallback sang icon mặc định)
  const currentEngineer = useMemo(() => {
    if (!user) return null;
    return engineers.find(e => 
      e.id === user.id ||
      (user.username && e.username === user.username) ||
      (user.name && e.name?.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
      (user.email && e.email === user.email) ||
      (user.phone && e.phone === user.phone)
    );
  }, [engineers, user]);

  const userAvatarUrl = (user as any)?.avatar || (user as any)?.avatarUrl || (currentEngineer as any)?.avatar || (currentEngineer as any)?.avatarUrl || null;
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [userAvatarUrl]);

  const activeCompanyName = companyName?.trim() || 'TITSMART';
  const activeCompanySlogan = companySlogan?.trim() || 'Project Manager';
  const activeCompanyLogo = companyLogo || './logo.png';

  // Tự động co giãn cỡ chữ theo độ dài để hiển thị trọn vẹn không bị cắt ba chấm
  const nameLength = activeCompanyName.length;
  const sloganLength = activeCompanySlogan.length;

  const nameFontSizeClass =
    nameLength > 24
      ? 'text-[10px]'
      : nameLength > 18
      ? 'text-[11px]'
      : nameLength > 12
      ? 'text-[12px]'
      : nameLength > 8
      ? 'text-[13px]'
      : 'text-[15px]';

  const sloganFontSizeClass =
    sloganLength > 26
      ? 'text-[6px] tracking-[0.03em]'
      : sloganLength > 18
      ? 'text-[7px] tracking-[0.06em]'
      : sloganLength > 13
      ? 'text-[7.5px] tracking-[0.08em]'
      : 'text-[8px] tracking-[0.15em]';

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    'Công việc': true,
    'Công và lương': true,
    'Chấm công': true,
    'Tất cả dự án': true,
    'Tổng kho': true,
    'Vật tư & Chi phí': true,
    'Kho Dự án': true
  });

  const toggleSubMenu = (label: string) => {
    setOpenSubMenus(prev => ({
      ...prev,
      [label]: prev[label] === undefined ? false : !prev[label]
    }));
  };

  useEffect(() => {
    if (location.pathname === '/task-assignment' || location.pathname === '/my-tasks' || location.pathname === '/work-plan') {
      setOpenSubMenus(prev => ({ ...prev, 'Công việc': true }));
    }
    if (location.pathname === '/attendance') {
      setOpenSubMenus(prev => ({ ...prev, 'Công và lương': true, 'Chấm công': true }));
    }
    if (location.pathname === '/projects') {
      setOpenSubMenus(prev => ({ ...prev, 'Tất cả dự án': true }));
    }
    if (location.pathname === '/materials') {
      setOpenSubMenus(prev => ({ ...prev, 'Tổng kho': true }));
    }
    if (location.pathname.includes('/cost-plan')) {
      setOpenSubMenus(prev => ({ ...prev, 'Vật tư & Chi phí': true }));
    }
    if (location.pathname.includes('/inventory')) {
      setOpenSubMenus(prev => ({ ...prev, 'Kho Dự án': true }));
    }
    if (location.pathname.includes('/document-tracking') || location.pathname.includes('/documents')) {
      setOpenSubMenus(prev => ({ ...prev, 'Quản lý hồ sơ': true, 'Hồ sơ': true }));
    }
  }, [location.pathname]);

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const navGroups = React.useMemo(() => {
    if (currentProject) {
      const costPlanSubItems = [
        {
          label: 'Đặt hàng',
          path: `/projects/${currentProject.id}/cost-plan?tab=TECH`,
          icon: 'list_alt',
          isActive: (pathname: string, search: string) => {
            if (!pathname.includes('/cost-plan')) return false;
            const sp = new URLSearchParams(search);
            const tab = sp.get('tab');
            return !tab || tab === 'TECH';
          }
        },
        {
          label: 'Chứng từ',
          path: `/projects/${currentProject.id}/cost-plan?tab=DOCS`,
          icon: 'description',
          isActive: (pathname: string, search: string) => {
            if (!pathname.includes('/cost-plan')) return false;
            const sp = new URLSearchParams(search);
            return sp.get('tab') === 'DOCS';
          }
        },
        ...(user?.role !== 'engineer' ? [
          {
            label: 'Thanh toán',
            path: `/projects/${currentProject.id}/cost-plan?tab=FINANCE`,
            icon: 'payments',
            isActive: (pathname: string, search: string) => {
              if (!pathname.includes('/cost-plan')) return false;
              const sp = new URLSearchParams(search);
              return sp.get('tab') === 'FINANCE';
            }
          },
          {
            label: 'Chi phí',
            path: `/projects/${currentProject.id}/cost-plan?tab=EXPENSE`,
            icon: 'receipt_long',
            isActive: (pathname: string, search: string) => {
              if (!pathname.includes('/cost-plan')) return false;
              const sp = new URLSearchParams(search);
              const tab = sp.get('tab');
              return tab === 'EXPENSE' || tab === 'PAYMENT_REQUEST';
            }
          }
        ] : [
          {
            label: 'Chi phí',
            path: `/projects/${currentProject.id}/cost-plan?tab=EXPENSE`,
            icon: 'receipt_long',
            isActive: (pathname: string, search: string) => {
              if (!pathname.includes('/cost-plan')) return false;
              const sp = new URLSearchParams(search);
              const tab = sp.get('tab');
              return tab === 'EXPENSE' || tab === 'PAYMENT_REQUEST';
            }
          }
        ])
      ];

      const inventorySubItems = [
        {
          label: 'Tồn kho',
          path: `/projects/${currentProject.id}/inventory?tab=overview`,
          icon: 'inventory_2',
          isActive: (pathname: string, search: string) => {
            if (!pathname.includes('/inventory')) return false;
            const sp = new URLSearchParams(search);
            const tab = sp.get('tab');
            return !tab || tab === 'overview' || tab === 'inventory';
          }
        },
        {
          label: 'Nhập kho',
          path: `/projects/${currentProject.id}/inventory?tab=import`,
          icon: 'login',
          isActive: (pathname: string, search: string) => {
            if (!pathname.includes('/inventory')) return false;
            const sp = new URLSearchParams(search);
            return sp.get('tab') === 'import';
          }
        },
        {
          label: 'Xuất kho',
          path: `/projects/${currentProject.id}/inventory?tab=export`,
          icon: 'logout',
          isActive: (pathname: string, search: string) => {
            if (!pathname.includes('/inventory')) return false;
            const sp = new URLSearchParams(search);
            return sp.get('tab') === 'export';
          }
        }
      ];

      const baseProjectItems = [
          { label: 'Tổng quan', path: `/projects/${currentProject.id}/overview`, icon: 'dashboard', req: 'VIEW_PROJECTS' },
          { label: 'Kế hoạch', path: `/projects/${currentProject.id}/plan`, icon: 'calendar_month', req: 'VIEW_TASKS' },
          { label: 'Tiến độ', path: `/projects/${currentProject.id}/tasks`, icon: 'fact_check', req: 'VIEW_TASKS' },
          { 
            label: 'Vật tư & Chi phí', 
            path: `/projects/${currentProject.id}/cost-plan?tab=TECH`, 
            icon: 'account_balance_wallet', 
            req: 'VIEW_FINANCE',
            children: costPlanSubItems
          },
          { 
            label: 'Hồ sơ', 
            path: `/projects/${currentProject.id}/documents`, 
            icon: 'file_present', 
            req: 'VIEW_DOCUMENTS',
            children: [
              {
                label: 'Hồ sơ đầu vào',
                path: `/projects/${currentProject.id}/documents?tab=input`,
                icon: 'upload_file',
                isActive: (pathname: string, search: string) => {
                  const sp = new URLSearchParams(search);
                  return pathname.includes('/documents') && sp.get('tab') === 'input';
                }
              },
              {
                label: 'Hồ sơ đầu ra',
                path: `/projects/${currentProject.id}/documents?tab=output`,
                icon: 'download_for_offline',
                isActive: (pathname: string, search: string) => {
                  const sp = new URLSearchParams(search);
                  return pathname.includes('/documents') && sp.get('tab') === 'output';
                }
              }
            ]
          },
          { label: 'Thư viện', path: `/projects/${currentProject.id}/diagram`, icon: 'photo_library', req: 'VIEW_PROJECT_DIAGRAM' },
          { 
            label: 'Kho Dự án', 
            path: `/projects/${currentProject.id}/inventory?tab=overview`, 
            icon: 'inventory_2', 
            req: 'VIEW_MATERIALS',
            children: inventorySubItems
          },
          { label: 'Hiện trường', path: `/projects/${currentProject.id}/field-logs`, icon: 'add_a_photo', req: 'VIEW_FIELD_LOGS' }
        ];

      const projectItems = baseProjectItems.filter(item => hasPermission(user, item.req as any));

      return [
        {
          title: currentProject.name,
          collapsible: false,
          backPath: hasPermission(user, 'VIEW_PROJECTS') ? '/projects' : undefined,
          backLabel: 'Tất cả dự án',
          items: projectItems
        }
      ].filter(group => group.items.length > 0);
    }

    // Đối với Admin hệ thống kỹ thuật: Không hiển thị các module nghiệp vụ dự án, chỉ hiển thị menu Quản trị & Nhật ký
    if (isSystemAdminUser) {
      return [{
        title: '',
        collapsible: false,
        items: [
          { label: 'Cài đặt hệ thống', path: '/settings', icon: 'settings' },
          { label: 'Nhật ký kỹ thuật', path: '/activity-log', icon: 'history' }
        ]
      }];
    }

    const projectSubItems = [
      {
        label: 'Tất cả',
        path: '/projects?status=all',
        icon: 'apps',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/projects' && (sp.get('status') === 'all' || !sp.get('status'));
        }
      },
      {
        label: 'Đang triển khai',
        path: '/projects?status=active',
        icon: 'play_circle',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/projects' && sp.get('status') === 'active';
        }
      },
      {
        label: 'Hoàn thành',
        path: '/projects?status=completed',
        icon: 'check_circle',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/projects' && sp.get('status') === 'completed';
        }
      }
    ];

    const taskSubItems = [
      {
        label: 'Dự án',
        path: isAdmin ? '/task-assignment?tab=project_tasks' : '/my-tasks?category=project',
        icon: 'folder_open',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          if (isAdmin) {
            return pathname === '/task-assignment' && (sp.get('tab') === 'project_tasks' || sp.get('tab') === 'unassigned' || !sp.get('tab'));
          }
          return pathname === '/my-tasks' && (sp.get('category') === 'project' || !sp.get('category'));
        }
      },
      {
        label: 'Phát sinh',
        path: isAdmin ? '/task-assignment?tab=direct' : '/my-tasks?category=direct',
        icon: 'bolt',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          if (isAdmin) {
            return pathname === '/task-assignment' && sp.get('tab') === 'direct';
          }
          return pathname === '/my-tasks' && sp.get('category') === 'direct';
        }
      },
      ...(isAdmin ? [{
        label: 'Việc của tôi',
        path: '/my-tasks?scope=assigned',
        icon: 'person',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/my-tasks' && (sp.get('scope') === 'assigned' || !sp.get('scope'));
        }
      },
      {
        label: 'Việc liên quan',
        path: '/my-tasks?scope=following',
        icon: 'visibility',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/my-tasks' && (sp.get('scope') === 'following' || sp.get('scope') === 'related');
        }
      }] : [
      {
        label: 'Việc liên quan',
        path: '/my-tasks?scope=following',
        icon: 'visibility',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/my-tasks' && (sp.get('scope') === 'following' || sp.get('scope') === 'related');
        }
      }
      ]),
      {
        label: 'Kế hoạch',
        path: '/work-plan',
        icon: 'calendar_month',
        isActive: (pathname: string) => pathname === '/work-plan'
      }
    ];

    const attendanceSubItems = [
      {
        label: 'Chấm công',
        path: '/attendance?tab=attendance',
        icon: 'fingerprint',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          const tab = sp.get('tab');
          return pathname === '/attendance' && (tab === 'attendance' || tab === 'payroll' || tab === 'salary' || !tab);
        }
      },
      {
        label: 'Xin nghỉ',
        path: '/attendance?tab=leave',
        icon: 'event_busy',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/attendance' && (sp.get('tab') === 'leave' || sp.get('tab') === 'leaves');
        }
      },
      {
        label: 'Bù công',
        path: '/attendance?tab=adjustment',
        icon: 'edit_calendar',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/attendance' && (sp.get('tab') === 'adjustment' || sp.get('tab') === 'adjustments' || sp.get('tab') === 'cham-cong-bu');
        }
      }
    ];

    const materialSubItems = [
      {
        label: 'Tồn kho',
        path: '/materials?tab=stock',
        icon: 'inventory_2',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/materials' && (sp.get('tab') === 'stock' || sp.get('tab') === 'inventory');
        }
      },
      {
        label: 'Nhập kho',
        path: '/materials?tab=import',
        icon: 'login',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/materials' && sp.get('tab') === 'import';
        }
      },
      {
        label: 'Xuất kho',
        path: '/materials?tab=export',
        icon: 'logout',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/materials' && sp.get('tab') === 'export';
        }
      }
    ];

    const documentSubItems = [
      {
        label: 'Hồ sơ đầu vào',
        path: '/document-tracking?tab=input',
        icon: 'upload_file',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/document-tracking' && sp.get('tab') === 'input';
        }
      },
      {
        label: 'Hồ sơ đầu ra',
        path: '/document-tracking?tab=output',
        icon: 'download_for_offline',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/document-tracking' && sp.get('tab') === 'output';
        }
      }
    ];

    const personnelSubItems = [
      {
        label: 'Phòng ban',
        path: '/personnel?tab=department',
        icon: 'corporate_fare',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/personnel' && sp.get('tab') === 'department';
        }
      },
      {
        label: 'Nhân sự',
        path: '/personnel?tab=list',
        icon: 'person',
        isActive: (pathname: string, search: string) => {
          const sp = new URLSearchParams(search);
          return pathname === '/personnel' && (sp.get('tab') === 'list' || sp.get('tab') === 'personnel');
        }
      }
    ];

    const mainItems = [
      { label: 'Tổng quan', path: '/dashboard', icon: 'analytics', req: 'VIEW_PROJECTS' },
      { 
        label: 'Tất cả dự án', 
        path: '/projects?status=all', 
        icon: 'cell_tower', 
        req: 'VIEW_PROJECTS',
        children: projectSubItems
      },
      { 
        label: 'Công việc', 
        path: defaultTaskPath, 
        icon: 'checklist', 
        req: 'VIEW_TASKS',
        children: taskSubItems
      },
      { 
        label: 'Quản lý hồ sơ', 
        path: '/document-tracking', 
        icon: 'folder_managed', 
        req: 'VIEW_DOCUMENTS',
        children: documentSubItems
      },
      { 
        label: 'Tổng kho', 
        path: '/materials?tab=overview', 
        icon: 'warehouse', 
        req: 'VIEW_MATERIALS',
        children: materialSubItems
      },
      { 
        label: 'Công và lương', 
        path: '/attendance?tab=overview', 
        icon: 'schedule', 
        req: 'VIEW_TASKS',
        children: attendanceSubItems
      },
      { 
        label: 'Nhân sự', 
        path: '/personnel', 
        icon: 'groups', 
        req: 'VIEW_USERS',
        children: personnelSubItems
      }
    ];

    return [{
      title: '',
      collapsible: false,
      items: mainItems.filter(item => !item.req || hasPermission(user, item.req as any))
    }].filter(group => group.items.length > 0);
  }, [currentProject?.id, currentProject?.name, user, defaultTaskPath]);

  return (
    <>
      <aside 
        ref={sidebarRef} 
        onMouseEnter={() => {
          if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            setIsSidebarHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            setIsSidebarHovered(false);
          }
        }}
        className={`hidden md:flex fixed left-0 top-0 h-[100dvh] transition-[width,box-shadow] duration-200 ease-out will-change-[width] flex-col border-r border-slate-200 bg-white z-[100] ${
          !isSidebarExpanded && isSidebarHovered ? 'shadow-[4px_0_24px_rgba(0,0,0,0.18)]' : 'shadow-[0_0_15px_rgba(0,0,0,0.05)]'
        } overflow-x-hidden ${isExpanded ? 'w-[170px]' : 'w-[56px]'}`}
      >
        <div className="relative h-12 px-2 flex items-center border-b border-slate-100 min-w-0 flex-shrink-0">
          <div className="flex-1 flex items-center min-w-0 px-1">
            <div 
              className={`relative w-8 h-8 flex items-center justify-center flex-shrink-0 ${sidebarShowToggleButton ? 'cursor-pointer group/logo' : ''}`}
              onClick={() => sidebarShowToggleButton && toggleSidebar && toggleSidebar()}
              title={sidebarShowToggleButton ? "Ghim / Bỏ ghim thanh menu" : ""}
            >
              <img 
                src={activeCompanyLogo} 
                alt={activeCompanyName} 
                className={`w-6 h-6 object-contain rounded-md transition-opacity duration-200 ${sidebarShowToggleButton ? 'group-hover/logo:opacity-0' : ''}`} 
              />
              {sidebarShowToggleButton && (
                <div className="absolute inset-0 bg-slate-100 rounded-lg flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-all text-slate-500 hover:text-primary hover:bg-slate-200">
                  <span className="material-symbols-outlined text-[18px] transform -scale-x-100">view_sidebar</span>
                </div>
              )}
            </div>
            
            <div className={`min-w-0 flex-1 flex flex-col justify-center ml-2.5 transition-opacity duration-200 overflow-hidden ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <h1 className={`font-extrabold ${nameFontSizeClass} text-blue-900 leading-tight tracking-tight`} title={activeCompanyName}>
                {activeCompanyName}
              </h1>
              <p className={`${sloganFontSizeClass} text-slate-500 font-bold uppercase mt-0.5 leading-none`} title={activeCompanySlogan}>
                {activeCompanySlogan}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 w-full px-2 mt-3 pb-4 space-y-3 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {navGroups.map((group, index) => (
            <div key={group.title || index} className="space-y-1">
              {group.title && (
                <div
                  className={`flex items-center justify-between mb-2 select-none px-1 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${group.collapsible !== false ? 'cursor-pointer hover:text-primary' : ''}`}
                  onClick={() => group.collapsible !== false && toggleGroup(group.title)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {(group as any).backPath && (
                      <NavLink
                        to={(group as any).backPath}
                        title={(group as any).backLabel || 'Quay lại'}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-primary hover:bg-blue-50 transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-[15px] font-bold">arrow_back</span>
                      </NavLink>
                    )}
                    <h3 className={`text-[11px] font-black uppercase tracking-wider truncate ${(group as any).backPath ? 'text-slate-800' : (group.collapsible !== false ? 'text-slate-500 hover:text-primary' : 'text-slate-700')}`}>
                      {group.title}
                    </h3>
                  </div>
                  {group.collapsible !== false && (
                    <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">
                      {collapsedGroups[group.title] ? 'expand_more' : 'expand_less'}
                    </span>
                  )}
                </div>
              )}

              <div className={`space-y-1 overflow-hidden transition-all duration-200 ${group.collapsible !== false && collapsedGroups[group.title] && isExpanded ? 'max-h-0 opacity-0' : 'max-h-[1200px] opacity-100'}`}>
                {group.items.map((item: any) => {
                  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                  const isTaskSection = (item.label === 'Công việc' || item.path.includes('task')) &&
                    (location.pathname === '/task-assignment' || location.pathname === '/my-tasks' || location.pathname === '/work-plan');
                  const isAttendanceSection = (item.label === 'Công và lương' || item.label === 'Chấm công') && location.pathname === '/attendance';
                  const isProjectsSection = item.label === 'Tất cả dự án' && location.pathname === '/projects';
                  const isMaterialsSection = item.label === 'Tổng kho' && location.pathname === '/materials';
                  const isCostPlanSection = (item.label === 'Vật tư & Chi phí' || item.path.includes('/cost-plan')) && location.pathname.includes('/cost-plan');
                  const isInventorySection = (item.label === 'Kho Dự án' || item.path.includes('/inventory')) && location.pathname.includes('/inventory');
                  const isPlanSection = (item.label === 'Kế hoạch' || item.path.includes('/plan')) && location.pathname.includes('/plan');
                  const isDocumentSection = (item.label === 'Quản lý hồ sơ' || item.label === 'Hồ sơ' || item.path.includes('/document-tracking') || item.path.includes('/documents')) && (location.pathname.includes('/document-tracking') || location.pathname.includes('/documents'));
                  const isPersonnelSection = (item.label === 'Nhân sự' || item.path.includes('/personnel')) && location.pathname.includes('/personnel');
                  const isParentActive = isTaskSection || isAttendanceSection || isProjectsSection || isMaterialsSection || isCostPlanSection || isInventorySection || isPlanSection || isDocumentSection || isPersonnelSection;
                  const isSubOpen = openSubMenus[item.label] ?? true;
                  
                  return (
                    <div key={item.path} className="space-y-0.5">
                      <div className="relative flex items-center">
                        <NavLink
                          to={item.path}
                          end={item.path === '/'}
                          aria-expanded={hasChildren ? isSubOpen : undefined}
                          aria-haspopup={hasChildren ? 'true' : undefined}
                          title={!isExpanded ? item.label : undefined}
                          onClick={() => {
                            if (hasChildren) {
                              if (isParentActive) {
                                toggleSubMenu(item.label);
                              } else {
                                setOpenSubMenus(prev => ({ ...prev, [item.label]: true }));
                              }
                            }
                          }}
                          className={({ isActive }) =>
                            `flex items-center rounded-lg text-xs transition-colors overflow-hidden whitespace-nowrap h-10 w-full px-1 gap-2 cursor-pointer select-none ${
                              isActive || isParentActive
                                ? 'text-primary bg-blue-100 font-bold shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold'
                            }`
                          }
                        >
                          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                          </div>
                          <span className={`truncate flex-1 font-semibold text-xs transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                            {item.label}
                          </span>
                        </NavLink>
                      </div>

                      {hasChildren && isExpanded && isSubOpen && (
                        <div className="pl-3.5 pr-1 py-0.5 space-y-1 border-l-2 border-blue-200/70 ml-5 my-0.5 transition-all">
                          {item.children.map((child: any) => {
                            const active = child.isActive 
                              ? child.isActive(location.pathname, location.search)
                              : location.pathname === child.path;
                            return (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                onClick={() => {
                                  setOpenSubMenus(prev => ({ ...prev, [item.label]: true }));
                                }}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] transition-all truncate select-none ${
                                  active 
                                    ? 'text-primary bg-blue-50 font-bold shadow-2xs border border-blue-200/80' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                                }`}
                              >
                                <span className={`material-symbols-outlined text-[14px] shrink-0 ${active ? 'text-primary' : 'text-slate-400'}`}>
                                  {child.icon}
                                </span>
                                <span className="truncate">{child.label}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          </nav>
        <div className="pt-3 pb-3 px-2 border-t border-slate-100 relative flex flex-col gap-1.5 flex-shrink-0">
            {/* User Profile */}
            <button
              type="button"
              onClick={() => navigate('/settings?tab=account')}
              title={!isExpanded ? (isSystemAdminUser ? "Cài đặt & Quản trị" : "Cài đặt & Tài khoản") : undefined}
              className="flex items-center rounded-lg transition-all overflow-hidden h-10 w-full px-1 gap-2 hover:bg-slate-100 cursor-pointer"
            >
              <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-slate-500 rounded-full overflow-hidden border border-slate-200 bg-slate-50">
                {userAvatarUrl && !avatarLoadFailed ? (
                  <img 
                    src={userAvatarUrl} 
                    alt={user?.name || "Avatar"} 
                    className="w-full h-full object-cover" 
                    onError={() => setAvatarLoadFailed(true)} 
                  />
                ) : (
                  <span className="material-symbols-outlined text-[20px] text-slate-500">person</span>
                )}
              </div>
              <div className={`text-left leading-tight flex-1 min-w-0 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <span className="block font-bold text-xs text-slate-800 truncate" title={user?.name}>
                  {user?.name ? user.name.trim().split(' ').pop() : (isSystemAdminUser ? 'Admin' : 'Nhân sự')}
                </span>
                <span className="block text-[10px] text-slate-500 truncate" title={user?.title}>{user?.title || (isSystemAdminUser ? 'Quản trị hệ thống' : 'Nhân viên')}</span>
              </div>
              {isExpanded && (
                <span className="material-symbols-outlined text-base text-slate-400 hover:text-primary shrink-0 mr-1">
                  settings
                </span>
              )}
            </button>
          </div>
      </aside>

      {/* Mobile Bottom Sheet Modal for All Features */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Bottom Sheet Card Panel */}
          <div 
            onTouchStart={(e) => {
              (e.currentTarget as any)._startY = e.touches[0].clientY;
            }}
            onTouchMove={(e) => {
              const startY = (e.currentTarget as any)._startY;
              if (startY && e.touches[0].clientY - startY > 60) {
                setIsMobileDrawerOpen(false);
              }
            }}
            className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col z-[101] animate-in slide-in-from-bottom duration-300 border-t border-slate-200 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
          >
            {/* Grab Handle Header */}
            <div 
              className="w-full flex flex-col items-center pt-3 pb-2 px-4 cursor-pointer border-b border-slate-100 select-none active:opacity-70 transition-opacity" 
              onClick={() => setIsMobileDrawerOpen(false)}
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mb-2 hover:bg-slate-400 transition-colors" />
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">apps</span>
                  <h3 className="font-bold text-sm text-slate-800">Tất cả tính năng</h3>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMobileDrawerOpen(false);
                  }}
                  className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            {/* Grid list of remaining features (excluding items already present on the bottom bar) */}
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4 custom-scrollbar">
              {(() => {
                const visibleBottomPaths = new Set(
                  (currentProject ? [
                    `/projects/${currentProject.id}/overview`,
                    `/projects/${currentProject.id}/tasks`,
                    `/projects/${currentProject.id}/cost-plan`,
                    `/projects/${currentProject.id}/documents`,
                  ] : [
                    '/dashboard',
                    '/projects',
                    '/my-tasks',
                    '/task-assignment',
                    '/task-assignment?tab=assigned',
                    defaultTaskPath,
                    '/document-tracking',
                    '/office-costs',
                  ])
                );

                return navGroups.map((group, idx) => {
                  const filteredItems = group.items.filter(item => !visibleBottomPaths.has(item.path));
                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={group.title || idx} className="space-y-2">
                      {group.title && (
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                          {group.title}
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2">
                        {filteredItems.map((item) => (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMobileDrawerOpen(false)}
                            className={({ isActive }) =>
                              `flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all text-center ${
                                isActive
                                  ? 'bg-blue-50 text-primary font-bold shadow-sm border border-blue-200'
                                  : 'bg-slate-50 text-slate-700 font-medium hover:bg-slate-100 border border-slate-100'
                              }`
                            }
                          >
                            <span className="material-symbols-outlined text-2xl mb-1 text-primary">{item.icon}</span>
                            <span className="text-[11px] leading-tight truncate w-full">{item.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Bottom Footer User Info & Logout */}
            {user && (
              <div className="mx-4 mt-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                    {userAvatarUrl && !avatarLoadFailed ? (
                      <img 
                        src={userAvatarUrl} 
                        alt={user.name || "Avatar"} 
                        className="w-full h-full object-cover" 
                        onError={() => setAvatarLoadFailed(true)} 
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[20px] text-slate-500">person</span>
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-800 truncate">{user.name || user.username}</div>
                    <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      <span>{user.role || 'Quản trị viên'}</span>
                      <span>•</span>
                      <span className="font-mono text-primary font-bold">v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <button
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      navigate('/settings?tab=account');
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
                    title="Cài đặt hệ thống"
                  >
                    <span className="material-symbols-outlined text-base text-slate-600">
                      settings
                    </span>
                    Cài đặt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Shown ONLY on screens <= 768px via css md:hidden) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(56px+env(safe-area-inset-bottom,0px))] bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] select-none">
        {(currentProject ? [
          { label: 'Tổng quan', path: `/projects/${currentProject.id}/overview`, icon: 'dashboard' },
          { label: 'Kế hoạch', path: `/projects/${currentProject.id}/plan`, icon: 'calendar_month' },
          { label: 'Công việc', path: `/projects/${currentProject.id}/tasks`, icon: 'fact_check' },
          { label: 'Chi phí', path: `/projects/${currentProject.id}/cost-plan`, icon: 'account_balance_wallet' },
          { label: 'Hồ sơ', path: `/projects/${currentProject.id}/documents`, icon: 'file_present' },
        ] : [
          { label: 'Tổng quan', path: '/dashboard', icon: 'analytics' },
          { label: 'Dự án', path: '/projects', icon: 'cell_tower' },
          { label: 'Công việc', path: defaultTaskPath, icon: 'checklist' },
          { label: 'Hồ sơ', path: '/document-tracking', icon: 'folder_managed' },
        ]).map((item) => {
          const isTask = (item.label === 'Công việc' || item.path.includes('task')) &&
            (location.pathname === '/task-assignment' || location.pathname === '/my-tasks' || location.pathname === '/work-plan');
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center h-[50px] py-0.5 px-1.5 rounded-lg transition-colors min-w-[48px] ${
                  isActive || isTask ? 'text-primary font-bold' : 'text-slate-500 font-medium hover:text-slate-800'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="text-[10px] leading-tight truncate max-w-[56px] mt-0.5">{item.label}</span>
            </NavLink>
          );
        })}

        {/* 5th Tab: Nút "Khác..." mở Bottom Sheet tất cả tính năng */}
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className={`flex flex-col items-center justify-center h-[50px] py-0.5 px-1.5 rounded-lg transition-colors min-w-[48px] ${
            isMobileDrawerOpen ? 'text-primary font-bold' : 'text-slate-500 font-medium hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">apps</span>
          <span className="text-[10px] leading-tight truncate max-w-[56px] mt-0.5">Khác...</span>
        </button>
      </div>

      
    </>
  );
};
