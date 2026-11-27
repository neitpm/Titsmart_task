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
  isAllowedToManage
}) => {
  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubType, setFilterSubType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDueCategory, setFilterDueCategory] = useState<'all' | 'no_due' | 'warning' | 'overdue' | 'completed'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

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

      return true;
    });
  }, [documents, searchTerm, filterSubType, filterStatus, filterDueCategory, filterDateFrom, filterDateTo]);

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

  const subTypeOptions = flow === 'input' ? INPUT_SUBTYPES : OUTPUT_SUBTYPES;
  const statusOptions = flow === 'input' ? INPUT_STATUSES : OUTPUT_STATUSES;
  const partnerHeader = flow === 'input' ? 'Nhà cung cấp / Đối tác' : 'Khách hàng / Chủ đầu tư';
  const totalHeader = flow === 'input' ? 'Tổng tiền phải trả' : 'Tổng tiền phải thu';
  const paidHeader = flow === 'input' ? 'Đã thanh toán' : 'Đã thu';
  const remainHeader = flow === 'input' ? 'Còn phải trả' : 'Còn phải thu';
  const dueHeader = flow === 'input' ? 'Hạn thanh toán' : 'Hạn phải thu';
  const actualHeader = flow === 'input' ? 'Ngày chi TT' : 'Ngày thu TT';

  const hasActiveFilter =
    searchTerm ||
    filterSubType !== 'all' ||
    filterStatus !== 'all' ||
    filterDueCategory !== 'all' ||
    filterDateFrom ||
    filterDateTo;

  return (
    <div className="space-y-3">
      {/* 1. Toolbar chuẩn hóa của TITSMART: cuộn ngang có tay kéo */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Cụm bộ lọc nghiệp vụ bên trái */}
          <div className="flex flex-wrap items-center gap-2 grow">
            {/* Loại hồ sơ */}
            <div className="min-w-[160px]">
              <CustomSelect
                value={filterSubType}
                onChange={e => setFilterSubType(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              >
                <option value="all">Tất cả loại hồ sơ</option>
                {subTypeOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </CustomSelect>
            </div>

            {/* Trạng thái quy trình */}
            <div className="min-w-[150px]">
              <CustomSelect
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              >
                <option value="all">Tất cả trạng thái</option>
                {statusOptions.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </CustomSelect>
            </div>

            {/* Bộ lọc Hạn thanh toán theo quy tắc chuẩn */}
            <div className="min-w-[170px]">
              <CustomSelect
                value={filterDueCategory}
                onChange={e => setFilterDueCategory(e.target.value as any)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white font-medium"
              >
                <option value="all">Tất cả thời hạn</option>
                <option value="no_due">⚪ Chưa xác định hạn</option>
                <option value="warning">🔔 Sắp đến hạn</option>
                <option value="overdue">🔴 Quá hạn thanh toán</option>
                <option value="completed">🟢 Đã thanh toán / Đã thu đủ</option>
              </CustomSelect>
            </div>

            {/* Khoảng ngày */}
            <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-600">Từ:</span>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="bg-transparent text-xs outline-none cursor-pointer"
              />
              <span className="text-[11px] font-semibold text-slate-600 ml-1">Đến:</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="bg-transparent text-xs outline-none cursor-pointer"
              />
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative min-w-[200px] grow max-w-xs">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Tìm mã, trích yếu, số HĐ, đối tác..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

            {/* Nút xóa lọc */}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterSubType('all');
                  setFilterStatus('all');
                  setFilterDueCategory('all');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
                className="text-xs px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1 font-semibold cursor-pointer transition"
                title="Xóa toàn bộ bộ lọc"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                <span>Xóa lọc</span>
              </button>
            )}
          </div>

          {/* Cụm thao tác bên phải */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExportExcel}
              className="text-xs px-3 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-emerald-600 text-[16px]">file_download</span>
              <span>Xuất Excel</span>
            </button>

            {isAllowedToManage && (
              <button
                type="button"
                onClick={onOpenNew}
                className="text-xs px-3.5 py-1.5 bg-primary text-white hover:bg-primary/90 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>{flow === 'input' ? 'Thêm hồ sơ đầu vào' : 'Thêm hồ sơ đầu ra'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Thanh tóm tắt số liệu & kết quả */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-2">
            <span>Tìm thấy <b>{filteredDocs.length}</b> hồ sơ</span>
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
            {stats.noDueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] text-slate-500 bg-slate-100">
                {stats.noDueCount} chưa định hạn
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div>Tổng: <b className="text-slate-900 font-mono">{formatCurrency(stats.totalValue)}</b></div>
            <div>{paidHeader}: <b className="text-emerald-700 font-mono">{formatCurrency(stats.totalPaid)}</b></div>
            <div>{remainHeader}: <b className="text-amber-700 font-mono">{formatCurrency(stats.totalRemain)}</b></div>
            <button
              type="button"
              onClick={resetWidths}
              className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer ml-1"
              title="Khôi phục độ rộng mặc định của các cột"
            >
              Reset cột
            </button>
          </div>
        </div>
      </div>

      {/* 2. Bảng dữ liệu có thanh cuộn ngang có tay kéo và kéo giãn độ rộng cột */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto table-scrollbar custom-scrollbar w-full">
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
                          {doc.subType || (flow === 'input' ? 'Hóa đơn NCC' : 'Hợp đồng CĐT')}
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
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[11px]">
                            <span className="material-symbols-outlined text-[13px]">attach_file</span>
                            {doc.fileUrls.length}
                          </span>
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
                          <button
                            type="button"
                            onClick={() => onEdit(doc)}
                            className="p-1 text-slate-500 hover:text-primary hover:bg-slate-100 rounded cursor-pointer transition"
                            title="Chỉnh sửa thông tin hồ sơ"
                          >
                            <span className="material-symbols-outlined text-[17px]">edit</span>
                          </button>
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
    </div>
  );
};
