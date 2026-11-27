/**
 * Project Financial Performance & Profitability Calculator
 * 
 * Chuẩn mực tài chính thi công công trình:
 * 1. Tách biệt Lợi nhuận kế hoạch vs Lợi nhuận thực tế tạm tính.
 * 2. Tách biệt Lợi nhuận kinh tế (P&L) vs Dòng tiền thực tế (Cash Flow).
 * 3. Phân định rõ 2 chiều:
 *    - Đầu ra: Hợp đồng CĐT, Phụ lục tăng/giảm DT, Doanh thu nghiệm thu, Doanh thu đã thu.
 *    - Đầu vào: Mua sắm/Thầu phụ, Phụ lục đầu vào, Nhân công (Công nhật + Khoán), Chi phí hiện trường, Khấu hao/Dự phòng.
 */

import { Project, ProjectPurchasing, ProjectExpense, LaborPayroll, DocumentTrack, ProjectMaterialPlan } from '../types';

export interface ProjectFinancialMetrics {
  // === 1. DOANH THU & ĐẦU RA (REVENUE) ===
  contractOutputBase: number; // Giá trị hợp đồng đầu ra gốc đã ký với CĐT/Khách hàng
  appendicesOutputAmount: number; // Phụ lục đầu ra tăng/giảm (+/-)
  totalApprovedRevenue: number; // Tổng doanh thu hợp đồng điều chỉnh = Gốc + Phụ lục
  acceptedRevenue: number; // Doanh thu đã nghiệm thu giai đoạn / đủ điều kiện ghi nhận
  unacceptedRevenue: number; // Khối lượng đang thi công chưa nghiệm thu (WIP) = Tổng DT điều chỉnh - Đã nghiệm thu
  retentionMoneyAmount: number; // Tạm giữ bảo hành (thường 5% của Đã nghiệm thu hoặc Hợp đồng)
  revenueCollected: number; // Doanh thu thực tế CĐT đã thanh toán
  revenueReceivable: number; // Còn phải thu từ CĐT = Đã nghiệm thu - Đã thu

  // === 2. GIÁ VỐN KẾ HOẠCH (BUDGETED COST) ===
  plannedPurchasingCost: number; // Kế hoạch mua hàng / thầu phụ đã duyệt (Vật tư + Thầu phụ)
  plannedLaborCost: number; // Ngân sách dự toán nhân công
  plannedExpenseCost: number; // Ngân sách dự toán chi phí hiện trường
  plannedContingencyCost: number; // Chi phí dự phòng rủi ro biến động giá / phát sinh (3-5%)
  totalPlannedCost: number; // Tổng giá vốn kế hoạch = Mua sắm + Nhân công + Chi phí + Dự phòng

  // === 3. GIÁ VỐN THỰC TẾ PHÁT SINH (ACTUAL COST / COGS) ===
  actualPurchasingCommitted: number; // Giá trị đơn mua hàng/thầu phụ đã ký kết (+ phụ lục đầu vào)
  actualPurchasingPaid: number; // Tiền vật tư/thầu phụ đã thanh toán
  actualPurchasingPayable: number; // Công nợ còn phải trả nhà cung cấp/thầu phụ
  actualLaborCost: number; // Chi phí nhân công công nhật / khoán thực tế phát sinh
  actualExpenseCost: number; // Chi phí hiện trường thực tế đã chi/đã duyệt
  allocatedGeneralCost: number; // Chi phí chung / khấu hao máy móc CCDC phân bổ (nếu có)
  totalActualCost: number; // Tổng giá vốn thực tế phát sinh = Mua hàng cam kết + Nhân công + Chi phí + Phân bổ

  // === 4. LỢI NHUẬN DỰ ÁN (PROFITABILITY) ===
  plannedGrossProfit: number; // Lợi nhuận kế hoạch = Tổng DT phê duyệt - Tổng giá vốn kế hoạch
  plannedGrossMarginPercent: number; // Biên lợi nhuận kế hoạch % = (LN kế hoạch / Tổng DT phê duyệt) * 100

  actualEstimatedProfit: number; // Lợi nhuận thực tế tạm tính = Doanh thu đã nghiệm thu - Tổng giá vốn thực tế
  actualGrossMarginPercent: number; // Biên lợi nhuận thực tế % = (LN tạm tính / Doanh thu đã nghiệm thu) * 100

  costVariance: number; // Chênh lệch giá vốn = Kế hoạch - Thực tế (Dương: Tiết kiệm chi phí, Âm: Vượt ngân sách)
  costHealthStatus: 'HEALTHY' | 'WARNING' | 'DANGER'; // Đánh giá mức độ an toàn tài chính

  // === 5. DÒNG TIỀN DỰ ÁN (CASH FLOW - TÁCH BIỆT HOÀN TOÀN VỚI LỢI NHUẬN) ===
  cashInflow: number; // Tổng tiền đã thu vào từ dự án
  cashOutflow: number; // Tổng tiền thực tế đã chi ra (Vật tư đã trả + Nhân công + Chi phí)
  netCashFlow: number; // Dòng tiền ròng hiện tại = Tiền vào - Tiền ra
  workingCapitalStatus: 'SURPLUS' | 'DEFICIT'; // Thặng dư tiền hay đang phải bù vốn lưu động
}

export const calculateProjectFinancialPerformance = (
  project: Project | null | undefined,
  purchasingPlans: ProjectPurchasing[],
  expenses: ProjectExpense[],
  laborPayrolls: LaborPayroll[],
  documentTracks: DocumentTrack[],
  materialPlans: ProjectMaterialPlan[] = []
): ProjectFinancialMetrics => {
  const code = project?.code || '';

  // 1. Lọc dữ liệu theo dự án
  const projPurchasing = purchasingPlans.filter(p => p.projectCode === code);
  const projExpenses = expenses.filter(p => p.projectCode === code);
  const projLabor = laborPayrolls.filter(p => p.projectCode === code);
  const projDocs = documentTracks.filter(d => d.projectCode === code || (project?.id && d.projectId === project.id));

  // Tách hồ sơ đầu ra và đầu vào
  const outputDocs = projDocs.filter(d => d.flowType === 'output');
  const inputDocs = projDocs.filter(d => d.flowType === 'input');

  // --- 1. DOANH THU & ĐẦU RA ---
  // Tìm hợp đồng đầu ra chính trong danh mục hồ sơ hoặc trường contractValue của dự án
  const mainOutputDoc = outputDocs.find(d => 
    (d.subType?.toLowerCase().includes('hợp đồng') || d.contractName?.toLowerCase().includes('hợp đồng')) &&
    !d.contractName?.toLowerCase().includes('phụ lục')
  );

  const contractOutputBase = Number(
    project?.contractValue ??
    mainOutputDoc?.contractValue ??
    mainOutputDoc?.totalAmount ??
    0
  );

  // Phụ lục đầu ra (tăng/giảm giá trị hợp đồng với CĐT)
  const outputAppendices = outputDocs.filter(d => 
    d.contractName?.toLowerCase().includes('phụ lục') || 
    d.subType?.toLowerCase().includes('phụ lục')
  );
  const appendicesOutputAmount = outputAppendices.reduce((sum, d) => sum + Number(d.totalAmount ?? d.contractValue ?? 0), 0);

  const totalApprovedRevenue = contractOutputBase + appendicesOutputAmount;

  // Doanh thu đã nghiệm thu: Tính từ các hồ sơ nghiệm thu đầu ra hoặc trường acceptedAmount
  const acceptedRevenueFromDocs = outputDocs.reduce((sum, d) => {
    if (d.acceptedAmount && d.acceptedAmount > 0) return sum + Number(d.acceptedAmount);
    if (d.subType?.toLowerCase().includes('nghiệm thu') || d.contractName?.toLowerCase().includes('nghiệm thu')) {
      return sum + Number(d.totalAmount ?? d.contractValue ?? 0);
    }
    return sum;
  }, 0);

  // Nếu chưa có hồ sơ nghiệm thu riêng, ước tính theo % tiến độ dự án
  const acceptedRevenue = acceptedRevenueFromDocs > 0
    ? acceptedRevenueFromDocs
    : Math.round(totalApprovedRevenue * (Math.min(100, Math.max(0, project?.progressPercent || 0)) / 100));

  const unacceptedRevenue = Math.max(0, totalApprovedRevenue - acceptedRevenue);

  // Tạm giữ bảo hành (ước tính 5% của doanh thu đã nghiệm thu)
  const retentionMoneyAmount = Math.round(acceptedRevenue * 0.05);

  // Tiền CĐT đã thanh toán thực tế (thu từ output docs)
  const revenueCollected = outputDocs.reduce((sum, d) => sum + Number(d.paidAmount ?? d.prepayAmount ?? 0), 0);
  const revenueReceivable = Math.max(0, acceptedRevenue - revenueCollected);

  // --- 2. GIÁ VỐN KẾ HOẠCH (DỰ TOÁN / BUDGET) ---
  // Dự toán mua sắm: Tổng giá trị vật tư dự toán ban đầu hoặc tổng hợp đồng mua sắm kế hoạch
  const plannedPurchasingCost = projPurchasing.reduce((sum, p) => sum + Number(p.totalAmount ?? 0), 0);
  
  // Dự toán nhân công: nếu có danh mục kế hoạch hoặc ước lượng 15-20% hợp đồng, ở đây tính theo tổng chi phí lương phát sinh + dự phòng
  const plannedLaborCost = projLabor.reduce((sum, l) => sum + Number(l.totalAmount ?? 0), 0);
  const plannedExpenseCost = projExpenses.reduce((sum, e) => sum + Number(e.totalAmount ?? 0), 0);
  
  // Chi phí dự phòng 5% trên tổng dự toán mua sắm & chi phí
  const plannedContingencyCost = Math.round((plannedPurchasingCost + plannedExpenseCost + plannedLaborCost) * 0.05);
  const totalPlannedCost = plannedPurchasingCost + plannedLaborCost + plannedExpenseCost + plannedContingencyCost;

  // --- 3. GIÁ VỐN THỰC TẾ PHÁT SINH ---
  // Mua hàng thực tế: Cam kết theo đơn đặt hàng / hợp đồng mua sắm
  const actualPurchasingCommitted = projPurchasing.reduce((sum, p) => sum + Number(p.totalAmount ?? 0), 0);
  const actualPurchasingPaid = projPurchasing.reduce((sum, p) => sum + Number(p.prepayAmount ?? 0), 0);
  const actualPurchasingPayable = Math.max(0, actualPurchasingCommitted - actualPurchasingPaid);

  // Nhân công thực tế
  const actualLaborCost = projLabor.reduce((sum, l) => sum + Number(l.totalAmount ?? 0), 0);

  // Chi phí thực tế đã duyệt
  const actualExpenseCost = projExpenses.reduce((sum, e) => sum + Number(e.totalAmount ?? 0), 0);

  // Phân bổ chi phí máy móc & CCDC (hiện tại tính 0 hoặc từ ghi chú tài sản)
  const allocatedGeneralCost = 0;

  const totalActualCost = actualPurchasingCommitted + actualLaborCost + actualExpenseCost + allocatedGeneralCost;

  // --- 4. LỢI NHUẬN DỰ ÁN ---
  const plannedGrossProfit = totalApprovedRevenue - totalPlannedCost;
  const plannedGrossMarginPercent = totalApprovedRevenue > 0
    ? Math.round((plannedGrossProfit / totalApprovedRevenue) * 1000) / 10
    : 0;

  // Lợi nhuận thực tế tạm tính = Doanh thu đã nghiệm thu - Giá vốn thực tế tương ứng với khối lượng đã hoàn thành
  // (Nếu tính toàn bộ giá vốn phát sinh thì đối chiếu trực tiếp với nghiệm thu)
  const actualEstimatedProfit = acceptedRevenue - totalActualCost;
  const actualGrossMarginPercent = acceptedRevenue > 0
    ? Math.round((actualEstimatedProfit / acceptedRevenue) * 1000) / 10
    : 0;

  const costVariance = totalPlannedCost - totalActualCost;

  let costHealthStatus: 'HEALTHY' | 'WARNING' | 'DANGER' = 'HEALTHY';
  if (totalApprovedRevenue > 0) {
    if (totalActualCost > totalApprovedRevenue || actualEstimatedProfit < 0) {
      costHealthStatus = 'DANGER';
    } else if (actualGrossMarginPercent < 10 || totalActualCost > totalPlannedCost * 0.95) {
      costHealthStatus = 'WARNING';
    }
  }

  // --- 5. DÒNG TIỀN DỰ ÁN (CASH FLOW) ---
  const cashInflow = revenueCollected;
  const cashOutflow = actualPurchasingPaid + actualLaborCost + actualExpenseCost;
  const netCashFlow = cashInflow - cashOutflow;
  const workingCapitalStatus: 'SURPLUS' | 'DEFICIT' = netCashFlow >= 0 ? 'SURPLUS' : 'DEFICIT';

  return {
    contractOutputBase,
    appendicesOutputAmount,
    totalApprovedRevenue,
    acceptedRevenue,
    unacceptedRevenue,
    retentionMoneyAmount,
    revenueCollected,
    revenueReceivable,

    plannedPurchasingCost,
    plannedLaborCost,
    plannedExpenseCost,
    plannedContingencyCost,
    totalPlannedCost,

    actualPurchasingCommitted,
    actualPurchasingPaid,
    actualPurchasingPayable,
    actualLaborCost,
    actualExpenseCost,
    allocatedGeneralCost,
    totalActualCost,

    plannedGrossProfit,
    plannedGrossMarginPercent,
    actualEstimatedProfit,
    actualGrossMarginPercent,
    costVariance,
    costHealthStatus,

    cashInflow,
    cashOutflow,
    netCashFlow,
    workingCapitalStatus,
  };
};

export const formatMoney = (val?: number | null): string => {
  return new Intl.NumberFormat('vi-VN').format(Math.round(val || 0));
};
