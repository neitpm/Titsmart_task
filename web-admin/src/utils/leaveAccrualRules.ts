import { LeaveRequest, AttendanceAdjustmentRequest } from '../types';

export interface LeaveAccrualMonthResult {
  month: number;
  accruedThisMonth: number; // Thường là 1
  cumulativeAccrued: number; // Lũy kế cộng dồn đến hết tháng này (tối đa 12)
  paidLeaveUsedThisMonth: number; // Số ngày nghỉ hưởng lương (P/PN)
  unpaidLeaveUsedThisMonth: number; // Số ngày vắng không lương (V)
  remainingLeaveEndOfMonth: number; // Số ngày phép còn lại chuyển sang tháng sau
}

export interface YearLeaveBalanceSummary {
  year: number;
  userId: string;
  maxYearQuota: number; // 12
  totalAccruedToDate: number; // Cộng dồn đến tháng hiện tại
  totalPaidLeaveUsed: number; // Tổng số ngày phép có lương đã dùng trong năm
  totalUnpaidLeave: number; // Tổng số ngày vắng không lương do hết phép
  currentRemainingLeave: number; // Số ngày phép còn lại có thể dùng
  monthlyDetails: Record<number, LeaveAccrualMonthResult>;
}

/**
 * Thuật toán tính toán bù trừ ngày nghỉ phép có lương và vắng không lương:
 * 1. Mỗi tháng có 1 ngày nghỉ có lương.
 * 2. Ngày nghỉ có lương được CỘNG DỒN nếu chưa dùng tới.
 * 3. Tối đa 1 năm có 12 ngày phép.
 * 4. Tự động linh hoạt bù trừ theo tháng:
 *    - Khi nghỉ phép trong tháng m:
 *      * Quota khả dụng = Số phép dư dồn từ các tháng trước + 1 ngày của tháng m (không vượt quá 12/năm).
 *      * Nếu số ngày xin nghỉ <= Quota khả dụng: Toàn bộ là Nghỉ có lương.
 *      * Nếu vượt quá Quota khả dụng: Phần vượt quá sẽ tính là Vắng không lương (V).
 *      * Số phép còn dư tiếp tục chuyển sang tích lũy cho các tháng tiếp theo.
 * 5. Tự động HOÀN TRẢ NGÀY PHÉP khi có Chấm công bù (AttendanceAdjustmentRequest):
 *    - Nếu ngày nghỉ phép đó sau đó đã có Đơn chấm công bù được DUYỆT (APPROVED hoặc APPROVED_STEP1),
 *      chứng tỏ nhân sự thực tế vẫn đi làm/chấm công bổ sung ngày hôm đó -> Ngày nghỉ phép đó được hoàn trả lại
 *      (không bị trừ vào quỹ phép năm nữa).
 */
export function calculateYearLeaveAccrual(
  userId: string,
  year: number,
  allLeaves: LeaveRequest[],
  upToMonth: number = 12,
  adjustments: AttendanceAdjustmentRequest[] = []
): YearLeaveBalanceSummary {
  // Tập hợp các ngày đã được duyệt chấm công bù của nhân viên này trong năm đang xét (YYYY-MM-DD)
  const approvedAdjDates = new Set<string>();
  const approvedHalfAdjDates = new Map<string, number>(); // date -> portion (0.5 hoặc 1)

  (adjustments || []).forEach(adj => {
    if (!adj.userId || adj.userId !== userId) return;
    if (adj.status !== 'APPROVED' && adj.status !== 'APPROVED_STEP1') return;
    if (!adj.adjustmentDate) return;

    const dateStr = String(adj.adjustmentDate).slice(0, 10);
    const dYear = parseInt(dateStr.slice(0, 4), 10);
    if (dYear !== year) return;

    approvedAdjDates.add(dateStr);
    const portion = (adj.adjustmentType === 'Bù vào ca' || adj.adjustmentType === 'Bù ra ca') ? 0.5 : 1;
    const currentPortion = approvedHalfAdjDates.get(dateStr) || 0;
    approvedHalfAdjDates.set(dateStr, Math.min(1, currentPortion + portion));
  });

  // Lọc tất cả đơn nghỉ phép đã được duyệt của nhân viên này trong năm đang xét
  const approvedLeaves = allLeaves.filter(lv => {
    if (!lv.userId || lv.userId !== userId) return false;
    if (lv.status !== 'APPROVED' && lv.status !== 'APPROVED_STEP1') return false;
    const sDate = new Date(lv.startDate);
    return sDate.getFullYear() === year;
  });

  // Gom số ngày nghỉ xin tính phép theo từng tháng (chỉ tính ngày thường T2 - T7)
  const leaveDaysByMonth: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    leaveDaysByMonth[m] = 0;
  }

  approvedLeaves.forEach(lv => {
    // Chỉ tính các đơn xin nghỉ phép hưởng chế độ phép năm/nghỉ có lương
    // Nếu đơn chọn rõ 'Nghỉ không lương' thì người dùng chủ động nghỉ không lương
    if (lv.leaveType === 'Nghỉ không lương') return;

    const sDate = new Date(lv.startDate);
    const eDate = new Date(lv.endDate);

    for (let cur = new Date(sDate); cur <= eDate; cur.setDate(cur.getDate() + 1)) {
      if (cur.getFullYear() === year) {
        const dayOfWeek = cur.getDay(); // 0 là CN
        if (dayOfWeek !== 0) { // Không tính CN
          const m = cur.getMonth() + 1;
          const monthPad = m < 10 ? `0${m}` : `${m}`;
          const dayPad = cur.getDate() < 10 ? `0${cur.getDate()}` : `${cur.getDate()}`;
          const curYMD = `${cur.getFullYear()}-${monthPad}-${dayPad}`;

          let portion = lv.session === 'MORNING' || lv.session === 'AFTERNOON' ? 0.5 : 1;

          // HOÀN TRẢ PHÉP: Nếu ngày này đã có Đơn chấm công bù được duyệt -> Hoàn trả lại ngày phép (giảm trừ số ngày nghỉ)
          if (approvedAdjDates.has(curYMD)) {
            const adjCoveredPortion = approvedHalfAdjDates.get(curYMD) || 1;
            portion = Math.max(0, portion - adjCoveredPortion);
          }

          if (portion > 0) {
            leaveDaysByMonth[m] = (leaveDaysByMonth[m] || 0) + portion;
          }
        }
      }
    }
  });

  let cumulativeAccrued = 0;
  let remainingBalance = 0;
  let totalPaidLeaveUsed = 0;
  let totalUnpaidLeave = 0;
  const monthlyDetails: Record<number, LeaveAccrualMonthResult> = {};

  for (let m = 1; m <= 12; m++) {
    // Mỗi tháng cộng thêm 1 ngày phép, tối đa không quá 12 ngày/năm
    const accruedThisMonth = cumulativeAccrued < 12 ? 1 : 0;
    cumulativeAccrued += accruedThisMonth;
    remainingBalance += accruedThisMonth;

    const requestedDays = leaveDaysByMonth[m] || 0;
    let paidUsed = 0;
    let unpaidUsed = 0;

    if (requestedDays <= remainingBalance) {
      paidUsed = requestedDays;
      remainingBalance -= requestedDays;
    } else {
      paidUsed = remainingBalance;
      unpaidUsed = requestedDays - remainingBalance;
      remainingBalance = 0;
    }

    totalPaidLeaveUsed += paidUsed;
    totalUnpaidLeave += unpaidUsed;

    monthlyDetails[m] = {
      month: m,
      accruedThisMonth,
      cumulativeAccrued,
      paidLeaveUsedThisMonth: paidUsed,
      unpaidLeaveUsedThisMonth: unpaidUsed,
      remainingLeaveEndOfMonth: remainingBalance,
    };
  }

  return {
    year,
    userId,
    maxYearQuota: 12,
    totalAccruedToDate: monthlyDetails[upToMonth]?.cumulativeAccrued || 0,
    totalPaidLeaveUsed,
    totalUnpaidLeave,
    currentRemainingLeave: monthlyDetails[upToMonth]?.remainingLeaveEndOfMonth || 0,
    monthlyDetails,
  };
}
