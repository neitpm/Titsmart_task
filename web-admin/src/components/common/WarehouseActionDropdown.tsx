import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface WarehouseActionDropdownProps {
  onImportClick: () => void;
  onExportClick: () => void;
  buttonLabel?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export const WarehouseActionDropdown: React.FC<WarehouseActionDropdownProps> = ({
  onImportClick,
  onExportClick,
  buttonLabel = 'Nhập / Xuất kho',
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
      const menuWidth = 192; // w-48 = 192px
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
        className={`flex items-center justify-center gap-1.5 border border-slate-200 bg-white text-slate-700 px-3 h-[34px] rounded-lg text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-xs whitespace-nowrap cursor-pointer shrink-0 no-drag-region electron-no-drag ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${buttonClassName}`}
        title={buttonLabel}
      >
        <span className="material-symbols-outlined text-[16px] text-slate-600">sync_alt</span>
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
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Nghiệp vụ kho
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onImportClick();
            }}
            className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-base text-emerald-600">arrow_downward</span>
            <span>Nhập Kho</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onExportClick();
            }}
            className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-base text-amber-600">arrow_upward</span>
            <span>Xuất Kho</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};
