import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DocumentTrack } from '@/types';
import { formatCurrency, calculateDocumentDueInfo, formatDateDisplay } from './documentConstants';

interface DocumentOverviewTabProps {
  inputDocs: DocumentTrack[];
  outputDocs: DocumentTrack[];
  onSelectTab: (tab: 'input' | 'output') => void;
  onEditDoc: (doc: DocumentTrack) => void;
}

export const DocumentOverviewTab: React.FC<DocumentOverviewTabProps> = ({
  inputDocs,
  outputDocs,
  onSelectTab,
  onEditDoc
}) => {
  // 1. Thống kê số liệu Đầu vào (Công ty phải trả)
  const inputStats = useMemo(() => {
    let totalMustPay = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let pendingApprovalCount = 0;
    let overdueCount = 0;
    let warningCount = 0;
    const missingDocs: DocumentTrack[] = [];
    const urgentDocs: DocumentTrack[] = [];

    inputDocs.forEach(d => {
      const val = d.totalAmount ?? d.contractValue ?? 0;
      const paid = d.paidAmount ?? d.prepayAmount ?? 0;
      const rem = Math.max(0, val - paid);

      totalMustPay += val;
      totalPaid += paid;
      totalRemaining += rem;

      if (d.docStatus === 'Chờ duyệt' || d.docStatus === 'Chờ thanh toán') {
        pendingApprovalCount++;
      }

      // Thiếu hóa đơn hoặc file đính kèm
      if ((!d.invoiceNo || !d.fileUrls || d.fileUrls.length === 0) && d.docStatus !== 'Nháp' && d.docStatus !== 'Hủy') {
        missingDocs.push(d);
      }

      const dueInfo = calculateDocumentDueInfo(d);
      if (dueInfo.status === 'overdue') {
        overdueCount++;
        urgentDocs.push(d);
      } else if (dueInfo.status === 'warning' || dueInfo.status === 'due_today') {
        warningCount++;
        urgentDocs.push(d);
      }
    });

    return {
      totalMustPay,
      totalPaid,
      totalRemaining,
      pendingApprovalCount,
      overdueCount,
      warningCount,
      missingDocs: missingDocs.slice(0, 5),
      urgentDocs: urgentDocs.slice(0, 5)
    };
  }, [inputDocs]);

  // 2. Thống kê số liệu Đầu ra (Bên khác phải trả công ty)
  const outputStats = useMemo(() => {
    let totalMustCollect = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let pendingConfirmationCount = 0;
    let overdueCount = 0;
    let warningCount = 0;
    const slowPayingClients = new Map<string, { count: number; totalRemain: number; clientName: string }>();

    outputDocs.forEach(d => {
      const val = d.totalAmount ?? d.contractValue ?? 0;
      const col = d.paidAmount ?? d.prepayAmount ?? 0;
      const rem = Math.max(0, val - col);

      totalMustCollect += val;
      totalCollected += col;
      totalRemaining += rem;

      if (d.docStatus === 'Chờ gửi' || d.docStatus === 'Chờ khách hàng xác nhận') {
        pendingConfirmationCount++;
      }

      const dueInfo = calculateDocumentDueInfo(d);
      if (dueInfo.status === 'overdue') {
        overdueCount++;
        const cName = d.company || 'Khách hàng chưa đặt tên';
        const curr = slowPayingClients.get(cName) || { count: 0, totalRemain: 0, clientName: cName };
        curr.count += 1;
        curr.totalRemain += rem;
        slowPayingClients.set(cName, curr);
      } else if (dueInfo.status === 'warning' || dueInfo.status === 'due_today') {
        warningCount++;
      }
    });

    const slowList = Array.from(slowPayingClients.values()).sort((a, b) => b.totalRemain - a.totalRemain).slice(0, 5);

    return {
      totalMustCollect,
      totalCollected,
      totalRemaining,
      pendingConfirmationCount,
      overdueCount,
      warningCount,
      slowClients: slowList
    };
  }, [outputDocs]);

  // 3. Biểu đồ đường (Line Chart) biến động tài chính 6 tháng gần nhất
  const chartData = useMemo(() => {
    const monthMap = new Map<string, { month: string; inputMustPay: number; inputPaid: number; outputMustCollect: number; outputCollected: number }>();

    // Chuẩn bị nhãn 6 tháng gần nhất
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
        item.inputMustPay += (d.totalAmount ?? d.contractValue ?? 0);
        item.inputPaid += (d.paidAmount ?? d.prepayAmount ?? 0);
      }
    });

    outputDocs.forEach(d => {
      const dateKey = (d.sendDate || (d.createdAt ? d.createdAt.split('T')[0] : '')).slice(0, 7);
      if (monthMap.has(dateKey)) {
        const item = monthMap.get(dateKey)!;
        item.outputMustCollect += (d.totalAmount ?? d.contractValue ?? 0);
        item.outputCollected += (d.paidAmount ?? d.prepayAmount ?? 0);
      }
    });

    return Array.from(monthMap.values());
  }, [inputDocs, outputDocs]);

  const hasData = inputDocs.length > 0 || outputDocs.length > 0;

  return (
    <div className="space-y-4">
      {/* KHỐI 1: KPI CƠ BẢN (CHỈ DÙNG DỮ LIỆU THỰC TẾ, GIAO DIỆN TITSMART SÁNG, GÓC BO NHẸ) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Tổng phải trả</div>
              <div className="font-mono font-bold text-sm text-slate-900 mt-1">
                {formatCurrency(inputStats.totalMustPay)}
              </div>
            </div>
            <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
              <div className="text-[11px] text-emerald-700 font-medium">Đã thanh toán</div>
              <div className="font-mono font-bold text-sm text-emerald-800 mt-1">
                {formatCurrency(inputStats.totalPaid)}
              </div>
            </div>
            <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
              <div className="text-[11px] text-amber-700 font-medium">Còn phải trả</div>
              <div className="font-mono font-bold text-sm text-amber-900 mt-1">
                {formatCurrency(inputStats.totalRemaining)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-600 bg-slate-50/70 px-3 py-2 rounded-lg border border-slate-100">
            <div>Chờ duyệt/thanh toán: <b className="text-blue-900">{inputStats.pendingApprovalCount}</b></div>
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

          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Tổng phải thu</div>
              <div className="font-mono font-bold text-sm text-slate-900 mt-1">
                {formatCurrency(outputStats.totalMustCollect)}
              </div>
            </div>
            <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
              <div className="text-[11px] text-emerald-700 font-medium">Đã thu về</div>
              <div className="font-mono font-bold text-sm text-emerald-800 mt-1">
                {formatCurrency(outputStats.totalCollected)}
              </div>
            </div>
            <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
              <div className="text-[11px] text-amber-700 font-medium">Còn phải thu</div>
              <div className="font-mono font-bold text-sm text-amber-900 mt-1">
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

      {/* KHỐI 2: BIỂU ĐỒ ĐƯỜNG DÒNG TIỀN THEO THỜI GIAN (CHỈ HIỂN THỊ KHI CÓ DỮ LIỆU) */}
      {hasData && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">show_chart</span>
              <h4 className="font-bold text-slate-800 text-xs">Biến động Phải trả/Đã trả & Phải thu/Đã thu theo tháng</h4>
            </div>
            <span className="text-[11px] text-slate-400">Đơn vị: VNĐ</span>
          </div>

          <div className="h-64 w-full">
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

      {/* KHỐI 3: DANH SÁCH CẦN LƯU Ý (THIẾU CHỨNG TỪ, GẦN HẠN, CHẬM THANH TOÁN) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bảng 1: Đầu vào cần xử lý ngay */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-rose-800">
              <span className="material-symbols-outlined text-[16px]">priority_high</span>
              <span>Đầu vào gần hạn / Thiếu chứng từ</span>
            </div>
            <span className="text-[11px] text-slate-400">Top 5 hồ sơ</span>
          </div>

          {inputStats.urgentDocs.length === 0 && inputStats.missingDocs.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-emerald-500 text-2xl block mb-1">check_circle</span>
              Tất cả hồ sơ đầu vào đều đầy đủ chứng từ và đúng hạn.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {[...inputStats.urgentDocs, ...inputStats.missingDocs].slice(0, 5).map(doc => {
                const dueInfo = calculateDocumentDueInfo(doc);
                const isMissing = !doc.invoiceNo || !doc.fileUrls || doc.fileUrls.length === 0;

                return (
                  <div
                    key={doc.id}
                    onClick={() => onEditDoc(doc)}
                    className="py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer rounded px-1.5 transition"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-800 truncate" title={doc.contractName}>
                        [{doc.contractNo}] {doc.contractName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        NCC: {doc.company || '-'} • Còn nợ: <span className="font-mono font-medium text-amber-800">{formatCurrency((doc.totalAmount ?? doc.contractValue ?? 0) - (doc.paidAmount ?? 0))}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {dueInfo.hasDueDate ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${dueInfo.badgeClass}`}>
                          {dueInfo.text}
                        </span>
                      ) : null}
                      {isMissing && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                          Thiếu hóa đơn/tệp
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bảng 2: Đầu ra khách hàng chậm thanh toán */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              <span>Khách hàng đang chậm thanh toán</span>
            </div>
            <span className="text-[11px] text-slate-400">Theo dư nợ quá hạn</span>
          </div>

          {outputStats.slowClients.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              <span className="material-symbols-outlined text-emerald-500 text-2xl block mb-1">sentiment_satisfied</span>
              Không có khoản nợ quá hạn nào từ khách hàng.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {outputStats.slowClients.map((c, i) => (
                <div key={i} className="py-2 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-800 truncate" title={c.clientName}>
                      {c.clientName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Có <b>{c.count}</b> hồ sơ đã quá hạn thu
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono font-bold text-rose-700">
                      {formatCurrency(c.totalRemain)}
                    </div>
                    <span className="text-[10px] text-slate-400">còn phải thu</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
