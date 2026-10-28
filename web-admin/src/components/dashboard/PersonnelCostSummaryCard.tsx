import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectExpense, Project } from '../../types';

interface PersonnelCostSummaryProps {
  expenses: ProjectExpense[];
  projects: Project[];
  selectedProjectCodes?: string[];
}

const money = (val: number) => val.toLocaleString('vi-VN');

const formatCompactMoney = (val: number) => {
  if (val === 0) return '0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    const formatted = (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}${formatted} tỷ`;
  }
  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}${formatted} tr`;
  }
  if (abs >= 1_000) {
    const formatted = Math.round(abs / 1_000);
    return `${sign}${formatted}k`;
  }
  return `${sign}${abs}`;
};

export const PersonnelCostSummaryCard: React.FC<PersonnelCostSummaryProps> = ({
  expenses,
  projects,
  selectedProjectCodes
}) => {
  const navigate = useNavigate();
  const [searchName, setSearchName] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'remaining' | 'over' | 'zero'>('all');
  const [selectedSpenderDetail, setSelectedSpenderDetail] = useState<string | null>(null);
  const [expandedSpender, setExpandedSpender] = useState<string | null>(null);

  // Tính toán dữ liệu theo từng nhân sự
  const summaryData = useMemo(() => {
    const bySpender: Record<string, {
      name: string;
      totalFund: number;
      totalSpent: number;
      balance: number;
      count: number;
      projects: Set<string>;
      projectDetails: Record<string, { fund: number; spent: number; lastCreator?: string }>;
    }> = {};

    let grandFund = 0;
    let grandSpent = 0;

    expenses.forEach((exp) => {
      const pCode = (exp.projectCode || (exp as any).project_code || '').trim();
      // Nếu có lọc dự án thì chỉ tính các dự án được chọn
      if (selectedProjectCodes && selectedProjectCodes.length > 0) {
        if (!pCode || !selectedProjectCodes.includes(pCode)) return;
      }

      const name = (exp.spenderName || '').trim() || 'DỰ ÁN';
      if (!bySpender[name]) {
        bySpender[name] = {
          name,
          totalFund: 0,
          totalSpent: 0,
          balance: 0,
          count: 0,
          projects: new Set(),
          projectDetails: {}
        };
      }

      const isFundRow = (exp.content || '').trim().toLowerCase() === 'quỹ';
      const spent = isFundRow ? 0 : Number(exp.totalAmount || 0);
      const fund = Number(exp.incomeAmount || 0);

      bySpender[name].totalFund += fund;
      bySpender[name].totalSpent += spent;
      if (spent > 0) bySpender[name].count += 1;
      if (pCode) {
        bySpender[name].projects.add(pCode);
        if (!bySpender[name].projectDetails[pCode]) {
          bySpender[name].projectDetails[pCode] = { fund: 0, spent: 0, lastCreator: '' };
        }
        bySpender[name].projectDetails[pCode].fund += fund;
        bySpender[name].projectDetails[pCode].spent += spent;
        const creator = (exp as any).createdByName || (exp as any).updatedBy || (exp as any).created_by_name || '';
        if (creator && creator !== 'Hệ thống') {
          (bySpender[name].projectDetails[pCode] as any).lastCreator = creator;
        }
      }

      grandFund += fund;
      grandSpent += spent;
    });

    Object.values(bySpender).forEach(item => {
      item.balance = item.totalFund - item.totalSpent;
      // Sắp xếp danh sách dự án ưu tiên: dự án đang còn tồn quỹ nhiều nhất hoặc âm quỹ nhiều nhất lên trước
      item.projects = new Set(
        Array.from(item.projects).sort((p1, p2) => {
          const b1 = (item.projectDetails[p1]?.fund || 0) - (item.projectDetails[p1]?.spent || 0);
          const b2 = (item.projectDetails[p2]?.fund || 0) - (item.projectDetails[p2]?.spent || 0);
          return Math.abs(b2) - Math.abs(b1);
        })
      );
    });

    const list = Object.values(bySpender).sort((a, b) => {
      if (a.name === 'DỰ ÁN') return -1;
      if (b.name === 'DỰ ÁN') return 1;
      return b.totalSpent - a.totalSpent;
    });

    return {
      list,
      grandFund,
      grandSpent,
      grandBalance: grandFund - grandSpent
    };
  }, [expenses, selectedProjectCodes]);

  // Lọc theo tìm kiếm và trạng thái
  const filteredList = useMemo(() => {
    return summaryData.list.filter(item => {
      const matchName = !searchName.trim() || item.name.toLowerCase().includes(searchName.trim().toLowerCase());
      if (!matchName) return false;

      if (filterStatus === 'remaining') return item.balance > 0;
      if (filterStatus === 'over') return item.balance < 0;
      if (filterStatus === 'zero') return item.balance === 0;
      return true;
    });
  }, [summaryData.list, searchName, filterStatus]);

  // Điều hướng vào chi tiết chi phí dự án (mở thẳng tab Chi phí - EXPENSE)
  const handleGoToProjectCost = (projectCode: string, spenderName?: string) => {
    const proj = projects.find(p => p.code === projectCode || p.id === projectCode);
    const query = new URLSearchParams();
    query.set('tab', 'EXPENSE');
    if (spenderName && spenderName !== 'DỰ ÁN') {
      query.set('spender', spenderName);
    }
    const searchStr = `?${query.toString()}`;

    if (proj) {
      navigate(`/projects/${proj.id || proj.code}/cost-plan${searchStr}`);
    } else {
      navigate(`/cost-plan${searchStr}`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col mb-1">
      {/* HEADER SECTION */}
      <div className="bg-slate-50/70 border-b border-slate-200 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">account_balance_wallet</span>
          <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
            <span>Chi phí & Tồn quỹ theo nhân sự</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
              {summaryData.list.length}
            </span>
          </h2>
        </div>

        {/* METRICS SUMMARY QUICK BADGES */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <div className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
            <span className="text-slate-500 text-[10px]">Tổng quỹ: </span>
            <strong className="text-blue-700 font-bold text-xs">{money(summaryData.grandFund)} đ</strong>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
            <span className="text-slate-500 text-[10px]">Tổng đã chi: </span>
            <strong className="text-indigo-700 font-bold text-xs">{money(summaryData.grandSpent)} đ</strong>
          </div>
          <div className={`border rounded-lg px-2 py-0.5 shadow-2xs ${
            summaryData.grandBalance < 0 
              ? 'bg-red-50 border-red-200 text-red-700' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <span className="text-[10px] opacity-80">Tổng tồn: </span>
            <strong className="font-bold text-xs">{money(summaryData.grandBalance)} đ</strong>
          </div>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-sm">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[15px]">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm nhân sự..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none h-7"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-slate-400 font-medium text-[10px]">Lọc:</span>
          {(['all', 'remaining', 'over', 'zero'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                filterStatus === st
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st === 'all' && 'Tất cả'}
              {st === 'remaining' && 'Còn tồn'}
              {st === 'over' && 'Âm quỹ'}
              {st === 'zero' && '0đ'}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN TABLE */}
      <div className="overflow-x-auto custom-scrollbar max-h-[420px]">
        <table className="w-full text-left border-collapse min-w-[750px] text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-tight">
            <tr>
              <th className="py-2 px-3 text-center w-12">STT</th>
              <th className="py-2 px-3 min-w-[150px]">Nhân sự / Người phụ trách</th>
              <th className="py-2 px-3 min-w-[140px]">Dự án tham gia</th>
              <th className="py-2 px-3 text-right min-w-[110px]">Quỹ nhận (đ)</th>
              <th className="py-2 px-3 text-right min-w-[110px]">Đã chi (đ)</th>
              <th className="py-2 px-3 text-right min-w-[120px]">Còn tồn quỹ (đ)</th>
              <th className="py-2 px-3 text-center w-28">Trạng thái</th>
              <th className="py-2 px-3 text-center w-24">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                  Không tìm thấy nhân sự phù hợp điều kiện lọc.
                </td>
              </tr>
            ) : (
              filteredList.map((item, idx) => {
                const isOver = item.balance < 0;
                const projectList = Array.from(item.projects);
                const isExpanded = expandedSpender === item.name;
                const projEntries = Object.entries(item.projectDetails).sort((a, b) => {
                  const balA = a[1].fund - a[1].spent;
                  const balB = b[1].fund - b[1].spent;
                  return Math.abs(balB) - Math.abs(balA);
                });

                return (
                  <React.Fragment key={item.name}>
                    <tr
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer select-none ${
                        isExpanded ? 'bg-blue-50/30' : idx % 2 === 1 ? 'bg-slate-50/20' : ''
                      }`}
                      onClick={() => setExpandedSpender(isExpanded ? null : item.name)}
                    >
                      <td className="py-2 px-3 text-center text-slate-400 text-[11px] font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs font-mono">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          projectList.length > 0
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'text-slate-400'
                        }`}>
                          {projectList.length} dự án {isExpanded ? '(thu gọn)' : '(xem chi tiết)'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800">
                        {money(item.totalFund)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800">
                        {money(item.totalSpent)}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold ${isOver ? 'text-red-600' : 'text-emerald-700'}`}>
                        {money(item.balance)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isOver
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : item.balance === 0
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {isOver ? 'Âm quỹ' : item.balance === 0 ? 'Hết quỹ' : 'Còn giữ quỹ'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setExpandedSpender(isExpanded ? null : item.name)}
                          className="px-2 py-0.5 rounded text-[11px] font-bold text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                        >
                          {isExpanded ? 'Đóng ▲' : 'Chi tiết ▼'}
                        </button>
                      </td>
                    </tr>

                    {/* DÒNG CHI TIẾT XỔ XUỐNG DƯỚI NHÂN SỰ */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70 border-y border-blue-100">
                        <td colSpan={8} className="p-3 pl-8">
                          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                            <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                              <span>Bảng phân bổ chi phí của {item.name} ({projEntries.length} dự án)</span>
                              <span className="text-slate-500 font-normal text-[11px]">Bấm &quot;Vào dự án&quot; để mở thẳng tab Chi phí</span>
                            </div>
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase bg-slate-50">
                                  <th className="py-1.5 px-3 w-10 text-center">STT</th>
                                  <th className="py-1.5 px-3">Tên dự án &amp; Mã</th>
                                  <th className="py-1.5 px-3 text-center">Người lập phiếu gần nhất</th>
                                  <th className="py-1.5 px-3 text-right">Quỹ nhận (đ)</th>
                                  <th className="py-1.5 px-3 text-right">Đã chi (đ)</th>
                                  <th className="py-1.5 px-3 text-right">Còn tồn quỹ (đ)</th>
                                  <th className="py-1.5 px-3 text-center w-28">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {projEntries.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="py-3 text-center text-slate-400 italic">
                                      Chưa phát sinh dự án
                                    </td>
                                  </tr>
                                ) : (
                                  projEntries.map(([pCode, details], pIdx) => {
                                    const proj = projects.find(p => p.code === pCode || p.id === pCode);
                                    const pName = proj?.name || pCode;
                                    const pBal = details.fund - details.spent;
                                    const isBalOver = pBal < 0;

                                    return (
                                      <tr key={pCode} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="py-2 px-3 text-center text-slate-400 text-[11px]">
                                          {pIdx + 1}
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="font-bold text-slate-900">{pName}</div>
                                          <div className="text-[10px] text-slate-400 font-mono">{pCode}</div>
                                        </td>
                                        <td className="py-2 px-3 text-center text-slate-600 text-[11px]">
                                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                            {(details as any).lastCreator || 'Chính chủ'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-right font-semibold text-slate-700">
                                          {money(details.fund)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-semibold text-slate-700">
                                          {money(details.spent)}
                                        </td>
                                        <td className={`py-2 px-3 text-right font-bold ${
                                          isBalOver ? 'text-red-600' : pBal === 0 ? 'text-slate-500' : 'text-emerald-700'
                                        }`}>
                                          {money(pBal)}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleGoToProjectCost(pCode, item.name)}
                                            className="px-2.5 py-1 rounded text-[11px] font-bold text-primary hover:bg-blue-50 border border-blue-200 transition-colors cursor-pointer"
                                            title={`Mở chi tiết phiếu chi của dự án ${pName}`}
                                          >
                                            Vào dự án →
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-900 text-xs">
              <td colSpan={3} className="py-2 px-3 text-right uppercase text-[11px] text-slate-700">
                Tổng cộng toàn hệ thống:
              </td>
              <td className="py-2 px-3 text-right text-blue-900 font-bold">
                {money(summaryData.grandFund)} đ
              </td>
              <td className="py-2 px-3 text-right text-indigo-900 font-bold">
                {money(summaryData.grandSpent)} đ
              </td>
              <td className={`py-2 px-3 text-right font-black ${
                summaryData.grandBalance < 0 ? 'text-red-600' : 'text-emerald-700'
              }`}>
                {money(summaryData.grandBalance)} đ
              </td>
              <td colSpan={2} className="py-2 px-3 text-center text-[11px] font-semibold text-slate-600">
                {summaryData.grandBalance < 0 ? '⚠️ Toàn hệ thống đang âm quỹ' : '✓ Toàn hệ thống còn tồn quỹ'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* MODAL CHI TIẾT DỰ ÁN THEO NHÂN SỰ */}
      {selectedSpenderDetail && (() => {
        const item = summaryData.list.find(s => s.name === selectedSpenderDetail);
        if (!item) return null;

        const projEntries = Object.entries(item.projectDetails).sort((a, b) => b[1].spent - a[1].spent);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">
                      {item.name === 'DỰ ÁN' ? 'apartment' : 'person'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                      <span>Phân bổ chi phí: {item.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                        {projEntries.length} dự án
                      </span>
                    </h3>
                    <p className="text-slate-500 text-xs">
                      Chi tiết quỹ nhận, chi tiêu và số dư tồn quỹ theo từng dự án
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSpenderDetail(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Summary stat cards */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50/60 border-b border-slate-100 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-slate-500 text-[11px]">Tổng quỹ nhận</div>
                  <div className="font-bold text-sm text-blue-700">{money(item.totalFund)} đ</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-slate-500 text-[11px]">Tổng đã chi</div>
                  <div className="font-bold text-sm text-indigo-700">{money(item.totalSpent)} đ</div>
                </div>
                <div className={`p-2.5 rounded-xl border shadow-2xs ${
                  item.balance < 0 ? 'bg-red-50/80 border-red-200 text-red-700' : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                }`}>
                  <div className="text-[11px] opacity-80">Tổng tồn quỹ</div>
                  <div className="font-bold text-sm">{money(item.balance)} đ</div>
                </div>
              </div>

              {/* Table projects list */}
              <div className="overflow-y-auto custom-scrollbar p-4 flex-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase">
                      <th className="pb-2 text-center w-10">STT</th>
                      <th className="pb-2">Dự án</th>
                      <th className="pb-2 text-right">Quỹ nhận</th>
                      <th className="pb-2 text-right">Đã chi</th>
                      <th className="pb-2 text-right">Tồn quỹ</th>
                      <th className="pb-2 text-center w-24">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projEntries.map(([pCode, details], pIdx) => {
                      const proj = projects.find(p => p.code === pCode || p.id === pCode);
                      const pName = proj?.name || pCode;
                      const pBal = details.fund - details.spent;
                      const isBalOver = pBal < 0;

                      return (
                        <tr key={pCode} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 text-center text-slate-400 font-medium">{pIdx + 1}</td>
                          <td className="py-2.5">
                            <div className="font-bold text-slate-900 leading-tight">{pName}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{pCode}</div>
                          </td>
                          <td className="py-2.5 text-right font-semibold text-slate-700">
                            {money(details.fund)} đ
                          </td>
                          <td className="py-2.5 text-right font-semibold text-slate-700">
                            {money(details.spent)} đ
                          </td>
                          <td className={`py-2.5 text-right font-bold ${
                            isBalOver ? 'text-red-600' : pBal === 0 ? 'text-slate-500' : 'text-emerald-700'
                          }`}>
                            {money(pBal)} đ
                          </td>
                          <td className="py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSpenderDetail(null);
                                handleGoToProjectCost(pCode, item.name);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title={`Mở chi tiết phiếu chi của dự án ${pName}`}
                            >
                              <span>Vào dự án</span>
                              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedSpenderDetail(null)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200/80 border border-slate-300 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
