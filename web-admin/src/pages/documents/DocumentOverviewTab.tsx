import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DocumentTrack } from '@/types';
import { formatCurrency, calculateDocumentDueInfo, formatDateDisplay } from './documentConstants';

interface DocumentOverviewTabProps {
  inputDocs: DocumentTrack[];
  outputDocs: DocumentTrack[];
  onSelectTab: (tab: 'input' | 'output') => void;
  onViewDetail: (doc: DocumentTrack) => void;
}

export const DocumentOverviewTab: React.FC<DocumentOverviewTabProps> = ({
  inputDocs,
  outputDocs,
  onSelectTab,
  onViewDetail
}) => {
  const allDocs = useMemo(() => [...inputDocs, ...outputDocs], [inputDocs, outputDocs]);

  // 1. Thống kê số liệu Đầu vào (Công ty phải trả)
  const inputStats = useMemo(() => {
    let totalMustPay = 0;
    let totalApproved = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let pendingApprovalCount = 0;
    let overdueCount = 0;
    let warningCount = 0;

    inputDocs.forEach(d => {
      const val = d.initialProposedAmount ?? d.totalAmount ?? d.contractValue ?? 0;
      const app = d.approvedAmount ?? val;
      const paid = d.paidAmount ?? d.prepayAmount ?? 0;
      const rem = Math.max(0, app - paid);

      totalMustPay += val;
      totalApproved += app;
      totalPaid += paid;
      totalRemaining += rem;

      if (d.docStatus === 'Chờ duyệt' || d.docStatus === 'Chờ thanh toán') {
        pendingApprovalCount++;
      }

      const dueInfo = calculateDocumentDueInfo(d);
      if (dueInfo.status === 'overdue') {
        overdueCount++;
      } else if (dueInfo.status === 'warning' || dueInfo.status === 'due_today') {
        warningCount++;
      }
    });

    return {
      totalMustPay,
      totalApproved,
      totalPaid,
      totalRemaining,
      pendingApprovalCount,
      overdueCount,
      warningCount
    };
  }, [inputDocs]);

  // 2. Thống kê số liệu Đầu ra (Bên khác phải trả công ty)
  const outputStats = useMemo(() => {
    let totalMustCollect = 0;
    let totalApproved = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let pendingConfirmationCount = 0;
    let overdueCount = 0;
    let warningCount = 0;

    outputDocs.forEach(d => {
      const val = d.initialProposedAmount ?? d.totalAmount ?? d.contractValue ?? 0;
      const app = d.approvedAmount ?? val;
      const col = d.paidAmount ?? d.prepayAmount ?? 0;
      const rem = Math.max(0, app - col);

      totalMustCollect += val;
      totalApproved += app;
      totalCollected += col;
      totalRemaining += rem;

      if (d.docStatus === 'Chờ gửi' || d.docStatus === 'Chờ khách hàng xác nhận') {
        pendingConfirmationCount++;
      }

      const dueInfo = calculateDocumentDueInfo(d);
      if (dueInfo.status === 'overdue') {
        overdueCount++;
      } else if (dueInfo.status === 'warning' || dueInfo.status === 'due_today') {
        warningCount++;
      }
    });

    return {
      totalMustCollect,
      totalApproved,
      totalCollected,
      totalRemaining,
      pendingConfirmationCount,
      overdueCount,
      warningCount
    };
  }, [outputDocs]);

  // 3. BỐN DANH SÁCH CẢNH BÁO KIỂM SOÁT BẮT BUỘC
  // A. Hồ sơ thiếu chứng từ
  const missingDocsList = useMemo(() => {
    return allDocs.filter(d => {
      if (d.docStatus === 'Hủy' || d.docStatus === 'Nháp') return false;
      if (d.checklist && d.checklist.length > 0) {
        return d.checklist.some(c => c.isRequired && c.status !== 'HOP_LE');
      }
      return !d.invoiceNo || !d.fileUrls || d.fileUrls.length === 0;
    }).slice(0, 5);
  }, [allDocs]);

  // B. Đã chi tiền nhưng thiếu UNC / Phiếu chi có dấu
  const missingUncList = useMemo(() => {
    return allDocs.filter(d => {
      const paid = d.paidAmount ?? d.prepayAmount ?? 0;
      if (paid <= 0) return false;
      if (d.installments && d.installments.length > 0) {
        return d.installments.some(inst => !inst.proofFileUrls || inst.proofFileUrls.length === 0);
      }
      return !d.fileUrls || d.fileUrls.length === 0;
    }).slice(0, 5);
  }, [allDocs]);

  // C. Đã thanh toán nhưng thiếu chữ ký / xác nhận bên nhận (Chờ ký hoặc Đang đối soát)
  const pendingSignatureList = useMemo(() => {
    return allDocs.filter(d => {
      const paid = d.paidAmount ?? d.prepayAmount ?? 0;
      if (paid <= 0) return false;
      if (d.signatureStatus === 'CHO_KY_XAC_NHAN' || d.signatureStatus === 'DANG_DOI_SOAT' || d.docStatus?.includes('chờ ký') || d.docStatus?.includes('đối soát')) {
        return true;
      }
      if (d.installments && d.installments.length > 0) {
        return d.installments.some(i => i.confirmationStatus === 'CHO_XAC_NHAN' || i.confirmationStatus === 'TU_CHOI');
      }
      return false;
    }).slice(0, 5);
  }, [allDocs]);

  // D. Hồ sơ sắp quá hạn hoặc quá hạn bổ sung chứng từ / nợ
  const overdueOrUrgentList = useMemo(() => {
    return allDocs.filter(d => {
      const dueInfo = calculateDocumentDueInfo(d);
      return dueInfo.status === 'overdue' || dueInfo.status === 'warning' || dueInfo.status === 'due_today';
    }).slice(0, 5);
  }, [allDocs]);

  // 4. Biểu đồ đường (Line Chart) biến động tài chính 6 tháng gần nhất
  const chartData = useMemo(() => {
    const monthMap = new Map<string, { month: string; inputMustPay: number; inputPaid: number; outputMustCollect: number; outputCollected: number }>();

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `Tháng ${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
      monthMap.set(key, { month: label, inputMustPay: 0, inputPaid: 0, outputMustCollect: 0, outputCollected: 0 });
    }

    inputDocs.forEach(d => {
      const dateKey = (d.sendDate || (d.createdAt ? d.createdAt.split('T')[0] : '')).slice(0, 7);
      if (monthMap.has(dateKey)) {
        const item = monthMap.get(dateKey)!;
        item.inputMustPay += (d.approvedAmount ?? d.totalAmount ?? d.contractValue ?? 0);
        item.inputPaid += (d.paidAmount ?? d.prepayAmount ?? 0);
      }
    });

    outputDocs.forEach(d => {
      const dateKey = (d.sendDate || (d.createdAt ? d.createdAt.split('T')[0] : '')).slice(0, 7);
      if (monthMap.has(dateKey)) {
        const item = monthMap.get(dateKey)!;
        item.outputMustCollect += (d.approvedAmount ?? d.totalAmount ?? d.contractValue ?? 0);
        item.outputCollected += (d.paidAmount ?? d.prepayAmount ?? 0);
      }
    });

    return Array.from(monthMap.values());
  }, [inputDocs, outputDocs]);

  const hasData = inputDocs.length > 0 || outputDocs.length > 0;

  return (
    <div className="space-y-3">
      {/* KHỐI 1: KPI CƠ BẢN ĐỐI CHIẾU NGHĨA VỤ TIỀN THỰC TẾ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Phân hệ 1: Hồ sơ đầu vào */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-xl">upload_file</span>
              <h3 className="font-bold text-slate-800 text-sm">Hồ sơ đầu vào (Công ty phải trả)</h3>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('input')}
              className="text-xs text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Xem chi tiết</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] text-slate-500 font-medium">Đề nghị ban đầu (V1)</div>
              <div className="font-mono font-bold text-xs text-slate-900 mt-1 truncate" title={formatCurrency(inputStats.totalMustPay)}>
                {formatCurrency(inputStats.totalMustPay)}
              </div>
            </div>
            <div className="bg-blue-50/40 p-2 rounded-lg border border-blue-100">
              <div className="text-[10px] text-blue-700 font-medium">Được duyệt</div>
              <div className="font-mono font-bold text-xs text-blue-900 mt-1 truncate" title={formatCurrency(inputStats.totalApproved)}>
                {formatCurrency(inputStats.totalApproved)}
              </div>
            </div>
            <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
              <div className="text-[10px] text-emerald-700 font-medium">Đã chi thực tế</div>
              <div className="font-mono font-bold text-xs text-emerald-800 mt-1 truncate" title={formatCurrency(inputStats.totalPaid)}>
                {formatCurrency(inputStats.totalPaid)}
              </div>
            </div>
            <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100">
              <div className="text-[10px] text-amber-700 font-medium">Còn được chi</div>
              <div className="font-mono font-bold text-xs text-amber-900 mt-1 truncate" title={formatCurrency(inputStats.totalRemaining)}>
                {formatCurrency(inputStats.totalRemaining)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-600 bg-slate-50/70 px-3 py-2 rounded-lg border border-slate-100">
            <div>Chờ duyệt/chi: <b className="text-blue-900">{inputStats.pendingApprovalCount}</b></div>
            <div>Sắp đến hạn: <b className="text-amber-800">{inputStats.warningCount}</b></div>
            <div>Quá hạn: <b className="text-rose-600">{inputStats.overdueCount}</b></div>
          </div>
        </div>

        {/* Phân hệ 2: Hồ sơ đầu ra */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-xl">download_for_offline</span>
              <h3 className="font-bold text-slate-800 text-sm">Hồ sơ đầu ra (Bên khác phải trả công ty)</h3>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('output')}
              className="text-xs text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Xem chi tiết</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="text-[10px] text-slate-500 font-medium">HĐ/Dự toán ban đầu</div>
              <div className="font-mono font-bold text-xs text-slate-900 mt-1 truncate" title={formatCurrency(outputStats.totalMustCollect)}>
                {formatCurrency(outputStats.totalMustCollect)}
              </div>
            </div>
            <div className="bg-blue-50/40 p-2 rounded-lg border border-blue-100">
              <div className="text-[10px] text-blue-700 font-medium">Được duyệt</div>
              <div className="font-mono font-bold text-xs text-blue-900 mt-1 truncate" title={formatCurrency(outputStats.totalApproved)}>
                {formatCurrency(outputStats.totalApproved)}
              </div>
            </div>
            <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
              <div className="text-[10px] text-emerald-700 font-medium">Đã thu về</div>
              <div className="font-mono font-bold text-xs text-emerald-800 mt-1 truncate" title={formatCurrency(outputStats.totalCollected)}>
                {formatCurrency(outputStats.totalCollected)}
              </div>
            </div>
            <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100">
              <div className="text-[10px] text-amber-700 font-medium">Còn phải thu</div>
              <div className="font-mono font-bold text-xs text-amber-900 mt-1 truncate" title={formatCurrency(outputStats.totalRemaining)}>
                {formatCurrency(outputStats.totalRemaining)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-600 bg-slate-50/70 px-3 py-2 rounded-lg border border-slate-100">
            <div>Chờ xác nhận: <b className="text-blue-900">{outputStats.pendingConfirmationCount}</b></div>
            <div>Sắp đến hạn: <b className="text-amber-800">{outputStats.warningCount}</b></div>
            <div>Quá hạn thu: <b className="text-rose-600">{outputStats.overdueCount}</b></div>
          </div>
        </div>
      </div>

      {/* KHỐI 2: BIỂU ĐỒ ĐƯỜNG DÒNG TIỀN THEO THỜI GIAN */}
      {hasData && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">show_chart</span>
              <h4 className="font-bold text-slate-800 text-xs">Biến động Phải trả/Đã trả & Phải thu/Đã thu theo tháng</h4>
            </div>
            <span className="text-[11px] text-slate-400">Đơn vị: VNĐ</span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={val => (val >= 1000000 ? `${Math.round(val / 1000000)}Tr` : `${val}`)}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="inputMustPay" name="Phải trả (Đầu vào)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="inputPaid" name="Đã trả" stroke="#f97316" strokeDasharray="4 4" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="outputMustCollect" name="Phải thu (Đầu ra)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="outputCollected" name="Đã thu" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* KHỐI 3: BỐN DANH SÁCH CẢNH BÁO KIỂM SOÁT BẮT BUỘC (2x2 GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. Hồ sơ thiếu chứng từ */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-rose-800">
              <span className="material-symbols-outlined text-[16px]">folder_off</span>
              <span>1. Hồ sơ thiếu chứng từ bắt buộc</span>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
              {missingDocsList.length} hồ sơ
            </span>
          </div>

          {missingDocsList.length === 0 ? (
            <div className="py-5 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-emerald-500 text-2xl block mb-1">check_circle</span>
              Tất cả hồ sơ đều có đầy đủ chứng từ bắt buộc.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {missingDocsList.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => onViewDetail(doc)}
                  className="py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer rounded px-1.5 transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-800 truncate">
                      [{doc.contractNo}] {doc.contractName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Đối tác: {doc.company || '-'} • Giá trị: <span className="font-mono font-medium text-slate-700">{formatCurrency(doc.contractValue)}</span>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200 shrink-0 font-medium">
                    Thiếu file/Checklist
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Đã chi tiền nhưng thiếu UNC / Phiếu chi */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
              <span className="material-symbols-outlined text-[16px]">no_sim</span>
              <span>2. Đã chi tiền nhưng thiếu UNC / Phiếu chi</span>
            </div>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
              {missingUncList.length} hồ sơ
            </span>
          </div>

          {missingUncList.length === 0 ? (
            <div className="py-5 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-emerald-500 text-2xl block mb-1">verified</span>
              Mọi khoản tiền đã chi đều có chứng từ UNC/phiếu chi hợp lệ.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {missingUncList.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => onViewDetail(doc)}
                  className="py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer rounded px-1.5 transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-800 truncate">
                      [{doc.contractNo}] {doc.contractName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Đã chi: <span className="font-mono font-bold text-emerald-700">{formatCurrency(doc.paidAmount)}</span> • Chưa có UNC
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 border border-amber-300 shrink-0 font-bold">
                    Cần upload UNC
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Đã thanh toán nhưng thiếu chữ ký xác nhận */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
              <span className="material-symbols-outlined text-[16px]">draw</span>
              <span>3. Đã chuyển tiền nhưng chờ ký / Đang đối soát</span>
            </div>
            <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
              {pendingSignatureList.length} hồ sơ
            </span>
          </div>

          {pendingSignatureList.length === 0 ? (
            <div className="py-5 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-emerald-500 text-2xl block mb-1">task_alt</span>
              Tất cả đợt chi đều đã được bên nhận ký nhận đầy đủ.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {pendingSignatureList.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => onViewDetail(doc)}
                  className="py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer rounded px-1.5 transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-800 truncate">
                      [{doc.contractNo}] {doc.contractName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Người nhận: {doc.receiverName || doc.company || '-'} • Tiền đã chuyển: <span className="font-mono font-bold text-emerald-700">{formatCurrency(doc.paidAmount)}</span>
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 font-bold ${
                    doc.signatureStatus === 'DANG_DOI_SOAT' || doc.docStatus?.includes('đối soát')
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {doc.signatureStatus === 'DANG_DOI_SOAT' || doc.docStatus?.includes('đối soát') ? 'Đang đối soát' : 'Chờ ký nhận'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Hồ sơ sắp quá hạn hoặc quá hạn bổ sung chứng từ */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-rose-800">
              <span className="material-symbols-outlined text-[16px]">alarm</span>
              <span>4. Sắp đến hạn & Quá hạn chứng từ / thanh toán</span>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
              {overdueOrUrgentList.length} hồ sơ
            </span>
          </div>

          {overdueOrUrgentList.length === 0 ? (
            <div className="py-5 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-emerald-500 text-2xl block mb-1">sentiment_satisfied</span>
              Không có hồ sơ nào bị quá hạn.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {overdueOrUrgentList.map(doc => {
                const dueInfo = calculateDocumentDueInfo(doc);
                return (
                  <div
                    key={doc.id}
                    onClick={() => onViewDetail(doc)}
                    className="py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer rounded px-1.5 transition"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-800 truncate">
                        [{doc.contractNo}] {doc.contractName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Hạn: {formatDateDisplay(doc.dueDate)} • Còn nợ: <span className="font-mono font-medium text-amber-800">{formatCurrency((doc.approvedAmount ?? doc.contractValue ?? 0) - (doc.paidAmount ?? 0))}</span>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border shrink-0 ${dueInfo.badgeClass}`}>
                      {dueInfo.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
