import React from 'react';

interface ResponsiveListLayoutProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ResponsiveListLayout: React.FC<ResponsiveListLayoutProps> = ({
  isLoading,
  isEmpty,
  emptyIcon = 'inbox',
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription,
  emptyAction,
  children,
  className = '',
}) => {
  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <span className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent mb-3" />
        <span className="text-xs font-semibold text-slate-500">Đang tải dữ liệu...</span>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="py-16 px-4 flex flex-col items-center justify-center text-center bg-white border border-slate-200 rounded-xl shadow-2xs">
        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">{emptyIcon}</span>
        <h3 className="text-sm font-bold text-slate-700">{emptyTitle}</h3>
        {emptyDescription && (
          <p className="text-xs text-slate-500 mt-1 max-w-sm">{emptyDescription}</p>
        )}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
};
