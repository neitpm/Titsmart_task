import React, { useMemo, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { CustomSelect } from '@/components/common/CustomSelect';
import { ProjectExpense, LaborPayroll } from '../../types';

interface CostPlanSummaryTableProps {
  expenses: ProjectExpense[];
  labors: LaborPayroll[];
  projects?: { code: string; name: string }[];
  currentProjectCode?: string;
  selectedSpender?: string;
  onSelectSpender?: (spender: string) => void;
  onAllocateFund?: (spenderName: string, amount?: number, date?: string) => void;
  onTransferFund?: (params: {
    fromSpender: string;
    toProjectCode: string;
    toSpender: string;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<void> | void;
}

const money = (value: number) => value.toLocaleString('vi-VN');

export const CostPlanSummaryTable: React.FC<CostPlanSummaryTableProps> = ({ 
  expenses, 
  labors, 
  projects = [],
  currentProjectCode = '',
  selectedSpender = 'all',
  onSelectSpender,
  onAllocateFund,
  onTransferFund
}) => {
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [fundAmountInput, setFundAmountInput] = useState('');
  const [fundDateInput, setFundDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [showPersonalModal, setShowPersonalModal] = useState(false);

  const [showTransferFundModal, setShowTransferFundModal] = useState(false);
  const [transferFromSpender, setTransferFromSpender] = useState('DỰ ÁN');
  const [transferToProject, setTransferToProject] = useState('');
  const [transferToSpender, setTransferToSpender] = useState('');
  const [transferAmountInput, setTransferAmountInput] = useState('');
  const [transferDateInput, setTransferDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [transferNotesInput, setTransferNotesInput] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const handleSaveFundModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAllocateFund && fundAmountInput.trim() !== '') {
      const addedVal = Number(fundAmountInput.replace(/[,.]/g, ''));
      if (!isNaN(addedVal) && addedVal > 0) {
        const newTotalFund = summary.totalProjectFund + addedVal;
        onAllocateFund('__PROJECT__', newTotalFund, fundDateInput);
      }
    }
    setShowAddFundModal(false);
    setFundAmountInput('');
  };

  const handleSaveTransferModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transferAmountInput.replace(/[,.]/g, ''));
    if (!amount || isNaN(amount) || amount <= 0) return;
    if (!transferToProject) return;

    setTransferSubmitting(true);
    try {
      if (onTransferFund) {
        await onTransferFund({
          fromSpender: transferFromSpender || 'DỰ ÁN',
          toProjectCode: transferToProject,
          toSpender: transferToSpender.trim() || transferFromSpender || 'DỰ ÁN',
          amount,
          date: transferDateInput,
          notes: transferNotesInput.trim()
        });
      }
      setShowTransferFundModal(false);
      setTransferAmountInput('');
      setTransferNotesInput('');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const openTransferModal = (fromPerson?: string) => {
    setTransferFromSpender(fromPerson || 'DỰ ÁN');
    setTransferToSpender(fromPerson && fromPerson !== 'DỰ ÁN' ? fromPerson : '');
    setTransferToProject('');
    setTransferAmountInput('');
    setTransferDateInput(new Date().toISOString().split('T')[0]);
    setTransferNotesInput('');
    setShowTransferFundModal(true);
  };

  const summary = useMemo(() => {
    const bySpender: Record<string, { chi: number; quy: number; count: number }> = {};
    let totalProjectExpense = 0;
    let totalProjectFund = 0;

    expenses.forEach((exp) => {
      const name = (exp.spenderName || '').trim() || 'KHÁC';
      if (!bySpender[name]) {
        bySpender[name] = { chi: 0, quy: 0, count: 0 };
      }
      
      const isFundRow = (exp.content || '').trim().toLowerCase() === 'quỹ';
      const chi = isFundRow ? 0 : Number(exp.totalAmount || 0);
      const quy = Number(exp.incomeAmount || 0);
      
      bySpender[name].chi += chi;
      bySpender[name].quy += quy;
      if (chi > 0) bySpender[name].count += 1;
      
      totalProjectExpense += chi;
      totalProjectFund += quy;
    });

    const totalChi = totalProjectExpense;
    const tonCuoiKy = totalProjectFund - totalProjectExpense;
    const totalLabor = labors.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    return {
      bySpender,
      totalProjectExpense,
      totalProjectFund,
      totalChi,
      tonCuoiKy,
      totalLabor
    };
  }, [expenses, labors]);

  const spenderNames = useMemo(() => {
    return Object.keys(summary.bySpender)
      .filter(n => n !== 'KHÁC' || summary.bySpender[n].chi > 0 || summary.bySpender[n].quy > 0)
      .sort((a, b) => {
        if (a === 'DỰ ÁN') return -1;
        if (b === 'DỰ ÁN') return 1;
        return summary.bySpender[b].chi - summary.bySpender[a].chi;
      });
  }, [summary.bySpender]);

  // Dữ liệu khi lọc một cá nhân cụ thể
  const isPersonalFiltered = selectedSpender && selectedSpender !== 'all';
  const currentSpenderData = isPersonalFiltered ? (summary.bySpender[selectedSpender] || { chi: 0, quy: 0, count: 0 }) : null;
  const currentFund = isPersonalFiltered ? (currentSpenderData?.quy || 0) : summary.totalProjectFund;
  const currentChi = isPersonalFiltered ? (currentSpenderData?.chi || 0) : summary.totalChi;
  const currentTon = isPersonalFiltered ? ((currentSpenderData?.quy || 0) - (currentSpenderData?.chi || 0)) : summary.tonCuoiKy;

  return (
    <div className="w-full bg-slate-50/70 p-2 md:p-3 border-b border-slate-200">
      {/* 1. THANH CHỈ SỐ TỒN QUỸ & TỔNG CHI TRỰC QUAN */}
      <div className="w-full overflow-x-auto custom-scrollbar pb-1">
        <div className="flex gap-2 md:gap-3 w-full items-stretch justify-start min-w-max">
          
          {/* THẺ 1: QUỸ CÔNG TRÌNH / QUỸ CÁ NHÂN */}
          <div className="flex-1 min-w-[140px] md:min-w-[170px] max-w-[240px] bg-white shadow-xs rounded-xl overflow-hidden border border-slate-200/80 hover:border-blue-300 transition-all flex flex-col justify-between p-2.5 md:p-3">
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
              <div className="flex items-center gap-1 text-blue-700">
                <span className="material-symbols-outlined text-[15px]">account_balance_wallet</span>
                <span>{isPersonalFiltered ? `QUỸ (${selectedSpender})` : 'TỔNG QUỸ DỰ ÁN'}</span>
              </div>
              <div className="flex items-center gap-0.5">
                {onAllocateFund && !isPersonalFiltered && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFundAmountInput('');
                      setFundDateInput(new Date().toISOString().split('T')[0]);
                      setShowAddFundModal(true);
                    }}
                    className="p-1 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
                    title="Thêm / Nạp Quỹ Dự Án"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">add_circle</span>
                  </button>
                )}
                {onTransferFund && !isPersonalFiltered && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTransferModal('DỰ ÁN');
                    }}
                    className="p-1 rounded-md text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                    title="Chuyển Quỹ Dự Án sang DA khác"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">swap_horiz</span>
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1 text-sm md:text-base font-black text-slate-900 tracking-tight">
              {money(currentFund)} <span className="text-[10px] text-slate-400 font-normal">đ</span>
            </div>
          </div>

          {/* THẺ 2: TỔNG CHI */}
          <div className="flex-1 min-w-[140px] md:min-w-[170px] max-w-[240px] bg-white shadow-xs rounded-xl overflow-hidden border border-slate-200/80 hover:border-indigo-300 transition-all flex flex-col justify-between p-2.5 md:p-3">
            <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 uppercase tracking-tight">
              <span className="material-symbols-outlined text-[15px]">payments</span>
              <span>{isPersonalFiltered ? `ĐÃ CHI (${selectedSpender})` : 'TỔNG ĐÃ CHI'}</span>
            </div>
            <div className="mt-1 text-sm md:text-base font-black text-slate-900 tracking-tight">
              {money(currentChi)} <span className="text-[10px] text-slate-400 font-normal">đ</span>
            </div>
          </div>

          {/* THẺ 3: TỒN QUỸ */}
          <div className={`flex-1 min-w-[150px] md:min-w-[190px] max-w-[260px] bg-white shadow-xs rounded-xl overflow-hidden border ${
            currentTon < 0 ? 'border-red-300 bg-red-50/20' : 'border-emerald-300 bg-emerald-50/20'
          } transition-all flex flex-col justify-between p-2.5 md:p-3`}>
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold uppercase tracking-tight">
              <div className={`flex items-center gap-1 ${currentTon < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                <span className="material-symbols-outlined text-[16px]">
                  {currentTon < 0 ? 'warning' : 'savings'}
                </span>
                <span>{isPersonalFiltered ? `TỒN QUỸ (${selectedSpender})` : 'TỒN QUỸ DỰ ÁN'}</span>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                currentTon < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {currentTon < 0 ? 'Âm quỹ' : 'Còn dư'}
              </span>
            </div>
            <div className={`mt-1 text-sm md:text-base font-black tracking-tight ${
              currentTon < 0 ? 'text-red-600' : 'text-emerald-700'
            }`}>
              {money(currentTon)} <span className="text-[10px] font-normal opacity-70">đ</span>
            </div>
          </div>

          {/* THẺ 4: TỔNG CHI PHÍ THEO NHÂN SỰ (Nút mở bảng tổng hợp toàn bộ nhân sự) */}
          <div 
            onClick={() => setShowPersonalModal(true)}
            className="flex-1 min-w-[150px] md:min-w-[210px] max-w-[280px] bg-gradient-to-r from-blue-50/80 to-indigo-50/80 hover:from-blue-100/80 hover:to-indigo-100/80 cursor-pointer shadow-xs rounded-xl overflow-hidden border border-blue-200/80 transition-all flex flex-col justify-between p-2.5 md:p-3 select-none group"
            title="Bấm để xem bảng tổng hợp toàn diện chi phí theo từng nhân sự"
          >
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-blue-900 uppercase tracking-tight">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-blue-600">group</span>
                <span>TỔNG HỢP THEO NHÂN SỰ</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-blue-500 group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-blue-700 font-semibold">
              <span>{spenderNames.length} nhân sự / đối tượng</span>
              <span className="text-[11px] text-primary font-bold underline">Xem bảng &gt;</span>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL TỔNG HỢP CHI TIẾT TẤT CẢ NHÂN SỰ */}
      <Modal isOpen={showPersonalModal} onClose={() => setShowPersonalModal(false)} title="TỔNG HỢP CHI PHÍ DỰ ÁN THEO NHÂN SỰ" size="xl">
        <div className="space-y-4 p-1 md:p-3 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-base">info</span>
              <span>Bảng tổng hợp phản ánh số tiền được cấp (Quỹ nhận), số tiền đã chi tiêu và số dư tồn quỹ của từng nhân sự phụ trách.</span>
            </div>
            <div className="text-slate-500 text-[11px]">
              Dự án: <strong className="text-slate-800">{currentProjectCode || 'Hiện tại'}</strong>
            </div>
          </div>

          {spenderNames.length === 0 ? (
            <div className="text-slate-400 italic py-8 text-center">Chưa có dữ liệu giao dịch chi phí của nhân sự nào.</div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left border-collapse min-w-[650px] text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Người phụ trách / Nhân sự</th>
                    <th className="py-2.5 px-3 text-right min-w-[110px]">Quỹ nhận (đ)</th>
                    <th className="py-2.5 px-3 text-right min-w-[110px]">Đã chi (đ)</th>
                    <th className="py-2.5 px-3 text-right min-w-[110px]">Tồn quỹ (đ)</th>
                    <th className="py-2.5 px-3 text-center w-28">Trạng thái</th>
                    <th className="py-2.5 px-3 text-center w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {spenderNames.map((name, idx) => {
                    const data = summary.bySpender[name];
                    const ton = data.quy - data.chi;
                    const isOver = ton < 0;
                    const isSelected = selectedSpender === name;

                    return (
                      <tr 
                        key={name}
                        className={`hover:bg-blue-50/40 transition-colors ${isSelected ? 'bg-blue-50/70 font-semibold' : ''}`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">
                              {name === 'DỰ ÁN' ? 'apartment' : 'person'}
                            </span>
                            <span>{name}</span>
                            {isSelected && (
                              <span className="text-[10px] px-1 py-0.2 bg-blue-100 text-blue-700 rounded">Đang lọc</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                          {money(data.quy)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                          {money(data.chi)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${isOver ? 'text-red-600' : 'text-emerald-700'}`}>
                          {money(ton)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isOver 
                              ? 'bg-red-100 text-red-700 border border-red-200' 
                              : ton === 0 
                                ? 'bg-slate-100 text-slate-600' 
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {isOver ? 'Âm quỹ' : ton === 0 ? 'Đã hết quỹ' : 'Còn giữ quỹ'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {onSelectSpender && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSpender(isSelected ? 'all' : name);
                                  setShowPersonalModal(false);
                                }}
                                className="p-1 text-primary hover:bg-blue-100 rounded text-xs font-semibold cursor-pointer"
                                title="Lọc xem phiếu chi của nhân sự này"
                              >
                                <span className="material-symbols-outlined text-[16px]">filter_alt</span>
                              </button>
                            )}
                            {onAllocateFund && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowPersonalModal(false);
                                  onAllocateFund(name);
                                }}
                                className="p-1 text-emerald-600 hover:bg-emerald-100 rounded text-xs cursor-pointer"
                                title="Cấp / Nạp thêm quỹ cho nhân sự này"
                              >
                                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                              </button>
                            )}
                            {onTransferFund && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowPersonalModal(false);
                                  openTransferModal(name);
                                }}
                                className="p-1 text-amber-600 hover:bg-amber-100 rounded text-xs cursor-pointer"
                                title="Chuyển quỹ từ nhân sự này sang dự án khác"
                              >
                                <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                    <td colSpan={2} className="py-2.5 px-3 text-right uppercase text-[11px]">
                      Tổng cộng toàn dự án:
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-900">
                      {money(summary.totalProjectFund)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-900">
                      {money(summary.totalChi)}
                    </td>
                    <td className={`py-2.5 px-3 text-right ${summary.tonCuoiKy < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {money(summary.tonCuoiKy)}
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-center text-slate-500 font-normal text-[11px]">
                      {summary.tonCuoiKy < 0 ? 'Dự án đang âm quỹ' : 'Dự án còn tồn quỹ'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL THÊM / NẠP QUỸ CÔNG TRÌNH */}
      <Modal isOpen={showAddFundModal} onClose={() => setShowAddFundModal(false)} title="THÊM / NẠP QUỸ CÔNG TRÌNH" size="md">
        <form onSubmit={handleSaveFundModal} className="p-4 space-y-4">
          <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Quỹ ban đầu / hiện tại:</span>
              <span className="font-bold text-slate-800 text-sm">{money(summary.totalProjectFund)} VNĐ</span>
            </div>
            
            {fundAmountInput.trim() !== '' && !isNaN(Number(fundAmountInput.replace(/[,.]/g, ''))) && Number(fundAmountInput.replace(/[,.]/g, '')) > 0 && (
              <>
                <div className="flex justify-between items-center text-emerald-600 border-t border-blue-100 pt-2">
                  <span className="font-medium">Nạp thêm:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    + {money(Number(fundAmountInput.replace(/[,.]/g, '')))} VNĐ
                  </span>
                </div>
                <div className="flex justify-between items-center text-blue-900 border-t border-blue-200/60 pt-2 font-bold">
                  <span>Tổng quỹ sau khi nạp:</span>
                  <span className="text-base text-blue-700">
                    {money(summary.totalProjectFund + Number(fundAmountInput.replace(/[,.]/g, '')))} VNĐ
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày nạp *
              </label>
              <input
                type="date"
                required
                value={fundDateInput}
                onChange={(e) => setFundDateInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nhập số tiền nạp thêm (VNĐ)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={fundAmountInput}
                onChange={(e) => setFundAmountInput(e.target.value)}
                placeholder="Ví dụ: 5000000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                autoFocus
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddFundModal(false)}
              className="px-4 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-primary text-white rounded-lg font-bold text-xs hover:opacity-90 transition-opacity shadow-xs"
            >
              Lưu Quỹ
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL CHUYỂN QUỸ */}
      <Modal isOpen={showTransferFundModal} onClose={() => setShowTransferFundModal(false)} title="CHUYỂN QUỸ DỰ ÁN" size="md">
        <form onSubmit={handleSaveTransferModal} className="p-4 space-y-4">
          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-1.5 text-xs text-amber-900">
            <div className="flex justify-between items-center font-bold">
              <span>Dự án nguồn:</span>
              <span className="text-primary font-black">{currentProjectCode || 'Dự án hiện tại'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Người chuyển / Nguồn quỹ:</span>
              <span className="font-bold">{transferFromSpender === 'DỰ ÁN' ? 'Quỹ Tổng Dự Án' : transferFromSpender}</span>
            </div>
            {transferFromSpender && transferFromSpender !== 'DỰ ÁN' && summary.bySpender[transferFromSpender] && (
              <div className="flex justify-between items-center border-t border-amber-200/60 pt-1 text-slate-700">
                <span>Tồn quỹ hiện tại:</span>
                <span className="font-bold text-emerald-700">
                  {money(summary.bySpender[transferFromSpender].quy - summary.bySpender[transferFromSpender].chi)} VNĐ
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dự án nhận quỹ *</label>
              <CustomSelect
                required
                value={transferToProject}
                onChange={(e) => setTransferToProject(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none bg-white"
              >
                <option value="">-- Chọn dự án đích --</option>
                {projects.filter(p => p.code !== currentProjectCode).map(p => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </CustomSelect>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Người nhận quỹ ở DA đích</label>
                <input
                  type="text"
                  value={transferToSpender}
                  onChange={(e) => setTransferToSpender(e.target.value)}
                  placeholder={transferFromSpender === 'DỰ ÁN' ? 'Mặc định: DỰ ÁN' : transferFromSpender}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngày chuyển *</label>
                <input
                  type="date"
                  required
                  value={transferDateInput}
                  onChange={(e) => setTransferDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Số tiền chuyển (VNĐ) *</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={transferAmountInput}
                onChange={(e) => setTransferAmountInput(e.target.value)}
                placeholder="Ví dụ: 5000000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-amber-700 focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ghi chú chuyển quỹ</label>
              <input
                type="text"
                value={transferNotesInput}
                onChange={(e) => setTransferNotesInput(e.target.value)}
                placeholder="Ví dụ: Tạm ứng quỹ thi công..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:outline-none bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowTransferFundModal(false)}
              className="px-4 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={transferSubmitting}
              className="px-5 py-1.5 bg-amber-600 text-white rounded-lg font-bold text-xs hover:bg-amber-700 transition-colors shadow-xs flex items-center gap-1 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
              {transferSubmitting ? 'Đang chuyển...' : 'Thực hiện chuyển quỹ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
