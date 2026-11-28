import React, { useMemo, useState } from 'react';
import { DocumentTrack } from '@/types';
import {
  DocumentFlow,
  formatCurrency,
  formatDateDisplay,
  calculateDocumentDueInfo,
  INPUT_STATUSES,
  OUTPUT_STATUSES,
  INPUT_SUBTYPES,
  OUTPUT_SUBTYPES
} from './documentConstants';
import { CustomSelect } from '@/components/common/CustomSelect';
import { ColumnResizeHandle } from '@/components/common/ColumnResizeHandle';
import { useTableColumnResize } from '@/services/useTableColumnResize';
import { FileViewerItem } from '@/components/common/FileViewerItem';
import { AuditInfoCell } from '@/components/common/AuditInfoCell';
import { Modal } from '@/components/common/Modal';
import { StandardFilterToolbar } from '@/components/common/StandardFilterToolbar';

interface DocumentFlowTableProps {
  flow: DocumentFlow;
  documents: DocumentTrack[];
  isLockedProject?: boolean;
  onEdit: (doc: DocumentTrack) => void;
  onDelete: (doc: DocumentTrack) => void;
  onViewDetail?: (doc: DocumentTrack) => void;
  onOpenNew: () => void;
  onExportExcel: () => void;
  isAllowedToManage: boolean;
  onClassify?: (doc: DocumentTrack, targetFlow: 'input' | 'output') => void;
}

export const DocumentFlowTable: React.FC<DocumentFlowTableProps> = ({
  flow,
  documents,
  isLockedProject = false,
  onEdit,
  onDelete,
  onViewDetail,
  onOpenNew,
  onExportExcel,
  isAllowedToManage,
  onClassify
}) => {
  const isUnclassified = flow === 'unclassified';
  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubType, setFilterSubType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDueCategory, setFilterDueCategory] = useState<'all' | 'no_due' | 'warning' | 'overdue' | 'completed'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterPartner, setFilterPartner] = useState('all');
  const [filterHasFiles, setFilterHasFiles] = useState<'all' | 'has_file' | 'no_file'>('all');
  const [filterCreator, setFilterCreator] = useState('all');
  const [filePreviewDoc, setFilePreviewDoc] = useState<DocumentTrack | null>(null);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  // Danh sách đối tác và người tạo duy nhất để chọn trong bộ lọc
  const partnerOptions = useMemo(() => {
    const list = Array.from(new Set(documents.map(d => (d.company || '').trim()).filter(Boolean)));
    return ['all', ...list];
  }, [documents]);

  const creatorOptions = useMemo(() => {
    const list = Array.from(new Set(documents.map(d => (d.createdByName || d.createdById || '').trim()).filter(Boolean)));
    return ['all', ...list];
  }, [documents]);

  // Độ rộng cột
  const defaultColWidths = useMemo(() => ({
    col_stt: 50,
    col_code: 130,
    col_type: 160,
    col_name: 240,
    col_partner: 220,
    col_project: 150,
    col_invoice_no: 120,
    col_total: 130,
    col_paid: 130,
    col_remaining: 130,
    col_send_date: 105,
    col_due_date: 135,
    col_actual_date: 110,
    col_status: 120,
    col_files: 60,
    col_audit: 140,
    col_actions: 90
  }), []);

  const { widths: colWidths, startResize, resetWidths } = useTableColumnResize({
    tableId: `table_doc_flow_${flow}`,
    defaultWidths: defaultColWidths
  });

  // Lọc dữ liệu
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      // Tìm kiếm từ khóa
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          (doc.contractNo || '').toLowerCase().includes(q) ||
          (doc.contractName || '').toLowerCase().includes(q) ||
          (doc.company || '').toLowerCase().includes(q) ||
          (doc.subType || '').toLowerCase().includes(q) ||
          (doc.invoiceNo || '').toLowerCase().includes(q) ||
          (doc.receiverName || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      // Lọc theo loại chứng từ
      if (filterSubType !== 'all' && doc.subType !== filterSubType) {
        return false;
      }

      // Lọc theo trạng thái quy trình
      if (filterStatus !== 'all' && doc.docStatus !== filterStatus) {
        return false;
      }

      // Lọc theo quy tắc hạn
      if (filterDueCategory !== 'all') {
        const dueInfo = calculateDocumentDueInfo(doc);
        if (filterDueCategory === 'no_due' && dueInfo.hasDueDate) return false;
        if (filterDueCategory === 'warning' && dueInfo.status !== 'warning' && dueInfo.status !== 'due_today') return false;
        if (filterDueCategory === 'overdue' && dueInfo.status !== 'overdue') return false;
        if (filterDueCategory === 'completed' && dueInfo.status !== 'completed') return false;
      }

      // Lọc theo khoảng ngày (sendDate hoặc invoiceDate)
      if (filterDateFrom || filterDateTo) {
        const d = doc.sendDate || (doc.createdAt ? doc.createdAt.split('T')[0] : '');
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
      }

      // Lọc theo đối tác
      if (filterPartner !== 'all') {
        if ((doc.company || '').trim() !== filterPartner) return false;
      }

      // Lọc theo có file đính kèm hay không
      if (filterHasFiles !== 'all') {
        const docHasFiles = Boolean(doc.fileUrls && doc.fileUrls.length > 0);
        if (filterHasFiles === 'has_file' && !docHasFiles) return false;
        if (filterHasFiles === 'no_file' && docHasFiles) return false;
      }

      // Lọc theo người tạo
      if (filterCreator !== 'all') {
        const creator = (doc.createdByName || doc.createdById || '').trim();
        if (creator !== filterCreator) return false;
      }

      return true;
    });
  }, [documents, searchTerm, filterSubType, filterStatus, filterDueCategory, filterDateFrom, filterDateTo, filterPartner, filterHasFiles, filterCreator]);

  // Thống kê nhanh thanh số liệu dưới toolbar
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalPaid = 0;
    let totalRemain = 0;
    let overdueCount = 0;
    let warningCount = 0;
    let noDueCount = 0;

    filteredDocs.forEach(d => {
      const val = d.totalAmount ?? d.contractValue ?? 0;
      const paid = d.paidAmount ?? d.prepayAmount ?? 0;
      const remain = Math.max(0, val - paid);

      totalValue += val;
      totalPaid += paid;
      totalRemain += remain;

      const dueInfo = calculateDocumentDueInfo(d);
      if (!dueInfo.hasDueDate) noDueCount++;
      else if (dueInfo.status === 'overdue') overdueCount++;
      else if (dueInfo.status === 'warning' || dueInfo.status === 'due_today') warningCount++;
    });

    return { totalValue, totalPaid, totalRemain, overdueCount, warningCount, noDueCount };
  }, [filteredDocs]);

  const subTypeOptions = isUnclassified ? [] : (flow === 'input' ? INPUT_SUBTYPES : OUTPUT_SUBTYPES);
  const statusOptions = isUnclassified ? [] : (flow === 'input' ? INPUT_STATUSES : OUTPUT_STATUSES);
  const partnerHeader = isUnclassified ? 'Đối tác / bên liên quan' : (flow === 'input' ? 'Nhà cung cấp / Đối tác' : 'Khách hàng / Chủ đầu tư');
  const totalHeader = isUnclassified ? 'Tổng giá trị' : (flow === 'input' ? 'Tổng tiền phải trả' : 'Tổng tiền phải thu');
  const paidHeader = isUnclassified ? 'Đã phát sinh' : (flow === 'input' ? 'Đã thanh toán' : 'Đã thu');
  const remainHeader = isUnclassified ? 'Chưa đối chiếu' : (flow === 'input' ? 'Còn phải trả' : 'Còn phải thu');
  const dueHeader = isUnclassified ? 'Hạn (nếu có)' : (flow === 'input' ? 'Hạn thanh toán' : 'Hạn phải thu');
  const actualHeader = isUnclassified ? 'Ngày phát sinh' : (flow === 'input' ? 'Ngày chi TT' : 'Ngày thu TT');

  const hasActiveFilter =
    searchTerm ||
    filterSubType !== 'all' ||
    filterStatus !== 'all' ||
    filterDueCategory !== 'all' ||
    filterDateFrom ||
    filterDateTo ||
    filterPartner !== 'all' ||
    filterHasFiles !== 'all' ||
    filterCreator !== 'all';

  const selectFilters = useMemo(() => {
    const filters: any[] = [];

    if (!isUnclassified && subTypeOptions.length > 0) {
      filters.push({
        id: 'subType',
        label: 'Loại hồ sơ',
        value: filterSubType,
        onChange: setFilterSubType,
        options: [
          { value: 'all', label: 'Tất cả loại hồ sơ' },
          ...subTypeOptions.map(t => ({ value: t, label: t }))
        ],
        minWidth: 'min-w-[130px]',
        maxWidth: 'max-w-[180px]',
      });
    }

    if (!isUnclassified && statusOptions.length > 0) {
      filters.push({
        id: 'status',
        label: 'Trạng thái',
        value: filterStatus,
        onChange: setFilterStatus,
        options: [
          { value: 'all', label: 'Tất cả trạng thái' },
          ...statusOptions.map(st => ({ value: st, label: st }))
        ],
        minWidth: 'min-w-[120px]',
        maxWidth: 'max-w-[160px]',
      });
    }

    filters.push({
      id: 'dueCategory',
      label: 'Thời hạn',
      value: filterDueCategory,
      onChange: setFilterDueCategory,
      options: [
        { value: 'all', label: 'Tất cả thời hạn' },
        { value: 'no_due', label: 'Chưa xác định hạn' },
        { value: 'warning', label: '🔔 Sắp đến hạn' },
        { value: 'overdue', label: '🔴 Quá hạn' },
        { value: 'completed', label: '✅ Đã hoàn thành' },
      ],
      minWidth: 'min-w-[120px]',
      maxWidth: 'max-w-[170px]',
    });

    if (partnerOptions.length > 2) {
      filters.push({
        id: 'partner',
        label: 'Đối tác',
        value: filterPartner,
        onChange: setFilterPartner,
        options: partnerOptions.map(p => ({ value: p, label: p === 'all' ? 'Tất cả đối tác' : p })),
        minWidth: 'min-w-[120px]',
        maxWidth: 'max-w-[180px]',
      });
    }

    filters.push({
      id: 'hasFiles',
      label: 'Tệp đính kèm',
      value: filterHasFiles,
      onChange: setFilterHasFiles,
      options: [
        { value: 'all', label: 'Tất cả tệp' },
        { value: 'has_file', label: '📎 Có tệp đính kèm' },
        { value: 'no_file', label: 'Chưa có tệp' },
      ],
      minWidth: 'min-w-[110px]',
      maxWidth: 'max-w-[150px]',
    });

    if (creatorOptions.length > 2) {
      filters.push({
        id: 'creator',
        label: 'Người tạo',
        value: filterCreator,
        onChange: setFilterCreator,
        options: creatorOptions.map(c => ({ value: c, label: c === 'all' ? 'Tất cả người tạo' : c })),
        minWidth: 'min-w-[110px]',
        maxWidth: 'max-w-[160px]',
      });
    }

    return filters;
  }, [isUnclassified, subTypeOptions, statusOptions, filterSubType, filterStatus, filterDueCategory, partnerOptions, filterPartner, filterHasFiles, creatorOptions, filterCreator]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar chuẩn hóa theo phong cách toàn hệ thống */}
      <StandardFilterToolbar
        totalCount={filteredDocs.length}
        totalCountLabel="hồ sơ"
        searchQuery={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm mã, trích yếu, số HĐ, đối tác..."
        onResetColumnWidths={resetWidths}
        selectFilters={selectFilters}
        dateRange={{
          label: 'Ngày',
          fromDate: filterDateFrom,
          toDate: filterDateTo,
          onFromChange: setFilterDateFrom,
          onToChange: setFilterDateTo,
        }}
        onResetFilters={hasActiveFilter ? () => {
          setSearchTerm('');
          setFilterSubType('all');
          setFilterStatus('all');
          setFilterDueCategory('all');
          setFilterDateFrom('');
          setFilterDateTo('');
          setFilterPartner('all');
          setFilterHasFiles('all');
          setFilterCreator('all');
        } : undefined}
      >
        {/* Tóm tắt cảnh báo hạn & tổng tiền nằm gọn cùng toolbar, không tạo thêm dòng trống */}
        <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
          {stats.overdueCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
              🔴 {stats.overdueCount} quá hạn
            </span>
          )}
          {stats.warningCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
              🔔 {stats.warningCount} sắp đến hạn
            </span>
          )}
          <div className="flex items-center gap-2">
            <span>Tổng: <b className="text-slate-900 font-mono">{formatCurrency(stats.totalValue)}</b></span>
            {!isUnclassified && <span>| {paidHeader}: <b className="text-emerald-700 font-mono">{formatCurrency(stats.totalPaid)}</b></span>}
            {!isUnclassified && <span>| {remainHeader}: <b className="text-amber-700 font-mono">{formatCurrency(stats.totalRemain)}</b></span>}
          </div>
        </div>
      </StandardFilterToolbar>

      {/* 2. Bảng dữ liệu có thanh cuộn ngang có tay kéo và kéo giãn độ rộng cột */}
      <div className="bg-white flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto table-scrollbar custom-scrollbar w-full flex-1">
          <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th style={{ width: colWidths.col_stt }} className="p-2.5 text-center relative">
                  #
                  <ColumnResizeHandle colKey="col_stt" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_code }} className="p-2.5 relative">
                  Mã hồ sơ
                  <ColumnResizeHandle colKey="col_code" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_type }} className="p-2.5 relative">
                  Loại chứng từ
                  <ColumnResizeHandle colKey="col_type" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_name }} className="p-2.5 relative">
                  Trích yếu / Nội dung
                  <ColumnResizeHandle colKey="col_name" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_partner }} className="p-2.5 relative">
                  {partnerHeader}
                  <ColumnResizeHandle colKey="col_partner" onResizeStart={startResize} />
                </th>
                {!isLockedProject && (
                  <th style={{ width: colWidths.col_project }} className="p-2.5 relative">
                    Dự án
                    <ColumnResizeHandle colKey="col_project" onResizeStart={startResize} />
                  </th>
                )}
                <th style={{ width: colWidths.col_invoice_no }} className="p-2.5 relative">
                  Số HĐ / Chứng từ
                  <ColumnResizeHandle colKey="col_invoice_no" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_total }} className="p-2.5 text-right relative">
                  {totalHeader}
                  <ColumnResizeHandle colKey="col_total" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_paid }} className="p-2.5 text-right relative">
                  {paidHeader}
                  <ColumnResizeHandle colKey="col_paid" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_remaining }} className="p-2.5 text-right relative">
                  {remainHeader}
                  <ColumnResizeHandle colKey="col_remaining" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_send_date }} className="p-2.5 text-center relative">
                  Ngày lập
                  <ColumnResizeHandle colKey="col_send_date" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_due_date }} className="p-2.5 text-center relative">
                  {dueHeader}
                  <ColumnResizeHandle colKey="col_due_date" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_actual_date }} className="p-2.5 text-center relative">
                  {actualHeader}
                  <ColumnResizeHandle colKey="col_actual_date" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_status }} className="p-2.5 text-center relative">
                  Trạng thái
                  <ColumnResizeHandle colKey="col_status" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_files }} className="p-2.5 text-center relative">
                  File
                  <ColumnResizeHandle colKey="col_files" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_audit }} className="p-2.5 text-center relative">
                  Người tạo
                  <ColumnResizeHandle colKey="col_audit" onResizeStart={startResize} />
                </th>
                <th style={{ width: colWidths.col_actions }} className="p-2.5 text-center">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl block mb-2 text-slate-300">
                      folder_open
                    </span>
                    <span className="font-medium">Chưa có hồ sơ nào phù hợp với điều kiện tìm kiếm.</span>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc, idx) => {
                  const val = doc.totalAmount ?? doc.contractValue ?? 0;
                  const paid = doc.paidAmount ?? doc.prepayAmount ?? 0;
                  const remain = Math.max(0, val - paid);
                  const dueInfo = calculateDocumentDueInfo(doc);

                  return (
                    <tr key={doc.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* # STT */}
                      <td className="p-2.5 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      {/* Mã hồ sơ */}
                      <td className="p-2.5 font-mono font-bold text-slate-800">
                        {doc.contractNo || '-'}
                      </td>

                      {/* Loại chứng từ */}
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 inline-block border border-slate-200">
                          {doc.subType || (isUnclassified ? 'Chưa xác định' : (flow === 'input' ? 'Hóa đơn NCC' : 'Hợp đồng CĐT'))}
                        </span>
                      </td>

                      {/* Trích yếu / Nội dung */}
                      <td className="p-2.5 font-semibold text-slate-900 max-w-[260px] truncate" title={doc.contractName}>
                        {doc.contractName}
                        {doc.notes && (
                          <div className="text-[10px] text-slate-400 font-normal truncate" title={doc.notes}>
                            {doc.notes}
                          </div>
                        )}
                      </td>

                      {/* Đối tác */}
                      <td className="p-2.5 font-medium text-slate-700 max-w-[220px] truncate" title={doc.company}>
                        {doc.company || '-'}
                        {doc.receiverName && (
                          <div className="text-[10px] text-slate-400">LH: {doc.receiverName}</div>
                        )}
                      </td>

                      {/* Dự án nếu ở cấp toàn công ty */}
                      {!isLockedProject && (
                        <td className="p-2.5 text-slate-600 font-medium">
                          {doc.projectCode === 'COMPANY' ? '🏢 Công ty' : doc.projectCode || '-'}
                        </td>
                      )}

                      {/* Số HĐ / Chứng từ */}
                      <td className="p-2.5 font-mono text-slate-700">
                        {doc.invoiceNo || '-'}
                      </td>

                      {/* Tổng tiền */}
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(val)}
                      </td>

                      {/* Đã thanh toán / Đã thu */}
                      <td className="p-2.5 text-right font-mono font-semibold text-emerald-700">
                        {formatCurrency(paid)}
                      </td>

                      {/* Còn phải trả / Còn phải thu */}
                      <td className={`p-2.5 text-right font-mono font-bold ${remain > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                        {formatCurrency(remain)}
                      </td>

                      {/* Ngày lập */}
                      <td className="p-2.5 text-center font-mono text-slate-600">
                        {formatDateDisplay(doc.sendDate)}
                      </td>

                      {/* Hạn thanh toán theo quy tắc chuẩn: Nếu không có hạn -> hiện 'Chưa xác định hạn' */}
                      <td className="p-2.5 text-center">
                        {dueInfo.hasDueDate ? (
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-[11px] text-slate-800">
                              {formatDateDisplay(doc.dueDate)}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${dueInfo.badgeClass}`}>
                              {dueInfo.text}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-100 border border-slate-200">
                            Chưa xác định hạn
                          </span>
                        )}
                      </td>

                      {/* Ngày thực tế */}
                      <td className="p-2.5 text-center font-mono text-slate-600">
                        {formatDateDisplay(doc.actualPaymentDate)}
                      </td>

                      {/* Trạng thái */}
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          {doc.docStatus || 'Nháp'}
                        </span>
                      </td>

                      {/* File đính kèm */}
                      <td className="p-2.5 text-center">
                        {doc.fileUrls && doc.fileUrls.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveFileIndex(0);
                              setFilePreviewDoc(doc);
                            }}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[11px] hover:bg-blue-100 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer transition-colors"
                            title={`Xem ${doc.fileUrls.length} tệp đính kèm`}
                            aria-label={`Xem ${doc.fileUrls.length} tệp đính kèm của ${doc.contractName || doc.contractNo || 'hồ sơ'}`}
                          >
                            <span className="material-symbols-outlined text-[13px]">attach_file</span>
                            {doc.fileUrls.length}
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Người tạo / Audit */}
                      <td className="p-2.5 text-center">
                        <AuditInfoCell
                          updatedBy={doc.updatedBy || doc.createdByName}
                          updatedAt={doc.updatedAt || doc.createdAt}
                          projectCode={doc.projectCode}
                          itemTitle={doc.contractName}
                        />
                      </td>

                      {/* Thao tác */}
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Nút Xem chi tiết 4 tab: Tổng quan, Đợt chi, Checklist, Phiên bản */}
                          <button
                            type="button"
                            onClick={() => onViewDetail ? onViewDetail(doc) : onEdit(doc)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded cursor-pointer transition"
                            title="Xem chi tiết, các đợt thanh toán, checklist & lịch sử phiên bản"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>
                          </button>
                          {isUnclassified ? (
                            isAllowedToManage && onClassify && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onClassify(doc, 'input')}
                                  className="px-1.5 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 cursor-pointer"
                                  title="Xác nhận là Hồ sơ đầu vào / phải trả"
                                >Vào</button>
                                <button
                                  type="button"
                                  onClick={() => onClassify(doc, 'output')}
                                  className="px-1.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer"
                                  title="Xác nhận là Hồ sơ đầu ra / phải thu"
                                >Ra</button>
                              </div>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => onEdit(doc)}
                              className="p-1 text-slate-500 hover:text-primary hover:bg-slate-100 rounded cursor-pointer transition"
                              title="Chỉnh sửa thông tin hồ sơ"
                            >
                              <span className="material-symbols-outlined text-[17px]">edit</span>
                            </button>
                          )}
                          {isAllowedToManage && (
                            <button
                              type="button"
                              onClick={() => onDelete(doc)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition"
                              title="Xóa hồ sơ"
                            >
                              <span className="material-symbols-outlined text-[17px]">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={!!filePreviewDoc}
        onClose={() => setFilePreviewDoc(null)}
        title={`Tệp đính kèm${filePreviewDoc?.contractNo ? ` · ${filePreviewDoc.contractNo}` : ''}`}
        size="full"
        defaultMaximized={true}
        icon="attach_file"
      >
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {(filePreviewDoc?.fileUrls?.length || 0) > 1 && (
            <div className="flex flex-wrap gap-2 shrink-0 border-b border-slate-200 pb-3">
              {filePreviewDoc?.fileUrls?.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => setActiveFileIndex(index)}
                  className={`px-3 py-1.5 text-xs font-semibold border rounded-md transition-colors cursor-pointer ${
                    activeFileIndex === index
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Tệp {index + 1}
                </button>
              ))}
            </div>
          )}
          {filePreviewDoc?.fileUrls?.[activeFileIndex] && (
            <div className="flex-1 min-h-0">
              <FileViewerItem
                url={filePreviewDoc.fileUrls[activeFileIndex]}
                index={activeFileIndex}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
