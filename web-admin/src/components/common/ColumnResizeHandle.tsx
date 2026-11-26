import React from 'react';
import { useUIStore } from '../../services/uiStore';

interface ColumnResizeHandleProps {
  colKey?: string;
  onResizeStart?: (colKey: string, e: React.MouseEvent | React.TouchEvent) => void;
  onMouseDown?: (e: React.MouseEvent<any> | React.TouchEvent<any> | any) => void;
  className?: string;
  title?: string;
}

export const ColumnResizeHandle: React.FC<ColumnResizeHandleProps> = ({
  colKey = '',
  onResizeStart,
  onMouseDown,
  className = '',
  title = 'Kéo để đổi độ rộng cột',
}) => {
  const enableTableColumnResize = useUIStore((s) => s.enableTableColumnResize);

  if (!enableTableColumnResize) return null;

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (onMouseDown) {
      onMouseDown(e);
    } else if (onResizeStart && colKey) {
      onResizeStart(colKey, e);
    }
  };

  return (
    <div
      role="separator"
      tabIndex={-1}
      title={title}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize z-20 flex items-center justify-center select-none group/resizer hover:bg-primary/20 active:bg-primary/30 transition-colors ${className}`}
    >
      <div className="w-[2px] h-3.5 bg-slate-300 group-hover/resizer:bg-primary group-hover/resizer:h-full group-hover/resizer:w-[2.5px] rounded-full transition-all" />
    </div>
  );
};
