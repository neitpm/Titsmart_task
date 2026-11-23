import { Engineer, LeaveRequest, AttendanceAdjustmentRequest, MonthlyPayrollItem } from '../types';

export interface AttendanceDaySummary {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number; // 1 - 31
  dayOfWeek: string; // T2, T3, T4, T5, T6, T7, CN
  isSunday: boolean;
  isSaturday: boolean;
  status: 'present' | 'field' | 'remote' | 'leave_paid' | 'leave_unpaid' | 'holiday' | 'off' | 'absent';
  statusLabel: string;
  checkInTime?: string;
  checkOutTime?: string;
  duration?: string;
  workLocationType?: 'office' | 'field' | 'remote';
  projectName?: string;
  shiftName?: string;
  otHours: number;
  isLate?: boolean;
  isEarly?: boolean;
  notes?: string;
}

export interface UserMonthlyTimesheetCalculation {
  month: number;
  year: number;
  daysInMonth: number;
  standardWorkingDays: number;
  actualWorkingDays: number;
  fieldWorkDays: number;
  remoteWorkDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  sundayWorkingDays: number;
  otHoursNormal: number;
  otHoursSunday: number;
  otHoursHoliday: number;
  lateTimes: number;
  earlyTimes: number;
  totalEquivalentDays: number;
  days: AttendanceDaySummary[];
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Tính toán dữ liệu chấm công chi tiết theo từng ngày trong tháng của nhân viên
 */
export function calculateUserMonthlyAttendance({
  userId,
  userName,
  month,
  year,
  logs = [],
  leaves = [],
  adjustments = [],
}: {
  userId: string;
  userName: string;
  month: number;
  year: number;
  logs: any[];
  leaves?: LeaveRequest[];
  adjustments?: AttendanceAdjustmentRequest[];
}): UserMonthlyTimesheetCalculation {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: AttendanceDaySummary[] = [];

  // Lọc logs của nhân viên trong tháng
  const userLogs = logs.filter(l => {
    if (!l) return false;
    const matchUser = String(l.userId || '') === String(userId || '') || 
      (userName && l.userName && l.userName.trim().toLowerCase() === userName.trim().toLowerCase());
    if (!matchUser) return false;
    if (!l.checkInTime) return false;
    const d = new Date(l.checkInTime);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  // Lọc leaves đã duyệt (APPROVED hoặc APPROVED_STEP1) của nhân viên trong tháng
  const userLeaves = (leaves || []).filter(l => {
    if (!l) return false;
    const matchUser = String(l.userId || '') === String(userId || '') || 
      (userName && l.userName && l.userName.trim().toLowerCase() === userName.trim().toLowerCase());
    if (!matchUser) return false;
    return l.status === 'APPROVED' || l.status === 'APPROVED_STEP1';
  });

  // Lọc adjustments đã duyệt của nhân viên trong tháng
  const userAdjustments = (adjustments || []).filter(a => {
    if (!a) return false;
    const matchUser = String(a.userId || '') === String(userId || '') || 
      (userName && a.userName && a.userName.trim().toLowerCase() === userName.trim().toLowerCase());
    if (!matchUser) return false;
    if (a.status !== 'APPROVED' && a.status !== 'APPROVED_STEP1') return false;
    const d = new Date(a.adjustmentDate);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  let standardWorkingDays = 0;
  let actualWorkingDays = 0;
  let fieldWorkDays = 0;
  let remoteWorkDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let sundayWorkingDays = 0;
  let otHoursNormal = 0;
  let otHoursSunday = 0;
  let otHoursHoliday = 0;
  let lateTimes = 0;
  let earlyTimes = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeekIdx = dateObj.getDay();
    const dayOfWeek = WEEKDAYS[dayOfWeekIdx];
    const isSunday = dayOfWeekIdx === 0;
    const isSaturday = dayOfWeekIdx === 6;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Công chuẩn: Thứ 2 đến Thứ 7 (mỗi ngày 1 công, công ty xây dựng làm T2-T7, CN nghỉ)
    if (!isSunday) {
      standardWorkingDays++;
    }

    // Tìm log chấm công ngày hôm đó
    const dayLogs = userLogs.filter(l => {
      const d = new Date(l.checkInTime);
      return d.getDate() === day;
    });

    // Tìm đơn nghỉ phép bao gồm ngày này
    const matchingLeave = userLeaves.find(l => {
      const start = new Date(l.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(l.endDate);
      end.setHours(23, 59, 59, 999);
      return dateObj >= start && dateObj <= end;
    });

    // Tìm điều chỉnh chấm công bù ngày này
    const matchingAdj = userAdjustments.find(a => {
      const d = new Date(a.adjustmentDate);
      return d.getDate() === day;
    });

    let status: AttendanceDaySummary['status'] = 'off';
    let statusLabel = isSunday ? 'Nghỉ Chủ Nhật' : 'Nghỉ';
    let checkInTime: string | undefined = undefined;
    let checkOutTime: string | undefined = undefined;
    let duration: string | undefined = undefined;
    let workLoc: 'office' | 'field' | 'remote' | undefined = undefined;
    let projName: string | undefined = undefined;
    let shiftName: string | undefined = undefined;
    let otHours = 0;
    let isLate = false;
    let isEarly = false;
    let notes: string | undefined = undefined;

    if (dayLogs.length > 0) {
      // Có chấm công thực tế
      const firstLog = dayLogs[0];
      checkInTime = firstLog.checkInTime;
      checkOutTime = firstLog.checkOutTime;
      workLoc = firstLog.workLocationType || 'office';
      projName = firstLog.projectName;
      shiftName = firstLog.shiftName;
      notes = firstLog.notes;

      if (firstLog.shiftStatus === 'late') {
        isLate = true;
        lateTimes++;
      }
      if (firstLog.shiftStatus === 'early') {
        isEarly = true;
        earlyTimes++;
      }

      if (checkInTime && checkOutTime) {
        const ms = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
        const totalHrs = ms / 3600000;
        const h = Math.floor(totalHrs);
        const m = Math.floor((ms % 3600000) / 60000);
        duration = `${h}h ${m}m`;

        // Tính OT nếu làm vượt 8h
        if (totalHrs > 8.5) {
          otHours = Math.round((totalHrs - 8) * 10) / 10;
        }
      }

      if (isSunday) {
        status = 'present';
        statusLabel = 'Làm CN';
        sundayWorkingDays++;
        otHoursSunday += otHours > 0 ? otHours : 8;
      } else {
        if (workLoc === 'field') {
          status = 'field';
          statusLabel = 'Công trường';
          fieldWorkDays++;
        } else if (workLoc === 'remote') {
          status = 'remote';
          statusLabel = 'Công tác';
          remoteWorkDays++;
        } else {
          status = 'present';
          statusLabel = 'Đi làm';
        }
        actualWorkingDays++;
        if (otHours > 0) {
          otHoursNormal += otHours;
        }
      }
    } else if (matchingAdj) {
      // Có đề xuất chấm công bù được duyệt
      checkInTime = matchingAdj.checkInTime;
      checkOutTime = matchingAdj.checkOutTime;
      projName = matchingAdj.projectName;
      notes = matchingAdj.reason;
      status = 'present';
      statusLabel = 'Đi làm (Bù)';
      actualWorkingDays++;
    } else if (matchingLeave) {
      // Nghỉ phép có duyệt
      notes = matchingLeave.reason;
      if (matchingLeave.leaveType === 'Nghỉ phép năm' || matchingLeave.leaveType === 'Nghỉ việc riêng') {
        status = 'leave_paid';
        statusLabel = matchingLeave.leaveType === 'Nghỉ phép năm' ? 'Phép năm (PN)' : 'Việc riêng (P)';
        paidLeaveDays++;
      } else {
        status = 'leave_unpaid';
        statusLabel = matchingLeave.leaveType === 'Nghỉ bệnh' ? 'Nghỉ ốm (FB)' : 'Không lương (KP)';
        unpaidLeaveDays++;
      }
    } else {
      // Không có chấm công và không có phép
      if (isSunday) {
        status = 'off';
        statusLabel = 'Nghỉ CN';
      } else if (dateObj > new Date()) {
        status = 'off';
        statusLabel = 'Chưa đến';
      } else {
        status = 'absent';
        statusLabel = 'Vắng mặt';
      }
    }

    days.push({
      dateStr,
      dayNumber: day,
      dayOfWeek,
      isSunday,
      isSaturday,
      status,
      statusLabel,
      checkInTime,
      checkOutTime,
      duration,
      workLocationType: workLoc,
      projectName: projName,
      shiftName,
      otHours,
      isLate,
      isEarly,
      notes,
    });
  }

  // Tổng công quy đổi = Công đi làm thực tế + Công phép năm có lương + (Công CN * 1.5 hoặc quy đổi)
  const totalEquivalentDays = actualWorkingDays + paidLeaveDays + (sundayWorkingDays * 1.5);

  return {
    month,
    year,
    daysInMonth,
    standardWorkingDays: Math.min(standardWorkingDays, 26),
    actualWorkingDays,
    fieldWorkDays,
    remoteWorkDays,
    paidLeaveDays,
    unpaidLeaveDays,
    sundayWorkingDays,
    otHoursNormal: Math.round(otHoursNormal * 10) / 10,
    otHoursSunday: Math.round(otHoursSunday * 10) / 10,
    otHoursHoliday: Math.round(otHoursHoliday * 10) / 10,
    lateTimes,
    earlyTimes,
    totalEquivalentDays: Math.round(totalEquivalentDays * 10) / 10,
    days,
  };
}

/**
 * Tự động tính toán bảng lương (Monthly Payroll) kết hợp từ dữ liệu chấm công và thông tin nhân sự
 */
export function generateMonthlyPayrollDraft({
  user,
  engineer,
  month,
  year,
  logs = [],
  leaves = [],
  adjustments = [],
  existingPayroll,
}: {
  user: { id: string; name: string; username?: string; title?: string };
  engineer?: Engineer;
  month: number;
  year: number;
  logs: any[];
  leaves?: LeaveRequest[];
  adjustments?: AttendanceAdjustmentRequest[];
  existingPayroll?: MonthlyPayrollItem | null;
}): MonthlyPayrollItem {
  // Nếu đã có bảng lương đã lưu, giữ nguyên các thông tin đã chốt / chữ ký, nhưng cho phép xem chi tiết
  if (existingPayroll && existingPayroll.signatureStatus === 'signed') {
    return existingPayroll;
  }

  const timesheet = calculateUserMonthlyAttendance({
    userId: user.id,
    userName: user.name,
    month,
    year,
    logs,
    leaves,
    adjustments,
  });

  // Lương cơ bản: Ưu tiên từ bảng đã lưu, hoặc từ engineer profile, hoặc mặc định 12,500,000 VND
  const baseSalary = existingPayroll?.baseSalary ?? (
    (engineer as any)?.baseSalary || 
    (engineer as any)?.salary || 
    12500000
  );

  const standardWorkingDays = existingPayroll?.standardWorkingDays || timesheet.standardWorkingDays || 26;
  const actualWorkingDays = timesheet.actualWorkingDays;
  const paidLeaveDays = timesheet.paidLeaveDays;

  // Tiền lương 1 ngày công
  const dailyRate = Math.round(baseSalary / standardWorkingDays);
  const hourlyRate = Math.round(dailyRate / 8);

  // Lương theo ngày công làm việc thực tế
  const salaryByWorkDays = Math.round(dailyRate * actualWorkingDays);

  // Lương ngày phép có lương
  const paidLeaveSalary = Math.round(dailyRate * paidLeaveDays);

  // Các khoản phụ cấp chuẩn
  // 1. Phụ cấp ăn trưa: 30,000 đ/ngày làm việc thực tế (hoặc theo cấu hình đã lưu)
  const allowanceLunch = existingPayroll?.allowanceLunch ?? Math.round(30000 * actualWorkingDays);

  // 2. Phụ cấp xăng xe / đi lại: 500,000 đ/tháng
  const allowanceFuel = existingPayroll?.allowanceFuel ?? (actualWorkingDays > 0 ? 500000 : 0);

  // 3. Phụ cấp điện thoại: 300,000 đ/tháng
  const allowancePhone = existingPayroll?.allowancePhone ?? (actualWorkingDays > 0 ? 300000 : 0);

  // 4. Phụ cấp công trường / lưu trú hiện trường: 100,000 đ/ngày đi công trường
  const allowanceField = existingPayroll?.allowanceField ?? Math.round(100000 * timesheet.fieldWorkDays);

  // 5. Phụ cấp chức vụ / trách nhiệm khác
  const allowanceRole = existingPayroll?.allowanceRole ?? 0;
  const allowanceOther = existingPayroll?.allowanceOther ?? 0;

  const totalAllowances = allowanceLunch + allowanceFuel + allowancePhone + allowanceField + allowanceRole + allowanceOther;

  // Tiền làm thêm giờ (OT)
  const otPay = existingPayroll?.otPay ?? Math.round(
    (timesheet.otHoursNormal * hourlyRate * 1.5) +
    (timesheet.otHoursSunday * hourlyRate * 2.0) +
    (timesheet.otHoursHoliday * hourlyRate * 3.0)
  );

  // Tiền thưởng
  const bonus = existingPayroll?.bonus ?? 0;

  // Tổng thu nhập (Gross Income)
  const grossIncome = salaryByWorkDays + paidLeaveSalary + totalAllowances + otPay + bonus;

  // Các khoản khấu trừ:
  // 1. BHXH, BHYT, BHTN: 10.5% mức lương cơ bản (nếu có tham gia bảo hiểm)
  const deductionSocialInsurance = existingPayroll?.deductionSocialInsurance ?? (
    (engineer as any)?.hasInsurance !== false ? Math.round(baseSalary * 0.105) : 0
  );

  // 2. Tạm ứng đã nhận
  const deductionAdvance = existingPayroll?.deductionAdvance ?? 0;

  // 3. Thuế TNCN tạm tính (nếu thu nhập chịu thuế > 11tr)
  const taxableIncome = grossIncome - deductionSocialInsurance - 11000000;
  const deductionTax = existingPayroll?.deductionTax ?? (taxableIncome > 0 ? Math.round(taxableIncome * 0.05) : 0);

  // 4. Giảm trừ khác
  const deductionOther = existingPayroll?.deductionOther ?? 0;

  const totalDeductions = deductionSocialInsurance + deductionAdvance + deductionTax + deductionOther;

  // THỰC LĨNH (Net Salary)
  const netSalary = Math.max(0, grossIncome - totalDeductions);

  return {
    id: existingPayroll?.id || `payroll-${year}-${month}-${user.id}`,
    month,
    year,
    userId: user.id,
    userName: user.name,
    userCode: engineer?.code || (engineer as any)?.employeeCode || '',
    userTitle: user.title || engineer?.title || 'Kỹ sư',
    department: (engineer as any)?.department || 'Phòng Kỹ Thuật - Dự Án',

    // Chấm công
    standardWorkingDays,
    actualWorkingDays,
    paidLeaveDays,
    unpaidLeaveDays: timesheet.unpaidLeaveDays,
    sundayWorkingDays: timesheet.sundayWorkingDays,
    otHoursNormal: timesheet.otHoursNormal,
    otHoursSunday: timesheet.otHoursSunday,
    otHoursHoliday: timesheet.otHoursHoliday,
    fieldWorkDays: timesheet.fieldWorkDays,
    remoteWorkDays: timesheet.remoteWorkDays,
    lateTimes: timesheet.lateTimes,
    earlyTimes: timesheet.earlyTimes,
    totalEquivalentDays: timesheet.totalEquivalentDays,

    // Lương & Phụ cấp
    baseSalary,
    salaryByWorkDays,
    paidLeaveSalary,
    allowanceLunch,
    allowanceFuel,
    allowancePhone,
    allowanceField,
    allowanceRole,
    allowanceOther,
    totalAllowances,
    otPay,
    bonus,
    grossIncome,

    // Khấu trừ
    deductionSocialInsurance,
    deductionAdvance,
    deductionTax,
    deductionOther,
    totalDeductions,

    // Thực lĩnh
    netSalary,
    paymentStatus: existingPayroll?.paymentStatus || 'unpaid',
    paymentDate: existingPayroll?.paymentDate,
    notes: existingPayroll?.notes,

    // Ký xác nhận
    signatureStatus: existingPayroll?.signatureStatus || 'pending',
    signedAt: existingPayroll?.signedAt,
    signedByName: existingPayroll?.signedByName,
    signedByUserId: existingPayroll?.signedByUserId,
    signatureImage: existingPayroll?.signatureImage,
    signatureType: existingPayroll?.signatureType,

    // Khiếu nại
    disputeNote: existingPayroll?.disputeNote,
    disputedAt: existingPayroll?.disputedAt,
    disputeResolvedAt: existingPayroll?.disputeResolvedAt,
    adminResolutionNote: existingPayroll?.adminResolutionNote,

    isLocked: existingPayroll?.isLocked || false,
    approvedBy: existingPayroll?.approvedBy,
    approvedAt: existingPayroll?.approvedAt,
    updatedAt: existingPayroll?.updatedAt || new Date().toISOString(),
  };
}

export const formatVND = (amount?: number): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
};
