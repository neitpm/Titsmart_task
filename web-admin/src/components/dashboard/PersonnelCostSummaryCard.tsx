import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectExpense, Project } from '../../types';

interface PersonnelCostSummaryProps {
  expenses: ProjectExpense[];
  projects: Project[];
  selectedProjectCodes?: string[];
}

const money = (val: number) => val.toLocaleString('vi-VN');

export const PersonnelCostSummaryCard: React.FC<PersonnelCostSummaryProps> = ({
  expenses,
  projects,
  selectedProjectCodes
}) => {
  const navigate = useNavigate();
  const [searchName, setSearchName] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'remaining' | 'over' | 'zero'>('all');
  const [selectedSpenderDetail, setSelectedSpenderDetail] = useState<string | null>(null);

  // Tính toán dữ liệu theo từng nhân sự
  const summaryData = useMemo(() => {
    const bySpender: Record<string, {
      name: string;
      totalFund: number;
      totalSpent: number;
      balance: number;
      count: number;
      projects: Set<string>;
      projectDetails: Record<string, { fund: number; spent: number }>;
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
          bySpender[name].projectDetails[pCode] = { fund: 0, spent: 0 };
        }
        bySpender[name].projectDetails[pCode].fund += fund;
        bySpender[name].projectDetails[pCode].spent += spent;
      }

      grandFund += fund;
      grandSpent += spent;
    });

    Object.values(bySpender).forEach(item => {
      item.balance = item.totalFund - item.totalSpent;
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

  // Điều hướng vào chi tiết chi phí dự án
  const handleGoToProjectCost = (projectCode: string) => {
    const proj = projects.find(p => p.code === projectCode || p.id === projectCode);
    if (proj) {
      navigate(`/projects/${proj.id || proj.code}/cost-plan`);
    } else {
      navigate(`/cost-plan`);
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

                return (
                  <tr
                    key={item.name}
                    className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/20' : ''}`}
                  >
                    <td className="py-2 px-3 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">
                          {item.name === 'DỰ ÁN' ? 'apartment' : 'person'}
                        </span>
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {projectList.length === 0 ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          projectList.slice(0, 3).map((pCode) => {
                            const proj = projects.find(p => p.code === pCode || p.id === pCode);
                            const pName = proj?.name || pCode;
                            return (
                              <button
                                key={pCode}
                                type="button"
                                onClick={() => handleGoToProjectCost(pCode)}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-800 text-[10px] font-semibold transition-colors cursor-pointer"
                                title={`Bấm để mở chi phí dự án ${pName}`}
                              >
                                {pCode}
                              </button>
                            );
                          })
                        )}
                        {projectList.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-bold">
                            +{projectList.length - 3}
                          </span>
                        )}
                      </div>
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
                    <td className="py-2 px-3 text-center">
                      {projectList.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleGoToProjectCost(projectList[0])}
                          className="px-2 py-0.5 rounded text-[11px] font-bold text-primary hover:bg-blue-50 border border-blue-200 inline-flex items-center gap-0.5 transition-colors cursor-pointer"
                          title="Vào xem chi tiết phiếu chi của dự án"
                        >
                          <span>Xem</span>
                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
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
    </div>
  );
};
