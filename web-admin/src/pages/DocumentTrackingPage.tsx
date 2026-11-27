import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useOutletContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore, hasPermission, canManageItem, isDirector, isSystemAdmin } from '../services/authStore';
import { Toast } from '../components/common/Toast';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { ImportExportDropdown } from '../components/common/ImportExportDropdown';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { DocumentTrack } from '../types';
import { exportToStyledExcel } from '../utils/excelExportUtils';
import * as XLSX from 'xlsx';

import {
  DocumentFlow,
  resolveDocumentFlow,
  formatCurrency,
  formatDateDisplay,
  calculateDocumentDueInfo
} from './documents/documentConstants';
import { DocumentOverviewTab } from './documents/DocumentOverviewTab';
import { DocumentFlowTable } from './documents/DocumentFlowTable';
import { DocumentFormModal } from './documents/DocumentFormModal';
import { DocumentDetailModal } from './documents/DocumentDetailModal';
import { CustomSelect } from '@/components/common/CustomSelect';

export const DocumentTrackingPage: React.FC = () => {
  const documentTracks = useRealtimeStore(s => s.documentTracks);
  const projects = useRealtimeStore(s => s.projects);
  const addDocumentTrack = useRealtimeStore(s => s.addDocumentTrack);
  const updateDocumentTrack = useRealtimeStore(s => s.updateDocumentTrack);
  const deleteDocumentTrack = useRealtimeStore(s => s.deleteDocumentTrack);
  const fetchAccounting = useRealtimeStore(s => s.fetchAccounting);
  const logActivity = useRealtimeStore(s => s.logActivity);

  const { user } = useAuthStore();
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const outletContext = useOutletContext<any>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phân quyền tài chính / hồ sơ
  const isAllowedToManage = hasPermission(user, 'MANAGE_DOCUMENTS') || hasPermission(user, 'CREATE_DOCUMENTS') || isDirector(user) || isSystemAdmin(user);

  // Xác định dự án hiện tại (nếu ở trong trang chi tiết dự án)
  const resolvedProjectCode = useMemo(() => {
    if (!projectId) return '';
    const proj = projects.find(p => p.id === projectId || p.code === projectId);
    return proj ? proj.code : projectId;
  }, [projectId, projects]);

  const isLockedProject = Boolean(resolvedProjectCode);

  // Lọc theo dự án ở cấp toàn công ty
  const [filterProjectCode, setFilterProjectCode] = useState<string>(() => {
    return resolvedProjectCode || searchParams.get('project') || 'all';
  });

  useEffect(() => {
    if (resolvedProjectCode) {
      setFilterProjectCode(resolvedProjectCode);
    }
  }, [resolvedProjectCode]);

  // Hồ sơ lịch sử chưa có flowType phải được xác nhận trước khi vào Đầu vào/Đầu ra.
  const [activeMainTab, setActiveMainTab] = useState<'overview' | 'unclassified' | 'input' | 'output'>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'input' || tabParam === 'output' || tabParam === 'unclassified') return tabParam;
    return 'overview';
  });

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'input' || tabParam === 'output' || tabParam === 'unclassified') {
      setActiveMainTab(tabParam);
    } else if (tabParam === 'overview') {
      setActiveMainTab('overview');
    }
  }, [searchParams]);

  const handleSelectMainTab = (tab: 'overview' | 'unclassified' | 'input' | 'output') => {
    setActiveMainTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  // Modal tạo / sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFlow, setModalFlow] = useState<DocumentFlow>('input');
  const [editingDoc, setEditingDoc] = useState<DocumentTrack | null>(null);

  // Modal xem chi tiết 4 tab (Tổng quan, Đợt thanh toán, Checklist, Phiên bản)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailDoc, setSelectedDetailDoc] = useState<DocumentTrack | null>(null);

  // Modal xác nhận xóa
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDestructive: false,
    confirmText: 'Xác nhận'
  });

  // Toast
  const [toastState, setToastState] = useState({ show: false, message: '', type: 'success' as 'success' | 'info' | 'warning' });
  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastState({ show: true, message, type });
    setTimeout(() => setToastState({ show: false, message: '', type: 'success' }), 3000);
  };

  // Portal gắn nút header khi ở trong dự án
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalNode(document.getElementById('project-header-actions'));
  }, []);

  // Lọc danh sách theo dự án hiện tại (nếu có khóa hoặc đang chọn)
  const projectScopedDocs = useMemo(() => {
    return documentTracks.filter(doc => {
      if (isLockedProject) {
        return doc.projectCode === resolvedProjectCode;
      }
      if (filterProjectCode !== 'all') {
        return doc.projectCode === filterProjectCode;
      }
      return true;
    });
  }, [documentTracks, isLockedProject, resolvedProjectCode, filterProjectCode]);

  // Phân tách thành 2 luồng: Đầu vào & Đầu ra
  const inputDocs = useMemo(() => {
    return projectScopedDocs.filter(d => resolveDocumentFlow(d) === 'input');
  }, [projectScopedDocs]);

  const outputDocs = useMemo(() => {
    return projectScopedDocs.filter(d => resolveDocumentFlow(d) === 'output');
  }, [projectScopedDocs]);

  const unclassifiedDocs = useMemo(() => {
    return projectScopedDocs.filter(d => resolveDocumentFlow(d) === 'unclassified');
  }, [projectScopedDocs]);

  // Handlers mở modal tạo mới
  const handleOpenNew = (flow: 'input' | 'output') => {
    setModalFlow(flow);
    setEditingDoc(null);
    setIsModalOpen(true);
  };

  const handleEditDoc = (doc: DocumentTrack) => {
    const flow = resolveDocumentFlow(doc);
    if (flow === 'unclassified') {
      triggerToast('Vui lòng xác nhận hồ sơ là Đầu vào hoặc Đầu ra trước khi chỉnh sửa.', 'warning');
      return;
    }
    setModalFlow(flow);
    setEditingDoc(doc);
    setIsModalOpen(true);
  };

  const handleClassifyDoc = async (doc: DocumentTrack, targetFlow: 'input' | 'output') => {
    const targetLabel = targetFlow === 'input' ? 'Hồ sơ đầu vào (phải trả)' : 'Hồ sơ đầu ra (phải thu)';
    const hasFinancialActivity = Number(doc.paidAmount ?? doc.prepayAmount ?? 0) > 0;
    const reason = window.prompt(
      `Xác nhận phân loại ${doc.contractNo || doc.contractName} thành ${targetLabel}.\n` +
      `${hasFinancialActivity ? 'Hồ sơ đã có phát sinh tiền: thao tác này chỉ đổi luồng hiển thị, không điều chỉnh số tiền. ' : ''}` +
      'Nhập lý do phân loại:',
      'Phân loại lại hồ sơ lịch sử'
    );
    if (reason === null) return;

    try {
      const actor = user?.name || user?.username || 'Người dùng';
      await updateDocumentTrack(doc.id, {
        flowType: targetFlow,
        flowClassificationReason: reason.trim() || 'Phân loại lại hồ sơ lịch sử',
        flowClassifiedAt: new Date().toISOString(),
        flowClassifiedBy: actor,
        side: targetFlow === 'input' ? 'Bên trả' : 'Bên nhận'
      });
      logActivity(
        `Phân loại hồ sơ ${doc.contractNo || doc.contractName}: Chưa phân loại → ${targetFlow === 'input' ? 'Đầu vào' : 'Đầu ra'}. Lý do: ${reason.trim() || 'Phân loại lại hồ sơ lịch sử'}`,
        doc.projectCode || 'COMPANY'
      );
      triggerToast(`Đã chuyển hồ sơ sang ${targetLabel}.`, 'success');
    } catch (err: any) {
      triggerToast(`Không thể phân loại hồ sơ: ${err?.message || 'Xin thử lại'}`, 'warning');
    }
  };

  const handleViewDetailDoc = (doc: DocumentTrack) => {
    setSelectedDetailDoc(doc);
    setIsDetailModalOpen(true);
  };

  const handleUpdateFromDetail = async (updatedData: Partial<DocumentTrack>, versionReason?: string) => {
    if (!selectedDetailDoc) return;
    await updateDocumentTrack(selectedDetailDoc.id, updatedData);
    // Cập nhật state detail hiện tại để modal render mượt mà
    setSelectedDetailDoc(prev => prev ? ({ ...prev, ...updatedData }) : null);
    logActivity(`Cập nhật hồ sơ [${selectedDetailDoc.contractNo}]: ${versionReason || 'Điều chỉnh đợt chi / checklist / phiên bản'}`, selectedDetailDoc.projectCode || 'COMPANY');
  };

  const handleDeleteDoc = (doc: DocumentTrack) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Xóa hồ sơ',
      message: `Bạn có chắc chắn muốn xóa hồ sơ "${doc.contractNo || doc.contractName}" không? Thao tác này không thể hoàn tác.`,
      isDestructive: true,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await deleteDocumentTrack(doc.id);
          logActivity(`Đã xóa hồ sơ: ${doc.contractNo || doc.contractName}`, doc.projectCode || 'COMPANY');
          triggerToast('Đã xóa hồ sơ thành công!', 'success');
        } catch (err: any) {
          triggerToast('Lỗi khi xóa hồ sơ: ' + (err.message || 'Xin thử lại'), 'warning');
        } finally {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSaveDoc = async (data: Partial<DocumentTrack>) => {
    if (editingDoc) {
      await updateDocumentTrack(editingDoc.id, data);
      logActivity(`Cập nhật hồ sơ: ${data.contractNo || editingDoc.contractNo}`, data.projectCode || 'COMPANY');
      triggerToast('Đã cập nhật hồ sơ thành công!', 'success');
    } else {
      await addDocumentTrack(data as any);
      logActivity(`Tạo hồ sơ mới: ${data.contractNo || data.contractName}`, data.projectCode || 'COMPANY');
      triggerToast('Đã thêm hồ sơ mới thành công!', 'success');
    }
  };

  // Xuất Excel theo luồng hiện tại
  const handleExportCurrentExcel = async () => {
    const targetDocs = activeMainTab === 'input' ? inputDocs : (activeMainTab === 'output' ? outputDocs : (activeMainTab === 'unclassified' ? unclassifiedDocs : projectScopedDocs));
    const flowTitle = activeMainTab === 'input' ? 'HO_SO_DAU_VAO' : (activeMainTab === 'output' ? 'HO_SO_DAU_RA' : (activeMainTab === 'unclassified' ? 'HO_SO_CHUA_PHAN_LOAI' : 'HO_SO_TONG_HOP'));

    const data = targetDocs.map((t, idx) => {
      const flow = resolveDocumentFlow(t);
      const val = t.totalAmount ?? t.contractValue ?? 0;
      const paid = t.paidAmount ?? t.prepayAmount ?? 0;
      const remain = Math.max(0, val - paid);
      const dueInfo = calculateDocumentDueInfo(t);

      return {
        'STT': idx + 1,
        'Luồng hồ sơ': flow === 'input' ? 'Đầu vào (Phải trả)' : (flow === 'output' ? 'Đầu ra (Phải thu)' : 'Chưa phân loại'),
        'Mã hồ sơ': t.contractNo || '',
        'Loại chứng từ': t.subType || '',
        'Trích yếu / Nội dung': t.contractName || '',
        'Đối tác / Công ty': t.company || '',
        'Người liên hệ': t.receiverName || '',
        'Số điện thoại': t.phone || '',
        'Dự án': projects.find(p => p.code === t.projectCode)?.name || t.projectCode || '',
        'Số hóa đơn/chứng từ': t.invoiceNo || '',
        'Tổng tiền (VNĐ)': val,
        'Đã thanh toán / Đã thu (VNĐ)': paid,
        'Còn nợ / Còn phải thu (VNĐ)': remain,
        'Ngày lập / Ngày gửi': formatDateDisplay(t.sendDate),
        'Hạn thanh toán': dueInfo.hasDueDate ? formatDateDisplay(t.dueDate) : 'Chưa xác định hạn',
        'Tình trạng hạn': dueInfo.text,
        'Ngày thực tế': formatDateDisplay(t.actualPaymentDate),
        'Trạng thái quy trình': t.docStatus || '',
        'Trạng thái thanh toán': t.paymentStatus || '',
        'Ghi chú': t.notes || ''
      };
    });

    if (data.length === 0) {
      triggerToast('Không có dữ liệu hồ sơ để xuất!', 'warning');
      return;
    }

    await exportToStyledExcel({
      fileName: `${flowTitle}_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'DanhSachHoSo',
      title: activeMainTab === 'input'
        ? 'BẢNG THEO DÕI HỒ SƠ ĐẦU VÀO (CÔNG TY PHẢI TRẢ TIỀN)'
        : (activeMainTab === 'output'
          ? 'BẢNG THEO DÕI HỒ SƠ ĐẦU RA (THU TIỀN TỪ KHÁCH HÀNG / CĐT)'
          : (activeMainTab === 'unclassified' ? 'BẢNG HỒ SƠ CHƯA PHÂN LOẠI – CẦN XÁC NHẬN LUỒNG' : 'BẢNG THEO DÕI TOÀN BỘ HỒ SƠ DỰ ÁN & CÔNG TY')),
      data
    });
  };

  // Nhập file Excel (giữ lại khả năng tương thích)
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let importCount = 0;
        rows.slice(1).forEach((row) => {
          if (!row || !row[2]) return;
          addDocumentTrack({
            contractNo: String(row[1] || `HD-${Date.now().toString().slice(-6)}`),
            contractName: String(row[2] || 'Hồ sơ nhập'),
            projectCode: resolvedProjectCode || String(row[3] || 'COMPANY'),
            company: String(row[4] || ''),
            receiverName: String(row[5] || ''),
            phone: String(row[6] || ''),
            sendDate: new Date().toISOString().split('T')[0],
            dueDate: null, // MẶC ĐỊNH LƯU NULL, KHÔNG TỰ ĐIỀN HÔM NAY
            totalAmount: Number(row[10]) || 0,
            contractValue: Number(row[10]) || 0,
            paidAmount: Number(row[11]) || 0,
            prepayAmount: Number(row[11]) || 0,
            docStatus: String(row[12] || 'Nháp'),
            flowType: activeMainTab === 'output' ? 'output' : (activeMainTab === 'input' ? 'input' : 'unclassified')
          } as any);
          importCount++;
        });

        triggerToast(`Đã nhập thành công ${importCount} hồ sơ từ file Excel!`, 'success');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        triggerToast('Lỗi phân tích Excel: ' + err.message, 'warning');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col flex-1 h-full bg-slate-50 relative overflow-hidden text-slate-800">
      {/* 1. HEADER SECTION (Cấp Công ty hoặc Cấp Dự án) */}
      {!isLockedProject ? (
        <section className="border-b border-slate-200 bg-white px-3 md:px-5 py-2 md:h-13 flex flex-wrap items-center justify-between gap-3 shadow-2xs z-30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg text-slate-900 border-l-4 border-primary pl-2 uppercase font-extrabold tracking-wide">
                QUẢN LÝ HỒ SƠ
              </h1>
            </div>

            {/* Lọc dự án ở cấp công ty */}
            <div className="hidden sm:flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Dự án:</span>
              <CustomSelect
                value={filterProjectCode}
                onChange={e => setFilterProjectCode(e.target.value)}
                className="w-48 text-xs px-2.5 py-1 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              >
                <option value="all">Toàn bộ công ty & Dự án</option>
                <option value="COMPANY">Hồ sơ Văn phòng / Chung</option>
                {projects.map(p => (
                  <option key={p.id} value={p.code}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <ImportExportDropdown
              onImportClick={() => fileInputRef.current?.click()}
              importLabel="Nhập Excel"
              onExportExcel={handleExportCurrentExcel}
              onExportCsv={handleExportCurrentExcel}
              onExportPdf={() => window.print()}
              onExportWord={handleExportCurrentExcel}
            />

            {isAllowedToManage && (
              <div className="flex items-center">
                <CustomSelect
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'input' || val === 'output') {
                      handleOpenNew(val);
                    }
                  }}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 font-semibold focus:border-primary focus:ring-1 focus:ring-primary shadow-xs cursor-pointer min-w-[140px]"
                >
                  <option value="" disabled>+ Thêm hồ sơ mới...</option>
                  <option value="input">Hồ sơ đầu vào (Phải trả)</option>
                  <option value="output">Hồ sơ đầu ra (Phải thu)</option>
                </CustomSelect>
              </div>
            )}
          </div>
        </section>
      ) : (
        /* Khi ở trong chi tiết dự án: gắn nút lên thanh project-header-actions và không tạo thêm thanh header trùng lặp */
        portalNode ? createPortal(
          <div className="flex items-center gap-2">
            <ImportExportDropdown
              onImportClick={() => fileInputRef.current?.click()}
              importLabel="Nhập Excel"
              onExportExcel={handleExportCurrentExcel}
              onExportCsv={handleExportCurrentExcel}
              onExportPdf={() => window.print()}
              onExportWord={handleExportCurrentExcel}
            />

            {isAllowedToManage && (
              <div className="flex items-center">
                <CustomSelect
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'input' || val === 'output') {
                      handleOpenNew(val);
                    }
                  }}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 font-semibold focus:border-primary focus:ring-1 focus:ring-primary shadow-xs cursor-pointer min-w-[140px]"
                >
                  <option value="" disabled>+ Thêm hồ sơ mới...</option>
                  <option value="input">Hồ sơ đầu vào (Phải trả)</option>
                  <option value="output">Hồ sơ đầu ra (Phải thu)</option>
                </CustomSelect>
              </div>
            )}
          </div>,
          portalNode
        ) : null
      )}



      {/* 3. NỘI DUNG – hiển thị theo tab từ sidebar hoặc overview */}
      {activeMainTab === 'overview' ? (
        <PullToRefresh onRefresh={async () => { await fetchAccounting(); }} className="flex-1 overflow-y-auto">
          <div className="p-0">
            <DocumentOverviewTab
              inputDocs={inputDocs}
              outputDocs={outputDocs}
              onSelectTab={(tab) => handleSelectMainTab(tab)}
              onViewDetail={handleViewDetailDoc}
            />
          </div>
        </PullToRefresh>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <DocumentFlowTable
            flow={activeMainTab as DocumentFlow}
            documents={activeMainTab === 'input' ? inputDocs : (activeMainTab === 'output' ? outputDocs : unclassifiedDocs)}
            isLockedProject={isLockedProject}
            onEdit={handleEditDoc}
            onDelete={handleDeleteDoc}
            onViewDetail={handleViewDetailDoc}
            onOpenNew={() => activeMainTab !== 'unclassified' && handleOpenNew(activeMainTab as 'input' | 'output')}
            onExportExcel={handleExportCurrentExcel}
            isAllowedToManage={isAllowedToManage}
            onClassify={handleClassifyDoc}
          />
        </div>
      )}

      {/* 4. MODAL CHI TIẾT 4 TAB (TỔNG QUAN, ĐỢT CHI, CHECKLIST, PHIÊN BẢN) */}
      {isDetailModalOpen && selectedDetailDoc && (
        <DocumentDetailModal
          isOpen={isDetailModalOpen}
          documentData={selectedDetailDoc}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedDetailDoc(null);
          }}
          onUpdate={handleUpdateFromDetail}
          triggerToast={triggerToast}
        />
      )}

      {/* 5. MODAL FORM TẠO/SỬA HỒ SƠ */}
      {isModalOpen && (
        <DocumentFormModal
          isOpen={isModalOpen}
          flow={modalFlow}
          documentData={editingDoc}
          defaultProjectCode={resolvedProjectCode || (filterProjectCode !== 'all' ? filterProjectCode : 'COMPANY')}
          lockedProject={isLockedProject}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveDoc}
          triggerToast={triggerToast}
        />
      )}

      {/* 5. MODAL XÁC NHẬN XÓA */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        isDestructive={confirmConfig.isDestructive}
        confirmText={confirmConfig.confirmText}
      />

      {/* 6. TOAST THÔNG BÁO */}
      <Toast
        show={toastState.show}
        message={toastState.message}
        type={toastState.type}
        onClose={() => setToastState(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};
