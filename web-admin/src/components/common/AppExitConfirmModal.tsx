import React from 'react';
import { Modal } from './Modal';

interface AppExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onMinimizeToTray?: () => void;
}

export const AppExitConfirmModal: React.FC<AppExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onMinimizeToTray,
}) => {
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

  const handleMinimizeToTray = () => {
    if (onMinimizeToTray) {
      onMinimizeToTray();
    } else if (window.electronAPI?.minimizeToTray) {
      window.electronAPI.minimizeToTray();
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tùy chọn đóng TITSMART"
      icon="notifications_active"
      size="md"
      requireConfirmOnClose={false}
      zIndexClass="z-[999999]"
    >
      <div className="py-2 text-slate-600 text-sm space-y-3">
        <p>
          Bạn muốn ẩn ứng dụng để <strong>tiếp tục nhận thông báo nhiệm vụ mới</strong> (giống Zalo) hay thoát hoàn toàn?
        </p>
        {isElectron && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
            <span className="material-symbols-outlined text-base text-blue-600 shrink-0">info</span>
            <span>
              Chọn <strong>&ldquo;Chạy ngầm (Nhận thông báo)&rdquo;</strong>, TITSMART sẽ thu nhỏ xuống góc màn hình và báo chuông ngay khi có công việc mới.
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-medium rounded-lg text-sm transition-colors"
        >
          Ở lại
        </button>

        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="px-3.5 py-2 font-medium rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 text-sm transition-colors"
        >
          Thoát hoàn toàn
        </button>

        {isElectron && (
          <button
            type="button"
            onClick={handleMinimizeToTray}
            className="px-4 py-2 font-medium rounded-lg text-white bg-primary hover:bg-primary/90 shadow-sm shadow-blue-200 text-sm flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-base">notifications</span>
            Chạy ngầm (Nhận thông báo)
          </button>
        )}
      </div>
    </Modal>
  );
};
