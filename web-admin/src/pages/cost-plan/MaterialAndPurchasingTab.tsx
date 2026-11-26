import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useRealtimeStore } from '../../services/realtimeStore';
import { ProjectMaterialPlan, ProjectPurchasing, getStatusColorStyle, getTextColorStyle, PURCHASE_STATUS_OPTIONS, CONSTRUCTION_STATUS_OPTIONS } from '../../types';
import { CustomSelect } from '@/components/common/CustomSelect';
import { compareTaskStt, formatSectionTitle } from '../../utils/taskTreeUtils';
import { decodeModels, encodeModels, ModelEntry } from './DocumentCertificateTab';
import { FastDocModal } from './FastDocModal';
import { DocumentCertificateTab } from './DocumentCertificateTab';
import { AuditInfoCell } from '../../components/common/AuditInfoCell';
import { stripDiscussionThread } from '../../utils/taskDiscussion';
import { Toast } from '../../components/common/Toast';
import { useUIStore } from '../../services/uiStore';
import { ImportExportDropdown } from '../../components/common/ImportExportDropdown';
import { PurchaseRequestModal } from '../../components/purchasing/PurchaseRequestModal';
import { PurchaseRequestListModal } from '../../components/purchasing/PurchaseRequestListModal';
import { api } from '../../services/apiSupabase';
import { useAuthStore } from '../../services/authStore';
import { PurchaseRequest } from '../../types';
import { useTableColumnResize } from '../../services/useTableColumnResize';
import { ColumnResizeHandle } from '../../components/common/ColumnResizeHandle';
import { StandardFilterToolbar } from '../../components/common/StandardFilterToolbar';

interface MaterialAndPurchasingTabProps {
  activeSubTab?: 'TECH' | 'ORDER' | 'DOCS' | 'FINANCE';
  data: ProjectMaterialPlan[];
  purchasingData: ProjectPurchasing[];
  onEditMaterial: (plan: ProjectMaterialPlan) => void;
  onEditPurchasing: (plan: ProjectPurchasing, subTab: 'FINANCE') => void;
  onDelete: (id: string) => void;
  onUpdateMaterial: (id: string, plan: Partial<ProjectMaterialPlan>) => void | Promise<void>;
  onUpdatePurchasing: (id: string, plan: Partial<ProjectPurchasing>) => void | Promise<void>;
  onAddSubtask?: (plan: ProjectMaterialPlan, suggestedStt?: string) => void;
  onAddSection?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  userRole?: string;
  selectedProject: string;
  onAddMaterial: (plan: any) => void;
  onExportExcel?: () => void;
  onImportClick?: () => void;
}

const TEXT = {
  search: 'Tìm theo nội dung công việc, vật tư, ghi chú...',
  statusFilter: 'Lọc trạng thái:',
  all: 'Tất cả',
  notStarted: 'Chưa thi công',
  doing: 'Đang thi công',
  done: 'Đã hoàn thành',
  empty: 'Không có hạng mục nào phù hợp với bộ lọc đã chọn',
  edit: 'Chỉnh sửa',
  confirmDelete: 'Xóa hạng mục kế hoạch vật tư này?',
};

const isParentRow = (plan: any) => {
  if (plan?.isSec || plan?.isSectionHeader) return true;
  if (String(plan?.notes || '').toLowerCase().includes('[section]')) return true;
  const stt = String(plan?.stt || '').trim();
  if (/^[A-Z]{1,2}$/i.test(stt)) return true;
  if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/i.test(stt)) return true;

  const vol = Number(plan?.contractVolume ?? plan?.volume ?? 0);
  const unitVal = String(plan?.unit || '').trim();
  const text = String(plan?.jobContent || plan?.content || plan?.name || '').trim();

  // If ends with colon (e.g. "TỦ BAO GỒM:") and has no volume/unit, it's definitely a section/group header
  if (text.endsWith(':') && (vol === 0 || !vol) && (unitVal === '' || unitVal === '-')) return true;

  // If has no volume and no unit
  if ((vol === 0 || !vol) && (unitVal === '' || unitVal === '-')) {
    // Top-level without dot (e.g. 33, 34)
    if (!stt.includes('.')) return true;
    // Sub-level with single dot (e.g. 33.1, 1.1)
    if (/^\d+\.\d+$/.test(stt)) return true;
    // Uppercase text header
    if (text === text.toUpperCase() && /[A-ZÀ-Ỹ]/.test(text)) return true;
  }
  return false;
};

const isRootSectionRow = (plan: ProjectMaterialPlan) => {
  const stt = String(plan.stt || '').trim().toUpperCase();
  if (stt.includes('.')) return false;
  return /^[A-Z]{1,2}$/.test(stt) || /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/i.test(stt) || (isParentRow(plan) && !plan.parentId);
};

const cleanNotes = (value?: string) => {
  return stripDiscussionThread(String(value || ''))
    .replace(/\[order:[\d.]+\]/g, '')
    .replace(/\[section\]/gi, '')
    .replace(/\[contractor\]/gi, '')
    .replace(/\[tech-status:[^\]]+\]/gi, '')
    .replace(/\[STATUS:[^\]]+\]/gi, '')
    .replace(/\[owner\]/gi, '').replace(/\[doc-track\]/gi, '').replace(/\[doc-track\s*]/gi, '')
    .replace(/Nhà thầu cung cấp/gi, '')
    .replace(/Chủ đầu tư cung cấp/gi, '')
    .replace(/Import từ phụ lục dự án/gi, '')
    .replace(/Đồng bộ từ phụ lục khi tạo dự án/gi, '')
    .split('[DOC-NOTE]')[0]
    .split('|')
    .map(s => s.trim())
    .filter(s => Boolean(s) && !s.startsWith('{') && !s.includes('"senderId"') && s !== ']')
    .join(' | ');
};

const getIssueContentText = (val?: string) => {
  const parts = String(val || '').split('[DOC-DATA]');
  // If there's no [DOC-DATA], and the string is valid JSON, then it's all JSON (no text).
  if (parts.length === 1) {
    try {
      JSON.parse(parts[0]);
      return ''; // It's all JSON, so text is empty
    } catch (e) {
      return parts[0]; // Not JSON, so it's all text
    }
  }
  return parts[0];
};

const getIssueContentData = (val?: string) => {
  const parts = String(val || '').split('[DOC-DATA]');
  if (parts.length > 1) return parts[1];
  try {
    JSON.parse(parts[0]);
    return parts[0];
  } catch (e) {
    return '';
  }
};

const getTechNote = (val?: string) => stripDiscussionThread(String(val || '')).split('[DOC-NOTE]')[0];
const getDocNoteFull = (val?: string) => {
  const parts = stripDiscussionThread(String(val || '')).split('[DOC-NOTE]');
  return parts.length > 1 ? parts[1] : '';
};
const getDocNote = (val?: string) => getDocNoteFull(val).split('[DOC-FILENAME]')[0].trim();
const getDocFileName = (val?: string) => {
  const parts = getDocNoteFull(val).split('[DOC-FILENAME]');
  return parts.length > 1 ? parts[1].trim() : '';
};
const cleanTechNotes = (val?: string) => cleanNotes(getTechNote(val));
const cleanDocNotes = (val?: string) => cleanNotes(getDocNote(val));


const showNumber = (value?: number) => {
  const n = Number(value || 0);
  return n ? n.toLocaleString('vi-VN') : '';
};

const showPercent = (value?: number) => {
  if (value === null || value === undefined) return '-';
  const n = Number(value);
  const val = (n > 0 && n <= 1) ? n * 100 : n;
  return `${Math.round(val * 100) / 100}%`;
};

const hasDocFiles = (plan: ProjectMaterialPlan, type: 'CO' | 'CQ' | 'PCCC' | 'STAMP'): boolean => {
  if (!plan.issueContent || !plan.issueContent.includes('[DOC-DATA]')) return false;
  try {
    const models = decodeModels(plan.issueContent);
    return models.some(m => m.docs.some(d => {
      // Allow empty files to show the badge
      // if (!d.fileUrls || d.fileUrls.length === 0) return false;
      const lower = (d.text || '').toLowerCase();
      if (type === 'CO') return lower.includes('co') || lower.includes('c/o');
      if (type === 'CQ') return lower.includes('cq') || lower.includes('c/q');
      if (type === 'PCCC') return lower.includes('pccc') || lower.includes('phòng cháy');
      if (type === 'STAMP') return lower.includes('tem') || lower.includes('kiểm định') || lower.includes('stamp') || lower.includes('tkd');
      return false;
    }));
  } catch { return false; }
};

const getCustomDocs = (plan: ProjectMaterialPlan): string[] => {
  if (!plan.issueContent || !plan.issueContent.includes('[DOC-DATA]')) return [];
  try {
    const models = decodeModels(plan.issueContent);
    const customTypes = new Set<string>();
    models.forEach(m => {
      m.docs.forEach(d => {
        // Allow empty files to show the badge
        // if (!d.fileUrls || d.fileUrls.length === 0) return;
        const lower = (d.text || '').toLowerCase();
        const isCO = lower.includes('co') || lower.includes('c/o');
        const isCQ = lower.includes('cq') || lower.includes('c/q');
        const isPCCC = lower.includes('pccc') || lower.includes('phòng cháy');
        const isSTAMP = lower.includes('tem') || lower.includes('kiểm định') || lower.includes('stamp') || lower.includes('tkd');
        if (!isCO && !isCQ && !isPCCC && !isSTAMP && d.text) {
          customTypes.add(d.text);
        }
      });
    });
    return Array.from(customTypes);
  } catch { return []; }
};

const renderAutoFilesByType = (plan: ProjectMaterialPlan, type: string, onFileClick?: (url: string, title: string) => void) => {
  if (!plan.issueContent || !plan.issueContent.includes('[DOC-DATA]')) return null;
  try {
    const models = decodeModels(plan.issueContent);
    const links: React.ReactNode[] = [];
    let counter = 0;
    models.forEach(m => {
      m.docs.forEach(d => {
        // Allow empty files to show the badge
        // if (!d.fileUrls || d.fileUrls.length === 0) return;
        const lower = (d.text || '').toLowerCase();
        let docTypeMatches = false;
        if (type === 'CO' && (lower.includes('co') || lower.includes('c/o'))) docTypeMatches = true;
        else if (type === 'CQ' && (lower.includes('cq') || lower.includes('c/q'))) docTypeMatches = true;
        else if (type === 'PCCC' && (lower.includes('pccc') || lower.includes('phòng cháy'))) docTypeMatches = true;
        else if (type === 'STAMP' && (lower.includes('tem') || lower.includes('kiểm định') || lower.includes('stamp') || lower.includes('tkd'))) docTypeMatches = true;
        else if (!['CO', 'CQ', 'PCCC', 'STAMP'].includes(type) && d.text === type) docTypeMatches = true;
        
        if (docTypeMatches && d.fileUrls) {
          d.fileUrls.forEach(url => {
             counter++;
             links.push(
               <button
                 key={`f-${counter}`}
                 type="button"
                 onClick={(e) => { e.stopPropagation(); onFileClick ? onFileClick(url, d.text || type) : window.open(url, '_blank'); }}
                 className="text-blue-500 hover:text-blue-700 transition-colors flex items-center justify-center cursor-pointer"
                 title={d.text || type}
               >
                 <span className="material-symbols-outlined text-[16px]">description</span>
               </button>
             );
          });
        }
      });
    });
    return links.length > 0 ? <div className="flex flex-wrap items-center gap-1.5">{links}</div> : null;
  } catch (e) { return null; }
};


const MultiDocSelect = ({ plan, onBadgeClick, onFileClick, disabled }: { plan: any, onBadgeClick: (plan: any, type: string) => void, onFileClick: (url: string, title: string) => void, disabled: boolean }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (type: string) => {
    setIsOpen(false);
    onBadgeClick(plan, type);
  };

  return (
    <div className="relative w-full h-full group/docs" ref={containerRef}>
      <div 
        className={`flex flex-row flex-wrap gap-x-3 gap-y-2 p-1.5 pr-6 w-full items-start justify-center min-h-[34px] h-full ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {plan.docCo && (
          <div className="flex flex-col items-center gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); onBadgeClick(plan, 'CO'); }} className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 cursor-pointer transition">CO</button>
            {renderAutoFilesByType(plan, 'CO', onFileClick)}
          </div>
        )}
        {plan.docCq && (
          <div className="flex flex-col items-center gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); onBadgeClick(plan, 'CQ'); }} className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 cursor-pointer transition">CQ</button>
            {renderAutoFilesByType(plan, 'CQ', onFileClick)}
          </div>
        )}
        {plan.docFireInspection && (
          <div className="flex flex-col items-center gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); onBadgeClick(plan, 'PCCC'); }} className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 cursor-pointer transition">PCCC</button>
            {renderAutoFilesByType(plan, 'PCCC', onFileClick)}
          </div>
        )}
        {hasDocFiles(plan, 'STAMP') && (
          <div className="flex flex-col items-center gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); onBadgeClick(plan, 'STAMP'); }} className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 cursor-pointer transition">TKD</button>
            {renderAutoFilesByType(plan, 'STAMP', onFileClick)}
          </div>
        )}
        
        {getCustomDocs(plan).map(customType => (
          <div key={customType} className="flex flex-col items-center gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); onBadgeClick(plan, customType); }} className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 cursor-pointer transition max-w-[60px] truncate" title={customType}>{customType}</button>
            {renderAutoFilesByType(plan, customType, onFileClick)}
          </div>
        ))}
        
        {!plan.docCo && !plan.docCq && !plan.docFireInspection && !hasDocFiles(plan, 'STAMP') && getCustomDocs(plan).length === 0 && (
          <span className="text-slate-400 text-xs italic">--</span>
        )}

        {/* Dropdown Chevron */}
        {!disabled && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 group-hover/docs:text-slate-600 transition-colors">
            <div className="p-0.5 hover:bg-slate-200 rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </div>
          </div>
        )}
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute top-full right-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-left">
          <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
            <input
              type="text"
              placeholder="Nhập tên chứng từ..."
              className="w-full text-xs px-2 py-1 border rounded focus:outline-none focus:border-primary"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  e.stopPropagation();
                  handleOptionClick(e.currentTarget.value.trim());
                }
              }}
            />
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleOptionClick('CO'); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700 text-left">
            <span className="material-symbols-outlined text-[14px] text-slate-400">upload_file</span> CO
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleOptionClick('CQ'); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700 text-left">
            <span className="material-symbols-outlined text-[14px] text-slate-400">upload_file</span> CQ
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleOptionClick('PCCC'); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700 text-left">
            <span className="material-symbols-outlined text-[14px] text-slate-400">upload_file</span> PCCC
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleOptionClick('STAMP'); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700 text-left">
            <span className="material-symbols-outlined text-[14px] text-slate-400">upload_file</span> TKD
          </button>
        </div>
      )}
    </div>
  );
};

export const MaterialAndPurchasingTab: React.FC<MaterialAndPurchasingTabProps> = ({
  data,
  purchasingData,
  onEditMaterial,
  onEditPurchasing,
  onDelete,
  onUpdateMaterial,
  onUpdatePurchasing,
  onAddSubtask,
  onAddSection,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  userRole,
  selectedProject,
  activeSubTab,
  onExportExcel,
  onImportClick
}) => {
  const subTab = activeSubTab || 'TECH';
  const user = useAuthStore(state => state.user);
  const engineers = useRealtimeStore(state => state.engineers || []);
  const materials = useRealtimeStore(state => state.materials);
  const tasks = useRealtimeStore(state => state.tasks);
  const addNotification = useRealtimeStore(state => state.addNotification);
  const logActivity = useRealtimeStore(state => state.logActivity);

  // Quản lý Yêu cầu mua hàng (Purchase Requests)
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [isPurchaseRequestModalOpen, setIsPurchaseRequestModalOpen] = useState(false);
  const [isPurchaseRequestListModalOpen, setIsPurchaseRequestListModalOpen] = useState(false);
  const [loadingPurchaseRequests, setLoadingPurchaseRequests] = useState(false);

  const fetchPurchaseRequests = async () => {
    try {
      setLoadingPurchaseRequests(true);
      const list = await api.purchaseRequests.getAll();
      setPurchaseRequests(list);
    } catch (err) {
      console.error('Lỗi khi nạp danh sách yêu cầu mua hàng:', err);
    } finally {
      setLoadingPurchaseRequests(false);
    }
  };

  useEffect(() => {
    fetchPurchaseRequests();
  }, [selectedProject]);
  const [filterParent, setFilterParent] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterProgress, setFilterProgress] = useState('all');
  const [filterOrder, setFilterOrder] = useState('all');
  const [filterModel, setFilterModel] = useState('all');
  const [filterOrigin, setFilterOrigin] = useState('all');
  const [filterDocs, setFilterDocs] = useState('all');
  const [filterExpectedDateFrom, setFilterExpectedDateFrom] = useState('');
  const [filterExpectedDateTo, setFilterExpectedDateTo] = useState('');
  const [filterPaymentDateFrom, setFilterPaymentDateFrom] = useState('');
  const [filterPaymentDateTo, setFilterPaymentDateTo] = useState('');
  const [filterContractStatus, setFilterContractStatus] = useState('all');
  const [filterPaymentDate, setFilterPaymentDate] = useState('all');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState('all');
  const [isScrolledHorizontally, setIsScrolledHorizontally] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Pre-computed map for fast O(1) purchasing lookup (eliminates lag on large datasets)
  const purchasingMatchMap = useMemo(() => {
    const map = new Map<string, ProjectPurchasing>();
    const norm = (s?: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

    purchasingData.forEach(p => {
      if (p.id) map.set(p.id, p);
      if (p.materialPlanId) map.set(p.materialPlanId, p);
      const sttKey = `${norm(p.stt)}|${norm(p.content)}`;
      if (!map.has(sttKey)) map.set(sttKey, p);
    });
    return map;
  }, [purchasingData]);

  const findPurchasingMatch = (plan: ProjectMaterialPlan) => {
    if (purchasingMatchMap.has(plan.id)) return purchasingMatchMap.get(plan.id);
    const norm = (s?: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const sttKey = `${norm(plan.stt)}|${norm(plan.jobContent || (plan as any).name)}`;
    return purchasingMatchMap.get(sttKey);
  };

  const parentOptions = useMemo(() => {
    const parents = data.filter(p => isParentRow(p));
    return [{ id: 'all', label: 'Tất cả' }, ...parents.map(p => ({ id: p.id, label: p.jobContent }))];
  }, [data]);
  
  const unitOptions = useMemo(() => ['all', ...Array.from(new Set(data.map(p => p.unit).filter(Boolean)))], [data]);
  const progressOptions = useMemo(() => ['all', ...Array.from(new Set(data.map(p => p.progressStatus).filter(Boolean)))], [data]);
  const orderOptions = useMemo(() => ['all', ...Array.from(new Set(data.map(p => p.orderedStatus).filter(Boolean)))], [data]);
  const modelOptions = useMemo(() => ['all', ...Array.from(new Set(data.map(p => p.techSpecModel).filter(Boolean)))], [data]);
  const originOptions = useMemo(() => ['all', ...Array.from(new Set(data.map(p => p.techSpecOrigin).filter(Boolean)))], [data]);
  const expectedDateOptions = useMemo(() => ['all', ...Array.from(new Set(data.map(p => p.expectedDate).filter(Boolean)))], [data]);
  const contractStatusOptions = useMemo(() => ['all', ...Array.from(new Set(purchasingData.map(p => p.contractStatus).filter(Boolean)))], [purchasingData]);
  const paymentDateOptions = useMemo(() => ['all', ...Array.from(new Set(purchasingData.map(p => p.paymentDate).filter(Boolean)))], [purchasingData]);
  const invoiceStatusOptions = useMemo(() => ['all', ...Array.from(new Set(purchasingData.map(p => p.invoiceStatus).filter(Boolean)))], [purchasingData]);
  const docsOptions = [
    { id: 'all', label: 'Tất cả' },
    { id: 'missing_co', label: 'Thiếu CO' },
    { id: 'missing_cq', label: 'Thiếu CQ' },
    { id: 'missing_fire', label: 'Thiếu PCCC' },
    { id: 'not_dispatched', label: 'Chưa về CT' }
  ];


  const [editingCell, setEditingCell] = useState<{ id: string; field: string; isPurchasing: boolean } | null>(null);
  const [tempValue, setTempValue] = useState<any>('');
  const [triggerAddDoc, setTriggerAddDoc] = useState(false);
  const [docModalPlanId, setDocModalPlanId] = useState<string | null>(null);
  const [fastDocType, setFastDocType] = useState<string | null>(null);
  const [fastDocModels, setFastDocModels] = useState<ModelEntry[]>([]);
  const [previewFile, setPreviewFile] = useState<{ url: string; title: string } | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore if clicking on interactive elements (input, select, button, etc.)
    const target = e.target as HTMLElement;
    if (target.closest('input, select, button, option, textarea, a')) return;
    
    if (!tableContainerRef.current) return;
    setIsMouseDown(true);
    setHasDragged(false);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setScrollLeftState(tableContainerRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Drag speed multiplier
    if (Math.abs(walk) > 5) {
      setHasDragged(true);
    }
    tableContainerRef.current.scrollLeft = scrollLeftState - walk;
  };

  const tablePaginationMode = useUIStore(s => s.tablePaginationMode);
  const tablePageSize = useUIStore(s => s.tablePageSize);

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [tablePage, setTablePage] = useState(1);
  const [visibleLimit, setVisibleLimit] = useState(tablePageSize || 25);

  useEffect(() => {
    setVisibleLimit(tablePageSize || 25);
  }, [tablePageSize]);

  useEffect(() => {
    setTablePage(1);
    setVisibleLimit(tablePageSize || 25);
  }, [data, purchasingData, activeSubTab, statusFilter, searchQuery]);

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) { next.delete(sectionKey); } else { next.add(sectionKey); }
      return next;
    });
  };

  const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'warning' | 'error' | 'info' }>({ show: false, message: '' });
  const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3500);
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPurchasingMode, setIsPurchasingMode] = useState<boolean>(false);

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // Quản lý độ rộng cột có thể kéo thả dùng chung
  const defaultColWidths = useMemo(() => ({
    col_content: subTab === 'FINANCE' ? 240 : 230,
    col_unit: 65,
    col_contract_qty: 50,
    col_model: 85,
    col_origin: 80,
    col_tech_status: 135,
    col_tech_brand: 55,
    col_tech_order_status: 135,
    col_tech_order_qty: 85,
    col_tech_expected_date: 140,
    col_tech_updated_by: 135,
    col_docs_content: 250,
    col_docs_status: 140,
    col_docs_updated_by: 135,
    col_fin_currency: 65,
    col_fin_exchange_rate: 90,
    col_fin_vat_pct: 50,
    col_fin_pretax: 100,
    col_fin_vat: 65,
    col_fin_aftertax: 110,
    col_fin_status: 140,
    col_fin_payment_date: 120,
    col_fin_supplier: 95,
    col_fin_contract_num: 110,
    col_fin_contract_val: 120,
    col_fin_deposit: 105,
    col_fin_deposit_date: 125,
    col_fin_debt: 90,
    col_fin_settle_date: 120,
    col_fin_invoice_status: 110,
    col_fin_updated_by: 130,
  }), [subTab]);

  const { widths: colWidths, startResize: startColResize, resetWidths: resetColWidths } = useTableColumnResize({
    tableId: `table_materials_${subTab}`,
    defaultWidths: defaultColWidths,
  });

  const { filteredData, resolveParentId, getSectionIndexForItem } = useMemo(() => {
    let filtered = [...data];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
            p.jobContent?.toLowerCase().includes(q) || 
            p.unit?.toLowerCase().includes(q) || 
            p.notes?.toLowerCase().includes(q)
        );
    }
    if (filterModel && filterModel !== 'all') {
      filtered = filtered.filter(p => {
         if (isParentRow(p)) return true;
         return p.techSpecModel === filterModel;
      });
    }
    if (filterOrigin && filterOrigin !== 'all') {
      filtered = filtered.filter(p => {
         if (isParentRow(p)) return true;
         return p.techSpecOrigin === filterOrigin;
      });
    }
    if (filterProgress && filterProgress !== 'all') {
      filtered = filtered.filter(p => {
         if (isParentRow(p)) return true;
         return p.progressStatus === filterProgress;
      });
    }
    if (filterExpectedDateFrom || filterExpectedDateTo) {
      filtered = filtered.filter(p => {
         if (isParentRow(p)) return true;
         if (!p.expectedDate) return false;
         
         const fromCheck = filterExpectedDateFrom ? p.expectedDate >= filterExpectedDateFrom : true;
         const toCheck = filterExpectedDateTo ? p.expectedDate <= filterExpectedDateTo : true;
         return fromCheck && toCheck;
      });
    }
    if (filterContractStatus && filterContractStatus !== 'all') {
      filtered = filtered.filter(p => {
         if (isParentRow(p)) return true;
         const purch = findPurchasingMatch(p);
         return purch?.contractStatus === filterContractStatus;
      });
    }
    if (filterPaymentDateFrom || filterPaymentDateTo) {
      filtered = filtered.filter(p => {
         if (isParentRow(p)) return true;
         const purch = findPurchasingMatch(p);
         if (!purch?.paymentDate) return false;
         
         const fromCheck = filterPaymentDateFrom ? purch.paymentDate >= filterPaymentDateFrom : true;
         const toCheck = filterPaymentDateTo ? purch.paymentDate <= filterPaymentDateTo : true;
         return fromCheck && toCheck;
      });
    }
    if (filterInvoiceStatus && filterInvoiceStatus !== 'all') {
      filtered = filtered.filter(p => {
         if (isParentRow(p)) return true;
         const purch = findPurchasingMatch(p);
         return purch?.invoiceStatus === filterInvoiceStatus;
      });
    }
    if (filterDocs && filterDocs !== 'all') {
      filtered = filtered.filter(p => {
         if (isParentRow(p)) return true;
         if (filterDocs === 'missing_co') return !p.docCo;
         if (filterDocs === 'missing_cq') return !p.docCq;
         if (filterDocs === 'missing_fire') return !p.docFireInspection;
         if (filterDocs === 'not_dispatched') return !p.dispatchToSite;
         return true;
      });
    }
    if (statusFilter && statusFilter !== 'Tất cả' && statusFilter !== 'ALL') {
      filtered = filtered.filter(p => {
        if (isParentRow(p)) return true;
        if (statusFilter === 'Chưa thi công') return p.progressStatus === 'Chưa thi công' || !p.progressStatus;
        return p.progressStatus === statusFilter;
      });
    }

    const romanToInt = (s: string): number => {
      const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
      const upper = s.toUpperCase();
      let total = 0;
      for (let i = 0; i < upper.length; i++) {
        const cur = map[upper[i]] ?? 0;
        const nxt = map[upper[i + 1]] ?? 0;
        total += cur < nxt ? -cur : cur;
      }
      return total;
    };
    const numericSttParts = (stt?: string): number[] => {
      const text = String(stt || '').trim();
      if (!text) return [Infinity];
      return text.split(/[.\-]/).map(p => { const n = parseInt(p, 10); return isNaN(n) ? Infinity : n; });
    };

    const hasMajorSections = filtered.some(r => {
      const s = String(r.stt || '').trim().toUpperCase();
      return (/^[A-Z]{1,2}$/.test(s) && !s.includes('.')) || /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/i.test(s);
    });

    const isRootSectionRow = (plan: ProjectMaterialPlan) => {
      const stt = String(plan.stt || '').trim().toUpperCase();
      if (stt.includes('.')) return false;
      // Root sections are letters (A, B) or Roman (I, II)
      if (/^[A-Z]{1,2}$/.test(stt) || /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)$/i.test(stt)) {
        return true;
      }
      // If there are no major letter/Roman sections, then root numeric items without parent can be root
      if (!hasMajorSections && isParentRow(plan) && !plan.parentId) {
        return true;
      }
      return false;
    };

    const orderTagValue = (notes?: string): number | null => {
      const m = String(notes || '').match(/\[order:([\d.]+)\]/);
      return m ? parseFloat(m[1]) : null;
    };
    const originalOrderMap = new Map<string, number>(filtered.map((r, i) => [r.id, orderTagValue(r.notes) ?? i]));

    const sectionSortKey = (r: ProjectMaterialPlan): number[] => {
      const stt = String(r.stt || '').trim();
      if (/^[A-Z]{1,2}$/i.test(stt)) return [0, stt.charCodeAt(0)];
      if (/^[IVXLCDM]+$/i.test(stt)) return [1, romanToInt(stt)];
      return [2, ...numericSttParts(stt)];
    };
    const sectionOrder = new Map<string, number>();
    [...filtered]
      .filter(r => isRootSectionRow(r))
      .sort((a, b) => {
        const orderA = orderTagValue(a.notes);
        const orderB = orderTagValue(b.notes);
        if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
        const ka = sectionSortKey(a), kb = sectionSortKey(b);
        for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
          const diff = (ka[i] ?? -1) - (kb[i] ?? -1);
          if (diff !== 0) return diff;
        }
        return 0;
      })
      .forEach((r, i) => sectionOrder.set(r.id, i));

    const resolveParentId = (plan: ProjectMaterialPlan): string | undefined => {
      if (plan.parentId && filtered.some(r => r.id === plan.parentId)) return plan.parentId;
      if (plan.stt && plan.stt.includes('.')) {
        const parts = plan.stt.split('.');
        parts.pop();
        const parentStt = parts.join('.');
        const myPos = originalOrderMap.get(plan.id) ?? Infinity;
        const candidates = filtered.filter(r => r.stt === parentStt && (originalOrderMap.get(r.id) ?? 0) <= myPos);
        if (candidates.length > 0) return candidates[candidates.length - 1].id;
      }
      if (plan.parentId) return plan.parentId;
      // Fallback for items without parent: find closest section header preceding this item
      const myPos = originalOrderMap.get(plan.id) ?? Infinity;
      let bestSecId: string | undefined = undefined;
      let bestSecPos = -1;
      filtered.forEach(r => {
        if (isRootSectionRow(r) || isParentRow(r)) {
          const secPos = originalOrderMap.get(r.id) ?? Infinity;
          if (secPos <= myPos && secPos > bestSecPos) {
            bestSecPos = secPos;
            bestSecId = r.id;
          }
        }
      });
      return bestSecId;
    };

    if (filterParent !== 'all') {
      filtered = filtered.filter(p => {
        if (p.id === filterParent) return true;
        let currentParentId = resolveParentId(p);
        let safety = 0;
        while (currentParentId && safety < 100) {
          safety++;
          if (currentParentId === filterParent) return true;
          const parentItem = data.find(x => x.id === currentParentId);
          currentParentId = parentItem ? (parentItem.parentId || undefined) : undefined;
        }
        return false;
      });
    }
    if (filterUnit !== 'all') {
      filtered = filtered.filter(p => p.unit === filterUnit || isParentRow(p));
    }
    if (filterProgress !== 'all') {
      filtered = filtered.filter(p => p.progressStatus === filterProgress || isParentRow(p));
    }
    if (filterOrder !== 'all') {
      filtered = filtered.filter(p => p.orderedStatus === filterOrder || isParentRow(p));
    }


    const sectionIndexCache = new Map<string, number>();
    const getSectionIndexForItem = (plan: ProjectMaterialPlan, visited = new Set<string>()): number => {
      if (sectionIndexCache.has(plan.id)) return sectionIndexCache.get(plan.id)!;
      if (visited.has(plan.id)) return Infinity;
      visited.add(plan.id);

      if (isRootSectionRow(plan)) {
        const res = sectionOrder.get(plan.id) ?? Infinity;
        sectionIndexCache.set(plan.id, res);
        return res;
      }
      
      const resolvedParentId = resolveParentId(plan);
      if (resolvedParentId) {
        if (sectionOrder.has(resolvedParentId)) {
          const res = sectionOrder.get(resolvedParentId)!;
          sectionIndexCache.set(plan.id, res);
          return res;
        }
        
        const parentItem = filtered.find(r => r.id === resolvedParentId);
        if (parentItem) {
          const parentSecIdx = getSectionIndexForItem(parentItem, visited);
          if (parentSecIdx !== Infinity) {
            sectionIndexCache.set(plan.id, parentSecIdx);
            return parentSecIdx;
          }
        }
      }

      const myPos = originalOrderMap.get(plan.id) ?? Infinity;
      let bestSecIdx = Infinity;
      let bestSecPos = -1;
      filtered.forEach(r => {
        if (isRootSectionRow(r)) {
          const secPos = originalOrderMap.get(r.id) ?? Infinity;
          if (secPos <= myPos && secPos > bestSecPos) {
            bestSecPos = secPos;
            bestSecIdx = sectionOrder.get(r.id) ?? -1;
          }
        }
      });
      const finalRes = bestSecIdx === -1 ? Infinity : bestSecIdx;
      sectionIndexCache.set(plan.id, finalRes);
      return finalRes;
    };

    const compareSttHierarchy = (sttA?: string, sttB?: string): number => {
      const partsA = (sttA || '').split(/[.\-]/).map(p => parseInt(p, 10));
      const partsB = (sttB || '').split(/[.\-]/).map(p => parseInt(p, 10));
      const len = Math.max(partsA.length, partsB.length);
      for (let i = 0; i < len; i++) {
        const valA = isNaN(partsA[i]) ? 0 : partsA[i];
        const valB = isNaN(partsB[i]) ? 0 : partsB[i];
        if (valA !== valB) return valA - valB;
      }
      return 0;
    };

    const sortedFiltered = filtered.sort((a, b) => {
      const sttComp = compareTaskStt(a.stt, b.stt);
      if (sttComp !== 0) return sttComp;
      const orderA = orderTagValue(a.notes);
      const orderB = orderTagValue(b.notes);
      if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
      const posA = originalOrderMap.get(a.id) ?? 0;
      const posB = originalOrderMap.get(b.id) ?? 0;
      if (posA !== posB) return posA - posB;
      return (a.jobContent || '').localeCompare(b.jobContent || '', 'vi', { numeric: true, sensitivity: 'base' });
    });
    return { filteredData: sortedFiltered, resolveParentId, getSectionIndexForItem };
  }, [data, searchQuery, statusFilter, filterParent, filterUnit, filterProgress, filterOrder, filterModel, filterOrigin, filterDocs, filterExpectedDateFrom, filterExpectedDateTo, filterPaymentDateFrom, filterPaymentDateTo, filterContractStatus, filterPaymentDate, filterInvoiceStatus, purchasingMatchMap]);

  const selectableItems = useMemo(() => filteredData.filter((p: ProjectMaterialPlan) => !isParentRow(p)), [filteredData]);
  const isAllSelected = useMemo(() => selectableItems.length > 0 && selectableItems.every(p => selectedIds.has(p.id)), [selectableItems, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableItems.map(p => p.id)));
    }
  };

  const handlePurchaseRequest = async () => {
    // Nếu chưa ở chế độ chọn mua hàng, click nút sẽ bật chế độ chọn vật tư
    if (!isPurchasingMode) {
      setIsPurchasingMode(true);
      showToast('Đã bật chế độ chọn vật tư. Vui lòng tích chọn các mục cần mua hàng rồi nhấn xác nhận!', 'info');
      return;
    }

    // Nếu đã ở chế độ chọn mua hàng nhưng chưa tích chọn mục nào
    if (selectedIds.size === 0) {
      showToast('Vui lòng tích chọn ít nhất 1 mục vật tư để gửi yêu cầu mua hàng!', 'warning');
      return;
    }

    // Mở popup tạo yêu cầu mua hàng đa cấp với các mục đã chọn
    setIsPurchaseRequestModalOpen(true);
  };

  const handleCreatePurchaseRequestSubmit = async (formData: any) => {
    try {
      const created = await api.purchaseRequests.create({
        projectCode: selectedProject || 'COMPANY',
        projectName: selectedProject || 'Dự án',
        creatorId: user?.id,
        creatorName: user?.name || user?.username || 'Nhân sự',
        creatorTitle: (user as any)?.title || user?.role || 'Kỹ thuật',
        checkerId: formData.checkerId,
        checkerName: formData.checkerName,
        checkerTitle: formData.checkerTitle,
        reviewerId: formData.reviewerId,
        reviewerName: formData.reviewerName,
        reviewerTitle: formData.reviewerTitle,
        neededDate: formData.neededDate,
        priority: formData.priority,
        reason: formData.reason,
        note: formData.note,
        status: 'PENDING_CHECK',
        items: formData.items
      });

      // Ghi nhật ký & thông báo
      const targetItems = selectableItems.filter(p => selectedIds.has(p.id));
      const itemNames = targetItems.map(p => `${p.stt} - ${p.jobContent}`).slice(0, 3).join(', ');
      const moreCount = targetItems.length > 3 ? ` và ${targetItems.length - 3} mục khác` : '';
      if (logActivity) {
        logActivity(
          `Lập Yêu cầu mua hàng [${created.code}] (${targetItems.length} mục): ${itemNames}${moreCount} - Chờ ${formData.checkerName || 'Chỉ huy trưởng'} kiểm tra`,
          selectedProject || 'Dự án'
        );
      }

      if (addNotification) {
        await addNotification({
          title: `Yêu cầu mua hàng mới: ${selectedProject || 'Dự án'}`,
          message: `${user?.name || user?.username} đã lập yêu cầu mua hàng ${created.code} (${targetItems.length} mục vật tư). Cần bạn kiểm tra phê duyệt.`,
          type: 'material_update'
        });
      }

      setPurchaseRequests(prev => [created, ...prev]);
      setSelectedIds(new Set());
      setIsPurchasingMode(false);
      showToast(`Đã gửi yêu cầu mua hàng ${created.code} thành công! Đang chờ kiểm tra và phê duyệt.`, 'success');
    } catch (err: any) {
      console.error('Lỗi khi lập yêu cầu mua hàng:', err);
      showToast(err.message || 'Lỗi khi gửi yêu cầu mua hàng!', 'error');
    }
  };

  const handleApprovePurchaseByChecker = async (req: PurchaseRequest, note?: string) => {
    try {
      const nowIso = new Date().toISOString();
      const updated = await api.purchaseRequests.update(req.id, {
        status: 'CHECKED_WAITING_APPROVAL'
      }, {
        action: 'Xác nhận kiểm tra kỹ thuật',
        actorId: user?.id,
        actorName: user?.name || user?.username || 'Người kiểm tra',
        actorRole: (user as any)?.title || user?.role || 'Kỹ thuật',
        timestamp: nowIso,
        note: note || 'Kỹ thuật đạt chuẩn, đề xuất Lãnh đạo phê duyệt mua hàng'
      });

      if (logActivity) {
        logActivity(
          `Kiểm tra đạt chuẩn Yêu cầu mua hàng [${req.code}] - Chờ ${req.reviewerName || 'Lãnh đạo'} duyệt`,
          req.projectCode || selectedProject || 'Dự án'
        );
      }

      if (addNotification) {
        await addNotification({
          title: `Yêu cầu mua hàng đã kiểm tra: ${req.projectCode || selectedProject}`,
          message: `${user?.name || user?.username} đã xác nhận kiểm tra đơn ${req.code}. Chờ Lãnh đạo duyệt mua.`,
          type: 'material_update'
        });
      }

      setPurchaseRequests(prev => prev.map(r => r.id === req.id ? updated : r));
      showToast(`Đã xác nhận kiểm tra đơn ${req.code} thành công! Đã chuyển tiếp Lãnh đạo phê duyệt.`, 'success');
    } catch (err: any) {
      showToast('Lỗi khi duyệt kiểm tra: ' + err.message, 'error');
    }
  };

  const handleApprovePurchaseByReviewer = async (req: PurchaseRequest, note?: string) => {
    try {
      const nowIso = new Date().toISOString();
      const updated = await api.purchaseRequests.update(req.id, {
        status: 'APPROVED'
      }, {
        action: 'Lãnh đạo phê duyệt mua hàng',
        actorId: user?.id,
        actorName: user?.name || user?.username || 'Lãnh đạo',
        actorRole: (user as any)?.title || user?.role || 'Lãnh đạo',
        timestamp: nowIso,
        note: note || 'Đã đồng ý phê duyệt mua hàng theo đề xuất'
      });

      // Tự động cập nhật trạng thái các vật tư liên quan thành "Đang đặt hàng" khi Lãnh đạo phê duyệt
      if (req.items && req.items.length > 0) {
        for (const item of req.items) {
          if (item.id) {
            await onUpdateMaterial(item.id, { orderedStatus: 'Đang đặt hàng' });
          }
        }
      }

      if (logActivity) {
        logActivity(
          `Lãnh đạo duyệt Yêu cầu mua hàng [${req.code}] (${req.items?.length || 0} mục) - Chuyển bộ phận Đặt hàng`,
          req.projectCode || selectedProject || 'Dự án'
        );
      }

      if (addNotification) {
        await addNotification({
          title: `Đã duyệt Yêu cầu mua hàng: ${req.code}`,
          message: `Lãnh đạo đã phê duyệt mua hàng cho đơn ${req.code} (${req.items?.length || 0} mục vật tư).`,
          type: 'material_update'
        });
      }

      setPurchaseRequests(prev => prev.map(r => r.id === req.id ? updated : r));
      showToast(`Đã phê duyệt mua hàng đơn ${req.code}! Trạng thái vật tư đã chuyển sang "Đang đặt hàng".`, 'success');
    } catch (err: any) {
      showToast('Lỗi khi phê duyệt mua hàng: ' + err.message, 'error');
    }
  };

  const handleRejectPurchase = async (req: PurchaseRequest, note?: string) => {
    try {
      const nowIso = new Date().toISOString();
      const updated = await api.purchaseRequests.update(req.id, {
        status: 'REJECTED'
      }, {
        action: 'Từ chối yêu cầu mua hàng',
        actorId: user?.id,
        actorName: user?.name || user?.username || 'Người duyệt',
        actorRole: (user as any)?.title || user?.role || 'Lãnh đạo',
        timestamp: nowIso,
        note: note || 'Từ chối yêu cầu mua hàng'
      });

      if (logActivity) {
        logActivity(
          `Từ chối Yêu cầu mua hàng [${req.code}]: ${note || 'Không duyệt'}`,
          req.projectCode || selectedProject || 'Dự án'
        );
      }

      setPurchaseRequests(prev => prev.map(r => r.id === req.id ? updated : r));
      showToast(`Đã từ chối đơn yêu cầu mua hàng ${req.code}!`, 'warning');
    } catch (err: any) {
      showToast('Lỗi khi từ chối yêu cầu: ' + err.message, 'error');
    }
  };

  const handleMarkPurchaseOrdered = async (req: PurchaseRequest) => {
    try {
      const nowIso = new Date().toISOString();
      const updated = await api.purchaseRequests.update(req.id, {
        status: 'ORDERED'
      }, {
        action: 'Đã đặt hàng với nhà cung cấp',
        actorId: user?.id,
        actorName: user?.name || user?.username || 'Bộ phận mua hàng',
        actorRole: (user as any)?.title || user?.role || 'Mua hàng',
        timestamp: nowIso,
        note: 'Đã hoàn tất đặt hàng với nhà cung cấp'
      });

      // Cập nhật trạng thái vật tư thành "Đã đặt hàng"
      if (req.items && req.items.length > 0) {
        for (const item of req.items) {
          if (item.id) {
            await onUpdateMaterial(item.id, { orderedStatus: 'Đã đặt hàng' });
          }
        }
      }

      setPurchaseRequests(prev => prev.map(r => r.id === req.id ? updated : r));
      showToast(`Đã cập nhật đơn ${req.code} sang trạng thái "Đã đặt hàng"!`, 'success');
    } catch (err: any) {
      showToast('Lỗi khi cập nhật đặt hàng: ' + err.message, 'error');
    }
  };

  const handleDeleteDoc = (planId: string, docType: string) => {
    const plan = data.find(p => p.id === planId);
    if (!plan) return;
    const models = decodeModels(plan.issueContent);
    // Remove all docs matching this type
    const newModels = models.map(m => ({
      ...m,
      docs: m.docs.filter(d => {
        const lower = (d.text || '').toLowerCase();
        if (docType === 'CO' && (lower.includes('co') || lower.includes('c/o'))) return false;
        if (docType === 'CQ' && (lower.includes('cq') || lower.includes('c/q'))) return false;
        if (docType === 'PCCC' && (lower.includes('pccc') || lower.includes('phòng cháy'))) return false;
        if (docType === 'STAMP' && (lower.includes('tem') || lower.includes('kiểm định') || lower.includes('stamp') || lower.includes('tkd'))) return false;
        if (!['CO', 'CQ', 'PCCC', 'STAMP'].includes(docType) && d.text === docType) return false;
        return true;
      })
    }));
    handleFastDocSubmit(newModels);
    setFastDocType(null);
  };

  const handleDocBadgeClick = (plan: any, type: string) => {
    setFastDocModels(decodeModels(plan.issueContent));
    setDocModalPlanId(plan.id);
    setFastDocType(type);
  };

  const handleFastDocSubmit = (newModels: ModelEntry[]) => {
    if (!docModalPlanId) return;
    const plan = data.find(p => p.id === docModalPlanId);
    if (!plan) return;

    const hasFileFor = (keywords: string[]) => newModels.some(m => m.docs.some(d => {
      const lowerText = d.text.toLowerCase();
      return keywords.some(k => lowerText.includes(k)) && d.fileUrls && d.fileUrls.length > 0;
    }));

    const docCo = hasFileFor(['c/o', 'co']);
    const docCq = hasFileFor(['c/q', 'cq']);
    const docFireInspection = hasFileFor(['pccc', 'phòng cháy']);
    const docStamp = hasFileFor(['tem', 'kiểm định', 'stamp', 'tkd']);

    const payload = {
      ...plan,
      issueContent: `${getIssueContentText(plan.issueContent)} [DOC-DATA] ${encodeModels(newModels)}`,
      docCo,
      docCq,
      docFireInspection,
    };
    
    onUpdateMaterial(plan.id, payload);
    setFastDocType(null);
  };

  const startEditing = (id: string, field: string, value: any, isPurchasing = false) => {
    if (userRole === 'engineer') return;
    setEditingCell({ id, field, isPurchasing });
    
    let finalTemp = value === undefined || value === null ? '' : value;
    if (field === 'issueContent') finalTemp = getIssueContentText(value);
    setTempValue(finalTemp);
  };

  const saveEditing = (plan: ProjectMaterialPlan, pRecord?: ProjectPurchasing) => {
    if (!editingCell) return;
    const { id, field, isPurchasing } = editingCell;

    // Kiểm tra nếu giá trị không hề thay đổi thì thoát ngay, không cập nhật gì
    if (isPurchasing) {
      const activeRecord = pRecord;
      if (activeRecord) {
        const origVal = (activeRecord as any)[field];
        if (field === 'notes') {
          const cleanCur = String(origVal || '').replace(/(\[order:[\d.]+\]|\[section\]|\[contractor\]|\[owner\])/gi, '').trim();
          const cleanNew = String(tempValue || '').trim();
          if (cleanCur === cleanNew) { setEditingCell(null); return; }
        } else if (['volumeOrder', 'unitPrice', 'vatRate', 'prepayPercent', 'prepayAmount', 'costPaidAmount'].includes(field as string)) {
          if (Number(tempValue || 0) === Number(origVal || 0)) { setEditingCell(null); return; }
        } else {
          if (String(tempValue ?? '').trim() === String(origVal ?? '').trim()) { setEditingCell(null); return; }
        }
      }
    } else {
      if (field === 'notes') {
        const cleanCur = String(cleanTechNotes(plan.notes) || '').trim();
        const cleanNew = String(tempValue || '').trim();
        if (cleanCur === cleanNew) { setEditingCell(null); return; }
      } else {
        const origVal = (plan as any)[field];
        if (String(tempValue ?? '').trim() === String(origVal ?? '').trim()) { setEditingCell(null); return; }
      }
    }

    let finalValue = tempValue;

    if (isPurchasing) {
      const activeRecord = pRecord || {
        id: plan.id,
        materialPlanId: plan.id,
        projectCode: plan.projectCode,
        stt: plan.stt,
        content: plan.jobContent,
        unit: plan.unit,
        volumeContract: plan.contractVolume || 0,
        volumeOrder: plan.contractVolume || 0,
        unitPrice: (plan as any).unitPrice || 0,
        vatRate: (plan as any).vatRate !== undefined ? (plan as any).vatRate : 10,
        vatAmount: 0,
        totalAmount: (plan as any).totalAmount || 0,
        prepayPercent: 0,
        prepayAmount: 0,
        remainingAmount: 0,
        orderStatus: 'Chưa đặt hàng',
        contractStatus: 'Đã có phụ lục',
        invoiceStatus: 'Chưa xuất'
      } as ProjectPurchasing;

      if (field === 'notes') {
        const finalNotes = String(activeRecord.notes || '');
        const existingTags = finalNotes.match(/(\[order:[\d.]+\]|\[section\]|\[contractor\]|\[owner\])/gi) || [];
        finalValue = [...existingTags, typeof tempValue === 'string' ? tempValue.trim() : tempValue].filter(Boolean).join(' | ');
      } else if (field === 'volumeOrder' || field === 'unitPrice' || field === 'vatRate' || field === 'prepayPercent' || field === 'prepayAmount' || field === 'costPaidAmount') {
        finalValue = Number(tempValue || 0);
      }
      
      let updatePayload: Partial<ProjectPurchasing> = { [field]: finalValue };
      
      // Auto-calculate VAT & Total
      if (field === 'volumeOrder' || field === 'unitPrice' || field === 'vatRate') {
        const vol = field === 'volumeOrder' ? Number(finalValue) : (activeRecord.volumeOrder || 0);
        const price = field === 'unitPrice' ? Number(finalValue) : (activeRecord.unitPrice || 0);
        const rate = field === 'vatRate' ? Number(finalValue) : (activeRecord.vatRate || 0);
        
        const vat = Math.round(vol * price * rate / 100);
        const total = Math.round(vol * price * (1 + rate / 100));
        
        updatePayload.vatAmount = vat;
        updatePayload.totalAmount = total;
        updatePayload.remainingAmount = total - (activeRecord.prepayAmount || 0);
      } else if (field === 'prepayAmount') {
        const prepay = Number(finalValue);
        const total = activeRecord.totalAmount || 0;
        updatePayload.remainingAmount = total - prepay;
        if (total > 0) {
          updatePayload.prepayPercent = Number(((prepay / total) * 100).toFixed(2));
        }
      } else if (field === 'prepayPercent') {
        const pct = Number(finalValue);
        const total = activeRecord.totalAmount || 0;
        const prepay = Math.round(total * pct / 100);
        updatePayload.prepayAmount = prepay;
        updatePayload.remainingAmount = total - prepay;
      }

      onUpdatePurchasing(activeRecord.id, updatePayload);
    } else {
      let finalNotes = String(plan.notes || '');
      const currentTech = getTechNote(finalNotes);
      const currentDoc = getDocNote(finalNotes);
      const currentFile = getDocFileName(finalNotes);

      if (field === 'notes') {
        const existingTags = finalNotes.match(/(\[order:[\d.]+\]|\[section\]|\[contractor\]|\[owner\])/gi) || [];
        const techStatusTag = finalNotes.match(/\[tech-status:[^\]]+\]/gi)?.[0] || '';
        const threadIdx = finalNotes.indexOf('[THREAD:');
        const threadTag = threadIdx !== -1 ? finalNotes.slice(threadIdx).trim() : '';

        let updatedNote = [...existingTags, typeof tempValue === 'string' ? tempValue.trim() : tempValue].filter(Boolean).join(' | ');
        if (techStatusTag) updatedNote = `${updatedNote} ${techStatusTag}`.trim();
        if (threadTag) updatedNote = `${updatedNote} ${threadTag}`.trim();
        
        if (subTab === 'DOCS') {
           finalValue = `${currentTech} [DOC-NOTE] ${updatedNote} [DOC-FILENAME] ${currentFile}`;
        } else {
           finalValue = `${updatedNote} [DOC-NOTE] ${currentDoc} [DOC-FILENAME] ${currentFile}`;
        }
      } else if (field === 'fileName') {
        finalValue = `${currentTech} [DOC-NOTE] ${currentDoc} [DOC-FILENAME] ${typeof tempValue === 'string' ? tempValue.trim() : tempValue}`;
        
      } else if (field === 'contractVolume' || field === 'orderedVolume') {
        finalValue = Number(tempValue || 0);
      } else if (field === 'docCo' || field === 'docCq' || field === 'docFireInspection' || field === 'dispatchToSite') {
        finalValue = tempValue === true || tempValue === 'true' || tempValue === 'Có';
      } else if (field === 'issueContent') {
        const existingDocData = getIssueContentData(plan.issueContent);
        const newText = typeof tempValue === 'string' ? tempValue.trim() : tempValue;
        finalValue = existingDocData ? `${newText} [DOC-DATA] ${existingDocData}` : newText;
      }
      onUpdateMaterial(id, { [field === 'fileName' ? 'notes' : field]: finalValue });
    }
    setEditingCell(null);
  };

  const groupedData = useMemo(() => {
    // Synthesize missing parent section headers if any child items exist (e.g. 33.1 without 33)
    const sttSet = new Set(filteredData.map(t => `${t.projectCode || ''}:::${String(t.stt || '').trim()}`));
    const missingParents: any[] = [];
    filteredData.forEach(t => {
      if (missingParents.length >= 30) return;
      const stt = String(t.stt || '').trim();
      if (stt.includes('.')) {
        const parts = stt.split('.');
        parts.pop();
        const parentStt = parts.join('.');
        const parentKey = `${t.projectCode || ''}:::${parentStt}`;
        if (parentStt && !sttSet.has(parentKey)) {
          sttSet.add(parentKey);
          let synthName = '';
          const parentItem: any = data.find((d: any) => d.projectCode === t.projectCode && String(d.stt || '').trim() === parentStt) ||
            tasks.find((d: any) => d.projectCode === t.projectCode && String(d.stt || '').trim() === parentStt);
          if (parentItem && (parentItem.content || parentItem.jobContent || parentItem.name)) {
            synthName = parentItem.content || parentItem.jobContent || parentItem.name || '';
          } else if ((t as any).sectionName && (t as any).sectionName.trim()) {
            synthName = (t as any).sectionName;
          } else {
            const siblingWithSection: any = data.find((d: any) => d.projectCode === t.projectCode && (String(d.stt || '').startsWith(parentStt + '.') || String(d.stt || '').trim() === parentStt) && (d.sectionName || d.content || d.jobContent || d.name)) ||
              tasks.find((d: any) => d.projectCode === t.projectCode && (String(d.stt || '').startsWith(parentStt + '.') || String(d.stt || '').trim() === parentStt) && (d.sectionName || (d as any).content || (d as any).jobContent || d.name));
            if (siblingWithSection && siblingWithSection.sectionName && siblingWithSection.sectionName.trim()) {
              synthName = siblingWithSection.sectionName;
            } else {
              synthName = `HẠNG MỤC ${parentStt}`;
            }
          }

          missingParents.push({
            id: `synth_mat_${parentStt}`,
            stt: parentStt,
            jobContent: synthName,
            content: synthName,
            name: synthName,
            projectCode: t.projectCode,
            parentId: t.parentId,
            isSec: true,
            notes: '[section]'
          });
        }
      }
    });

    // Build tree globally exactly like TaskManagementPage
    const map = new Map<string, any>();
    const roots: any[] = [];

    const fullTasks = [...missingParents, ...filteredData];

    // Initialize map
    fullTasks.forEach((t) => map.set(t.id, { ...t, children: [] }));

    const sttToItemMap = new Map<string, any>();
    fullTasks.forEach((t) => {
      if (t.stt) sttToItemMap.set(`${t.projectCode || ''}:::${String(t.stt).trim()}`, t);
    });

    // Resolve parent globally
    const resolveParentIdGlobal = (item: any) => {
      // 1. If valid parentId exists, trust it!
      if (item.parentId && item.parentId !== item.id && map.has(item.parentId)) return item.parentId;

      // 2. If STT is dotted (e.g. 1.1, 2.1), look for parent with matching STT in preceding items
      if (item.stt && String(item.stt).includes('.')) {
        const parts = String(item.stt).split('.');
        parts.pop();
        const parentStt = parts.join('.');
        const orderTagValue = (notes?: string): number | null => {
          const m = String(notes || '').match(/\[order:([\d.]+)\]/);
          return m ? parseFloat(m[1]) : null;
        };
        const myOrder = orderTagValue(item.notes);
        const candidates = fullTasks.filter(t =>
          (t.projectCode || '') === (item.projectCode || '') &&
          t.id !== item.id &&
          String(t.stt || '').trim() === parentStt &&
          map.has(t.id) &&
          (myOrder === null || (orderTagValue(t.notes) ?? 0) <= myOrder)
        );
        if (candidates.length > 0) return candidates[candidates.length - 1].id;
      }
      if (!isParentRow(item) && item.sectionName && String(item.sectionName).trim().length > 0) {
        const secHeader = fullTasks.find(x => 
          (x.projectCode || '') === (item.projectCode || '') &&
          x.id !== item.id &&
          isParentRow(x) &&
          ((x.jobContent || x.name || '').trim().toLowerCase() === item.sectionName.trim().toLowerCase() ||
           (x.sectionName || '').trim().toLowerCase() === item.sectionName.trim().toLowerCase())
        );
        if (secHeader && map.has(secHeader.id)) return secHeader.id;
      }
      return (item.parentId && item.parentId !== item.id) ? item.parentId : undefined;
    };

    fullTasks.forEach((t) => {
      const resolvedParentId = resolveParentIdGlobal(t);
      if (resolvedParentId && map.has(resolvedParentId)) {
        map.get(resolvedParentId)!.children.push(map.get(t.id));
      } else {
        roots.push(map.get(t.id));
      }
    });

    let currentSectionKey = '';
    const flattened: any[] = [];

    const flattenTree = (nodes: any[], currentDepth: number = 0, prefix: string = '', visited = new Set<string>()) => {
      if (currentDepth > 15) return; // Safety guard against OOM crash

      nodes.sort((a, b) => {
        const orderTagValue = (notes?: string): number | null => {
          const m = String(notes || '').match(/\[order:([\d.]+)\]/);
          return m ? parseFloat(m[1]) : null;
        };
        const orderA = orderTagValue(a.notes);
        const orderB = orderTagValue(b.notes);
        if (orderA !== null && orderB !== null && orderA !== orderB) {
          return orderA - orderB;
        }
        const sttCompare = compareTaskStt(a.stt, b.stt);
        if (sttCompare !== 0) return sttCompare;
        return (a.jobContent || a.name || '').localeCompare(b.jobContent || b.name || '', 'vi', { numeric: true, sensitivity: 'base' });
      });

      nodes.forEach((node, idx) => {
        if (!node || !node.id || visited.has(node.id)) return;
        visited.add(node.id);

        const isSec = node.isSec || isParentRow(node);
        if (isSec) {
          currentSectionKey = node.id;
        }

        let displayDepth = currentDepth;
        if (currentDepth === 0 && !isSec && currentSectionKey !== '') {
          displayDepth = 1;
        }

        const currentNum = (idx + 1).toString();
        const computedStt = node.stt || (displayDepth === 1 ? currentNum : (displayDepth > 1 ? `${prefix}.${currentNum}` : currentNum));

        flattened.push({
          ...node,
          isSec: isSec,
          depth: displayDepth,
          computedStt,
          _sectionKey: currentSectionKey || 'Khác'
        });
        if (node.children && node.children.length > 0) {
          flattenTree(node.children, currentDepth + 1, computedStt, visited);
        }
      });
    };

    flattenTree(roots, 0, '');
    return flattened;
  }, [filteredData]);

  const maxSttWidth = React.useMemo(() => {
    let maxLen = 3; // Minimum length 3 for "STT" header
    groupedData.forEach(t => {
      const rawVal = String((t as any).computedStt || t.stt || '').trim();
      const match = rawVal.match(/^[\d.]+/);
      const cleanVal = match ? match[0] : rawVal.split(/[\s\-]/)[0];
      if (cleanVal.length > maxLen) maxLen = cleanVal.length;
    });
    // Khi bật chế độ chọn mua hàng (có checkbox), cần thêm khoảng 22px để hiển thị cả checkbox và số STT không bị che
    const extraForCheckbox = (subTab === 'TECH' && isPurchasingMode) ? 24 : 0;
    const calculated = Math.round(maxLen * 6.8 + 12 + extraForCheckbox);
    return Math.max((subTab === 'TECH' && isPurchasingMode) ? 58 : 34, Math.min(85, calculated));
  }, [groupedData, isPurchasingMode, subTab]);

  const totals = useMemo(() => {
    let sell = 0;
    let cost = 0;
    let costPaid = 0;

    data.forEach((plan) => {
      const vol = Number(plan.contractVolume || 0);
      const unitVal = String(plan.unit || '').trim();
      if (vol === 0 && unitVal === '') return;

      const pRecord = purchasingData.find(
        (p) => (p.materialPlanId && p.materialPlanId === plan.id) || (p.stt === plan.stt && p.projectCode === plan.projectCode)
      );

      const effectiveVol = pRecord?.volumeOrder || plan.contractVolume || 0;
      const effectivePrice = pRecord?.unitPrice || (plan as any).unitPrice || 0;
      const effectiveVat = pRecord?.vatRate !== undefined ? pRecord.vatRate : ((plan as any).vatRate !== undefined ? (plan as any).vatRate : 10);
      const effectiveVatAmt = pRecord?.vatAmount || (effectiveVol * effectivePrice * effectiveVat / 100);
      const effectiveTotal = pRecord?.totalAmount || (plan as any).totalAmount || ((effectiveVol * effectivePrice) + effectiveVatAmt);

      const costAmt = pRecord?.prepayAmount || 0;
      const costPaidAmt = pRecord?.costPaidAmount || 0;

      sell += effectiveTotal;
      cost += costAmt;
      costPaid += costPaidAmt;
    });

    return {
      sell,
      cost,
      costPaid,
      profit: sell - cost,
    };
  }, [data, purchasingData]);

  const uncollapsedRows = useMemo(() => {
    return groupedData.filter(plan => plan.isSec || !collapsedSections.has(plan._sectionKey || ''));
  }, [groupedData, collapsedSections]);

  const colSpanCount = useMemo(() => {
    if (subTab === 'TECH') return 10;
    if (subTab === 'DOCS') return 7;
    if (subTab === 'FINANCE') return 21;
    return 10;
  }, [subTab]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {fastDocType && (
        <FastDocModal
          title={`Cập nhật chứng từ ${fastDocType}`}
          docType={fastDocType as any}
          initialModels={fastDocModels}
          onClose={() => setFastDocType(null)}
          onSubmit={handleFastDocSubmit}
          onDelete={() => docModalPlanId && fastDocType && handleDeleteDoc(docModalPlanId, fastDocType)}
        />
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewFile(null)} />
          <div className="relative flex w-full max-w-4xl h-[85vh] flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                <span className="material-symbols-outlined text-base text-primary">description</span>
                {previewFile.title}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewFile.url}
                  download
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Tải về
                </a>
                <button onClick={() => setPreviewFile(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100">
              {previewFile.url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                <div className="flex items-center justify-center h-full p-4">
                  <img src={previewFile.url} alt={previewFile.title} className="max-w-full max-h-full object-contain rounded-lg shadow" />
                </div>
              ) : (
                <iframe
                  src={previewFile.url}
                  className="w-full h-full border-0"
                  title={previewFile.title}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <datalist id="issueStatus-options">
        <option value="Chưa xử lý" />
        <option value="Đang xử lý" />
        <option value="Đã xử lý" />
        <option value="Cần xác nhận" />
      </datalist>
      <datalist id="issueContent-options">
        <option value="Chưa chốt phương án kỹ thuật" />
        <option value="Sai khác so với thiết kế" />
        <option value="Thiết kế thay đổi" />
        <option value="Hàng về chậm" />
        <option value="Nhà máy trễ tiến độ" />
        <option value="Chờ phê duyệt" />
      </datalist>

      <datalist id="issueStatus-options">
        <option value="Chưa xử lý" />
        <option value="Đang xử lý" />
        <option value="Đã xử lý" />
        <option value="Cần xác nhận" />
      </datalist>
      <datalist id="issueContent-options">
        <option value="Chưa chốt phương án kỹ thuật" />
        <option value="Sai khác so với thiết kế" />
        <option value="Thiết kế thay đổi" />
        <option value="Hàng về chậm" />
        <option value="Nhà máy trễ tiến độ" />
        <option value="Chờ phê duyệt" />
      </datalist>

      <div className="flex flex-col border-b border-slate-200 sticky top-0 z-40 bg-slate-50">
        
        

        <StandardFilterToolbar
          totalCount={selectableItems.length}
          totalCountLabel="vật tư"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onResetColumnWidths={resetColWidths}
          selectFilters={[
            {
              id: 'parent',
              label: 'Đầu mục',
              value: filterParent,
              onChange: setFilterParent,
              options: parentOptions.map(opt => ({ value: opt.id, label: opt.label })),
              minWidth: 'min-w-[70px]',
              maxWidth: 'max-w-[120px]',
            },
            {
              id: 'unit',
              label: 'ĐVT',
              value: filterUnit,
              onChange: setFilterUnit,
              options: unitOptions.map(u => ({ value: u, label: u === 'all' ? 'Tất cả' : u })),
              minWidth: 'min-w-[50px]',
              maxWidth: 'max-w-[85px]',
            },
            ...((subTab === 'TECH' || subTab === 'FINANCE') ? [{
              id: 'order',
              label: 'Đặt hàng',
              value: filterOrder,
              onChange: setFilterOrder,
              options: orderOptions.map(o => ({ value: o, label: o === 'all' ? 'Tất cả' : o })),
              minWidth: 'min-w-[70px]',
              maxWidth: 'max-w-[110px]',
            }] : []),
            ...(subTab === 'TECH' ? [{
              id: 'progress',
              label: 'Tình trạng',
              value: filterProgress,
              onChange: setFilterProgress,
              options: progressOptions.map(p => ({ value: p, label: p === 'all' ? 'Tất cả' : p })),
              minWidth: 'min-w-[70px]',
              maxWidth: 'max-w-[110px]',
            }] : []),
            ...(subTab === 'FINANCE' ? [{
              id: 'contractStatus',
              label: 'Tình trạng HĐ',
              value: filterContractStatus,
              onChange: setFilterContractStatus,
              options: contractStatusOptions.map(c => ({ value: c, label: c === 'all' ? 'Tất cả' : c })),
              minWidth: 'min-w-[70px]',
              maxWidth: 'max-w-[110px]',
            }, {
              id: 'invoiceStatus',
              label: 'Hóa đơn VAT',
              value: filterInvoiceStatus,
              onChange: setFilterInvoiceStatus,
              options: invoiceStatusOptions.map(i => ({ value: i, label: i === 'all' ? 'Tất cả' : i })),
              minWidth: 'min-w-[70px]',
              maxWidth: 'max-w-[110px]',
            }] : []),
            ...(subTab === 'DOCS' ? [{
              id: 'docs',
              label: 'Chứng từ',
              value: filterDocs,
              onChange: setFilterDocs,
              options: docsOptions.map(d => ({ value: d.id, label: d.label })),
              minWidth: 'min-w-[70px]',
              maxWidth: 'max-w-[120px]',
            }] : []),
          ]}
          dateRange={
            subTab === 'TECH'
              ? {
                  label: 'Ngày có hàng',
                  fromDate: filterExpectedDateFrom,
                  toDate: filterExpectedDateTo,
                  onFromChange: setFilterExpectedDateFrom,
                  onToChange: setFilterExpectedDateTo,
                }
              : subTab === 'FINANCE'
              ? {
                  label: 'Ngày thanh toán',
                  fromDate: filterPaymentDateFrom,
                  toDate: filterPaymentDateTo,
                  onFromChange: setFilterPaymentDateFrom,
                  onToChange: setFilterPaymentDateTo,
                }
              : undefined
          }
          onResetFilters={() => {
            setSearchQuery('');
            setFilterParent('all');
            setFilterUnit('all');
            setFilterOrder('all');
            setFilterProgress('all');
            setFilterExpectedDateFrom('');
            setFilterExpectedDateTo('');
            setFilterContractStatus('all');
            setFilterPaymentDateFrom('');
            setFilterPaymentDateTo('');
            setFilterInvoiceStatus('all');
            setFilterDocs('all');
          }}
          actionButtons={
            <>
              {/* Nút Yêu cầu mua hàng (khi ở tab Đặt hàng - TECH) */}
              {subTab === 'TECH' && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handlePurchaseRequest}
                    className={`flex items-center justify-center gap-1.5 rounded text-[11px] font-bold transition-all shadow-xs whitespace-nowrap h-8 px-2.5 shrink-0 cursor-pointer ${
                      isPurchasingMode
                        ? (selectedIds.size > 0
                            ? 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-white ring-2 ring-amber-300'
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300')
                        : 'bg-white hover:bg-amber-50 text-slate-700 border border-slate-300'
                    }`}
                    title={
                      !isPurchasingMode
                        ? "Bật chế độ chọn vật tư để yêu cầu mua hàng"
                        : (selectedIds.size > 0
                            ? `Gửi yêu cầu mua hàng cho ${selectedIds.size} mục đã chọn`
                            : "Tích chọn các mục bên dưới rồi nhấn nút này để gửi yêu cầu")
                    }
                  >
                    <span className="material-symbols-outlined text-[16px] text-amber-600">
                      {isPurchasingMode && selectedIds.size > 0 ? 'shopping_cart_checkout' : 'checklist'}
                    </span>
                    <span className="inline">
                      {!isPurchasingMode
                        ? 'Yêu cầu mua hàng'
                        : (selectedIds.size > 0 ? `Xác nhận mua hàng (${selectedIds.size})` : 'Chọn mua hàng...')}
                    </span>
                  </button>

                  {isPurchasingMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPurchasingMode(false);
                        setSelectedIds(new Set());
                      }}
                      className="h-8 px-2 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold cursor-pointer shadow-xs"
                      title="Hủy chế độ chọn mua hàng"
                    >
                      Hủy
                    </button>
                  )}

                  {/* Nút Xem danh sách Yêu cầu mua hàng (kèm badge chờ duyệt) */}
                  <button
                    type="button"
                    onClick={() => setIsPurchaseRequestListModalOpen(true)}
                    className="flex items-center gap-1.5 h-8 px-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                    title="Xem danh sách đơn yêu cầu mua hàng"
                  >
                    <span className="material-symbols-outlined text-[15px] text-amber-600">receipt_long</span>
                    <span className="hidden sm:inline">Duyệt mua hàng</span>
                    {purchaseRequests.filter(r => r.status === 'PENDING_CHECK' || r.status === 'CHECKED_WAITING_APPROVAL').length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">
                        {purchaseRequests.filter(r => r.status === 'PENDING_CHECK' || r.status === 'CHECKED_WAITING_APPROVAL').length}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {onAddSection && subTab !== 'FINANCE' && (
                <button
                  onClick={onAddSection}
                  className="flex items-center justify-center gap-1.5 bg-primary text-white rounded text-[11px] font-bold hover:opacity-90 active:scale-95 shadow-xs whitespace-nowrap h-8 px-2.5 shrink-0"
                  title="Thêm đầu mục"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span className="inline">Thêm đầu mục</span>
                </button>
              )}
            </>
          }
          importExportComponent={
            (onExportExcel || onImportClick) ? (
              <ImportExportDropdown
                onImportClick={onImportClick}
                onExportExcel={onExportExcel}
                onExportCsv={onExportExcel}
                onExportPdf={() => window.print()}
                onExportWord={onExportExcel}
                buttonClassName="!h-8 !text-[11px]"
              />
            ) : undefined
          }
        />
      </div>

      <div 
        ref={tableContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
        className={`w-full max-w-full min-h-0 flex-1 overflow-x-auto custom-scrollbar select-none ${isMouseDown ? 'cursor-grabbing' : 'cursor-grab'}`} 
        onScroll={(e) => {
          setIsScrolledHorizontally(e.currentTarget.scrollLeft > 10);
          if (tablePaginationMode === 'infinite') {
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
            if (scrollHeight - (scrollTop + clientHeight) < 350) {
              const uncollapsedRows = groupedData.filter(plan => plan.isSec || !collapsedSections.has(plan._sectionKey || ''));
              setVisibleLimit(prev => (prev < uncollapsedRows.length ? Math.min(uncollapsedRows.length, prev + (tablePageSize || 25)) : prev));
            }
          }
        }}
      >
        <table className={`w-full table-fixed border-collapse text-left text-xs ${subTab === 'FINANCE' ? 'min-w-[2150px]' : subTab === 'DOCS' ? 'min-w-[950px]' : 'min-w-[1050px] md:min-w-[1150px]'}`} style={{ "--stt-width": `${maxSttWidth}px` } as React.CSSProperties}>
          <colgroup>
            <col style={{ width: "var(--stt-width)" }} />
            <col style={{ width: colWidths.col_content }} />
            <col style={{ width: colWidths.col_unit }} />
            <col style={{ width: colWidths.col_contract_qty }} />
            <col style={{ width: colWidths.col_model }} />
            <col style={{ width: colWidths.col_origin }} />
            {subTab === 'TECH' && (
              <>
                <col style={{ width: colWidths.col_tech_status }} />
                <col style={{ width: colWidths.col_tech_brand }} />
                <col style={{ width: colWidths.col_tech_order_status }} />
                <col style={{ width: colWidths.col_tech_order_qty }} />
                <col style={{ width: colWidths.col_tech_expected_date }} />
                <col style={{ width: colWidths.col_tech_updated_by }} />
              </>
            )}
            {subTab === 'DOCS' && (
              <>
                <col style={{ width: colWidths.col_docs_content }} />
                <col style={{ width: colWidths.col_docs_status }} />
                <col style={{ width: colWidths.col_docs_updated_by }} />
              </>
            )}
            {subTab === 'FINANCE' && (
              <>
                <col style={{ width: colWidths.col_fin_currency }} />
                <col style={{ width: colWidths.col_fin_exchange_rate }} />
                <col style={{ width: colWidths.col_fin_vat_pct }} />
                <col style={{ width: colWidths.col_fin_pretax }} />
                <col style={{ width: colWidths.col_fin_vat }} />
                <col style={{ width: colWidths.col_fin_aftertax }} />
                <col style={{ width: colWidths.col_fin_status }} />
                <col style={{ width: colWidths.col_fin_payment_date }} />
                <col style={{ width: colWidths.col_fin_supplier }} />
                <col style={{ width: colWidths.col_fin_contract_num }} />
                <col style={{ width: colWidths.col_fin_contract_val }} />
                <col style={{ width: colWidths.col_fin_deposit }} />
                <col style={{ width: colWidths.col_fin_deposit_date }} />
                <col style={{ width: colWidths.col_fin_debt }} />
                <col style={{ width: colWidths.col_fin_settle_date }} />
                <col style={{ width: colWidths.col_fin_invoice_status }} />
                <col style={{ width: colWidths.col_fin_updated_by }} />
              </>
            )}
          </colgroup>
          <thead className="sticky top-0 z-30 border-b border-slate-300 bg-slate-50 text-[10px] font-extrabold uppercase tracking-tight text-slate-600">
            <tr className="bg-slate-50">
              <th style={{ width: "var(--stt-width)", minWidth: "var(--stt-width)", maxWidth: "var(--stt-width)", borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="py-2 px-1 text-center font-extrabold whitespace-nowrap bg-slate-50 tracking-tighter">
                {subTab === 'TECH' && isPurchasingMode ? (
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-primary cursor-pointer"
                      title={isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả vật tư"}
                    />
                    <span>STT</span>
                  </div>
                ) : (
                  <span>STT</span>
                )}
              </th>
              <th style={{ borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8', minWidth: 180, width: colWidths.col_content }} className="sticky left-0 z-30 bg-slate-50 bg-clip-padding px-2 py-2 font-extrabold text-left min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] relative group/th">
                <span>NỘI DUNG</span>
                <ColumnResizeHandle colKey="col_content" onResizeStart={startColResize} />
              </th>
              {(subTab === 'TECH' || subTab === 'DOCS' || subTab === 'FINANCE') && (
                <>
                  <th style={{ minWidth: 55, width: colWidths.col_unit, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1.5 text-center leading-tight relative group/th">
                    <span>ĐVT</span>
                    <ColumnResizeHandle colKey="col_unit" onResizeStart={startColResize} />
                  </th>
                  <th style={{ minWidth: 45, width: colWidths.col_contract_qty, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1.5 text-center leading-tight relative group/th">
                    <span>KL HĐ</span>
                    <ColumnResizeHandle colKey="col_contract_qty" onResizeStart={startColResize} />
                  </th>
                  <th style={{ width: colWidths.col_model, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1.5 text-center leading-tight relative group/th">
                    <span>MÃ HIỆU</span>
                    <ColumnResizeHandle colKey="col_model" onResizeStart={startColResize} />
                  </th>
                  <th style={{ width: colWidths.col_origin, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1.5 text-center leading-tight relative group/th">
                    <span>XUẤT XỨ</span>
                    <ColumnResizeHandle colKey="col_origin" onResizeStart={startColResize} />
                  </th>
                </>
              )}
              
              {subTab === 'TECH' && (
                <>
                  <th style={{ width: 135, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1 text-center leading-tight">
                    <div className="flex flex-col items-center gap-1">
                      <span>TÌNH TRẠNG</span>
                      <CustomSelect
                        value=""
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const val = e.target.value;
                          if (!val) return;
                          const targetVal = val === 'Chưa xác định' ? '' : val;
                          const targetList = selectableItems;
                          if (targetList.length === 0) return;
                          targetList.forEach((plan: ProjectMaterialPlan) => {
                            const rawNotes = String(plan.notes || '');
                            let currentTech = getTechNote(rawNotes).replace(/\[tech-status:[^\]]+\]/gi, '').trim();
                            if (targetVal) currentTech = `${currentTech} [tech-status:${targetVal}]`.trim();
                            const docNote = getDocNoteFull(rawNotes);
                            const newNotes = docNote ? `${currentTech} [DOC-NOTE]${docNote}` : currentTech;
                            onUpdateMaterial(plan.id, { techSpecStatus: targetVal, notes: newNotes });
                          });
                          showToast(`Đã gán Tình trạng "${val}" thành công cho ${targetList.length} vật tư!`, 'success');
                          e.target.value = '';
                        }}
                        className="h-6 w-full border border-emerald-400 rounded px-1 py-0 bg-emerald-50 text-emerald-800 text-[10px] font-bold shadow-xs hover:bg-emerald-100 transition-colors normal-case cursor-pointer"
                      >
                        <option value="" className="bg-white text-slate-700 font-normal">-- Gán nhanh --</option>
                        {['Chưa xác định', 'Đáp ứng', 'Chưa đáp ứng', 'Đang xem xét'].map(opt => (
                          <option key={opt} value={opt} className={getStatusColorStyle(opt)}>{opt}</option>
                        ))}
                      </CustomSelect>
                    </div>
                  </th>
                  <th style={{ width: 55, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1.5 text-center leading-tight">KL ĐẶT HÀNG</th>
                  <th style={{ width: 135, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1 text-center leading-tight">
                    <div className="flex flex-col items-center gap-1">
                      <span>TT ĐẶT HÀNG</span>
                      <CustomSelect
                        value=""
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const val = e.target.value;
                          if (!val) return;
                          const targetList = selectableItems;
                          if (targetList.length === 0) return;
                          targetList.forEach((plan: ProjectMaterialPlan) => {
                            onUpdateMaterial(plan.id, { orderedStatus: val });
                          });
                          showToast(`Đã gán TT Đặt hàng "${val}" thành công cho ${targetList.length} vật tư!`, 'success');
                          e.target.value = '';
                        }}
                        className="h-6 w-full border border-blue-400 rounded px-1 py-0 bg-blue-50 text-blue-800 text-[10px] font-bold shadow-xs hover:bg-blue-100 transition-colors normal-case cursor-pointer"
                      >
                        <option value="" className="bg-white text-slate-700 font-normal">-- Gán nhanh --</option>
                        {PURCHASE_STATUS_OPTIONS.map(opt => (
                          <option key={opt} value={opt} className={getStatusColorStyle(opt)}>{opt}</option>
                        ))}
                      </CustomSelect>
                    </div>
                  </th>
                  <th style={{ width: 85, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1.5 text-center leading-tight">NGÀY CÓ HÀNG</th>
                  <th style={{ minWidth: 100, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1.5 text-center leading-tight">GHI CHÚ</th>
                  <th style={{ width: 135, borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">NGƯỜI CẬP NHẬT</th>
                </>
              )}

              {subTab === 'DOCS' && (
                <>
                  <th style={{ width: 250, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1.5 text-center leading-tight">CHỨNG TỪ HÀNG HÓA</th>
                  <th style={{ minWidth: 100, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">GHI CHÚ</th>
                  <th style={{ width: 135, borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">NGƯỜI CẬP NHẬT</th>
                </>
              )}

              {subTab === 'FINANCE' && (
                <>
                  <th style={{ width: 65, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1 py-1.5 text-center leading-tight">KL ĐH</th>
                  <th style={{ width: 90, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">ĐƠN GIÁ BÁN</th>
                  <th style={{ width: 50, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">VAT %</th>
                  <th style={{ width: 100, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">THÀNH TIỀN BÁN</th>
                  <th style={{ width: 65, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">% TẠM ỨNG</th>
                  <th style={{ width: 110, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">CHI PHÍ (GIÁ VỐN) (đ)</th>
                  <th style={{ width: 140, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">NHÀ CUNG CẤP (GIÁ VỐN)</th>
                  <th style={{ width: 120, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">ĐÃ THANH TOÁN (GIÁ VỐN) (đ)</th>
                  <th style={{ width: 95, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">NGÀY THANH TOÁN</th>
                  <th style={{ width: 110, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">HÌNH THỨC TT</th>
                  <th style={{ width: 120, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">NGƯỜI THANH TOÁN</th>
                  <th style={{ width: 105, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">LỢI NHUẬN (đ)</th>
                  <th style={{ width: 125, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">TÌNH TRẠNG HĐ</th>
                  <th style={{ width: 90, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">HẠN THANH TOÁN</th>
                  <th style={{ width: 120, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">HÓA ĐƠN VAT</th>
                  <th style={{ width: 110, borderRight: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">GHI CHÚ</th>
                  <th style={{ width: 130, borderBottom: '1px solid #94a3b8' }} className="bg-slate-50 bg-clip-padding px-1.5 py-1.5 text-center leading-tight">NGƯỜI CẬP NHẬT</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
            {groupedData.length === 0 ? (
              <tr><td colSpan={colSpanCount + 2} className="p-8 text-center text-slate-400 whitespace-nowrap">{TEXT.empty}</td></tr>
            ) : (
              (() => {
                const uncollapsedRows = groupedData.filter(plan => plan.isSec || !collapsedSections.has(plan._sectionKey || ''));
                if (tablePaginationMode === 'infinite') {
                  return uncollapsedRows.slice(0, visibleLimit);
                }
                const effectivePageSize = tablePageSize || 25;
                const start = (tablePage - 1) * effectivePageSize;
                return uncollapsedRows.slice(start, start + effectivePageSize);
              })()
                .map((plan, index) => {
                  const parent = plan.isSec || isParentRow(plan);
                  const depth = plan.depth || 0;
                  const suggestedStt = '';
                  const pRecord = parent ? undefined : findPurchasingMatch(plan);

                  if (parent) {
                    const isCollapsed = collapsedSections.has(plan._sectionKey || '');
                    return (
                      <tr key={plan.id} className="group bg-[#eff6ff] border-t-2 border-b border-blue-200 font-bold text-primary">
                        <td style={{ width: "var(--stt-width)", minWidth: "var(--stt-width)", maxWidth: "var(--stt-width)" }} className="bg-[#eff6ff] border-r border-blue-200 py-1 sm:py-2 px-1 text-center font-mono font-extrabold text-[10.5px] sm:text-[11px] text-primary whitespace-nowrap tracking-tighter" title={String(plan.stt)}>
                          {subTab === 'TECH' && isPurchasingMode ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="checkbox"
                                checked={(() => {
                                  const sectionChildren = selectableItems.filter((p: ProjectMaterialPlan) => p.parentId === plan.id || (p.stt && plan.stt && p.stt.startsWith(plan.stt + '.')));
                                  return sectionChildren.length > 0 && sectionChildren.every((p: ProjectMaterialPlan) => selectedIds.has(p.id));
                                })()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const sectionChildren = selectableItems.filter((p: ProjectMaterialPlan) => p.parentId === plan.id || (p.stt && plan.stt && p.stt.startsWith(plan.stt + '.')));
                                  const allChildrenSelected = sectionChildren.length > 0 && sectionChildren.every((p: ProjectMaterialPlan) => selectedIds.has(p.id));
                                  setSelectedIds(prev => {
                                    const next = new Set(prev);
                                    sectionChildren.forEach((child: ProjectMaterialPlan) => {
                                      if (allChildrenSelected) { next.delete(child.id); } else { next.add(child.id); }
                                    });
                                    return next;
                                  });
                                }}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-primary cursor-pointer flex-shrink-0"
                                title="Tích chọn / Bỏ chọn tất cả vật tư thuộc mục này"
                              />
                              <span>{plan.stt}</span>
                            </div>
                          ) : (
                            <span>{plan.stt}</span>
                          )}
                        </td>
                        <td className="sticky left-0 z-10 bg-[#eff6ff] border-r border-blue-200 py-1 sm:py-1.5 px-1.5 sm:px-2 uppercase tracking-tight font-extrabold text-[11px] sm:text-xs text-primary whitespace-normal min-w-[150px] sm:min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] relative" title={plan.jobContent || plan.name || plan.content}>
                          <div className="flex items-center gap-1 min-w-0 w-full overflow-hidden">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSection(plan._sectionKey || ''); }}
                              className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-blue-200 transition-colors"
                              title={isCollapsed ? 'Mở rộng đầu mục' : 'Thu gọn đầu mục'}
                            >
                              <span className={`material-symbols-outlined text-[13px] sm:text-[15px] text-primary transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>expand_more</span>
                            </button>
                            <span className="material-symbols-outlined text-[13px] sm:text-[15px] flex-shrink-0">{isCollapsed ? 'folder' : 'folder_open'}</span>
                            <span className="flex-1 min-w-0 cursor-pointer hover:underline truncate md:whitespace-normal md:overflow-visible break-words leading-tight text-[11px] sm:text-xs" onClick={(e) => { e.stopPropagation(); onEditMaterial?.(plan); }} title={plan.jobContent || plan.name || plan.content}>
                              {formatSectionTitle(plan.stt, plan.jobContent || plan.name || plan.content)}
                            </span>
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-[#eff6ff]/95 backdrop-blur-xs pl-1.5 py-0.5 shadow-[-6px_0_10px_-2px_#eff6ff] z-20">
                              {onAddSubtask && subTab !== 'FINANCE' && (
                                <button onClick={(e) => { e.stopPropagation(); onAddSubtask(plan, suggestedStt); }} className="p-0.5 rounded text-blue-400 hover:text-blue-700 hover:bg-blue-100 transition-colors inline-flex items-center" title="Thêm hạng mục mới">
                                  <span className="material-symbols-outlined text-[13px]">add_circle</span>
                                </button>
                              )}
                              {onDelete && (
                                <button onClick={(e) => { e.stopPropagation(); onDelete(plan.id); }} className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition-colors inline-flex items-center" title="Xóa">
                                  <span className="material-symbols-outlined text-[13px]">delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td colSpan={colSpanCount} className="bg-blue-50/90 py-1 sm:py-2 px-1.5 sm:px-2 text-slate-500 truncate text-[10.5px] sm:text-[11px]" title={cleanNotes(plan.notes)}>
                          {cleanNotes(plan.notes)}
                        </td>
                      </tr>
                    );
                  }

                  let rowBg = 'bg-white';
                  let stickyBg = 'bg-white';
                  let fontStyle = 'font-medium text-slate-800 text-[11px] sm:text-[12px] leading-snug';
                  let sttStyle = 'font-bold text-slate-400 text-[10.5px] sm:text-xs';
                  
                  if (depth === 1) {
                    rowBg = 'bg-white';
                    stickyBg = 'bg-white';
                    fontStyle = 'font-semibold text-slate-900 text-[11px] sm:text-[12px] leading-snug';
                    sttStyle = 'font-bold text-slate-600 text-[10.5px] sm:text-xs';
                  } else if (depth === 2) {
                    fontStyle = 'font-medium text-slate-800 text-[11px] sm:text-[12px] leading-snug';
                    sttStyle = 'font-semibold text-slate-400 text-[10px] sm:text-[11px]';
                  } else if (depth >= 3) {
                    fontStyle = 'font-normal text-slate-700 text-[10.5px] sm:text-[11.5px] leading-snug';
                    sttStyle = 'font-medium text-slate-400 text-[9.5px] sm:text-[10.5px]';
                  }
                  
                  const rowClass = `group transition-colors border-b border-slate-50 ${rowBg} hover:bg-slate-100`;
                  const paddingLeft = depth > 0 ? `${(depth - 1) * 0.3}rem` : '0';

                  return (
                    <tr key={plan.id} onDoubleClick={() => {
                      if (subTab === 'FINANCE') {
                        if (pRecord) onEditPurchasing(pRecord, 'FINANCE');
                      } else {
                        onEditMaterial(plan);
                      }
                    }} className={rowClass}>
                      {/* STT */}
                      <td style={{ width: "var(--stt-width)", minWidth: "var(--stt-width)", maxWidth: "var(--stt-width)" }} className={`py-0.5 sm:py-1 px-1 ${stickyBg} group-hover:bg-slate-100 border-r border-slate-200 text-center font-mono whitespace-nowrap tracking-tighter ${sttStyle}`}>
                        {editingCell?.id === plan.id && editingCell?.field === 'stt' && !editingCell.isPurchasing ? (
                          <input
                            type="text"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={() => saveEditing(plan, pRecord)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                            autoFocus
                            className="w-full text-center bg-white text-slate-900 font-bold focus:outline-primary text-xs px-1 py-1 h-[26px] box-border outline-none shadow-sm border-none rounded"
                          />
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {subTab === 'TECH' && isPurchasingMode && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(plan.id)}
                                onChange={(e) => { e.stopPropagation(); toggleSelectRow(plan.id); }}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-primary cursor-pointer flex-shrink-0"
                                title="Tích chọn để yêu cầu mua hàng"
                              />
                            )}
                            <span onClick={() => startEditing(plan.id, 'stt', plan.stt)} className="cursor-pointer hover:bg-slate-200/50 px-0.5 py-0 rounded flex-1 whitespace-nowrap tracking-tighter text-center" title={String(depth > 0 ? plan.computedStt : plan.stt)}>{depth > 0 ? plan.computedStt : plan.stt}</span>
                          </div>
                        )}
                      </td>
                          
                          {/* NỘI DUNG */}
                          <td className={`sticky left-0 z-10 ${stickyBg} group-hover:bg-slate-100 border-r border-slate-200 py-0.5 sm:py-1 px-1 sm:px-2 align-middle text-left overflow-hidden min-w-[150px] sm:min-w-[180px] ${fontStyle} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] relative`}>
                            {editingCell?.id === plan.id && editingCell?.field === 'jobContent' && !editingCell.isPurchasing ? (
                              <input
                                type="text"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                onBlur={() => saveEditing(plan, pRecord)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                autoFocus
                                className="w-full bg-white text-slate-900 font-bold focus:outline-primary text-xs px-1.5 py-1 h-[26px] box-border outline-none shadow-sm border-none rounded"
                              />
                            ) : (
                              <div className="flex items-center gap-0.5 sm:gap-1 w-full min-w-0 overflow-hidden" style={{ paddingLeft }}>
                                {depth > 1 && (
                                  <span className="material-symbols-outlined flex-shrink-0 text-slate-400 text-[11px] sm:text-[12px]">
                                    subdirectory_arrow_right
                                  </span>
                                )}
                                <span onClick={() => startEditing(plan.id, 'jobContent', plan.jobContent || plan.name || plan.content)} className="cursor-pointer hover:bg-slate-100 flex-1 py-0.5 w-full min-w-0 line-clamp-2 sm:line-clamp-none break-words leading-tight" title={plan.jobContent || plan.name || plan.content}>
                                  {plan.jobContent || plan.name || plan.content}
                                </span>
                                
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-white/95 group-hover:bg-slate-100/95 backdrop-blur-xs pl-1.5 py-0.5 shadow-[-6px_0_10px_-2px_rgba(241,245,249,0.9)] z-20">
                                {onAddSubtask && subTab !== 'FINANCE' && (
                                  <button onClick={(e) => { e.stopPropagation(); onAddSubtask(plan, suggestedStt); }} className="p-0.5 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200 transition-colors inline-flex items-center flex-shrink-0" title="thêm hạng mục mới">
                                    <span className="material-symbols-outlined text-[13px]">add_circle</span>
                                  </button>
                                )}
                                  {onDelete && (
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(plan.id); }} className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition-colors inline-flex items-center flex-shrink-0" title="Xóa">
                                      <span className="material-symbols-outlined text-[13px]">delete</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* DYNAMIC RIGHT COLUMNS BASED ON SUBTAB */}
                          {(subTab === 'TECH' || subTab === 'DOCS' || subTab === 'FINANCE') && (
                            <>
                              <td className="bg-white group-hover:bg-slate-50 border-r border-slate-200 p-0 text-center font-semibold text-[11px] align-middle text-slate-700">
                                {editingCell?.id === plan.id && editingCell?.field === 'unit' && !editingCell.isPurchasing ? (
                                  <input
                                    type="text"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white focus:outline-primary px-1 py-1 box-border outline-none shadow-sm border-none h-[28px] rounded"
                                  />
                                ) : (
                                  <div onClick={() => startEditing(plan.id, 'unit', plan.unit)} className="w-full min-h-[32px] cursor-pointer hover:bg-slate-100 flex items-center justify-center" title={plan.unit || 'Click để nhập'}>
                                    {plan.unit || <span className="text-slate-300">-</span>}
                                  </div>
                                )}
                              </td>
                              <td className="bg-white group-hover:bg-slate-50 border-r border-slate-200 p-0 text-center font-semibold text-[11px] align-middle text-slate-700">
                                {editingCell?.id === plan.id && editingCell?.field === 'contractVolume' && !editingCell.isPurchasing ? (
                                  <input
                                    type="text"
                                    value={tempValue}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9.-]/g, '');
                                      setTempValue(val);
                                    }}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-700 font-semibold focus:outline-primary px-1 py-1 box-border outline-none shadow-sm border-none h-[28px] rounded"
                                  />
                                ) : (
                                  <div onClick={() => startEditing(plan.id, 'contractVolume', plan.contractVolume)} className="w-full min-h-[32px] cursor-pointer hover:bg-slate-100 flex items-center justify-center" title={showNumber(plan.contractVolume) || 'Click để nhập'}>
                                    {showNumber(plan.contractVolume) || <span className="text-slate-300">-</span>}
                                  </div>
                                )}
                              </td>
                              <td className="bg-white group-hover:bg-slate-50 border-r border-slate-200 p-0 text-center text-[11px] align-middle">
                                {editingCell?.id === plan.id && editingCell?.field === 'techSpecModel' && !editingCell.isPurchasing ? (
                                  <input
                                    type="text"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-700 focus:outline-primary px-1 py-1 box-border outline-none shadow-sm border-none h-[28px] rounded"
                                  />
                                ) : ((() => {
                                  const inventoryMatch = plan.techSpecModel ? materials.find(m => plan.techSpecModel.toLowerCase().includes(m.code?.toLowerCase() || 'NO_MATCH') || (m.code && m.code.toLowerCase().includes(plan.techSpecModel.toLowerCase()))) : null;
                                  return (
                                    <div onClick={() => startEditing(plan.id, 'techSpecModel', plan.techSpecModel)} className="w-full min-h-[32px] cursor-pointer hover:bg-slate-100 flex flex-col items-center justify-center break-words px-1 py-0.5 text-slate-600 relative group/cell" title={plan.techSpecModel || 'Click để nhập mã'}>
                                      <div className="text-center text-slate-700 w-full">
                                        {plan.techSpecModel || <span className="text-slate-300 font-normal">-</span>}
                                      </div>
                                      {inventoryMatch && (
                                        <div className="mt-0.5 opacity-80 group-hover/cell:opacity-100 transition-opacity">
                                          <span className="text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded shadow-sm border border-green-200 font-bold whitespace-nowrap" title={`Tồn kho: ${inventoryMatch.currentStock || 0} ${inventoryMatch.unit || ''}`}>
                                            Kho: {inventoryMatch.currentStock || 0}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                                  )}
                              </td>
                              <td className="bg-white group-hover:bg-slate-50 border-r border-slate-200 p-0 text-center text-[11px] align-middle">
                                {editingCell?.id === plan.id && editingCell?.field === 'techSpecOrigin' && !editingCell.isPurchasing ? (
                                  <input
                                    type="text"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-700 focus:outline-primary px-1 py-1 box-border outline-none shadow-sm border-none h-[28px] rounded"
                                  />
                                ) : (
                                  <div onClick={() => startEditing(plan.id, 'techSpecOrigin', plan.techSpecOrigin)} className="w-full min-h-[32px] cursor-pointer hover:bg-slate-100 flex items-center justify-center break-words px-1 text-slate-600" title={plan.techSpecOrigin || 'Click để nhập'}>
                                    {plan.techSpecOrigin || <span className="text-slate-300">-</span>}
                                  </div>
                                )}
                              </td>
                            </>
                          )}

                          {subTab === 'TECH' && (
                            <>
                              {/* TÌNH TRẠNG */}
                              <td className="w-[125px] p-0 align-middle text-slate-600 border-r border-slate-200">
                                <div className="p-1">
                                   {(() => {
                                     const currentStatus = plan.techSpecStatus || 'Chưa xác định';
                                     const style = getStatusColorStyle(currentStatus);
                                     return (
                                       <CustomSelect
                                         value={currentStatus}
                                         onChange={(e) => { 
                                           const val = e.target.value === 'Chưa xác định' ? '' : e.target.value;
                                           const rawNotes = String(plan.notes || '');
                                           let currentTech = getTechNote(rawNotes).replace(/\[tech-status:[^\]]+\]/gi, '').trim();
                                           if (val) currentTech = `${currentTech} [tech-status:${val}]`.trim();
                                           const docNote = getDocNoteFull(rawNotes);
                                           const newNotes = docNote ? `${currentTech} [DOC-NOTE]${docNote}` : currentTech;
                                           onUpdateMaterial(plan.id, { techSpecStatus: val, notes: newNotes });
                                         }}
                                         className={`w-full min-w-0 rounded border px-1 py-0.5 text-[10px] font-bold focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-colors ${style}`}
                                       >
                                         {['Chưa xác định', 'Đáp ứng', 'Chưa đáp ứng', 'Đang xem xét'].map(opt => (
                                           <option key={opt} value={opt} className={getStatusColorStyle(opt)}>{opt}</option>
                                         ))}
                                       </CustomSelect>
                                     );
                                   })()}
                                </div>
                              </td>
                            

                              {/* KL ĐẶT HÀNG */}
                              <td className="p-0 align-middle text-center font-mono font-semibold text-slate-900 border-r border-slate-200 whitespace-normal break-words leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'orderedVolume' && !editingCell.isPurchasing ? (
                                  <input
                                    type="number" step="any"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none shadow-sm border-none rounded"
                                  />
                                ) : (
                                  <span onClick={() => startEditing(plan.id, 'orderedVolume', plan.orderedVolume)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5" title={showNumber(plan.orderedVolume)}>{showNumber(plan.orderedVolume)}</span>
                                )}
                              </td>
                              {/* TT ĐẶT HÀNG */}
                              <td className="p-0 align-middle text-center border-r border-slate-200">
                                <div className="p-1">
                                  {(() => {
                                    const currentStatus = plan.orderedStatus || 'Chưa đặt hàng';
                                    const btnStyle = getStatusColorStyle(currentStatus);
                                    return (
                                      <CustomSelect
                                        value={currentStatus}
                                        onChange={(e) => { onUpdateMaterial(plan.id, { orderedStatus: e.target.value }) }}
                                        className={`w-full min-w-0 rounded border px-1 py-0.5 text-[10px] font-bold focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-colors ${btnStyle}`}
                                      >
                                        {PURCHASE_STATUS_OPTIONS.map(opt => <option key={opt} value={opt} className={getStatusColorStyle(opt)}>{opt}</option>)}
                                      </CustomSelect>
                                    );
                                  })()}
                                </div>
                              </td>
                              {/* NGÀY CÓ HÀNG */}
                              <td className="p-0 align-middle text-center font-mono text-slate-600 truncate border-r border-slate-200">
                                {editingCell?.id === plan.id && editingCell?.field === 'expectedDate' && !editingCell.isPurchasing ? (
                                  <input
                                    type="date"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-600 focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none shadow-sm border-none rounded"
                                  />
                                ) : (
                                  <span onClick={() => startEditing(plan.id, 'expectedDate', plan.expectedDate)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5">{plan.expectedDate || ''}</span>
                                )}
                              </td>
                              
</>
)}

                          {subTab === 'DOCS' && (
                            <>
                              {/* CHỨNG TỪ HÀNG HÓA (Combined CO, CQ, PCCC, Tem KĐ) */}
                              <td className="w-[240px] p-0 align-middle border-r border-slate-200 relative group/docs">
                                <MultiDocSelect plan={plan} onBadgeClick={handleDocBadgeClick} onFileClick={(url: string, title: string) => setPreviewFile({ url, title })} disabled={userRole === 'engineer'} />
                              </td>
                              
                            </>
                          )}

                          {subTab === 'FINANCE' && (
                            <>
                              {/* KL ĐH */}
                              <td className="p-0 align-middle text-center font-mono text-slate-600 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'volumeOrder' && editingCell?.isPurchasing ? (
                                  <input
                                    type="number" step="any"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : ((() => {
                                  const effectiveVol = pRecord?.volumeOrder !== undefined && pRecord.volumeOrder > 0 ? pRecord.volumeOrder : plan.contractVolume;
                                  return (
                                    <span onClick={() => startEditing(plan.id, 'volumeOrder', effectiveVol, true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5" title={showNumber(effectiveVol)}>{showNumber(effectiveVol) || '-'}</span>
                                  );
                                })())}
                              </td>
                              {/* ĐƠN GIÁ BÁN */}
                              <td className="p-0 align-middle text-right font-mono text-slate-600 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'unitPrice' && editingCell?.isPurchasing ? (
                                  <input
                                    type="number" step="any"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-right bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : ((() => {
                                  const effectivePrice = pRecord?.unitPrice || (plan as any).unitPrice || 0;
                                  return (
                                    <span onClick={() => startEditing(plan.id, 'unitPrice', effectivePrice, true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-end px-1.5 py-1.5" title={showNumber(effectivePrice)}>{showNumber(effectivePrice) || '-'}</span>
                                  );
                                })())}
                              </td>
                              {/* VAT % */}
                              <td className="p-0 align-middle text-center font-mono text-slate-600 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'vatRate' && editingCell?.isPurchasing ? (
                                  <input
                                    type="number" step="any"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : ((() => {
                                  const effectiveVat = pRecord?.vatRate !== undefined ? pRecord.vatRate : ((plan as any).vatRate !== undefined ? (plan as any).vatRate : 10);
                                  return (
                                    <span onClick={() => startEditing(plan.id, 'vatRate', effectiveVat, true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis" title={showNumber(effectiveVat)}>{showPercent(effectiveVat)}</span>
                                  );
                                })())}
                              </td>
                              {/* THÀNH TIỀN BÁN */}
                              <td className="p-1.5 align-middle text-right font-mono font-bold text-slate-800 border-r border-slate-200 leading-tight">
                                {(() => {
                                  const effectiveVol = pRecord?.volumeOrder || plan.contractVolume || 0;
                                  const effectivePrice = pRecord?.unitPrice || (plan as any).unitPrice || 0;
                                  const effectiveVat = pRecord?.vatRate !== undefined ? pRecord.vatRate : ((plan as any).vatRate !== undefined ? (plan as any).vatRate : 10);
                                  const effectiveVatAmt = pRecord?.vatAmount || (effectiveVol * effectivePrice * effectiveVat / 100);
                                  const effectiveTotal = pRecord?.totalAmount || (plan as any).totalAmount || ((effectiveVol * effectivePrice) + effectiveVatAmt);
                                  return showNumber(effectiveTotal) || '-';
                                })()}
                              </td>
                              {/* % TẠM ỨNG */}
                              <td className="p-0 align-middle text-center font-mono text-slate-600 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'prepayPercent' && editingCell?.isPurchasing ? (
                                  <input
                                    type="number" step="any"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : (
                                  <span onClick={() => pRecord && startEditing(plan.id, 'prepayPercent', pRecord.prepayPercent, true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis" title={showNumber(pRecord?.prepayPercent)}>{showPercent(pRecord?.prepayPercent)}</span>
                                )}
                              </td>
                              {/* CHI PHÍ (GIÁ VỐN) */}
                              <td className="p-0 align-middle text-right font-mono text-slate-600 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'prepayAmount' && editingCell?.isPurchasing ? (
                                  <input
                                    type="number" step="any"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-right bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : (
                                  <span onClick={() => pRecord && startEditing(plan.id, 'prepayAmount', pRecord.prepayAmount, true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-end px-1.5 py-1.5" title={showNumber(pRecord?.prepayAmount)}>{showNumber(pRecord?.prepayAmount) || '-'}</span>
                                )}
                              </td>
                              {/* NHÀ CUNG CẤP (GIÁ VỐN) */}
                              <td className="p-0 align-middle text-center text-xs text-slate-700 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'supplier' && editingCell?.isPurchasing ? (
                                  <input
                                    type="text"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    placeholder="Nhà cung cấp..."
                                    className="w-full text-center bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : (
                                  <span onClick={() => pRecord && startEditing(plan.id, 'supplier', pRecord.supplier || '', true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5 text-slate-800" title={pRecord?.supplier || 'Click để nhập'}>{pRecord?.supplier || <span className="text-slate-300 font-normal">-</span>}</span>
                                )}
                              </td>

                              {/* ĐÃ THANH TOÁN (GIÁ VỐN) */}
                              <td className="p-0 align-middle text-right font-mono text-slate-600 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'costPaidAmount' && editingCell?.isPurchasing ? (
                                  <input
                                    type="number" step="any"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-right bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : (
                                  <span onClick={() => pRecord && startEditing(plan.id, 'costPaidAmount', pRecord.costPaidAmount, true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-end px-1.5 py-1.5 text-blue-700 font-semibold" title={showNumber(pRecord?.costPaidAmount)}>{showNumber(pRecord?.costPaidAmount) || '-'}</span>
                                )}
                              </td>

                              {/* NGÀY THANH TOÁN */}
                              <td className="p-0 align-middle text-center text-xs text-slate-700 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'costPaymentDate' && editingCell?.isPurchasing ? (
                                  <input
                                    type="date"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : (
                                  <span onClick={() => pRecord && startEditing(plan.id, 'costPaymentDate', pRecord.costPaymentDate || '', true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5 text-slate-800" title={pRecord?.costPaymentDate || 'Click để chọn ngày'}>{pRecord?.costPaymentDate || <span className="text-slate-300 font-normal">-</span>}</span>
                                )}
                              </td>

                              {/* HÌNH THỨC TT */}
                              <td className="p-0 align-middle text-center text-xs text-slate-700 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'costPaymentMethod' && editingCell?.isPurchasing ? (
                                  <CustomSelect
                                    value={tempValue || 'Chuyển khoản'}
                                    onChange={(e) => {
                                      setTempValue(e.target.value);
                                      if (pRecord) onUpdatePurchasing(pRecord.id, { ...pRecord, costPaymentMethod: e.target.value });
                                      setEditingCell(null);
                                    }}
                                    className="w-full text-center bg-white text-slate-900 font-semibold text-xs px-1 py-1 h-[28px] rounded border"
                                  >
                                    <option value="Chuyển khoản">Chuyển khoản</option>
                                    <option value="Tiền mặt">Tiền mặt</option>
                                    <option value="Ví điện tử">Ví điện tử</option>
                                    <option value="Khác">Khác</option>
                                  </CustomSelect>
                                ) : (
                                  <span onClick={() => pRecord && startEditing(plan.id, 'costPaymentMethod', pRecord.costPaymentMethod || '', true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5 text-slate-800" title={pRecord?.costPaymentMethod || 'Click để chọn'}>{pRecord?.costPaymentMethod || <span className="text-slate-300 font-normal">-</span>}</span>
                                )}
                              </td>

                              {/* NGƯỜI THANH TOÁN */}
                              <td className="p-0 align-middle text-center text-xs text-slate-700 border-r border-slate-200 leading-tight">
                                {editingCell?.id === plan.id && editingCell?.field === 'costPayerName' && editingCell?.isPurchasing ? (
                                  <input
                                    type="text"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    placeholder="Tên người thanh toán..."
                                    className="w-full text-center bg-white text-slate-900 font-semibold focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : (
                                  <span onClick={() => pRecord && startEditing(plan.id, 'costPayerName', pRecord.costPayerName || '', true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5 text-slate-800" title={pRecord?.costPayerName || 'Click để nhập'}>{pRecord?.costPayerName || <span className="text-slate-300 font-normal">-</span>}</span>
                                )}
                              </td>
                              {/* LỢI NHUẬN (= Thành tiền bán - Giá vốn) */}
                              <td className="p-1.5 align-middle text-right font-mono font-bold text-emerald-700 border-r border-slate-200 leading-tight">
                                {(() => {
                                  const effectiveVol = pRecord?.volumeOrder || plan.contractVolume || 0;
                                  const effectivePrice = pRecord?.unitPrice || (plan as any).unitPrice || 0;
                                  const effectiveVat = pRecord?.vatRate !== undefined ? pRecord.vatRate : ((plan as any).vatRate !== undefined ? (plan as any).vatRate : 10);
                                  const effectiveVatAmt = pRecord?.vatAmount || (effectiveVol * effectivePrice * effectiveVat / 100);
                                  const effectiveTotal = pRecord?.totalAmount || (plan as any).totalAmount || ((effectiveVol * effectivePrice) + effectiveVatAmt);
                                  const costAmount = pRecord?.prepayAmount || 0;
                                  const profit = effectiveTotal - costAmount;
                                  return (
                                    <span className={profit < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                                      {showNumber(profit) || '0'}
                                    </span>
                                  );
                                })()}
                              </td>

                              {/* TÌNH TRẠNG HĐ */}
                              <td className="p-1 align-middle text-center border-r border-slate-200">
                                <CustomSelect
                                  value={pRecord?.contractStatus || 'Chưa ký'}
                                  onChange={(e) => { if (pRecord) onUpdatePurchasing(pRecord.id, { ...pRecord, contractStatus: e.target.value }) }}
                                  className={`w-full min-w-0 rounded border px-1 py-0.5 text-[10px] font-bold focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-colors ${getStatusColorStyle(pRecord?.contractStatus || 'Chưa ký')}`}
                                >
                                  <option value="Chưa ký" className={getStatusColorStyle('Chưa ký')}>Chưa ký</option>
                                  <option value="Đã ký" className={getStatusColorStyle('Đã ký')}>Đã ký</option>
                                  <option value="Đang thương thảo" className={getStatusColorStyle('Đang thương thảo')}>Đang thương thảo</option>
                                </CustomSelect>
                              </td>
                              {/* HẠN THANH TOÁN */}
                              <td className="p-0 align-middle text-center font-mono text-slate-600 truncate border-r border-slate-200">
                                {editingCell?.id === plan.id && editingCell?.field === 'paymentDate' && editingCell?.isPurchasing ? (
                                  <input
                                    type="date"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => saveEditing(plan, pRecord)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-full text-center bg-white text-slate-600 focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none border-none rounded"
                                  />
                                ) : (
                                  <span onClick={() => pRecord && startEditing(plan.id, 'paymentDate', pRecord.paymentDate, true)} className="cursor-pointer hover:bg-slate-100 flex items-center min-h-[32px] w-full justify-center px-1.5 py-1.5">{pRecord?.paymentDate || ''}</span>
                                )}
                              </td>
                              {/* HÓA ĐƠN VAT */}
                              <td className="p-1 align-middle text-center border-r border-slate-200">
                                <CustomSelect
                                  value={pRecord?.invoiceStatus || 'Chưa xuất HĐ'}
                                  onChange={(e) => { if (pRecord) onUpdatePurchasing(pRecord.id, { ...pRecord, invoiceStatus: e.target.value }) }}
                                  className={`w-full min-w-0 rounded border px-1 py-0.5 text-[10px] font-bold focus:ring-2 focus:ring-primary focus:outline-none focus:bg-white transition-colors ${getStatusColorStyle(pRecord?.invoiceStatus || 'Chưa xuất HĐ')}`}
                                >
                                  <option value="Chưa xuất HĐ" className={getStatusColorStyle('Chưa xuất HĐ')}>Chưa xuất HĐ</option>
                                  <option value="Đã xuất HĐ" className={getStatusColorStyle('Đã xuất HĐ')}>Đã xuất HĐ</option>
                                  <option value="Ko có HĐ" className={getStatusColorStyle('Ko có HĐ')}>Ko có HĐ</option>
                                  <option value="Nhân công" className={getStatusColorStyle('Nhân công')}>Nhân công</option>
                                </CustomSelect>
                              </td>
                            </>
                          )}

                          {subTab === 'TECH' ? (
                            <td className="bg-white group-hover:bg-slate-50 border-r border-slate-200 py-1 px-1.5 align-middle text-slate-500 text-[11px] truncate">
                              {editingCell?.id === plan.id && editingCell?.field === 'notes' ? (
                                <input
                                  type="text"
                                  value={tempValue}
                                  onChange={(e) => setTempValue(e.target.value)}
                                  onBlur={() => saveEditing(plan, pRecord)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                  autoFocus
                                  placeholder="Nhập ghi chú..."
                                  className="w-full bg-white text-slate-700 focus:outline-primary text-[11px] px-1 py-0.5 box-border outline-none border border-slate-200 rounded"
                                />
                              ) : (
                                <div onClick={() => startEditing(plan.id, 'notes', cleanTechNotes(plan.notes))} className="cursor-pointer hover:bg-slate-100 flex items-center gap-1 w-full truncate" title={plan.issueContent ? `Vướng mắc: ${getIssueContentText(plan.issueContent)} | ${cleanTechNotes(plan.notes)}` : cleanTechNotes(plan.notes)}>
                                  {plan.issueContent && (
                                    <span className="text-rose-600 font-semibold truncate flex items-center gap-0.5 shrink-0">
                                      <span className="material-symbols-outlined text-[12px]">warning</span>
                                      {getIssueContentText(plan.issueContent)}
                                    </span>
                                  )}
                                  {cleanTechNotes(plan.notes) ? (
                                    <span className="text-slate-600 truncate">{cleanTechNotes(plan.notes)}</span>
                                  ) : !plan.issueContent ? (
                                    <span className="text-slate-300 italic">-</span>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          ) : (
                            <td className="bg-white group-hover:bg-slate-50 border-r border-slate-200 p-0 align-middle text-slate-500">
                              {editingCell?.id === plan.id && editingCell?.field === 'notes' && editingCell.isPurchasing === (subTab === 'FINANCE') ? (
                                <input
                                  type="text"
                                  value={tempValue}
                                  onChange={(e) => setTempValue(e.target.value)}
                                  onBlur={() => saveEditing(plan, pRecord)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(plan, pRecord); if (e.key === 'Escape') setEditingCell(null); }}
                                  autoFocus
                                  className="w-full bg-white text-slate-500 focus:outline-primary text-xs px-1.5 py-1.5 h-[28px] box-border outline-none shadow-sm border-none rounded"
                                />
                              ) : (
                                <div onClick={() => {
                                  if (subTab === 'FINANCE') {
                                    if (pRecord) startEditing(plan.id, 'notes', cleanNotes(pRecord.notes) || '', true);
                                  } else {
                                    startEditing(plan.id, 'notes', cleanDocNotes(plan.notes), false);
                                  }
                                }} className="w-full min-h-[32px] cursor-pointer hover:bg-slate-100 flex items-center px-1.5 py-1.5" title={subTab === 'FINANCE' ? cleanNotes(pRecord?.notes) : cleanDocNotes(plan.notes)}>
                                  <span className="truncate flex-1">{subTab === 'FINANCE' ? cleanNotes(pRecord?.notes) : cleanDocNotes(plan.notes)}</span>
                                </div>
                              )}
                            </td>
                          )}

                          <td className="bg-white group-hover:bg-slate-50 border-l border-slate-200 p-1.5 align-middle text-slate-500 min-w-[120px]">
                            <AuditInfoCell 
                              updatedBy={subTab === 'FINANCE' ? (pRecord?.updatedBy || plan.updatedBy) : (plan.updatedBy || pRecord?.updatedBy)} 
                              updatedAt={subTab === 'FINANCE' ? (pRecord?.updatedAt || plan.updatedAt) : (plan.updatedAt || pRecord?.updatedAt)} 
                              projectCode={plan.projectCode}
                              itemTitle={plan.jobContent || (pRecord as any)?.content}
                            />
                          </td>
                      </tr>
                      );
                    })
            )}
          </tbody>
          {subTab === 'FINANCE' && (
            <tfoot className="sticky bottom-0 z-30 border-t-2 border-slate-400 bg-slate-100 font-extrabold text-slate-800 shadow-[0_-3px_10px_rgba(0,0,0,0.12)] text-[11px]">
              <tr className="bg-slate-100">
                <td style={{ width: "var(--stt-width)", minWidth: "var(--stt-width)", maxWidth: "var(--stt-width)", borderRight: '1px solid #94a3b8' }} className="bg-slate-100 px-0 py-2 text-center font-black">
                  ∑
                </td>
                <td style={{ borderRight: '1px solid #94a3b8' }} className="sticky left-0 z-20 bg-slate-100 px-2 py-2 text-left font-black uppercase text-primary min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  TỔNG DỰ ÁN
                </td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-right font-mono font-black text-slate-900 px-1.5">{showNumber(totals.sell) || '0'}</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-right font-mono font-black text-slate-900 px-1.5">{showNumber(totals.cost) || '0'}</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-right font-mono font-black text-blue-700 px-1.5">{showNumber(totals.costPaid) || '0'}</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-right font-mono font-black px-1.5">
                  <span className={totals.profit < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                    {showNumber(totals.profit) || '0'}
                  </span>
                </td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="border-r border-slate-300 p-1 text-center">-</td>
                <td className="p-1 text-center">-</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Controls */}
      {(() => {
        const uncollapsedRows = groupedData.filter(plan => plan.isSec || !collapsedSections.has(plan._sectionKey || ''));
        const totalRows = uncollapsedRows.length;
        if (totalRows === 0) return null;

        if (tablePaginationMode === 'infinite') {
          return null;
        }

        const effectivePageSize = tablePageSize || 25;
        const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));
        return (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shrink-0 select-none">
            <div className="flex items-center gap-2">
              <span className="font-medium whitespace-nowrap">Hiển thị {(tablePage - 1) * effectivePageSize + 1}-{Math.min(tablePage * effectivePageSize, totalRows)} / {totalRows} mục</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={tablePage <= 1}
                onClick={() => setTablePage(1)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 shadow-xs"
              >
                Đầu
              </button>
              <button
                type="button"
                disabled={tablePage <= 1}
                onClick={() => setTablePage(p => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 shadow-xs"
              >
                Trước
              </button>
              <span className="px-3 font-semibold text-slate-700 whitespace-nowrap">
                Trang {tablePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={tablePage >= totalPages}
                onClick={() => setTablePage(p => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 shadow-xs"
              >
                Sau
              </button>
              <button
                type="button"
                disabled={tablePage >= totalPages}
                onClick={() => setTablePage(totalPages)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 shadow-xs"
              >
                Cuối
              </button>
            </div>
          </div>
        );
      })()}

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />

      {/* Modal Lập Yêu cầu mua hàng đa cấp */}
      {isPurchaseRequestModalOpen && (
        <PurchaseRequestModal
          isOpen={isPurchaseRequestModalOpen}
          onClose={() => setIsPurchaseRequestModalOpen(false)}
          selectedItems={selectableItems.filter(p => selectedIds.has(p.id))}
          projectCode={selectedProject || 'COMPANY'}
          projectName={selectedProject || 'Dự án'}
          engineers={engineers}
          currentUser={user}
          onSubmit={handleCreatePurchaseRequestSubmit}
        />
      )}

      {/* Modal Danh sách duyệt Yêu cầu mua hàng đa cấp */}
      {isPurchaseRequestListModalOpen && (
        <PurchaseRequestListModal
          isOpen={isPurchaseRequestListModalOpen}
          onClose={() => setIsPurchaseRequestListModalOpen(false)}
          requests={purchaseRequests}
          currentUser={user}
          loading={loadingPurchaseRequests}
          onRefresh={fetchPurchaseRequests}
          onApproveByChecker={handleApprovePurchaseByChecker}
          onApproveByReviewer={handleApprovePurchaseByReviewer}
          onReject={handleRejectPurchase}
          onMarkOrdered={handleMarkPurchaseOrdered}
        />
      )}
    </div>
  );
};
