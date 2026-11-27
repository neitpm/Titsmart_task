import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { formatDate, formatPhoneNumber } from '../../pages/PersonnelPage';
import { Project, Task, ProjectExpense, InventoryTransaction } from '../../types';
import { cleanNotes } from '../../utils/cleanNotesUtils';

interface PersonnelOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: any | null;
  projects: Project[];
  tasks: Task[];
  expenses: ProjectExpense[];
  inventoryTransactions: InventoryTransaction[];
  fundRequests?: any[];
  onOpenEditModal?: (person: any) => void;
  onOpenQuickAssign?: (person: any) => void;
}

export const PersonnelOverviewModal: React.FC<PersonnelOverviewModalProps> = ({
  isOpen,
  onClose,
  person,
  projects,
  tasks,
  expenses,
  inventoryTransactions,
  fundRequests = [],
  onOpenEditModal,
  onOpenQuickAssign,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'tasks' | 'funds' | 'materials'>('overview');
  const [taskFilter, setTaskFilter] = useState<'all' | 'in_progress' | 'completed' | 'overdue'>('all');
  const [materialFilter, setMaterialFilter] = useState<'all' | 'tools' | 'materials'>('all');

  const personId = String(person?.id || '').trim().toLowerCase();
  const personUsername = String(person?.username || '').trim().toLowerCase();
  const personCode = String(person?.code || '').trim().toLowerCase();
  const personName = String(person?.name || '').trim().toLowerCase();

  // 1. DỰ ÁN CỦA NHÂN SỰ
  const assignedProjects = (person?.assignedProjects || []) as Array<{ code: string; name: string }>;

  // 2. TIẾN ĐỘ & CÔNG VIỆC CỦA NHÂN SỰ
  const personTasks = useMemo(() => {
    if (!person) return [];
    return tasks.filter(t => {
      if (t.isSectionHeader) return false;
      const assignedId = String(t.assignedEngineerId || '').trim().toLowerCase();
      const assignedName = String(t.assignedEngineerName || '').trim().toLowerCase();

      if (personId && assignedId === personId) return true;
      if (personUsername && assignedId === personUsername) return true;
      if (personCode && assignedId === personCode) return true;
      if (personName && assignedName === personName) return true;
      if (personName && assignedName && (assignedName.includes(personName) || personName.includes(assignedName))) return true;

      return false;
    });
  }, [tasks, person, personId, personUsername, personCode, personName]);

  const todayStr = new Date().toISOString().split('T')[0];
  const completedTasks = personTasks.filter(t => t.isDone || t.status === 'Hoàn thành' || (t.progress !== undefined && t.progress >= 1));
  const inProgressTasks = personTasks.filter(t => !t.isDone && t.status !== 'Hoàn thành' && (t.status === 'Đang làm' || (t.progress !== undefined && t.progress > 0 && t.progress < 1)));
  const overdueTasks = personTasks.filter(t => {
    if (t.isDone || t.status === 'Hoàn thành' || (t.progress !== undefined && t.progress >= 1)) return false;
    if (!t.dueDate) return false;
    return String(t.dueDate).split('T')[0] < todayStr;
  });

  const taskCompletionRate = personTasks.length > 0 
    ? Math.round((completedTasks.length / personTasks.length) * 100) 
    : 0;

  const avgTaskProgress = personTasks.length > 0
    ? Math.round(personTasks.reduce((sum, t) => sum + (t.isDone || t.status === 'Hoàn thành' ? 100 : Math.round((t.progress || 0) * 100)), 0) / personTasks.length)
    : 0;

  // 3. QUỸ & CHI PHÍ CỦA NHÂN SỰ
  const personExpenses = useMemo(() => {
    if (!person) return [];
    return expenses.filter(exp => {
      const spName = String(exp.spenderName || '').trim().toLowerCase();
      const crName = String(exp.createdByName || '').trim().toLowerCase();
      if (personName && (spName === personName || spName.includes(personName) || personName.includes(spName))) return true;
      if (personName && (crName === personName || crName.includes(personName))) return true;
      return false;
    });
  }, [expenses, person, personName]);

  const totalFundReceived = personExpenses.reduce((sum, e) => sum + (Number(e.incomeAmount) || 0), 0);
  const totalFundSpent = personExpenses.reduce((sum, e) => sum + (Number(e.totalAmount) || 0), 0);
  const currentFundBalance = totalFundReceived - totalFundSpent;

  // Đơn cấp quỹ liên quan đến nhân sự
  const personFundRequests = useMemo(() => {
    if (!person) return [];
    return fundRequests.filter(fr => {
      const crName = String(fr.creatorName || '').trim().toLowerCase();
      const crId = String(fr.creatorId || '').trim().toLowerCase();
      if (personId && crId === personId) return true;
      if (personName && (crName === personName || crName.includes(personName) || personName.includes(crName))) return true;
      return false;
    });
  }, [fundRequests, person, personId, personName]);

  // 4. VẬT TƯ & ĐỒ NGHỀ ĐANG SỬ DỤNG
  const personMaterialsAndTools = useMemo(() => {
    if (!person) return [];
    return inventoryTransactions.filter(tx => {
      if (tx.type !== 'EXPORT') return false;
      if (tx.receiverId && tx.receiverId === person.id) return true;
      const recName = String(tx.receiverName || '').trim().toLowerCase();
      const notes = String(tx.notes || '').trim().toLowerCase();
      if (personName && (recName === personName || recName.includes(personName) || personName.includes(recName))) return true;
      if (personName && notes.includes(personName)) return true;
      return false;
    });
  }, [inventoryTransactions, person, personName]);

  const isEquipmentOrTool = (tx: InventoryTransaction) => {
    if (tx.isAsset) return true;
    const text = `${tx.category || ''} ${tx.materialName || ''} ${tx.specs || ''} ${tx.notes || ''}`.toLowerCase();
    return text.includes('đồ nghề') || text.includes('thiết bị') || text.includes('công cụ') || text.includes('dụng cụ') || text.includes('máy') || text.includes('khoan') || text.includes('thước') || text.includes('búa') || text.includes('kìm');
  };

  const toolCount = personMaterialsAndTools.filter(isEquipmentOrTool).length;
  const inCustodyCount = personMaterialsAndTools.filter(tx => (tx.isAsset || isEquipmentOrTool(tx)) && tx.custodyStatus !== 'RETURNED').length;
  const materialCount = personMaterialsAndTools.length - toolCount;

  // Lọc tác vụ hiển thị
  const filteredTasks = personTasks.filter(t => {
    if (taskFilter === 'completed') return t.isDone || t.status === 'Hoàn thành' || (t.progress !== undefined && t.progress >= 1);
    if (taskFilter === 'in_progress') return !t.isDone && t.status !== 'Hoàn thành' && (t.status === 'Đang làm' || (t.progress !== undefined && t.progress > 0 && t.progress < 1));
    if (taskFilter === 'overdue') {
      if (t.isDone || t.status === 'Hoàn thành' || (t.progress !== undefined && t.progress >= 1)) return false;
      return t.dueDate && String(t.dueDate).split('T')[0] < todayStr;
    }
    return true;
  });

  // Lọc vật tư/đồ nghề
  const filteredMaterials = personMaterialsAndTools.filter(tx => {
    if (materialFilter === 'tools') return isEquipmentOrTool(tx);
    if (materialFilter === 'materials') return !isEquipmentOrTool(tx);
    return true;
  });

  if (!person) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
      requireConfirmOnClose={false}
    >
      <div className="flex flex-col max-h-[85vh] overflow-hidden -m-1 bg-white">
        {/* Profile Header: Nền sáng chuẩn TITSMART ERP, viền mảnh, không gradient đen/tối */}
        <div className="bg-white border-b border-slate-200 p-4 sm:p-5 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                {person.avatar ? (
                  <img src={person.avatar} alt={person.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-400">person</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{person.name}</h2>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-100 text-slate-700 border border-slate-200">
                    {person.code}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    person.locked ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {person.locked ? 'Bị khóa' : 'Đang hoạt động'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-primary font-bold">{person.departmentName || (person as any).department || 'Chưa phân phòng'}</span>
                  <span>•</span>
                  <span>{person.role || 'Nhân viên'}</span>
                  <span>•</span>
                  <span>{formatPhoneNumber(person.phone)}</span>
                  {person.email && (
                    <>
                      <span>•</span>
                      <span className="text-slate-500">{person.email}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              {onOpenQuickAssign && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenQuickAssign(person);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">add_task</span>
                  <span>Giao việc nhanh</span>
                </button>
              )}
              {onOpenEditModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditModal(person);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-slate-500">edit</span>
                  <span>Chỉnh sửa hồ sơ</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-100 overflow-x-auto custom-scrollbar">
            {[
              { id: 'overview', label: 'Tổng quan', icon: 'dashboard' },
              { id: 'projects', label: `Dự án (${assignedProjects.length})`, icon: 'folder' },
              { id: 'tasks', label: `Tiến độ công việc (${personTasks.length})`, icon: 'task_alt' },
              { id: 'funds', label: 'Quỹ & Chi phí', icon: 'payments' },
              { id: 'materials', label: `Vật tư & Đồ nghề (${personMaterialsAndTools.length})`, icon: 'handyman' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border ${
                  activeTab === tab.id
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar bg-slate-50 space-y-4">
          
          {/* TAB 1: TỔNG QUAN HỒ SƠ */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Segmented KPI Bar - Chuẩn bảng điều khiển phẳng, gọn, không dùng khối card nổi lớn */}
              <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-2xs">
                <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  {/* 1. Dự án */}
                  <div 
                    onClick={() => setActiveTab('projects')}
                    className="p-2.5 hover:bg-slate-50 transition-colors cursor-pointer group rounded"
                  >
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                      <span>Dự án tham gia</span>
                      <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary">arrow_forward</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-extrabold text-slate-900 tabular-nums">{assignedProjects.length}</span>
                      <span className="text-[11px] text-slate-500">dự án</span>
                    </div>
                  </div>

                  {/* 2. Tiến độ nhiệm vụ */}
                  <div 
                    onClick={() => setActiveTab('tasks')}
                    className="p-2.5 hover:bg-slate-50 transition-colors cursor-pointer group rounded"
                  >
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                      <span>Tiến độ nhiệm vụ</span>
                      <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary">arrow_forward</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-extrabold text-slate-900 tabular-nums">{taskCompletionRate}%</span>
                      <span className="text-[11px] text-slate-500 font-medium">({completedTasks.length}/{personTasks.length} việc)</span>
                    </div>
                  </div>

                  {/* 3. Quỹ tiền mặt */}
                  <div 
                    onClick={() => setActiveTab('funds')}
                    className="p-2.5 hover:bg-slate-50 transition-colors cursor-pointer group rounded"
                  >
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                      <span>Số dư quỹ tạm ứng</span>
                      <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary">arrow_forward</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className={`text-xl font-extrabold tabular-nums ${currentFundBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {currentFundBalance.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>

                  {/* 4. Vật tư & Đồ nghề */}
                  <div 
                    onClick={() => setActiveTab('materials')}
                    className="p-2.5 hover:bg-slate-50 transition-colors cursor-pointer group rounded"
                  >
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                      <span>Vật tư & Thiết bị</span>
                      <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary">arrow_forward</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-extrabold text-slate-900 tabular-nums">{personMaterialsAndTools.length}</span>
                      <span className="text-[11px] text-slate-500">mục ({toolCount} đồ nghề)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tiến độ trung bình */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Tổng tiến độ hoàn thành công việc được giao</span>
                  <span className="font-extrabold text-primary tabular-nums">{avgTaskProgress}% (TB tiến độ)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  <div style={{ width: `${taskCompletionRate}%` }} className="bg-emerald-500 h-full" title={`Hoàn thành: ${taskCompletionRate}%`} />
                  <div style={{ width: `${personTasks.length > 0 ? (inProgressTasks.length / personTasks.length) * 100 : 0}%` }} className="bg-blue-500 h-full" title="Đang làm" />
                  <div style={{ width: `${personTasks.length > 0 ? (overdueTasks.length / personTasks.length) * 100 : 0}%` }} className="bg-rose-500 h-full" title="Quá hạn" />
                </div>
                <div className="flex items-center gap-4 text-[11px] pt-0.5">
                  <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Hoàn thành ({completedTasks.length})</span>
                  <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Đang làm ({inProgressTasks.length})</span>
                  <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Quá hạn ({overdueTasks.length})</span>
                </div>
              </div>

              {/* Quick Summary Grid (Projects & Recent Tasks) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {/* Dự án gần nhất */}
                <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-500 text-base">folder</span>
                      <span>Dự án đang phụ trách ({assignedProjects.length})</span>
                    </h3>
                    <button onClick={() => setActiveTab('projects')} className="text-primary text-[11px] font-bold hover:underline cursor-pointer">Xem tất cả</button>
                  </div>
                  {assignedProjects.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs italic">Chưa được gán dự án nào</div>
                  ) : (
                    <div className="space-y-2 flex-1">
                      {assignedProjects.slice(0, 4).map((proj, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-800 truncate">{proj.name}</div>
                            <span className="text-[10px] font-mono text-primary font-bold">{proj.code}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">Tham gia</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Công việc cần chú ý / Đang làm */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-600 text-base">pending_actions</span>
                      Công việc đang thực hiện ({inProgressTasks.length + overdueTasks.length})
                    </h3>
                    <button onClick={() => setActiveTab('tasks')} className="text-primary text-[11px] font-bold hover:underline">Xem tất cả</button>
                  </div>
                  {personTasks.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs italic">Chưa có công việc nào được giao</div>
                  ) : (
                    <div className="space-y-2 flex-1">
                      {personTasks
                        .filter(t => !t.isDone && t.status !== 'Hoàn thành')
                        .slice(0, 4)
                        .map((task) => {
                          const isOverdue = task.dueDate && String(task.dueDate).split('T')[0] < todayStr;
                          return (
                            <div key={task.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-xs text-slate-800 truncate" title={task.name}>{task.name}</div>
                                <div className="text-[10.5px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span className="font-semibold text-slate-600">{task.projectCode || task.projectName}</span>
                                  {task.dueDate && (
                                    <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                                      Hạn: {formatDate(task.dueDate)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                isOverdue ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {isOverdue ? 'Trễ hạn' : `${Math.round((task.progress || 0) * 100)}%`}
                              </span>
                            </div>
                          );
                        })}
                      {personTasks.filter(t => !t.isDone && t.status !== 'Hoàn thành').length === 0 && (
                        <div className="py-6 text-center text-emerald-600 text-xs font-semibold">Tất cả công việc đã hoàn thành tốt đẹp! 🎉</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DANH SÁCH DỰ ÁN */}
          {activeTab === 'projects' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  Danh sách {assignedProjects.length} dự án {person.name} tham gia
                </h3>
              </div>
              {assignedProjects.length === 0 ? (
                <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-400 text-xs italic">
                  Nhân sự này chưa được phân công vào dự án nào.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {assignedProjects.map((proj, idx) => {
                    const fullProj = projects.find(p => p.code === proj.code || p.name === proj.name || p.id === proj.code);
                    const projTasks = personTasks.filter(t => t.projectCode === proj.code || t.projectName === proj.name);
                    const projDoneTasks = projTasks.filter(t => t.isDone || t.status === 'Hoàn thành');

                    return (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono text-[10px] font-bold text-primary px-2 py-0.5 rounded bg-blue-50 border border-blue-100">
                              {proj.code}
                            </span>
                            <h4 className="font-extrabold text-sm text-slate-900 mt-1.5 leading-snug">{proj.name}</h4>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                            {fullProj?.status || 'Đang triển khai'}
                          </span>
                        </div>

                        {fullProj?.managerName && (
                          <div className="text-[11px] text-slate-500">
                            Quản lý dự án: <b className="text-slate-700">{fullProj.managerName}</b>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                          <span>Nhiệm vụ tại dự án: <b>{projDoneTasks.length}/{projTasks.length}</b> xong</span>
                          <span className="font-bold text-primary">
                            {projTasks.length > 0 ? `${Math.round((projDoneTasks.length / projTasks.length) * 100)}%` : 'Chưa giao'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TIẾN ĐỘ & CÔNG VIỆC */}
          {activeTab === 'tasks' && (
            <div className="space-y-3">
              {/* Task Filter Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                  {[
                    { id: 'all', label: `Tất cả (${personTasks.length})` },
                    { id: 'in_progress', label: `Đang làm (${inProgressTasks.length})` },
                    { id: 'completed', label: `Đã xong (${completedTasks.length})` },
                    { id: 'overdue', label: `Quá hạn (${overdueTasks.length})` },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setTaskFilter(tab.id as any)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        taskFilter === tab.id ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <tr>
                        <th className="p-2.5 text-center w-10">STT</th>
                        <th className="p-2.5">Dự án</th>
                        <th className="p-2.5">Tên công việc</th>
                        <th className="p-2.5 text-center">Tiến độ</th>
                        <th className="p-2.5">Trạng thái</th>
                        <th className="p-2.5">Thời hạn</th>
                        <th className="p-2.5">Người giao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 italic">Không có công việc nào theo điều kiện lọc</td>
                        </tr>
                      ) : (
                        filteredTasks.map((t, idx) => {
                          const isDone = t.isDone || t.status === 'Hoàn thành' || (t.progress !== undefined && t.progress >= 1);
                          const isOverdue = !isDone && t.dueDate && String(t.dueDate).split('T')[0] < todayStr;
                          const progVal = isDone ? 100 : Math.round((t.progress || 0) * 100);
                          const displayNote = cleanNotes(t.notes || '');

                          return (
                            <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700">
                                  {t.projectCode || t.projectName || '-'}
                                </span>
                              </td>
                              <td className="p-2.5">
                                <div className="font-bold text-slate-900 leading-snug">{t.name}</div>
                                {displayNote && <div className="text-[10px] text-slate-400 truncate max-w-xs">{displayNote}</div>}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center gap-1.5 justify-center">
                                  <div className="w-12 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div style={{ width: `${progVal}%` }} className={`h-full ${isDone ? 'bg-emerald-500' : progVal > 0 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                  </div>
                                  <span className="font-bold text-[11px] text-slate-700">{progVal}%</span>
                                </div>
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  isOverdue ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  progVal > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                  {isOverdue ? 'Quá hạn' : (t.status || (isDone ? 'Hoàn thành' : 'Chưa làm'))}
                                </span>
                              </td>
                              <td className="p-2.5 whitespace-nowrap text-[11px]">
                                {t.dueDate ? (
                                  <span className={isOverdue ? 'font-bold text-rose-600' : 'text-slate-600'}>
                                    {formatDate(t.dueDate)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Chưa đặt</span>
                                )}
                              </td>
                              <td className="p-2.5 whitespace-nowrap text-slate-600 text-[11px]">
                                {t.assignerName || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: QUỸ & CHI PHÍ */}
          {activeTab === 'funds' && (
            <div className="space-y-4">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Tổng quỹ nhận vào</div>
                  <div className="text-xl font-black text-emerald-600 mt-1">
                    {totalFundReceived.toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Tiền nạp / nhận từ công ty</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Tổng chi phí đã chi</div>
                  <div className="text-xl font-black text-rose-600 mt-1">
                    {totalFundSpent.toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{personExpenses.length} khoản chi phí</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Số dư quỹ hiện tại</div>
                  <div className={`text-xl font-black mt-1 ${currentFundBalance < 0 ? 'text-rose-600' : 'text-primary'}`}>
                    {currentFundBalance.toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Số tiền đang giữ trong tay</div>
                </div>
              </div>

              {/* Expense History Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                    Nhật ký chi tiêu & Cấp quỹ ({personExpenses.length} bản ghi)
                  </h4>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <tr>
                        <th className="p-2.5 text-center w-10">STT</th>
                        <th className="p-2.5">Ngày</th>
                        <th className="p-2.5">Dự án</th>
                        <th className="p-2.5">Nội dung chi / nhận</th>
                        <th className="p-2.5 text-right">Nhận quỹ (+)</th>
                        <th className="p-2.5 text-right">Chi ra (-)</th>
                        <th className="p-2.5">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {personExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 italic">Chưa có giao dịch chi phí hay nhận quỹ nào được ghi nhận</td>
                        </tr>
                      ) : (
                        personExpenses.map((exp, idx) => (
                          <tr key={exp.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 whitespace-nowrap text-[11px] text-slate-600">{formatDate(exp.date)}</td>
                            <td className="p-2.5 whitespace-nowrap font-mono font-bold text-[10px] text-primary">{exp.projectCode || '-'}</td>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-900 leading-snug">{exp.content || exp.description || '-'}</div>
                            </td>
                            <td className="p-2.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                              {exp.incomeAmount ? `+${Number(exp.incomeAmount).toLocaleString('vi-VN')} đ` : '-'}
                            </td>
                            <td className="p-2.5 text-right font-bold text-rose-600 whitespace-nowrap">
                              {exp.totalAmount ? `-${Number(exp.totalAmount).toLocaleString('vi-VN')} đ` : '-'}
                            </td>
                            <td className="p-2.5 text-[11px] text-slate-500 max-w-xs truncate">{exp.notes || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fund Requests by Person */}
              {personFundRequests.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-3 border-b border-slate-100">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                      Đơn đề nghị cấp quỹ đã tạo ({personFundRequests.length} đơn)
                    </h4>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                        <tr>
                          <th className="p-2.5">Ngày cần</th>
                          <th className="p-2.5">Mục đích</th>
                          <th className="p-2.5 text-right">Số tiền</th>
                          <th className="p-2.5">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {personFundRequests.map((fr, idx) => (
                          <tr key={fr.id || idx} className="hover:bg-slate-50">
                            <td className="p-2.5 whitespace-nowrap text-[11px]">{formatDate(fr.neededDate || fr.createdAt)}</td>
                            <td className="p-2.5 font-bold text-slate-900">{fr.purpose || '-'}</td>
                            <td className="p-2.5 text-right font-black text-blue-600 whitespace-nowrap">
                              {Number(fr.amount || 0).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {fr.status || 'Đang xử lý'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: VẬT TƯ & ĐỒ NGHỀ ĐANG SỬ DỤNG */}
          {activeTab === 'materials' && (
            <div className="space-y-3">
              {/* Material Filter Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                  {[
                    { id: 'all', label: `Tất cả (${personMaterialsAndTools.length})` },
                    { id: 'tools', label: `Đồ nghề & Thiết bị (${toolCount})` },
                    { id: 'materials', label: `Vật tư công trình (${materialCount})` },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setMaterialFilter(tab.id as any)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        materialFilter === tab.id ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-500 font-medium">Danh sách các vật tư, thiết bị đã xuất cho nhân sự nhận</span>
              </div>

              {/* Material Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <tr>
                        <th className="p-2.5 text-center w-10">STT</th>
                        <th className="p-2.5">Ngày nhận</th>
                        <th className="p-2.5">Phân loại</th>
                        <th className="p-2.5">Tên vật tư / Đồ nghề</th>
                        <th className="p-2.5">Quy cách / Mã</th>
                        <th className="p-2.5 text-right">Số lượng</th>
                        <th className="p-2.5 text-center">ĐVT</th>
                        <th className="p-2.5">Dự án sử dụng</th>
                        <th className="p-2.5 text-center">Quyền sở hữu</th>
                        <th className="p-2.5 text-center">Trạng thái</th>
                        <th className="p-2.5">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredMaterials.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-slate-400 italic">
                            Chưa có dữ liệu vật tư hay đồ nghề nào được xuất cho nhân sự này
                          </td>
                        </tr>
                      ) : (
                        filteredMaterials.map((tx, idx) => {
                          const isTool = isEquipmentOrTool(tx);
                          const isReturned = tx.custodyStatus === 'RETURNED';
                          return (
                            <tr key={tx.id || idx} className={`hover:bg-slate-50 transition-colors ${isReturned ? 'bg-slate-50/60 opacity-75' : ''}`}>
                              <td className="p-2.5 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-2.5 whitespace-nowrap text-[11px] text-slate-600">{formatDate(tx.date)}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  tx.isAsset ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' :
                                  isTool ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {tx.isAsset ? 'Tài sản Cấp phát' : isTool ? 'Đồ nghề / Thiết bị' : 'Vật tư'}
                                </span>
                              </td>
                              <td className="p-2.5 font-bold text-slate-900 leading-snug">
                                {tx.materialName}
                              </td>
                              <td className="p-2.5 text-[11px] text-slate-500 font-mono">
                                {tx.specs || tx.materialCode || '-'}
                              </td>
                              <td className="p-2.5 text-right font-extrabold text-slate-900 whitespace-nowrap">
                                {tx.quantity}
                              </td>
                              <td className="p-2.5 text-center text-slate-500">{tx.unit}</td>
                              <td className="p-2.5 whitespace-nowrap font-mono font-bold text-[10px] text-primary">
                                {tx.sourceOrProject || '-'}
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-700">
                                  Của Công Ty
                                </span>
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                {isReturned ? (
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                                    Đã trả kho
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                                    Đang nắm giữ
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-[11px] text-slate-500 max-w-xs truncate">{tx.notes || '-'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white p-3 border-t border-slate-200 flex justify-between items-center rounded-b-xl">
          <div className="text-[11px] text-slate-400">
            Dữ liệu tổng hợp Realtime từ Dự án, Tiến độ, Kế toán Quỹ và Kho vật tư.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all active:scale-95 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
