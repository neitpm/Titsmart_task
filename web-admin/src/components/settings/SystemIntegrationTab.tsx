import React, { useState } from 'react';
import { usePlatformAdminStore } from '../../services/platformAdminStore';

interface SystemIntegrationTabProps {
  triggerToast: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const SystemIntegrationTab: React.FC<SystemIntegrationTabProps> = ({ triggerToast }) => {
  const { integrationConfig, saveIntegrationConfig } = usePlatformAdminStore();

  const [telegramBotEnabled, setTelegramBotEnabled] = useState(integrationConfig.telegramBotEnabled);
  const [telegramBotToken, setTelegramBotToken] = useState(integrationConfig.telegramBotToken || '');
  const [telegramChatId, setTelegramChatId] = useState(integrationConfig.telegramChatId || '');
  const [zaloZnsEnabled, setZaloZnsEnabled] = useState(integrationConfig.zaloZnsEnabled);
  const [zaloTemplateId, setZaloTemplateId] = useState(integrationConfig.zaloTemplateId || '');

  const [alertOnFundRequest, setAlertOnFundRequest] = useState(integrationConfig.alertOnFundRequest);
  const [alertOnTaskOverdue, setAlertOnTaskOverdue] = useState(integrationConfig.alertOnTaskOverdue);
  const [alertOnSecurityAnomaly, setAlertOnSecurityAnomaly] = useState(integrationConfig.alertOnSecurityAnomaly);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveIntegrationConfig({
        telegramBotEnabled,
        telegramBotToken: telegramBotToken.trim(),
        telegramChatId: telegramChatId.trim(),
        zaloZnsEnabled,
        zaloTemplateId: zaloTemplateId.trim(),
        alertOnFundRequest,
        alertOnTaskOverdue,
        alertOnSecurityAnomaly
      });
      triggerToast('Đã lưu cấu hình tích hợp và cảnh báo thành công!', 'success');
    } catch {
      triggerToast('Lỗi khi lưu cấu hình tích hợp!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramBotToken.trim() || !telegramChatId.trim()) {
      triggerToast('Vui lòng nhập Bot Token và Chat ID trước khi kiểm tra!', 'warning');
      return;
    }
    triggerToast('Đang gửi tin nhắn thử nghiệm tới Telegram...', 'info');
    try {
      const url = `https://api.telegram.org/bot${telegramBotToken.trim()}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId.trim(),
          text: '🔔 [TITSMART Alert] Kết nối hệ thống cảnh báo thành công!'
        })
      });
      const data = await res.json();
      if (data.ok) {
        triggerToast('Gửi tin nhắn Telegram thành công! Hãy kiểm tra ứng dụng Telegram.', 'success');
      } else {
        triggerToast(`Lỗi gửi Telegram: ${data.description || 'Không xác định'}`, 'error');
      }
    } catch (err: any) {
      triggerToast(`Lỗi kết nối Telegram API: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Tích hợp & Kênh Cảnh báo tự động</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình kết nối Telegram Bot / Zalo ZNS để tự động thông báo đơn duyệt cấp quỹ, trễ hạn dự án và cảnh báo bảo mật.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Telegram Bot */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-500 text-xl">send</span>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Telegram Bot Cảnh báo tức thì</h2>
                <p className="text-[11px] text-slate-400">Nhận thông báo đơn cấp quỹ & tiến độ trực tiếp vào Group chat hoặc cá nhân</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700">
              <input
                type="checkbox"
                checked={telegramBotEnabled}
                onChange={(e) => setTelegramBotEnabled(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              Bật Telegram
            </label>
          </div>

          {telegramBotEnabled && (
            <div className="space-y-3 text-xs pt-1">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Telegram Bot Token (Từ @BotFather)</label>
                <input
                  type="text"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="VD: 123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Chat ID hoặc Group ID</label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="VD: -1001234567890 hoặc 987654321"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-primary font-mono"
                />
              </div>

              <div className="flex justify-start pt-1">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  <span>Gửi tin nhắn thử nghiệm</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Zalo ZNS / Notification */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-xl">chat</span>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Zalo ZNS Official Account (Doanh nghiệp)</h2>
                <p className="text-[11px] text-slate-400">Gửi thông báo OTP, phê duyệt hoặc hợp đồng qua tin nhắn Zalo OA</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700">
              <input
                type="checkbox"
                checked={zaloZnsEnabled}
                onChange={(e) => setZaloZnsEnabled(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              Bật Zalo ZNS
            </label>
          </div>

          {zaloZnsEnabled && (
            <div className="space-y-3 text-xs pt-1">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mẫu Zalo ZNS Template ID</label>
                <input
                  type="text"
                  value={zaloTemplateId}
                  onChange={(e) => setZaloTemplateId(e.target.value)}
                  placeholder="Mã template đã được Zalo duyệt"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-primary font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sự kiện kích hoạt cảnh báo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="material-symbols-outlined text-amber-500 text-xl">notifications_active</span>
            <h2 className="text-sm font-bold text-slate-800">Sự kiện gửi cảnh báo tự động</h2>
          </div>

          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
              <span className="font-semibold text-slate-800">Có yêu cầu cấp quỹ / giải ngân dự án mới</span>
              <input
                type="checkbox"
                checked={alertOnFundRequest}
                onChange={(e) => setAlertOnFundRequest(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
              <span className="font-semibold text-slate-800">Công việc hoặc tiến độ dự án bị trễ hạn</span>
              <input
                type="checkbox"
                checked={alertOnTaskOverdue}
                onChange={(e) => setAlertOnTaskOverdue(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
              <span className="font-semibold text-slate-800">Cảnh báo đăng nhập thất bại liên tiếp hoặc bất thường</span>
              <input
                type="checkbox"
                checked={alertOnSecurityAnomaly}
                onChange={(e) => setAlertOnSecurityAnomaly(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-blue-800 text-white transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            <span>{isSaving ? 'Đang cập nhật...' : 'Lưu cấu hình tích hợp'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
