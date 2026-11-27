import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../services/authStore';
import { useRealtimeStore } from '../../services/realtimeStore';
import { useTableColumnResize } from '../../services/useTableColumnResize';
import { ColumnResizeHandle } from '../common/ColumnResizeHandle';
import { api } from '../../services/apiSupabase';
import { MonthlyPayrollItem, Engineer, LeaveRequest, AttendanceAdjustmentRequest } from '../../types';
import { 
  generateMonthlyPayrollDraft, 
  calculateUserMonthlyAttendance,
  formatVND, 
  UserMonthlyTimesheetCalculation 
} from '../../utils/payrollCalculator';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import { PayrollDisputeModal } from './PayrollDisputeModal';
import { PayrollSlipViewModal } from './PayrollSlipViewModal';

interface MonthlyPayrollTabProps {
  logs: any[];
  leaves: LeaveRequest[];
  adjustments: AttendanceAdjustmentRequest[];
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  isAdmin: boolean;
}

export const MonthlyPayrollTab: React.FC<MonthlyPayrollTabProps> = ({
  logs,
  leaves,
  adjustments,
  showToast,
  isAdmin,
}) => {
  const { user } = useAuthStore();
  const engineers = useRealtimeStore(state => state.engineers);

  // Bộ lọc Tháng & Năm (Mặc định tháng hiện tại)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Chế độ xem: 'my' (Cá nhân tôi) | 'all' (Toàn bộ nhân sự - Admin)
  const [viewScope, setViewScope] = useState<'my' | 'all'>('my');

  // Trạng thái bảo mật ẩn/hiện số tiền lương
  const [showSalaryAmounts, setShowSalaryAmounts] = useState<boolean>(true);

  // Dữ liệu bảng lương đã lưu từ cloud
  const [savedPayrolls, setSavedPayrolls] = useState<MonthlyPayrollItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals
  const [signingItem, setSigningItem] = useState<MonthlyPayrollItem | null>(null);
  const [disputingItem, setDisputingItem] = useState<MonthlyPayrollItem | null>(null);
  const [viewingSlipItem, setViewingSlipItem] = useState<MonthlyPayrollItem | null>(null);

  // Quản lý kéo thay đổi độ rộng cột bảng lương
  const defaultPayrollColWidths = useMemo(() => ({
    col_stt: 45,
    col_code: 85,
    col_name: 180,
    col_title: 120,
    col_actual_days: 105,
    col_field_days: 95,
    col_gross: 120,
    col_deduction: 110,
    col_net: 130,
    col_sign_status: 110,
    col_signature: 85,
    col_actions: 95,
  }), []);

  const { widths: colWidths, startResize, resetWidths } = useTableColumnResize({
    tableId: 'table_payroll_monthly',
    defaultWidths: defaultPayrollColWidths,
  });

  // Admin filter & search
  const [adminSearch, setAdminSearch] = useState<string>('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'all' | 'signed' | 'pending' | 'disputed'>('all');

  // Nạp dữ liệu bảng lương đã lưu theo tháng/năm
  const fetchSavedPayrolls = async () => {
    setIsLoading(true);
    try {
      const data = await api.payroll.getAll(selectedMonth, selectedYear);
      setSavedPayrolls(data || []);
    } catch (err) {
      console.error('[Payroll] Lỗi tải dữ liệu bảng lương:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedPayrolls();
  }, [selectedMonth, selectedYear]);

  // Thông tin kỹ sư của người dùng hiện tại
  const currentEngineer = useMemo(() => {
    return engineers.find(e => 
      e.id === user?.id || 
      (user?.name && e.name && e.name.trim().toLowerCase() === user.name.trim().toLowerCase())
    );
  }, [engineers, user]);

  // Tính toán bảng lương cá nhân cho user hiện tại
  const myPayrollItem = useMemo(() => {
    if (!user) return null;
    const existing = savedPayrolls.find(p => String(p.userId) === String(user.id));
    return generateMonthlyPayrollDraft({
      user: { id: user.id, name: user.name || user.username || 'User', username: user.username, title: user.title },
      engineer: currentEngineer,
      month: selectedMonth,
      year: selectedYear,
      logs,
      leaves,
      adjustments,
      existingPayroll: existing,
    });
  }, [user, currentEngineer, selectedMonth, selectedYear, logs, leaves, adjustments, savedPayrolls]);

  // Tính toán chi tiết chấm công từng ngày trong tháng của user
  const myTimesheet = useMemo<UserMonthlyTimesheetCalculation | null>(() => {
    if (!user) return null;
    return calculateUserMonthlyAttendance({
      userId: user.id,
      userName: user.name || user.username || 'User',
      month: selectedMonth,
      year: selectedYear,
      logs,
      leaves,
      adjustments,
    });
  }, [user, selectedMonth, selectedYear, logs, leaves, adjustments]);

  // Danh sách bảng lương của toàn bộ nhân viên (Dành cho Admin)
  const allEmployeesPayroll = useMemo(() => {
    if (!isAdmin) return [];

    // Danh sách hợp nhất tất cả nhân viên từ danh mục engineers
    const activeEngineers = engineers.filter(e => e.name && e.name.trim());

    return activeEngineers.map(eng => {
      const existing = savedPayrolls.find(p => 
        String(p.userId) === String(eng.id) || 
        (p.userName && p.userName.trim().toLowerCase() === eng.name.trim().toLowerCase())
      );
      return generateMonthlyPayrollDraft({
        user: { id: eng.id, name: eng.name, username: eng.username, title: eng.title },
        engineer: eng,
        month: selectedMonth,
        year: selectedYear,
        logs,
        leaves,
        adjustments,
        existingPayroll: existing,
      });
    });
  }, [isAdmin, engineers, savedPayrolls, selectedMonth, selectedYear, logs, leaves, adjustments]);

  // Thống kê tiến độ ký của toàn công ty
  const adminStats = useMemo(() => {
    const total = allEmployeesPayroll.length;
    const signed = allEmployeesPayroll.filter(p => p.signatureStatus === 'signed').length;
    const disputed = allEmployeesPayroll.filter(p => p.signatureStatus === 'disputed').length;
    const pending = total - signed - disputed;
    const percent = total > 0 ? Math.round((signed / total) * 100) : 0;
    return { total, signed, disputed, pending, percent };
  }, [allEmployeesPayroll]);

  // Lọc bảng lương cho Admin
  const filteredAdminPayroll = useMemo(() => {
    return allEmployeesPayroll.filter(item => {
      if (adminStatusFilter !== 'all' && item.signatureStatus !== adminStatusFilter) return false;
      if (adminSearch.trim()) {
        const q = adminSearch.toLowerCase();
        const matchName = item.userName.toLowerCase().includes(q);
        const matchCode = (item.userCode || '').toLowerCase().includes(q);
        const matchTitle = (item.userTitle || '').toLowerCase().includes(q);
        return matchName || matchCode || matchTitle;
      }
      return true;
    });
  }, [allEmployeesPayroll, adminStatusFilter, adminSearch]);

  const handleUpdatePayrollItem = (updated: MonthlyPayrollItem) => {
    setSavedPayrolls(prev => {
      const idx = prev.findIndex(p => p.id === updated.id || (p.userId === updated.userId && p.month === updated.month && p.year === updated.year));
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });
  };

  return (
    <div className="w-full flex flex-col">
      {/* HEADER: BỘ LỌC THỜI GIAN & CHẾ ĐỘ XEM */}
      <div className="bg-white px-3 sm:px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
            <span className="material-symbols-outlined text-[17px] text-primary ml-1">calendar_month</span>
            <span className="font-bold text-slate-700">Tháng:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-xs"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowSalaryAmounts(prev => !prev)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-md border border-slate-200 text-xs font-bold transition cursor-pointer"
            title={showSalaryAmounts ? 'Ẩn số tiền lương bảo mật' : 'Hiển thị số tiền lương'}
          >
            <span className="material-symbols-outlined text-[15px]">
              {showSalaryAmounts ? 'visibility_off' : 'visibility'}
            </span>
            <span>{showSalaryAmounts ? 'Ẩn số tiền' : 'Hiện số tiền'}</span>
          </button>
        </div>

        {/* Chuyển đổi giữa Chế độ cá nhân & Chế độ quản trị (Admin) */}
        {isAdmin && (
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewScope('my')}
              className={`flex items-center gap-1 px-3 py-1 rounded font-bold transition-all cursor-pointer ${
                viewScope === 'my'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">person</span>
              Bảng lương của tôi
            </button>
            <button
              type="button"
              onClick={() => setViewScope('all')}
              className={`flex items-center gap-1 px-3 py-1 rounded font-bold transition-all cursor-pointer ${
                viewScope === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">group</span>
              Toàn bộ nhân sự ({adminStats.signed}/{adminStats.total} đã ký)
            </button>
          </div>
        )}
      </div>

      {/* ===================== VIEW 1: BẢNG LƯƠNG & CHẤM CÔNG CÁ NHÂN ===================== */}
      {viewScope === 'my' && myPayrollItem && (
        <div className="w-full flex flex-col">
          {/* BANNER TRẠNG THÁI KÝ XÁC NHẬN */}
          <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded text-xs font-bold border inline-flex items-center gap-1 ${
                myPayrollItem.signatureStatus === 'signed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : myPayrollItem.signatureStatus === 'disputed'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                <span className="material-symbols-outlined text-[15px]">
                  {myPayrollItem.signatureStatus === 'signed'
                    ? 'verified'
                    : myPayrollItem.signatureStatus === 'disputed'
                    ? 'help_outline'
                    : 'edit_note'}
                </span>
                {myPayrollItem.signatureStatus === 'signed'
                  ? 'Đã ký xác nhận'
                  : myPayrollItem.signatureStatus === 'disputed'
                  ? 'Đang phản hồi'
                  : 'Chờ ký xác nhận'}
              </span>

              <div>
                <p className="text-xs text-slate-700 leading-normal">
                  {myPayrollItem.signatureStatus === 'signed' ? (
                    <>
                      Đã ký xác nhận điện tử lúc{' '}
                      <span className="font-semibold text-slate-900">{myPayrollItem.signedAt ? new Date(myPayrollItem.signedAt).toLocaleString('vi-VN') : ''}</span>. Bảng công và phiếu thanh toán lương Tháng {selectedMonth}/{selectedYear} đã được chốt.
                    </>
                  ) : myPayrollItem.signatureStatus === 'disputed' ? (
                    <>
                      Nội dung thắc mắc: <span className="font-medium text-slate-900">"{myPayrollItem.disputeNote}"</span>. Bộ phận kế toán đang xử lý đối soát số liệu.
                    </>
                  ) : (
                    <>
                      Vui lòng kiểm tra đối chiếu ngày công ({myPayrollItem.actualWorkingDays} công) và số tiền thực lĩnh Tháng {selectedMonth}/{selectedYear} trước khi ký xác nhận.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Nút hành động */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                type="button"
                onClick={() => setViewingSlipItem(myPayrollItem)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold shadow-2xs transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">print</span>
                Xem & In phiếu A4
              </button>

              {myPayrollItem.signatureStatus !== 'signed' && (
                <>
                  <button
                    type="button"
                    onClick={() => setDisputingItem(myPayrollItem)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-amber-800 border border-amber-300 rounded text-xs font-semibold transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">chat_bubble_outline</span>
                    Phản hồi
                  </button>

                  <button
                    type="button"
                    onClick={() => setSigningItem(myPayrollItem)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-blue-800 text-white rounded text-xs font-bold shadow-2xs transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">draw</span>
                    Ký xác nhận
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 4 CARD CHỈ SỐ TỔNG QUAN (PHONG CÁCH CHUẨN ERP DOANH NGHIỆP, NỔI BẬT SẮC NÉT) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3 bg-slate-100/70 border-b border-slate-200">
            {/* 1. Công thực tế */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Ngày công thực tế</span>
                <span className="material-symbols-outlined text-slate-400 text-[18px]">event_available</span>
              </div>
              <div className="flex items-baseline gap-1.5 my-0.5">
                <span className="text-2xl font-black text-slate-900">{myPayrollItem.actualWorkingDays}</span>
                <span className="text-xs text-slate-500 font-medium">/ {myPayrollItem.standardWorkingDays} công</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                <span>{myPayrollItem.paidLeaveDays} phép năm</span>
                <span className="text-slate-300">•</span>
                <span>{myPayrollItem.sundayWorkingDays} chủ nhật</span>
              </div>
            </div>

            {/* 2. Công trường & Đi ngoài */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Công trường / Đi ngoài</span>
                <span className="material-symbols-outlined text-slate-400 text-[18px]">engineering</span>
              </div>
              <div className="flex items-baseline gap-1.5 my-0.5">
                <span className="text-2xl font-black text-slate-900">{myPayrollItem.fieldWorkDays}</span>
                <span className="text-xs text-slate-500 font-medium">ngày công trường</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Công tác ngoài: <strong className="text-slate-700">{myPayrollItem.remoteWorkDays}</strong> ngày
              </div>
            </div>

            {/* 3. Tăng ca OT */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Giờ làm thêm (OT)</span>
                <span className="material-symbols-outlined text-slate-400 text-[18px]">schedule</span>
              </div>
              <div className="flex items-baseline gap-1.5 my-0.5">
                <span className="text-2xl font-black text-slate-900">
                  {myPayrollItem.otHoursNormal + myPayrollItem.otHoursSunday + myPayrollItem.otHoursHoliday}
                </span>
                <span className="text-xs text-slate-500 font-medium">giờ làm thêm</span>
              </div>
              <div className="text-[11px] text-slate-600 mt-1 font-medium">
                Tiền OT: <strong className="text-slate-900">{showSalaryAmounts ? formatVND(myPayrollItem.otPay) : '•••••• đ'}</strong>
              </div>
            </div>

            {/* 4. Thực lĩnh (Net Salary) - Nổi bật sang trọng theo chuẩn tài chính */}
            <div className="bg-blue-50/60 p-3.5 rounded-lg border border-blue-200/90 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-blue-900 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900">Thực lĩnh tháng</span>
                <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
              </div>
              <div className="my-0.5">
                <span className="text-2xl font-black text-primary tracking-tight font-mono">
                  {showSalaryAmounts ? formatVND(myPayrollItem.netSalary) : '•••••••• đ'}
                </span>
              </div>
              <div className="text-[11px] text-blue-900/80 mt-1 font-medium">
                Tổng thu nhập: <strong className="text-blue-950">{showSalaryAmounts ? formatVND(myPayrollItem.grossIncome) : '•••••• đ'}</strong>
              </div>
            </div>
          </div>

          {/* CHI TIẾT 2 CỘT: BẢNG LƯƠNG & BẢNG NHẬT KÝ CHẤM CÔNG */}
          <div className="grid grid-cols-1 lg:grid-cols-12 bg-white border-b border-slate-200">
            {/* CỘT TRÁI: BẢNG NHẬT KÝ CHẤM CÔNG TỪNG NGÀY TRONG THÁNG (7 COLS) */}
            <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">calendar_today</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                    Nhật ký chấm công Tháng {selectedMonth}/{selectedYear}
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {myTimesheet?.days.length} ngày trong tháng
                </span>
              </div>

              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10 text-[11px]">
                    <tr>
                      <th className="p-2.5 text-center w-12">Ngày</th>
                      <th className="p-2.5 text-center w-12">Thứ</th>
                      <th className="p-2.5">Trạng thái</th>
                      <th className="p-2.5 text-center">Giờ vào</th>
                      <th className="p-2.5 text-center">Giờ ra</th>
                      <th className="p-2.5">Địa điểm / Dự án</th>
                      <th className="p-2.5 text-center">OT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myTimesheet?.days.map(d => {
                      const isToday = new Date().toDateString() === new Date(selectedYear, selectedMonth - 1, d.dayNumber).toDateString();
                      return (
                        <tr
                          key={d.dayNumber}
                          className={`hover:bg-slate-50 transition-colors ${
                            d.isSunday
                              ? 'bg-slate-50/70 text-slate-500'
                              : isToday
                              ? 'bg-blue-50/30 font-medium'
                              : ''
                          }`}
                        >
                          <td className="p-2 text-center font-semibold text-slate-800">{d.dayNumber}</td>
                          <td className={`p-2 text-center font-medium ${d.isSunday ? 'text-slate-400' : 'text-slate-600'}`}>
                            {d.dayOfWeek}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {d.isSunday ? (
                              <span className="text-slate-400 text-[11px]">Nghỉ CN</span>
                            ) : d.status === 'present' ? (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800">
                                Đi làm
                              </span>
                            ) : d.status === 'field' ? (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800">
                                Công trường
                              </span>
                            ) : d.status === 'remote' ? (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800">
                                Công tác
                              </span>
                            ) : d.status === 'leave_paid' ? (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
                                Phép năm
                              </span>
                            ) : d.status === 'leave_unpaid' ? (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                                Nghỉ KP
                              </span>
                            ) : d.checkInTime ? (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                                {d.statusLabel}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center text-slate-700 font-mono text-[11px]">
                            {d.checkInTime ? new Date(d.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-2 text-center text-slate-700 font-mono text-[11px]">
                            {d.checkOutTime ? new Date(d.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-2 text-slate-600 max-w-[140px] truncate" title={d.projectName || d.notes}>
                            {d.projectName || (d.workLocationType === 'office' ? 'Văn phòng' : '—')}
                          </td>
                          <td className="p-2 text-center font-medium text-slate-700">
                            {d.otHours > 0 ? `+${d.otHours}h` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CỘT PHẢI: BẢNG CHI TIẾT TÍNH LƯƠNG & CHỮ KÝ (5 COLS) */}
            <div className="lg:col-span-5 bg-slate-50/50 p-3 sm:p-4 space-y-3">
              <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">receipt_long</span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Chi tiết thu nhập & khấu trừ
                    </h3>
                  </div>
                </div>

                <div className="p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Lương cơ bản theo HĐ:</span>
                    <span className="font-semibold text-slate-800">
                      {showSalaryAmounts ? formatVND(myPayrollItem.baseSalary) : '•••••• đ'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 font-semibold text-slate-900">
                    <span>Lương theo công thực tế ({myPayrollItem.actualWorkingDays} công):</span>
                    <span>{showSalaryAmounts ? formatVND(myPayrollItem.salaryByWorkDays) : '•••••• đ'}</span>
                  </div>

                  {myPayrollItem.paidLeaveSalary > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                      <span>Lương ngày phép ({myPayrollItem.paidLeaveDays} ngày):</span>
                      <span>{showSalaryAmounts ? formatVND(myPayrollItem.paidLeaveSalary) : '•••••• đ'}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Phụ cấp ăn trưa:</span>
                    <span className="font-medium text-slate-800">
                      {showSalaryAmounts ? formatVND(myPayrollItem.allowanceLunch) : '•••••• đ'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Phụ cấp xăng xe / đi lại:</span>
                    <span className="font-medium text-slate-800">
                      {showSalaryAmounts ? formatVND(myPayrollItem.allowanceFuel) : '•••••• đ'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Phụ cấp điện thoại:</span>
                    <span className="font-medium text-slate-800">
                      {showSalaryAmounts ? formatVND(myPayrollItem.allowancePhone) : '•••••• đ'}
                    </span>
                  </div>

                  {myPayrollItem.allowanceField > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700 font-medium">
                      <span>Phụ cấp công trường ({myPayrollItem.fieldWorkDays} ngày):</span>
                      <span>{showSalaryAmounts ? formatVND(myPayrollItem.allowanceField) : '•••••• đ'}</span>
                    </div>
                  )}

                  {myPayrollItem.otPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700 font-semibold">
                      <span>Tiền làm thêm giờ (OT):</span>
                      <span>{showSalaryAmounts ? formatVND(myPayrollItem.otPay) : '•••••• đ'}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 border-b border-slate-200 font-bold text-slate-900 pt-2">
                    <span>TỔNG THU NHẬP (GROSS):</span>
                    <span>{showSalaryAmounts ? formatVND(myPayrollItem.grossIncome) : '•••••• đ'}</span>
                  </div>

                  {/* Khấu trừ */}
                  <div className="pt-2 text-slate-500 font-semibold text-[11px] uppercase">Khấu trừ:</div>
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span>BHXH, BHYT, BHTN (10.5%):</span>
                    <span className="text-red-600 font-medium">-{showSalaryAmounts ? formatVND(myPayrollItem.deductionSocialInsurance) : '•••••• đ'}</span>
                  </div>
                  {myPayrollItem.deductionAdvance > 0 && (
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>Tạm ứng trong tháng:</span>
                      <span className="text-red-600 font-medium">-{showSalaryAmounts ? formatVND(myPayrollItem.deductionAdvance) : '•••••• đ'}</span>
                    </div>
                  )}
                  {myPayrollItem.deductionTax > 0 && (
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>Thuế TNCN tạm tính:</span>
                      <span className="text-red-600 font-medium">-{showSalaryAmounts ? formatVND(myPayrollItem.deductionTax) : '•••••• đ'}</span>
                    </div>
                  )}

                  {/* THỰC LĨNH BOX (CHUẨN CHỨNG TỪ KẾ TOÁN) */}
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-md flex items-baseline justify-between mt-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">THỰC LĨNH TIỀN LƯƠNG</span>
                      <span className="text-[10.5px] text-slate-500">Chuyển khoản tài khoản ngân hàng</span>
                    </div>
                    <span className="text-xl font-bold text-slate-900 tracking-tight font-mono">
                      {showSalaryAmounts ? formatVND(myPayrollItem.netSalary) : '•••••••• đ'}
                    </span>
                  </div>
                </div>
              </div>

              {/* KHUNG CHỮ KÝ ĐÃ KÝ */}
              {myPayrollItem.signatureStatus === 'signed' && (
                <div className="bg-white rounded-lg border border-emerald-300 p-3.5 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {myPayrollItem.signatureImage && (
                      <img
                        src={myPayrollItem.signatureImage}
                        alt="Chữ ký"
                        className="h-12 max-w-[120px] object-contain border border-slate-200 rounded p-1 bg-slate-50"
                      />
                    )}
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{myPayrollItem.userName}</span>
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        Đã ký số: {myPayrollItem.signedAt ? new Date(myPayrollItem.signedAt).toLocaleDateString('vi-VN') : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingSlipItem(myPayrollItem)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition cursor-pointer"
                  >
                    Xem phiếu
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== VIEW 2: QUẢN TRỊ VIÊN XEM TOÀN BỘ NHÂN SỰ ===================== */}
      {viewScope === 'all' && isAdmin && (
        <div className="w-full flex flex-col">
          {/* STATS BARS DÀNH CHO ADMIN */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-white">
            <div className="bg-white p-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Tổng số nhân sự</span>
              <span className="text-2xl font-black text-slate-800">{adminStats.total}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Tháng {selectedMonth}/{selectedYear}</span>
            </div>

            <div className="bg-emerald-50/40 p-3">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">verified</span>
                Đã ký xác nhận
              </span>
              <span className="text-2xl font-black text-emerald-800">{adminStats.signed}</span>
              <span className="text-[11px] text-emerald-600 font-bold block mt-0.5">
                Đạt {adminStats.percent}% tiến độ
              </span>
            </div>

            <div className="bg-white p-3">
              <span className="text-[11px] font-bold text-blue-700 uppercase block flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">hourglass_top</span>
                Chờ ký xác nhận
              </span>
              <span className="text-2xl font-black text-blue-800">{adminStats.pending}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Chưa thực hiện ký</span>
            </div>

            <div className="bg-amber-50/40 p-3">
              <span className="text-[11px] font-bold text-amber-800 uppercase block flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">warning</span>
                Có khiếu nại / phản hồi
              </span>
              <span className="text-2xl font-black text-amber-900">{adminStats.disputed}</span>
              <span className="text-[11px] text-amber-700 font-medium block mt-0.5">Cần kế toán đối soát</span>
            </div>
          </div>

          {/* THANH TÌM KIẾM & BỘ LỌC ADMIN */}
          <div className="bg-slate-50 px-3 sm:px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-base">search</span>
                <input
                  type="text"
                  value={adminSearch}
                  onChange={e => setAdminSearch(e.target.value)}
                  placeholder="Tìm theo tên, mã nhân viên, chức danh..."
                  className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-200 text-xs">
              {(['all', 'signed', 'pending', 'disputed'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setAdminStatusFilter(st)}
                  className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                    adminStatusFilter === st
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'all' ? 'Tất cả' : st === 'signed' ? 'Đã ký' : st === 'pending' ? 'Chờ ký' : 'Có khiếu nại'}
                </button>
              ))}
            </div>
          </div>

          {/* BẢNG TỔNG HỢP TOÀN BỘ NHÂN SỰ */}
          <div className="bg-white overflow-x-auto table-scrollbar custom-scrollbar">
            <div className="overflow-x-auto table-scrollbar custom-scrollbar">
              <table className="w-full text-xs text-left table-fixed min-w-[1180px]">
                <colgroup>
                  <col style={{ width: colWidths.col_stt }} />
                  <col style={{ width: colWidths.col_code }} />
                  <col style={{ width: colWidths.col_name }} />
                  <col style={{ width: colWidths.col_title }} />
                  <col style={{ width: colWidths.col_actual_days }} />
                  <col style={{ width: colWidths.col_field_days }} />
                  <col style={{ width: colWidths.col_gross }} />
                  <col style={{ width: colWidths.col_deduction }} />
                  <col style={{ width: colWidths.col_net }} />
                  <col style={{ width: colWidths.col_sign_status }} />
                  <col style={{ width: colWidths.col_signature }} />
                  <col style={{ width: colWidths.col_actions }} />
                </colgroup>
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="p-3 text-center w-12 relative">STT<ColumnResizeHandle onMouseDown={(e) => startResize('col_stt', e)} /></th>
                    <th className="p-3 relative">Mã NV<ColumnResizeHandle onMouseDown={(e) => startResize('col_code', e)} /></th>
                    <th className="p-3 relative">Họ và tên<ColumnResizeHandle onMouseDown={(e) => startResize('col_name', e)} /></th>
                    <th className="p-3 relative">Chức danh<ColumnResizeHandle onMouseDown={(e) => startResize('col_title', e)} /></th>
                    <th className="p-3 text-center relative">Công thực tế<ColumnResizeHandle onMouseDown={(e) => startResize('col_actual_days', e)} /></th>
                    <th className="p-3 text-center relative">Công trường<ColumnResizeHandle onMouseDown={(e) => startResize('col_field_days', e)} /></th>
                    <th className="p-3 text-right relative">Tổng thu nhập<ColumnResizeHandle onMouseDown={(e) => startResize('col_gross', e)} /></th>
                    <th className="p-3 text-right relative">Khấu trừ<ColumnResizeHandle onMouseDown={(e) => startResize('col_deduction', e)} /></th>
                    <th className="p-3 text-right font-extrabold text-blue-900 relative">Thực lĩnh<ColumnResizeHandle onMouseDown={(e) => startResize('col_net', e)} /></th>
                    <th className="p-3 text-center relative">Tình trạng ký<ColumnResizeHandle onMouseDown={(e) => startResize('col_sign_status', e)} /></th>
                    <th className="p-3 text-center relative">Chữ ký<ColumnResizeHandle onMouseDown={(e) => startResize('col_signature', e)} /></th>
                    <th className="p-3 text-center w-24 relative">Thao tác<ColumnResizeHandle onMouseDown={(e) => startResize('col_actions', e)} /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdminPayroll.map((item, idx) => (
                    <tr key={item.userId} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">{item.userCode || '—'}</td>
                      <td className="p-3 font-bold text-slate-900">{item.userName}</td>
                      <td className="p-3 text-slate-600">{item.userTitle || 'Kỹ sư'}</td>
                      <td className="p-3 text-center font-bold text-slate-800">
                        {item.actualWorkingDays} <span className="text-[10px] text-slate-400">/{item.standardWorkingDays}</span>
                      </td>
                      <td className="p-3 text-center font-bold text-amber-700">{item.fieldWorkDays}</td>
                      <td className="p-3 text-right text-slate-700 font-medium">
                        {showSalaryAmounts ? formatVND(item.grossIncome) : '•••••• đ'}
                      </td>
                      <td className="p-3 text-right text-red-600 font-medium">
                        -{showSalaryAmounts ? formatVND(item.totalDeductions) : '•••••• đ'}
                      </td>
                      <td className="p-3 text-right font-black text-emerald-700 text-xs">
                        {showSalaryAmounts ? formatVND(item.netSalary) : '•••••• đ'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                          item.signatureStatus === 'signed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : item.signatureStatus === 'disputed'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          <span className="material-symbols-outlined text-[13px]">
                            {item.signatureStatus === 'signed' ? 'verified' : item.signatureStatus === 'disputed' ? 'warning' : 'hourglass_top'}
                          </span>
                          {item.signatureStatus === 'signed' ? 'Đã ký' : item.signatureStatus === 'disputed' ? 'Khiếu nại' : 'Chờ ký'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {item.signatureImage ? (
                          <img
                            src={item.signatureImage}
                            alt="Signature"
                            className="h-7 max-w-[80px] object-contain mx-auto border border-slate-100 rounded bg-slate-50 p-0.5"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setViewingSlipItem(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-md text-[11px] font-bold transition cursor-pointer"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAdminPayroll.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-400 text-xs">
                        Không tìm thấy nhân viên nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KÝ XÁC NHẬN */}
      {signingItem && (
        <DigitalSignatureModal
          isOpen={!!signingItem}
          onClose={() => setSigningItem(null)}
          payrollItem={signingItem}
          onSuccess={(updated) => {
            handleUpdatePayrollItem(updated);
            setSigningItem(null);
          }}
          showToast={showToast}
        />
      )}

      {/* MODAL PHẢN HỒI KHIẾU NẠI */}
      {disputingItem && (
        <PayrollDisputeModal
          isOpen={!!disputingItem}
          onClose={() => setDisputingItem(null)}
          payrollItem={disputingItem}
          onSuccess={(updated) => {
            handleUpdatePayrollItem(updated);
            setDisputingItem(null);
          }}
          showToast={showToast}
        />
      )}

      {/* MODAL XEM PHIẾU LƯƠNG & BẢNG CÔNG A4 */}
      {viewingSlipItem && (
        <PayrollSlipViewModal
          isOpen={!!viewingSlipItem}
          onClose={() => setViewingSlipItem(null)}
          payrollItem={viewingSlipItem}
          onUpdatePayroll={(updated) => {
            handleUpdatePayrollItem(updated);
            setViewingSlipItem(updated);
          }}
          showToast={showToast}
          canSign={viewingSlipItem.userId === user?.id || isAdmin}
        />
      )}
    </div>
  );
};
