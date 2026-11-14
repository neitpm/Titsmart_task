import React, { useState } from 'react';
import { usePlatformAdminStore } from '../../services/platformAdminStore';

interface SystemSecurityTabProps {
  triggerToast: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const SystemSecurityTab: React.FC<SystemSecurityTabProps> = ({ triggerToast }) => {
  const { securityConfig, saveSecurityConfig } = usePlatformAdminStore();

  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(securityConfig.sessionTimeoutMinutes);
  const [minPasswordLength, setMinPasswordLength] = useState(securityConfig.minPasswordLength);
  const [requireSpecialChar, setRequireSpecialChar] = useState(securityConfig.requireSpecialChar);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(securityConfig.maxLoginAttempts);
  const [allowMobileAppLogin, setAllowMobileAppLogin] = useState(securityConfig.allowMobileAppLogin);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveSecurityConfig({
        sessionTimeoutMinutes: Number(sessionTimeoutMinutes),
        minPasswordLength: Number(minPasswordLength),
        requireSpecialChar,
        maxLoginAttempts: Number(maxLoginAttempts),
        allowMobileAppLogin
      });
      triggerToast('Đã lưu chính sách bảo mật hệ thống thành công!', 'success');
    } catch {
      triggerToast('Lỗi khi lưu chính sách bảo mật!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Chính sách Bảo mật & Phiên làm việc</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình thời gian hết hạn phiên, tiêu chuẩn an toàn mật khẩu và bảo vệ tài khoản cho toàn hệ thống.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Card 1: Phiên làm việc */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="material-symbols-outlined text-primary text-xl">timer</span>
            <h2 className="text-sm font-bold text-slate-800">Kiểm soát Phiên làm việc (Session Management)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Thời gian tự động đăng xuất khi không thao tác (Phút)</label>
              <input
                type="number"
                min={0}
                max={1440}
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-primary font-bold text-slate-800"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Đặt 0 để không tự động đăng xuất. Mặc định khuyên dùng: 120 phút (2 tiếng).
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Giới hạn số lần đăng nhập sai liên tiếp</label>
              <input
                type="number"
                min={3}
                max={20}
                value={maxLoginAttempts}
                onChange={(e) => setMaxLoginAttempts(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-primary font-bold text-slate-800"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Tài khoản sẽ bị tạm khóa 15 phút nếu nhập sai vượt quá số lần này.
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Tiêu chuẩn mật khẩu */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="material-symbols-outlined text-emerald-600 text-xl">password</span>
            <h2 className="text-sm font-bold text-slate-800">Quy chuẩn Mật khẩu & Đăng nhập</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">Độ dài mật khẩu tối thiểu</span>
                <span className="text-[11px] text-slate-500">Áp dụng khi tạo mới nhân sự hoặc đổi mật khẩu.</span>
              </div>
              <select
                value={minPasswordLength}
                onChange={(e) => setMinPasswordLength(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
              >
                <option value={6}>6 ký tự (Tiêu chuẩn)</option>
                <option value={8}>8 ký tự (Khuyên dùng)</option>
                <option value={10}>10 ký tự (Bảo mật cao)</option>
                <option value={12}>12 ký tự (Tối đa)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">Bắt buộc chứa ký tự đặc biệt (@, #, $,...)</span>
                <span className="text-[11px] text-slate-500">Tăng cường khả năng chống tấn công dò quét mật khẩu.</span>
              </div>
              <input
                type="checkbox"
                checked={requireSpecialChar}
                onChange={(e) => setRequireSpecialChar(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="font-bold text-slate-800 block">Cho phép truy cập từ Ứng dụng Di Động (Mobile App)</span>
                <span className="text-[11px] text-slate-500">Tắt nếu doanh nghiệp chỉ cho phép nhân viên thao tác qua máy tính công ty.</span>
              </div>
              <input
                type="checkbox"
                checked={allowMobileAppLogin}
                onChange={(e) => setAllowMobileAppLogin(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-blue-800 text-white transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">shield</span>
            <span>{isSaving ? 'Đang cập nhật...' : 'Cập nhật chính sách bảo mật'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
