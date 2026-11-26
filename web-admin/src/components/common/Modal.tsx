import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
  icon?: string;
  defaultMaximized?: boolean;
  requireConfirmOnClose?: boolean;
  isDirty?: boolean;
  zIndexClass?: string;
}

const modalSizeClasses = {
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-7xl',
  full: 'max-w-[98vw] h-[95vh]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  icon = 'add_task',
  defaultMaximized = false,
  requireConfirmOnClose,
  isDirty,
  zIndexClass = "z-[100]",
}) => {
  const [isMaximized, setIsMaximized] = useState<boolean>(defaultMaximized);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const initialSnapshotRef = useRef<string | null>(null);
  const userInteractedRef = useRef<boolean>(false);

  // Helper hàm chụp trạng thái hiện tại của tất cả inputs/textareas/selects trong modal (bỏ qua input search nội bộ)
  const captureFormSnapshot = useCallback((): string => {
    if (!contentRef.current) return '';
    const elements = contentRef.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([data-ignore-dirty="true"]), textarea:not([data-ignore-dirty="true"]), select:not([data-ignore-dirty="true"])'
    );
    const parts: string[] = [];
    elements.forEach((el, index) => {
      // Bỏ qua các input tìm kiếm hoặc filter tạm thời
      const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
      if (placeholder.includes('tìm kiếm') || placeholder.includes('nhập để tìm')) return;

      const type = el.getAttribute('type') || el.tagName.toLowerCase();
      const name = el.getAttribute('name') || String(index);
      if (type === 'checkbox' || type === 'radio') {
        parts.push(`${name}:${(el as HTMLInputElement).checked}`);
      } else {
        parts.push(`${name}:${el.value}`);
      }
    });
    return parts.join('|||');
  }, []);

  // Lắng nghe sự kiện người dùng thực sự nhập liệu (input, change) vào form
  useEffect(() => {
    if (!isOpen) return;

    userInteractedRef.current = false;
    const handleInput = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const placeholder = (target.getAttribute('placeholder') || '').toLowerCase();
      if (placeholder.includes('tìm kiếm') || placeholder.includes('nhập để tìm')) return;
      if (target.getAttribute('data-ignore-dirty') === 'true') return;

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        userInteractedRef.current = true;
      }
    };

    const container = contentRef.current;
    if (container) {
      container.addEventListener('input', handleInput);
      container.addEventListener('change', handleInput);
    }
    return () => {
      if (container) {
        container.removeEventListener('input', handleInput);
        container.removeEventListener('change', handleInput);
      }
    };
  }, [isOpen]);

  // Chụp snapshot ban đầu sau khi modal mở và các input đã render xong
  useEffect(() => {
    if (isOpen) {
      setShowExitConfirm(false);
      userInteractedRef.current = false;
      initialSnapshotRef.current = null;
      // Chờ form fill giá trị ban đầu vào input
      const timer = setTimeout(() => {
        initialSnapshotRef.current = captureFormSnapshot();
      }, 200);
      return () => clearTimeout(timer);
    } else {
      initialSnapshotRef.current = null;
      userInteractedRef.current = false;
      setShowExitConfirm(false);
    }
  }, [isOpen, captureFormSnapshot]);

  if (!isOpen) return null;

  // Kiểm tra người dùng có thực sự thay đổi dữ liệu hay không
  const checkHasUserChanges = (): boolean => {
    // Nếu component cha có truyền cờ isDirty rõ ràng
    if (typeof isDirty === 'boolean') {
      return isDirty;
    }
    // Nếu người dùng đã gõ hoặc thay đổi giá trị
    if (userInteractedRef.current) {
      const currentSnapshot = captureFormSnapshot();
      if (initialSnapshotRef.current !== null) {
        return currentSnapshot !== initialSnapshotRef.current;
      }
      return true;
    }
    // So sánh snapshot nếu có
    if (initialSnapshotRef.current !== null) {
      const currentSnapshot = captureFormSnapshot();
      return currentSnapshot !== initialSnapshotRef.current;
    }
    return false;
  };

  const handleCloseClick = () => {
    // Tự động xác định: Nếu requireConfirmOnClose được truyền false thì đóng ngay.
    // Nếu requireConfirmOnClose là undefined, tự động kiểm tra xem modal có chứa form/input không
    if (requireConfirmOnClose === false) {
      onClose();
      return;
    }

    // Nếu modal chỉ là modal xem (không có form/input nhập liệu nào) thì đóng luôn không cần hỏi
    const hasEditableInputs = Boolean(
      contentRef.current?.querySelector(
        'form, input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea'
      )
    );

    if (!hasEditableInputs) {
      onClose();
      return;
    }

    // Nếu có form và người dùng có thay đổi dữ liệu thực tế -> Hỏi xác nhận
    const hasChanges = checkHasUserChanges();
    if (hasChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onClose();
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
  };

  const sizeClass = isMaximized
    ? 'max-w-[99vw] h-[98dvh] my-auto'
    : size === 'full'
    ? 'max-w-[98vw] h-[95dvh]'
    : `${modalSizeClasses[size]} max-h-[92dvh] md:max-h-[94dvh]`;

  return (
    <>
      <div data-modal-root="true" data-app-exit={zIndexClass.includes("999999") ? "true" : undefined} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/50 backdrop-blur-sm p-1.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+8px)] pb-[calc(env(safe-area-inset-bottom,0px)+8px)] md:pb-4 animate-fadeIn`}>
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className={`bg-white rounded-2xl shadow-2xl border border-outline-variant w-full ${sizeClass} overflow-hidden flex flex-col transition-all duration-200`}>
          {/* Modal Header */}
          <div className="px-4 py-2 bg-surface-container-low border-b border-outline-variant flex justify-between items-center select-none shrink-0">
            <h3 className="text-sm font-bold text-primary flex items-center gap-1.5 truncate">
              {icon && <span className="material-symbols-outlined text-[17px]">{icon}</span>}
              <span className="truncate">{title}</span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCloseClick}
                title="Đóng"
                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] block">close</span>
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div ref={contentRef} className={`${size === 'full' ? 'p-1 sm:p-4' : 'p-3.5 sm:p-4'} overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0 h-full`}>{children}</div>
        </div>
      </div>

      {/* Exit confirmation dialog overlay when clicking X */}
      {showExitConfirm && (
        <div data-app-exit="true" className="fixed inset-0 z-[10000000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 shadow-2xl max-w-sm w-full border border-slate-200 text-center animate-zoomIn space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-primary border border-blue-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">help_outline</span>
            </div>
            <div>
              <h4 className="font-bold text-base text-slate-800">Xác nhận thoát</h4>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc chắn muốn thoát? Dữ liệu đang nhập có thể bị mất.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelExit}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors flex-1 shadow-2xs"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow-md transition-all flex-1"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

