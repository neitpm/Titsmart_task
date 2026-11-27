import React, { useMemo, useState } from 'react';
import { useRealtimeStore } from '../../services/realtimeStore';
import { calculateProjectFinancialPerformance, formatMoney } from '../../utils/financialPerformanceUtils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell } from 'recharts';

interface FinancialPerformanceTabProps {
  selectedProjectCode: string;
}

export const FinancialPerformanceTab: React.FC<FinancialPerformanceTabProps> = ({ selectedProjectCode }) => {
  const projects = useRealtimeStore(s => s.projects);
  const purchasingPlans = useRealtimeStore(s => s.purchasingPlans);
  const expenses = useRealtimeStore(s => s.expenses);
  const laborPayrolls = useRealtimeStore(s => s.laborPayrolls);
  const documentTracks = useRealtimeStore(s => s.documentTracks);
  const materialPlans = useRealtimeStore(s => s.materialPlans);
  const updateProject = useRealtimeStore(s => s.updateProject);

  const [activeViewMode, setActiveViewMode] = useState<'OVERVIEW' | 'BREAKDOWN' | 'CASHFLOW'>('OVERVIEW');
  const [isEditingContract, setIsEditingContract] = useState(false);
  const [contractInputVal, setContractInputVal] = useState('');

  const currentProject = useMemo(() => {
    return projects.find(p => p.code === selectedProjectCode || p.id === selectedProjectCode) || null;
  }, [projects, selectedProjectCode]);

  const metrics = useMemo(() => {
    return calculateProjectFinancialPerformance(
      currentProject,
      purchasingPlans,
      expenses,
      laborPayrolls,
      documentTracks,
      materialPlans
    );
  }, [currentProject, purchasingPlans, expenses, laborPayrolls, documentTracks, materialPlans]);

  const handleSaveContractValue = async () => {
    if (!currentProject) return;
    const num = parseFloat(contractInputVal.replace(/[^\d.-]/g, '')) || 0;
    try {
      await updateProject(currentProject.id, { contractValue: num });
      setIsEditingContract(false);
    } catch (e) {
      console.error('Failed to update contract value', e);
    }
  };

  // Biểu đồ so sánh Kế hoạch vs Thực tế
  const comparisonChartData = useMemo(() => [
    {
      category: 'Doanh thu',
      'Kế hoạch / Hợp đồng': metrics.totalApprovedRevenue,
      'Thực tế / Nghiệm thu': metrics.acceptedRevenue
    },
    {
      category: 'Giá vốn',
      'Kế hoạch / Hợp đồng': metrics.totalPlannedCost,
      'Thực tế / Nghiệm thu': metrics.totalActualCost
    },
    {
      category: 'Lợi nhuận gộp',
      'Kế hoạch / Hợp đồng': Math.max(0, metrics.plannedGrossProfit),
      'Thực tế / Nghiệm thu': Math.max(0, metrics.actualEstimatedProfit)
    }
  ], [metrics]);

  // Biểu đồ cơ cấu giá vốn thực tế
  const costBreakdownData = useMemo(() => [
    { name: 'Vật tư & Thầu phụ', value: metrics.actualPurchasingCommitted, color: '#3b82f6' },
    { name: 'Nhân công công nhật', value: metrics.actualLaborCost, color: '#f59e0b' },
    { name: 'Chi phí hiện trường', value: metrics.actualExpenseCost, color: '#10b981' }
  ].filter(d => d.value > 0), [metrics]);

  if (!selectedProjectCode) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-slate-500">
        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">trending_up</span>
        <p className="text-sm font-semibold">Vui lòng chọn một dự án để xem báo cáo hiệu quả tài chính và lợi nhuận.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden text-slate-800">
      {/* 1. TOP STATS BAR: 4 TRỤ CỘT TÀI CHÍNH */}
      <div className="bg-white border-b border-slate-200 px-3 py-2.5 shrink-0 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Card 1: DOANH THU & ĐẦU RA */}
          <div className="p-2.5 rounded-lg border border-blue-100 bg-blue-50/40 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">contract</span>
                1. DOANH THU PHÊ DUYỆT
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-mono">
                {currentProject?.progressPercent || 0}% tiến độ
              </span>
            </div>
            <div className="text-xl font-extrabold text-blue-950 tracking-tight">
              {formatMoney(metrics.totalApprovedRevenue)} <span className="text-xs font-semibold text-blue-700">đ</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 border-t border-blue-200/50 pt-1.5 font-medium">
              <div className="flex justify-between items-center">
                <span>HĐ gốc:</span>
                {isEditingContract ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={contractInputVal}
                      onChange={(e) => setContractInputVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveContractValue(); if (e.key === 'Escape') setIsEditingContract(false); }}
                      placeholder="Nhập giá trị..."
                      className="w-24 px-1 py-0.5 border border-primary rounded text-[11px] font-bold text-slate-800 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveContractValue}
                      className="px-1.5 py-0.5 bg-primary text-white rounded text-[10px] font-bold"
                    >Lưu</button>
                    <button
                      type="button"
                      onClick={() => setIsEditingContract(false)}
                      className="px-1 py-0.5 text-slate-400 hover:text-slate-600 text-[10px]"
                    >✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <b className="text-slate-800">{formatMoney(metrics.contractOutputBase)} đ</b>
                    <button
                      type="button"
                      onClick={() => {
                        setContractInputVal(String(metrics.contractOutputBase || ''));
                        setIsEditingContract(true);
                      }}
                      title="Cài đặt giá trị hợp đồng gốc"
                      className="text-slate-400 hover:text-primary p-0.5 rounded cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">edit</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <span>Phụ lục CĐT (+/-):</span>
                <b className={metrics.appendicesOutputAmount >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {metrics.appendicesOutputAmount > 0 ? '+' : ''}{formatMoney(metrics.appendicesOutputAmount)} đ
                </b>
              </div>
              <div className="flex justify-between text-blue-800 font-bold pt-0.5">
                <span>Đã nghiệm thu (A-B):</span>
                <span>{formatMoney(metrics.acceptedRevenue)} đ</span>
              </div>
            </div>
          </div>

          {/* Card 2: GIÁ VỐN & CHI PHÍ */}
          <div className="p-2.5 rounded-lg border border-amber-100 bg-amber-50/40 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">shopping_bag</span>
                2. TỔNG GIÁ VỐN THỰC TẾ
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                metrics.costHealthStatus === 'HEALTHY'
                  ? 'bg-emerald-100 text-emerald-800'
                  : metrics.costHealthStatus === 'WARNING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
              }`}>
                {metrics.costHealthStatus === 'HEALTHY' ? 'Trong ngân sách' : metrics.costHealthStatus === 'WARNING' ? 'Sát trần' : 'Vượt giá vốn'}
              </span>
            </div>
            <div className="text-xl font-extrabold text-amber-950 tracking-tight">
              {formatMoney(metrics.totalActualCost)} <span className="text-xs font-semibold text-amber-700">đ</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 border-t border-amber-200/50 pt-1.5 font-medium">
              <div className="flex justify-between">
                <span>Mua hàng / Thầu phụ:</span>
                <b className="text-slate-800">{formatMoney(metrics.actualPurchasingCommitted)} đ</b>
              </div>
              <div className="flex justify-between">
                <span>Nhân công công nhật:</span>
                <b className="text-slate-800">{formatMoney(metrics.actualLaborCost)} đ</b>
              </div>
              <div className="flex justify-between">
                <span>Chi phí hiện trường:</span>
                <b className="text-slate-800">{formatMoney(metrics.actualExpenseCost)} đ</b>
              </div>
            </div>
          </div>

          {/* Card 3: LỢI NHUẬN GỘP & BIÊN LÃI */}
          <div className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/40 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">trending_up</span>
                3. LỢI NHUẬN THỰC TẾ (TẠM TÍNH)
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-200 text-emerald-900 font-extrabold">
                {metrics.actualGrossMarginPercent}%
              </span>
            </div>
            <div className={`text-xl font-extrabold tracking-tight ${
              metrics.actualEstimatedProfit >= 0 ? 'text-emerald-900' : 'text-rose-700'
            }`}>
              {formatMoney(metrics.actualEstimatedProfit)} <span className="text-xs font-semibold">đ</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 border-t border-emerald-200/50 pt-1.5 font-medium">
              <div className="flex justify-between">
                <span>Lợi nhuận kế hoạch:</span>
                <b className="text-slate-800">{formatMoney(metrics.plannedGrossProfit)} đ ({metrics.plannedGrossMarginPercent}%)</b>
              </div>
              <div className="flex justify-between">
                <span>Chênh lệch kế hoạch:</span>
                <b className={metrics.costVariance >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {metrics.costVariance >= 0 ? 'Tiết kiệm: +' : 'Bội chi: '}{formatMoney(Math.abs(metrics.costVariance))} đ
                </b>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Bảo hành tạm giữ (5%):</span>
                <span>{formatMoney(metrics.retentionMoneyAmount)} đ</span>
              </div>
            </div>
          </div>

          {/* Card 4: DÒNG TIỀN DỰ ÁN */}
          <div className="p-2.5 rounded-lg border border-purple-100 bg-purple-50/40 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold text-purple-900 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-purple-600 text-[18px]">account_balance</span>
                4. DÒNG TIỀN THỰC TẾ (CASH FLOW)
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                metrics.workingCapitalStatus === 'SURPLUS' ? 'bg-purple-200 text-purple-900' : 'bg-rose-200 text-rose-900'
              }`}>
                {metrics.workingCapitalStatus === 'SURPLUS' ? 'Dương tiền' : 'Đang ứng vốn'}
              </span>
            </div>
            <div className={`text-xl font-extrabold tracking-tight ${
              metrics.netCashFlow >= 0 ? 'text-purple-950' : 'text-rose-700'
            }`}>
              {formatMoney(metrics.netCashFlow)} <span className="text-xs font-semibold">đ</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 border-t border-purple-200/50 pt-1.5 font-medium">
              <div className="flex justify-between">
                <span>Tiền đã thu về:</span>
                <b className="text-emerald-700">{formatMoney(metrics.cashInflow)} đ</b>
              </div>
              <div className="flex justify-between">
                <span>Tiền đã chi ra:</span>
                <b className="text-rose-700">{formatMoney(metrics.cashOutflow)} đ</b>
              </div>
              <div className="flex justify-between text-slate-700 font-semibold pt-0.5">
                <span>Còn phải thu CĐT:</span>
                <span className="text-blue-700">{formatMoney(metrics.revenueReceivable)} đ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CHỌN CHẾ ĐỘ XEM & CHI TIẾT */}
      <div className="bg-white border-b border-slate-200 px-3 py-1.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveViewMode('OVERVIEW')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeViewMode === 'OVERVIEW'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">analytics</span>
            <span>Báo cáo Tổng hợp P&L</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewMode('BREAKDOWN')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeViewMode === 'BREAKDOWN'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">pie_chart</span>
            <span>Cơ cấu Chi phí & Kế hoạch</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewMode('CASHFLOW')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeViewMode === 'CASHFLOW'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">account_balance_wallet</span>
            <span>Đối chiếu Dòng tiền & Công nợ</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium hidden sm:block">
          Dự án: <b className="text-slate-800">[{selectedProjectCode}] {currentProject?.name}</b>
        </div>
      </div>

      {/* 3. NỘI DUNG TỪNG CHẾ ĐỘ XEM */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {activeViewMode === 'OVERVIEW' && (
          <div className="space-y-3">
            {/* Bảng so sánh 2 Lớp: Kế hoạch vs Thực tế */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">table_chart</span>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                    BẢNG ĐỐI SOÁT HIỆU QUẢ KINH TẾ (P&L DỰ ÁN)
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500 italic">
                  Đơn vị tính: VNĐ
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">CHỈ TIÊU KINH TẾ</th>
                      <th className="py-2.5 px-3 text-right">KẾ HOẠCH / DỰ TOÁN</th>
                      <th className="py-2.5 px-3 text-right">THỰC TẾ / TẠM TÍNH</th>
                      <th className="py-2.5 px-3 text-right">CHÊNH LỆCH</th>
                      <th className="py-2.5 px-3 text-center">GHI CHÚ / QUY TẮC TÍNH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {/* KHỐI 1: DOANH THU */}
                    <tr className="bg-blue-50/30 font-bold text-blue-950">
                      <td className="py-2.5 px-3">I. TỔNG DOANH THU ĐẦU RA</td>
                      <td className="py-2.5 px-3 text-right font-extrabold">{formatMoney(metrics.totalApprovedRevenue)}</td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-blue-700">{formatMoney(metrics.acceptedRevenue)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {formatMoney(metrics.acceptedRevenue - metrics.totalApprovedRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500 text-center">
                        Nghiệm thu đạt {metrics.totalApprovedRevenue > 0 ? Math.round((metrics.acceptedRevenue / metrics.totalApprovedRevenue) * 100) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-7">1. Giá trị hợp đồng gốc với CĐT</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.contractOutputBase)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.contractOutputBase)}</td>
                      <td className="py-2 px-3 text-right text-slate-400">-</td>
                      <td className="py-2 px-3 text-[11px] text-slate-400 text-center">Hợp đồng kinh tế ban đầu</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-7">2. Phụ lục đầu ra tăng/giảm (VO)</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.appendicesOutputAmount)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.appendicesOutputAmount)}</td>
                      <td className="py-2 px-3 text-right text-slate-400">-</td>
                      <td className="py-2 px-3 text-[11px] text-slate-400 text-center">Phụ lục điều chỉnh doanh thu</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-7">3. Khối lượng thi công dở dang (WIP)</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-400">-</td>
                      <td className="py-2 px-3 text-right font-medium text-amber-700">{formatMoney(metrics.unacceptedRevenue)}</td>
                      <td className="py-2 px-3 text-right text-slate-400">-</td>
                      <td className="py-2 px-3 text-[11px] text-slate-400 text-center">Đang thi công chưa làm thủ tục nghiệm thu</td>
                    </tr>

                    {/* KHỐI 2: GIÁ VỐN */}
                    <tr className="bg-amber-50/30 font-bold text-amber-950">
                      <td className="py-2.5 px-3">II. TỔNG GIÁ VỐN CÔNG TRÌNH (COGS)</td>
                      <td className="py-2.5 px-3 text-right font-extrabold">{formatMoney(metrics.totalPlannedCost)}</td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-amber-800">{formatMoney(metrics.totalActualCost)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {metrics.costVariance >= 0 ? '+' : ''}{formatMoney(metrics.costVariance)}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500 text-center">
                        {metrics.costVariance >= 0 ? 'Tiết kiệm so với dự toán' : 'Vượt định mức kế hoạch'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-7">1. Mua sắm vật tư & Thầu phụ</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.plannedPurchasingCost)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.actualPurchasingCommitted)}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-600">
                        {formatMoney(metrics.plannedPurchasingCost - metrics.actualPurchasingCommitted)}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-400 text-center">Đơn đặt hàng & Hợp đồng NCC</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-7">2. Nhân công công nhật & Khoán ngoài</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.plannedLaborCost)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.actualLaborCost)}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-600">
                        {formatMoney(metrics.plannedLaborCost - metrics.actualLaborCost)}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-400 text-center">Lương công nhật dự án</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-7">3. Chi phí hiện trường & Tiếp khách, lán trại</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.plannedExpenseCost)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.actualExpenseCost)}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-600">
                        {formatMoney(metrics.plannedExpenseCost - metrics.actualExpenseCost)}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-400 text-center">Chi phí phát sinh công trình</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-7">4. Dự phòng phát sinh & Biến động giá (5%)</td>
                      <td className="py-2 px-3 text-right font-medium">{formatMoney(metrics.plannedContingencyCost)}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-400">0</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-400">-</td>
                      <td className="py-2 px-3 text-[11px] text-slate-400 text-center">Khoản đệm dự phòng rủi ro</td>
                    </tr>

                    {/* KHỐI 3: LỢI NHUẬN */}
                    <tr className="bg-emerald-50/50 font-extrabold text-emerald-950 text-sm">
                      <td className="py-3 px-3">III. LỢI NHUẬN GỘP DỰ ÁN (GROSS PROFIT)</td>
                      <td className="py-3 px-3 text-right font-black text-emerald-800">{formatMoney(metrics.plannedGrossProfit)}</td>
                      <td className={`py-3 px-3 text-right font-black ${
                        metrics.actualEstimatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {formatMoney(metrics.actualEstimatedProfit)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {formatMoney(metrics.actualEstimatedProfit - metrics.plannedGrossProfit)}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-center font-bold text-emerald-800">
                        {metrics.actualGrossMarginPercent}% biên lợi nhuận
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-slate-700">
                      <td className="py-2 px-3 pl-7">Tỷ suất biên lợi nhuận (%)</td>
                      <td className="py-2 px-3 text-right">{metrics.plannedGrossMarginPercent}%</td>
                      <td className="py-2 px-3 text-right">{metrics.actualGrossMarginPercent}%</td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {(metrics.actualGrossMarginPercent - metrics.plannedGrossMarginPercent).toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-400 text-center">LN / Doanh thu tương ứng</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Biểu đồ trực quan hóa */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">bar_chart</span>
                  So sánh Kế hoạch vs Thực tế (Doanh thu - Giá vốn - Lợi nhuận)
                </h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}Tr`} tick={{ fontSize: 10 }} />
                      <RechartsTooltip formatter={(val: any) => [`${formatMoney(val)} đ`, '']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Kế hoạch / Hợp đồng" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Thực tế / Nghiệm thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">pie_chart</span>
                  Cơ cấu giá vốn thực tế
                </h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={costBreakdownData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {costBreakdownData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: any) => [`${formatMoney(val)} đ`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5 text-xs">
                  {costBreakdownData.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-slate-600">{d.name}:</span>
                      </div>
                      <b className="text-slate-800">{formatMoney(d.value)} đ</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeViewMode === 'BREAKDOWN' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">account_tree</span>
                Chi tiết các danh mục cấu thành giá vốn và phụ lục
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hệ thống tách biệt rõ ràng 2 chiều phụ lục: 
                <strong className="text-blue-700"> Phụ lục đầu ra </strong> (làm tăng/giảm doanh thu hợp đồng CĐT) và 
                <strong className="text-amber-700"> Phụ lục đầu vào </strong> (làm tăng/giảm giá vốn mua sắm vật tư, nhân công với nhà thầu phụ).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30">
                  <h4 className="font-bold text-xs text-blue-900 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-600 text-[18px]">file_download</span>
                    CHIỀU ĐẦU RA (VỚI CHỦ ĐẦU TƯ / KHÁCH HÀNG)
                  </h4>
                  <ul className="text-xs space-y-1.5 text-slate-700">
                    <li className="flex justify-between border-b border-blue-100 pb-1">
                      <span>Hợp đồng ký kết ban đầu:</span>
                      <b>{formatMoney(metrics.contractOutputBase)} đ</b>
                    </li>
                    <li className="flex justify-between border-b border-blue-100 pb-1">
                      <span>Phụ lục điều chỉnh khối lượng / đơn giá:</span>
                      <b className={metrics.appendicesOutputAmount >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {formatMoney(metrics.appendicesOutputAmount)} đ
                      </b>
                    </li>
                    <li className="flex justify-between border-b border-blue-100 pb-1 font-bold text-blue-900">
                      <span>Tổng giá trị sau điều chỉnh:</span>
                      <span>{formatMoney(metrics.totalApprovedRevenue)} đ</span>
                    </li>
                    <li className="flex justify-between pt-1">
                      <span>Giá trị đã được CĐT nghiệm thu A-B:</span>
                      <b className="text-emerald-700">{formatMoney(metrics.acceptedRevenue)} đ</b>
                    </li>
                  </ul>
                </div>

                <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/30">
                  <h4 className="font-bold text-xs text-amber-900 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-600 text-[18px]">file_upload</span>
                    CHIỀU ĐẦU VÀO (VẬT TƯ, THẦU PHỤ, NHÂN CÔNG)
                  </h4>
                  <ul className="text-xs space-y-1.5 text-slate-700">
                    <li className="flex justify-between border-b border-amber-100 pb-1">
                      <span>Hợp đồng mua sắm vật tư & thầu phụ:</span>
                      <b>{formatMoney(metrics.actualPurchasingCommitted)} đ</b>
                    </li>
                    <li className="flex justify-between border-b border-amber-100 pb-1">
                      <span>Lương nhân công công nhật dự án:</span>
                      <b>{formatMoney(metrics.actualLaborCost)} đ</b>
                    </li>
                    <li className="flex justify-between border-b border-amber-100 pb-1">
                      <span>Chi phí hiện trường thực tế:</span>
                      <b>{formatMoney(metrics.actualExpenseCost)} đ</b>
                    </li>
                    <li className="flex justify-between border-b border-amber-100 pb-1 font-bold text-amber-900">
                      <span>Tổng chi phí phát sinh cam kết:</span>
                      <span>{formatMoney(metrics.totalActualCost)} đ</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeViewMode === 'CASHFLOW' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">account_balance</span>
                  QUẢN TRỊ DÒNG TIỀN VÀ CÔNG NỢ (TIỀN THU - TIỀN CHI)
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-purple-100 text-purple-800">
                  Tiền đã thu - Tiền đã chi ≠ Lợi nhuận
                </span>
              </div>

              <div className="p-2.5 bg-purple-50/60 rounded-lg border border-purple-200 text-xs text-purple-950 leading-relaxed">
                <strong>Quy tắc hạch toán:</strong> Dòng tiền ghi nhận tiền thực tế chạy vào tài khoản công ty và tiền công ty thực chi trả. 
                Một dự án có thể đã phát sinh lợi nhuận cao (nghiệm thu đạt 90%), nhưng dòng tiền vẫn có thể tạm thời âm nếu Chủ đầu tư chưa giải ngân thanh toán đợt.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
                  <div className="text-xs font-bold text-emerald-800 mb-1">DÒNG TIỀN VÀO (INFLOW)</div>
                  <div className="text-lg font-black text-emerald-950">{formatMoney(metrics.cashInflow)} đ</div>
                  <p className="text-[11px] text-slate-500 mt-2">Tổng số tiền CĐT đã chuyển khoản / thanh toán vào tài khoản.</p>
                </div>

                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30">
                  <div className="text-xs font-bold text-rose-800 mb-1">DÒNG TIỀN RA (OUTFLOW)</div>
                  <div className="text-lg font-black text-rose-950">{formatMoney(metrics.cashOutflow)} đ</div>
                  <p className="text-[11px] text-slate-500 mt-2">Đã thanh toán cho nhà cung cấp vật tư, công nhật và chi phí.</p>
                </div>

                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/30">
                  <div className="text-xs font-bold text-purple-800 mb-1">DÒNG TIỀN RÒNG (NET CASH FLOW)</div>
                  <div className={`text-lg font-black ${metrics.netCashFlow >= 0 ? 'text-purple-950' : 'text-rose-700'}`}>
                    {formatMoney(metrics.netCashFlow)} đ
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    {metrics.netCashFlow >= 0 ? 'Dự án tự chủ tài chính thặng dư.' : 'Công ty đang phải ứng vốn lưu động bù đắp.'}
                  </p>
                </div>
              </div>

              {/* Bảng công nợ 2 đầu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="font-bold text-xs text-slate-800 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-600 text-[18px]">call_received</span>
                    CÔNG NỢ PHẢI THU (CHỦ ĐẦU TƯ / KHÁCH HÀNG)
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Doanh thu đã nghiệm thu:</span>
                      <b>{formatMoney(metrics.acceptedRevenue)} đ</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Đã thu thực tế:</span>
                      <b className="text-emerald-700">{formatMoney(metrics.revenueCollected)} đ</b>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-rose-600">
                      <span>Còn nợ phải thu:</span>
                      <span>{formatMoney(metrics.revenueReceivable)} đ</span>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="font-bold text-xs text-slate-800 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-600 text-[18px]">call_made</span>
                    CÔNG NỢ PHẢI TRẢ (NHÀ CUNG CẤP & THẦU PHỤ)
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Giá trị mua hàng cam kết:</span>
                      <b>{formatMoney(metrics.actualPurchasingCommitted)} đ</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Đã thanh toán tạm ứng:</span>
                      <b className="text-emerald-700">{formatMoney(metrics.actualPurchasingPaid)} đ</b>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-amber-700">
                      <span>Còn phải trả NCC/Thầu phụ:</span>
                      <span>{formatMoney(metrics.actualPurchasingPayable)} đ</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
