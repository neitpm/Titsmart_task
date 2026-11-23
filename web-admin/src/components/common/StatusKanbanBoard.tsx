import React from 'react';

export interface KanbanColumn<T> {
  id: string;
  title: string;
  badge?: string | number;
  headerColorClass?: string;
  columnBgClass?: string;
  items: T[];
}

interface StatusKanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  renderCard: (item: T, columnId: string) => React.ReactNode;
  keyExtractor: (item: T) => string;
  emptyText?: string;
  className?: string;
}

export function StatusKanbanBoard<T>({
  columns,
  renderCard,
  keyExtractor,
  emptyText = 'Không có dữ liệu',
  className = '',
}: StatusKanbanBoardProps<T>) {
  return (
    <div className={`flex gap-4 overflow-x-auto pb-4 pt-1 items-start ${className}`}>
      {columns.map((col) => (
        <div
          key={col.id}
          className={`shrink-0 w-80 sm:w-84 rounded-xl border border-slate-200/80 shadow-xs flex flex-col max-h-[calc(100vh-220px)] ${
            col.columnBgClass || 'bg-slate-50/80'
          }`}
        >
          {/* Header cột */}
          <div className="p-3 border-b border-slate-200/80 flex items-center justify-between sticky top-0 bg-inherit rounded-t-xl z-10">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${col.headerColorClass || 'bg-primary'}`} />
              <h4 className="text-xs font-bold text-slate-800 tracking-tight">{col.title}</h4>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shadow-2xs">
              {col.badge !== undefined ? col.badge : col.items.length}
            </span>
          </div>

          {/* Danh sách thẻ */}
          <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-[140px]">
            {col.items.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                <span className="material-symbols-outlined text-xl mb-1 opacity-40">inbox</span>
                <span>{emptyText}</span>
              </div>
            ) : (
              col.items.map((item) => (
                <div key={keyExtractor(item)}>
                  {renderCard(item, col.id)}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
