import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeStore } from '../services/realtimeStore';
import { useAuthStore } from '../services/authStore';
import { api } from '../services/apiSupabase';
import { MonthlyPayrollItem, LeaveRequest, AttendanceAdjustmentRequest } from '../types';
import { generateMonthlyPayrollDraft, formatVND } from '../utils/payrollCalculator';
import { ChangePasswordModal } from '../components/common/ChangePasswordModal';
import { Modal } from '../components/common/Modal';
import { Toast } from '../components/common/Toast';
import { DigitalSignatureModal } from '../components/payroll/DigitalSignatureModal';
import { PayrollDisputeModal } from '../components/payroll/PayrollDisputeModal';
import { PayrollSlipViewModal } from '../components/payroll/PayrollSlipViewModal';

export const AccountPage: React.FC = () => {
  const engineer = useRealtimeStore((state) => state.engineers[0]);
  const engineers = useRealtimeStore((state) => state.engineers);
  const user = useAuthStore((state) => state.user);
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);
  const [toastState, setToastState] = useState({ show: false, message: '', type: 'success' as 'success' | 'info' | 'warning' | 'error' });

  // Dữ liệu Bảng công & Lương trên tài khoản
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [showSalaryAmounts, setShowSalaryAmounts] = useState<boolean>(true);

  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustmentRequest[]>([]);
  const [savedPayrolls, setSavedPayrolls] = useState<MonthlyPayrollItem[]>([]);
  const [isPayrollLoading, setIsPayrollLoading] = useState<boolean>(false);

  // Modals ký và xem phiếu lương
  const [signingItem, setSigningItem] = useState<MonthlyPayrollItem | null>(null);
  const [disputingItem, setDisputingItem] = useState<MonthlyPayrollItem | null>(null);
  const [viewingSlipItem, setViewingSlipItem] = useState<MonthlyPayrollItem | null>(null);

  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setToastState({ show: true, message, type });
    setTimeout(() => setToastState({ show: false, message: '', type: 'success' }), 3000);
  };

  // Nạp dữ liệu chấm công & bảng lương cho tài khoản
  const fetchAccountPayrollData = async () => {
    if (!user) return;
    setIsPayrollLoading(true);
    try {
      const [logsData, leavesData, adjsData, payrollsData] = await Promise.all([
        api.attendance.getByUser(user.id, user.name),
        api.leaves.getAll(),
        api.adjustments.getAll(),
        api.payroll.getAll(selectedMonth, selectedYear),
      ]);
      setAttendanceLogs(logsData || []);
      setLeaves(leavesData || []);
      setAdjustments(adjsData || []);
      setSavedPayrolls(payrollsData || []);
    } catch (err) {
      console.warn('[Account] Lỗi nạp bảng công lương tài khoản:', err);
    } finally {
      setIsPayrollLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountPayrollData();
  }, [user, selectedMonth, selectedYear]);

  // Thông tin kỹ sư của tài khoản hiện tại
  const myEngineer = useMemo(() => {
    return engineers.find(e => 
      e.id === user?.id || 
      (user?.name && e.name && e.name.trim().toLowerCase() === user.name.trim().toLowerCase())
    ) || engineer;
  }, [engineers, engineer, user]);

  // Bảng lương của tài khoản tháng đã chọn
  const myAccountPayroll = useMemo<MonthlyPayrollItem | null>(() => {
    if (!user) return null;
    const existing = savedPayrolls.find(p => String(p.userId) === String(user.id));
    return generateMonthlyPayrollDraft({
      user: { id: user.id, name: user.name || user.username || 'User', username: user.username, title: user.title },
      engineer: myEngineer,
      month: selectedMonth,
      year: selectedYear,
      logs: attendanceLogs,
      leaves,
      adjustments,
      existingPayroll: existing,
    });
  }, [user, myEngineer, selectedMonth, selectedYear, attendanceLogs, leaves, adjustments, savedPayrolls]);

  const handleUpdatePayroll = (updated: MonthlyPayrollItem) => {
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

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsConfirmLogoutOpen(false);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-full bg-slate-50 relative overflow-y-auto">
      <section className={`bg-white px-6 md:h-12 flex items-center border-b border-slate-200 shadow-sm pr-16 md:pr-20`}>
        <div className="flex items-center gap-3">
          <div className="h-6 w-[2px] bg-primary"></div>
          <h2 className="text-lg font-extrabold text-primary uppercase tracking-wide">TÀI KHOẢN</h2>
        </div>
      </section>

      <div className="p-6 md:p-8 space-y-4 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[360px]">
            <div className="w-28 h-28 rounded-md bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shadow-sm mb-6 overflow-hidden">
              {(myEngineer as any)?.avatar ? <img src={(myEngineer as any).avatar} alt="Ảnh người dùng" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-[64px]">person</span>}
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">
              {user?.name || engineer?.name || 'Admin'}
            </h3>
            <span className="px-3.5 py-1 rounded-md bg-blue-50 text-primary border border-blue-100 text-xs font-bold">
              {user?.title || 'Quản trị viên'}
            </span>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 p-8 flex flex-col justify-between min-h-[360px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Info label="Họ tên" value={user?.name || engineer?.name || 'Admin'} icon="person" />
              <Info label="Tên đăng nhập" value={user?.username || 'admin'} icon="badge" />
              <Info label="Vai trò" value={user?.title || 'Quản trị viên'} icon="verified_user" />
              <Info label="Email" value={user?.email || engineer?.email || 'admin@titsmart.vn'} icon="mail" />
              <Info label="Số điện thoại" value={user?.phone || engineer?.phone || '0901 234 567'} icon="call" />
              <Info label="Ngày vào công ty" value={(myEngineer as any)?.joinDate || (myEngineer as any)?.join_date || 'Chưa cập nhật'} icon="event" />
              <Info label="Địa chỉ" value={(myEngineer as any)?.address || 'Chưa cập nhật'} icon="home" />
              <Info label="Số CCCD" value={(myEngineer as any)?.identityNumber || (myEngineer as any)?.identity_number || 'Chưa cập nhật'} icon="badge" />
              <Info label="Người liên hệ khẩn cấp" value={(myEngineer as any)?.emergencyContactName || (myEngineer as any)?.emergency_contact_name || 'Chưa cập nhật'} icon="contact_phone" />
              <Info label="SĐT khẩn cấp" value={(myEngineer as any)?.emergencyPhone || (myEngineer as any)?.emergency_phone || 'Chưa cập nhật'} icon="phone_in_talk" />
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
              <button 
                type="button"
                onClick={() => setIsChangePasswordOpen(true)} 
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">lock_reset</span>
                Đổi mật khẩu
              </button>
              <button 
                type="button"
                onClick={() => setIsConfirmLogoutOpen(true)} 
                disabled={isLoggingOut}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isLoggingOut ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span className="material-symbols-outlined text-lg">logout</span>
                )}
                {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
              </button>
            </div>
          </div>
        </div>

        {/* SECTION: BẢNG CHẤM CÔNG & PHIẾU LƯƠNG TRÊN TÀI KHOẢN */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-blue-50 text-primary border border-blue-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">receipt_long</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                  Bảng Chấm Công & Bảng Lương Trên Tài Khoản
                </h3>
                <p className="text-xs text-slate-500">
                  Đối soát số ngày công làm việc, phụ cấp và thực hiện ký xác nhận điện tử trực tiếp
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
                <span className="material-symbols-outlined text-[15px] text-primary ml-1">calendar_month</span>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-2 py-0.5 font-bold text-primary focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-2 py-0.5 font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowSalaryAmounts(p => !p)}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-md border border-slate-200 text-xs font-bold transition cursor-pointer"
                title={showSalaryAmounts ? 'Ẩn số tiền lương' : 'Hiện số tiền lương'}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {showSalaryAmounts ? 'visibility_off' : 'visibility'}
                </span>
                <span>{showSalaryAmounts ? 'Ẩn tiền' : 'Hiện tiền'}</span>
              </button>
            </div>
          </div>

          {myAccountPayroll && (
            <div className="space-y-3.5">
              {/* BANNER TRẠNG THÁI KÝ */}
              <div className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                myAccountPayroll.signatureStatus === 'signed'
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : myAccountPayroll.signatureStatus === 'disputed'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-blue-50/90 border-blue-300 text-blue-950'
              }`}>
                <div className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                    myAccountPayroll.signatureStatus === 'signed'
                      ? 'bg-emerald-600 text-white'
                      : myAccountPayroll.signatureStatus === 'disputed'
                      ? 'bg-amber-600 text-white'
                      : 'bg-primary text-white animate-pulse'
                  }`}>
                    <span className="material-symbols-outlined text-lg">
                      {myAccountPayroll.signatureStatus === 'signed' ? 'verified' : myAccountPayroll.signatureStatus === 'disputed' ? 'warning' : 'draw'}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wide">
                        {myAccountPayroll.signatureStatus === 'signed'
                          ? 'Đã ký xác nhận bảng công & lương'
                          : myAccountPayroll.signatureStatus === 'disputed'
                          ? 'Đang có phản hồi khiếu nại'
                          : 'Chờ bạn ký xác nhận tháng này'}
                      </span>
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-white/80 border">
                        Tháng {selectedMonth}/{selectedYear}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                      {myAccountPayroll.signatureStatus === 'signed' ? (
                        <>Đã ký điện tử lúc <b>{myAccountPayroll.signedAt ? new Date(myAccountPayroll.signedAt).toLocaleString('vi-VN') : ''}</b>.</>
                      ) : myAccountPayroll.signatureStatus === 'disputed' ? (
                        <>Nội dung phản hồi: <i>"{myAccountPayroll.disputeNote}"</i></>
                      ) : (
                        <>Vui lòng kiểm tra số ngày công ({myAccountPayroll.actualWorkingDays} công) và số tiền thực lĩnh, sau đó bấm <b>Ký xác nhận</b>.</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setViewingSlipItem(myAccountPayroll)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">visibility</span>
                    Xem phiếu A4
                  </button>

                  {myAccountPayroll.signatureStatus !== 'signed' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDisputingItem(myAccountPayroll)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-md text-xs font-bold transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">chat_bubble</span>
                        Phản hồi
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigningItem(myAccountPayroll)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-blue-800 text-white rounded-md text-xs font-extrabold shadow-xs transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">draw</span>
                        Ký xác nhận ngay
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 4 THẺ SỐ LIỆU */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block mb-1">Công thực tế</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-800">{myAccountPayroll.actualWorkingDays}</span>
                    <span className="text-xs text-slate-400 font-medium">/ {myAccountPayroll.standardWorkingDays} công</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block mb-1">Công trường / Đi ngoài</span>
                  <div className="text-xl font-black text-amber-700">{myAccountPayroll.fieldWorkDays} <span className="text-xs text-slate-400 font-medium">ngày</span></div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block mb-1">Làm thêm giờ (OT)</span>
                  <div className="text-xl font-black text-indigo-700">
                    {myAccountPayroll.otHoursNormal + myAccountPayroll.otHoursSunday + myAccountPayroll.otHoursHoliday} <span className="text-xs text-slate-400 font-medium">giờ</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50/50">
                  <span className="text-[10.5px] uppercase font-bold text-emerald-700 block mb-1">THỰC LĨNH THÁNG</span>
                  <div className="text-xl font-black text-emerald-800">
                    {showSalaryAmounts ? formatVND(myAccountPayroll.netSalary) : '•••••••• đ'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 text-xs">
                <span className="text-slate-500">
                  Chữ ký điện tử trên tài khoản có giá trị xác nhận hồ sơ quyết toán tiền lương hàng tháng.
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/attendance?tab=payroll`)}
                  className="text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Xem bảng chi tiết ngày công
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Ký xác nhận */}
      {signingItem && (
        <DigitalSignatureModal
          isOpen={!!signingItem}
          onClose={() => setSigningItem(null)}
          payrollItem={signingItem}
          onSuccess={(updated) => {
            handleUpdatePayroll(updated);
            setSigningItem(null);
            triggerToast('Đã ký xác nhận thành công!', 'success');
          }}
          showToast={triggerToast}
        />
      )}

      {/* Modal Phản hồi khiếu nại */}
      {disputingItem && (
        <PayrollDisputeModal
          isOpen={!!disputingItem}
          onClose={() => setDisputingItem(null)}
          payrollItem={disputingItem}
          onSuccess={(updated) => {
            handleUpdatePayroll(updated);
            setDisputingItem(null);
            triggerToast('Đã gửi phản hồi thắc mắc cho Kế toán!', 'success');
          }}
          showToast={triggerToast}
        />
      )}

      {/* Modal Xem phiếu lương A4 */}
      {viewingSlipItem && (
        <PayrollSlipViewModal
          isOpen={!!viewingSlipItem}
          onClose={() => setViewingSlipItem(null)}
          payrollItem={viewingSlipItem}
          onUpdatePayroll={(updated) => {
            handleUpdatePayroll(updated);
            setViewingSlipItem(updated);
          }}
          showToast={triggerToast}
          canSign={true}
        />
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={() => triggerToast('Đổi mật khẩu tài khoản thành công!', 'success')}
      />

      {/* Confirm Logout Modal */}
      <Modal
        isOpen={isConfirmLogoutOpen}
        onClose={() => setIsConfirmLogoutOpen(false)}
        title="Xác nhận đăng xuất"
        icon="logout"
        size="md"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Bạn có chắc chắn muốn đăng xuất?</p>
              <p className="text-xs text-slate-500 mt-0.5">Phiên làm việc hiện tại của bạn sẽ kết thúc.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsConfirmLogoutOpen(false)}
              className="px-4 py-2 rounded-md text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-md text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* In-app Toast */}
      <Toast
        show={toastState.show}
        message={toastState.message}
        type={toastState.type}
        onClose={() => setToastState(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

const Info = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 flex items-start gap-4 transition-all duration-300 hover:shadow-sm hover:bg-white hover:border-blue-200 group">
    <span className="material-symbols-outlined text-primary text-lg group-hover:scale-110 transition-transform">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">{label}</div>
      <div className="text-[15px] font-extrabold text-slate-800 break-words">{value}</div>
    </div>
  </div>
);
