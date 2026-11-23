import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../services/authStore';
import { useRealtimeStore } from '../../services/realtimeStore';
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
    <div className="space-y-4">
      {/* HEADER: BỘ LỌC THỜI GIAN & CHẾ ĐỘ XEM */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <span className="material-symbols-outlined text-[18px] text-primary ml-1.5">calendar_month</span>
            <span className="font-bold text-slate-700">Tháng:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowSalaryAmounts(prev => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 text-xs font-bold transition cursor-pointer"
            title={showSalaryAmounts ? 'Ẩn số tiền lương bảo mật' : 'Hiển thị số tiền lương'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {showSalaryAmounts ? 'visibility_off' : 'visibility'}
            </span>
            <span>{showSalaryAmounts ? 'Ẩn số tiền' : 'Hiện số tiền'}</span>
          </button>
        </div>

        {/* Chuyển đổi giữa Chế độ cá nhân & Chế độ quản trị (Admin) */}
        {isAdmin && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewScope('my')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewScope === 'my'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">person</span>
              Bảng lương của tôi
            </button>
            <button
              type="button"
              onClick={() => setViewScope('all')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewScope === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">group</span>
              Toàn bộ nhân sự ({adminStats.signed}/{adminStats.total} đã ký)
            </button>
          </div>
        )}
      </div>

      {/* ===================== VIEW 1: BẢNG LƯƠNG & CHẤM CÔNG CÁ NHÂN ===================== */}
      {viewScope === 'my' && myPayrollItem && (
        <div className="space-y-4">
          {/* BANNER TRẠNG THÁI KÝ XÁC NHẬN */}
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs ${
            myPayrollItem.signatureStatus === 'signed'
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
              : myPayrollItem.signatureStatus === 'disputed'
              ? 'bg-amber-50/90 border-amber-300 text-amber-950'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 text-blue-950'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                myPayrollItem.signatureStatus === 'signed'
                  ? 'bg-emerald-600 text-white'
                  : myPayrollItem.signatureStatus === 'disputed'
                  ? 'bg-amber-600 text-white'
                  : 'bg-primary text-white animate-pulse'
              }`}>
                <span className="material-symbols-outlined text-2xl">
                  {myPayrollItem.signatureStatus === 'signed'
                    ? 'verified'
                    : myPayrollItem.signatureStatus === 'disputed'
                    ? 'report_problem'
                    : 'draw'}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold uppercase tracking-wide">
                    {myPayrollItem.signatureStatus === 'signed'
                      ? 'ĐÃ KÝ XÁC NHẬN BẢNG CÔNG & LƯƠNG'
                      : myPayrollItem.signatureStatus === 'disputed'
                      ? 'ĐANG KHIẾU NẠI / CHỜ KẾ TOÁN XỬ LÝ'
                      : 'CHỜ BẠN KÝ XÁC NHẬN BẢNG CÔNG & LƯƠNG'}
                  </h4>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/80 border">
                    Tháng {selectedMonth}/{selectedYear}
                  </span>
                </div>

                <p className="text-xs mt-1 opacity-90 leading-relaxed">
                  {myPayrollItem.signatureStatus === 'signed' ? (
                    <>
                      Bạn đã ký xác nhận điện tử vào lúc{' '}
                      <b>{myPayrollItem.signedAt ? new Date(myPayrollItem.signedAt).toLocaleString('vi-VN') : ''}</b>. Số tiền thực lĩnh đã được chốt để kế toán chi trả.
                    </>
                  ) : myPayrollItem.signatureStatus === 'disputed' ? (
                    <>
                      Nội dung thắc mắc: <i>"{myPayrollItem.disputeNote}"</i>. Kế toán sẽ liên hệ kiểm tra và cập nhật lại số liệu.
                    </>
                  ) : (
                    <>
                      Vui lòng đối chiếu số ngày công làm việc ({myPayrollItem.actualWorkingDays} công) và số tiền thực lĩnh. Sau khi kiểm tra, bấm <b>"Ký xác nhận ngay"</b> để hoàn tất.
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
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                Xem chi tiết & In phiếu A4
              </button>

              {myPayrollItem.signatureStatus !== 'signed' && (
                <>
                  <button
                    type="button"
                    onClick={() => setDisputingItem(myPayrollItem)}
                    className="flex items-center gap-1 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                    Phản hồi
                  </button>

                  <button
                    type="button"
                    onClick={() => setSigningItem(myPayrollItem)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">draw</span>
                    Ký xác nhận ngay
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 4 CARD CHỈ SỐ TỔNG QUAN */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Công thực tế */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Ngày công thực tế</span>
                <span className="material-symbols-outlined text-primary text-xl">fact_check</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-800">{myPayrollItem.actualWorkingDays}</span>
                <span className="text-xs text-slate-400 font-medium">/ {myPayrollItem.standardWorkingDays} công chuẩn</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span className="text-emerald-600 font-bold">+{myPayrollItem.paidLeaveDays} phép năm</span>
                <span>|</span>
                <span className="text-amber-600 font-bold">+{myPayrollItem.sundayWorkingDays} CN</span>
              </div>
            </div>

            {/* 2. Công trường & Đi ngoài */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Công trường / Công tác</span>
                <span className="material-symbols-outlined text-amber-600 text-xl">foundation</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-700">{myPayrollItem.fieldWorkDays}</span>
                <span className="text-xs text-slate-500 font-medium">ngày công trường</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Đi công tác ngoài: <b>{myPayrollItem.remoteWorkDays}</b> ngày
              </div>
            </div>

            {/* 3. Tăng ca OT */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Giờ làm thêm (OT)</span>
                <span className="material-symbols-outlined text-indigo-600 text-xl">more_time</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-indigo-700">
                  {myPayrollItem.otHoursNormal + myPayrollItem.otHoursSunday + myPayrollItem.otHoursHoliday}
                </span>
                <span className="text-xs text-slate-500 font-medium">giờ làm thêm</span>
              </div>
              <div className="text-[11px] text-indigo-700 mt-1 font-bold">
                Tiền OT: {showSalaryAmounts ? formatVND(myPayrollItem.otPay) : '•••••• đ'}
              </div>
            </div>

            {/* 4. Thực lĩnh (Net Salary) */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between opacity-90 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">THỰC LĨNH THÁNG</span>
                <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
              </div>
              <div className="text-2xl font-black tracking-tight">
                {showSalaryAmounts ? formatVND(myPayrollItem.netSalary) : '•••••••• đ'}
              </div>
              <div className="text-[11px] opacity-80 mt-1">
                Tổng thu nhập: {showSalaryAmounts ? formatVND(myPayrollItem.grossIncome) : '•••••• đ'}
              </div>
            </div>
          </div>

          {/* CHI TIẾT 2 CỘT: BẢNG LƯƠNG & BẢNG NHẬT KÝ CHẤM CÔNG */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* CỘT TRÁI: BẢNG NHẬT KÝ CHẤM CÔNG TỪNG NGÀY TRONG THÁNG (7 COLS) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                    Nhật ký chấm công Tháng {selectedMonth}/{selectedYear}
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {myTimesheet?.days.length} ngày trong tháng
                </span>
              </div>

              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
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
                              ? 'bg-red-50/30'
                              : isToday
                              ? 'bg-blue-50/40 font-semibold'
                              : ''
                          }`}
                        >
                          <td className="p-2.5 text-center font-bold text-slate-800">{d.dayNumber}</td>
                          <td className={`p-2.5 text-center font-bold ${d.isSunday ? 'text-red-500' : 'text-slate-600'}`}>
                            {d.dayOfWeek}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                              d.status === 'present'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : d.status === 'field'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : d.status === 'remote'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : d.status === 'leave_paid'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : d.status === 'leave_unpaid'
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : d.status === 'absent'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}>
                              {d.status === 'field' ? '🏗️ ' : d.status === 'remote' ? '🚗 ' : ''}
                              {d.statusLabel}
                            </span>
                          </td>
                          <td className="p-2.5 text-center text-slate-700 font-mono text-[11px]">
                            {d.checkInTime ? new Date(d.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-2.5 text-center text-slate-700 font-mono text-[11px]">
                            {d.checkOutTime ? new Date(d.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-2.5 text-slate-600 max-w-[140px] truncate" title={d.projectName || d.notes}>
                            {d.projectName || (d.workLocationType === 'office' ? 'Văn phòng' : '—')}
                          </td>
                          <td className="p-2.5 text-center font-bold text-indigo-700">
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
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">receipt_long</span>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                      Chi tiết thu nhập & khấu trừ
                    </h3>
                  </div>
                </div>

                <div className="p-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                    <span className="text-slate-600">Lương cơ bản theo HĐ:</span>
                    <span className="font-bold text-slate-800">
                      {showSalaryAmounts ? formatVND(myPayrollItem.baseSalary) : '•••••• đ'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-dashed border-slate-100 font-bold text-blue-900">
                    <span>Lương theo công thực tế ({myPayrollItem.actualWorkingDays} công):</span>
                    <span>{showSalaryAmounts ? formatVND(myPayrollItem.salaryByWorkDays) : '•••••• đ'}</span>
                  </div>

                  {myPayrollItem.paidLeaveSalary > 0 && (
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-100 text-emerald-700">
                      <span>Lương ngày phép ({myPayrollItem.paidLeaveDays} ngày):</span>
                      <span>{showSalaryAmounts ? formatVND(myPayrollItem.paidLeaveSalary) : '•••••• đ'}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                    <span className="text-slate-600">Phụ cấp ăn trưa:</span>
                    <span className="font-medium text-slate-800">
                      {showSalaryAmounts ? formatVND(myPayrollItem.allowanceLunch) : '•••••• đ'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                    <span className="text-slate-600">Phụ cấp xăng xe / đi lại:</span>
                    <span className="font-medium text-slate-800">
                      {showSalaryAmounts ? formatVND(myPayrollItem.allowanceFuel) : '•••••• đ'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                    <span className="text-slate-600">Phụ cấp điện thoại:</span>
                    <span className="font-medium text-slate-800">
                      {showSalaryAmounts ? formatVND(myPayrollItem.allowancePhone) : '•••••• đ'}
                    </span>
                  </div>

                  {myPayrollItem.allowanceField > 0 && (
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-100 text-amber-800 font-medium">
                      <span>Phụ cấp công trường ({myPayrollItem.fieldWorkDays} ngày):</span>
                      <span>{showSalaryAmounts ? formatVND(myPayrollItem.allowanceField) : '•••••• đ'}</span>
                    </div>
                  )}

                  {myPayrollItem.otPay > 0 && (
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-100 text-indigo-700 font-bold">
                      <span>Tiền làm thêm giờ (OT):</span>
                      <span>{showSalaryAmounts ? formatVND(myPayrollItem.otPay) : '•••••• đ'}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-b border-slate-200 font-extrabold text-blue-900 pt-2">
                    <span>TỔNG THU NHẬP (GROSS):</span>
                    <span>{showSalaryAmounts ? formatVND(myPayrollItem.grossIncome) : '•••••• đ'}</span>
                  </div>

                  {/* Khấu trừ */}
                  <div className="pt-2 text-slate-500 font-bold text-[11px] uppercase">Khấu trừ:</div>
                  <div className="flex justify-between py-0.5 text-red-600">
                    <span>BHXH, BHYT, BHTN (10.5%):</span>
                    <span>-{showSalaryAmounts ? formatVND(myPayrollItem.deductionSocialInsurance) : '•••••• đ'}</span>
                  </div>
                  {myPayrollItem.deductionAdvance > 0 && (
                    <div className="flex justify-between py-0.5 text-red-600">
                      <span>Tạm ứng trong tháng:</span>
                      <span>-{showSalaryAmounts ? formatVND(myPayrollItem.deductionAdvance) : '•••••• đ'}</span>
                    </div>
                  )}
                  {myPayrollItem.deductionTax > 0 && (
                    <div className="flex justify-between py-0.5 text-red-600">
                      <span>Thuế TNCN tạm tính:</span>
                      <span>-{showSalaryAmounts ? formatVND(myPayrollItem.deductionTax) : '•••••• đ'}</span>
                    </div>
                  )}

                  {/* THỰC LĨNH BOX */}
                  <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-between mt-3 shadow-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-90">THỰC LĨNH:</span>
                      <span className="text-xs opacity-80">(Chuyển khoản)</span>
                    </div>
                    <span className="text-lg font-black tracking-tight">
                      {showSalaryAmounts ? formatVND(myPayrollItem.netSalary) : '•••••••• đ'}
                    </span>
                  </div>
                </div>
              </div>

              {/* KHUNG CHỮ KÝ ĐÃ KÝ */}
              {myPayrollItem.signatureStatus === 'signed' && (
                <div className="bg-white rounded-2xl border border-emerald-300 p-4 shadow-xs flex items-center justify-between">
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
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
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
        <div className="space-y-4">
          {/* STATS BARS DÀNH CHO ADMIN */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Tổng số nhân sự</span>
              <span className="text-2xl font-black text-slate-800">{adminStats.total}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Tháng {selectedMonth}/{selectedYear}</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-emerald-300 shadow-xs bg-emerald-50/30">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">verified</span>
                Đã ký xác nhận
              </span>
              <span className="text-2xl font-black text-emerald-800">{adminStats.signed}</span>
              <span className="text-[11px] text-emerald-600 font-bold block mt-0.5">
                Đạt {adminStats.percent}% tiến độ
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-xs">
              <span className="text-[11px] font-bold text-blue-700 uppercase block flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">hourglass_top</span>
                Chờ ký xác nhận
              </span>
              <span className="text-2xl font-black text-blue-800">{adminStats.pending}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Chưa thực hiện ký</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-amber-300 shadow-xs bg-amber-50/30">
              <span className="text-[11px] font-bold text-amber-800 uppercase block flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">warning</span>
                Có khiếu nại / phản hồi
              </span>
              <span className="text-2xl font-black text-amber-900">{adminStats.disputed}</span>
              <span className="text-[11px] text-amber-700 font-medium block mt-0.5">Cần kế toán đối soát</span>
            </div>
          </div>

          {/* THANH TÌM KIẾM & BỘ LỌC ADMIN */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  value={adminSearch}
                  onChange={e => setAdminSearch(e.target.value)}
                  placeholder="Tìm theo tên, mã nhân viên, chức danh..."
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              {(['all', 'signed', 'pending', 'disputed'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setAdminStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    adminStatusFilter === st
                      ? 'bg-white text-primary shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'all' ? 'Tất cả' : st === 'signed' ? 'Đã ký' : st === 'pending' ? 'Chờ ký' : 'Có khiếu nại'}
                </button>
              ))}
            </div>
          </div>

          {/* BẢNG TỔNG HỢP TOÀN BỘ NHÂN SỰ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="p-3 text-center w-12">STT</th>
                    <th className="p-3">Mã NV</th>
                    <th className="p-3">Họ và tên</th>
                    <th className="p-3">Chức danh</th>
                    <th className="p-3 text-center">Công thực tế</th>
                    <th className="p-3 text-center">Công trường</th>
                    <th className="p-3 text-right">Tổng thu nhập</th>
                    <th className="p-3 text-right">Khấu trừ</th>
                    <th className="p-3 text-right font-extrabold text-blue-900">Thực lĩnh</th>
                    <th className="p-3 text-center">Tình trạng ký</th>
                    <th className="p-3 text-center">Chữ ký</th>
                    <th className="p-3 text-center w-24">Thao tác</th>
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
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
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
                          className="px-2.5 py-1 bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
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
          onUpdatePayroll={handleUpdatePayrollItem}
          showToast={showToast}
          canSign={viewingSlipItem.userId === user?.id || isAdmin}
        />
      )}
    </div>
  );
};
