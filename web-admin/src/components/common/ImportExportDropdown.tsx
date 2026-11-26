import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ImportExportDropdownProps {
  onImportClick?: () => void;
  importLabel?: string;
  onExportExcel?: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  onExportWord?: () => void;
  buttonLabel?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export const ImportExportDropdown: React.FC<ImportExportDropdownProps> = ({
  onImportClick,
  importLabel = 'Nhập file',
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onExportWord,
  buttonLabel = 'Nhập / Xuất file',
  className = '',
  buttonClassName = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 192; // w-48 = 12rem = 192px
      // Căn lề phải menu trùng lề phải button, nếu tràn màn hình thì đẩy vào trong
      let left = rect.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - 8 - menuWidth;
      }
      setCoords({
        top: rect.bottom + 6,
        left,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => {
        updatePosition();
      };
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          buttonRef.current && buttonRef.current.contains(target) ||
          menuRef.current && menuRef.current.contains(target)
        ) {
          return;
        }
        setIsOpen(false);
      };
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const hasImport = Boolean(onImportClick);
  const hasExport = Boolean(onExportExcel || onExportCsv || onExportPdf || onExportWord);

  return (
    <div className={`relative shrink-0 no-drag-region electron-no-drag ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-center gap-1 border border-slate-200 bg-white text-slate-700 px-2.5 h-[34px] rounded-lg text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-xs whitespace-nowrap cursor-pointer shrink-0 no-drag-region electron-no-drag ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${buttonClassName}`}
        title={buttonLabel}
      >
        <span className="material-symbols-outlined text-[16px] text-slate-600">swap_vert</span>
        {buttonLabel && <span className="inline">{buttonLabel}</span>}
        <span className="material-symbols-outlined text-xs">expand_more</span>
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 9999999,
          }}
          className="w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-in fade-in zoom-in duration-100 no-drag-region electron-no-drag"
        >
          {hasImport && (
            <>
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Nhập dữ liệu
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onImportClick?.();
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-primary flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base text-primary">file_upload</span>
                <span>{importLabel}</span>
              </button>
            </>
          )}

          {hasImport && hasExport && (
            <div className="border-t border-slate-100 my-1"></div>
          )}

          {hasExport && (
            <>
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Xuất dữ liệu
              </div>

              {onExportExcel && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onExportExcel();
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-green-600">grid_on</span>
                  <span>Xuất Excel</span>
                </button>
              )}

              {onExportCsv && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onExportCsv();
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-teal-600">csv</span>
                  <span>Xuất CSV</span>
                </button>
              )}

              {onExportPdf && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onExportPdf();
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-red-600">picture_as_pdf</span>
                  <span>Xuất PDF</span>
                </button>
              )}

              {onExportWord && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onExportWord();
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-blue-600">description</span>
                  <span>Xuất Word</span>
                </button>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
