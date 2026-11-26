import React, { useState } from 'react';

export interface TabOverviewKpi {
  id: string;
  label: string;
  value: number | string;
  subValue?: string;
  active?: boolean;
  onClick?: () => void;
  tone?: 'default' | 'primary' | 'danger' | 'warning' | 'success' | 'info';
}

export interface TabOverviewActionItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: 'danger' | 'warning' | 'info' | 'default';
  onClick?: () => void;
}

export interface TabOverviewProps {
  kpis: TabOverviewKpi[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  chartTitle?: string;
  hasChartData?: boolean;
  chartContent?: React.ReactNode;
  emptyChartText?: string;
  actionTitle?: string;
  actionItems?: TabOverviewActionItem[];
  emptyActionText?: string;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<TabOverviewKpi['tone']>, { value: string; activeBorder: string }> = {
  default: { value: 'text-slate-900', activeBorder: 'border-slate-800 bg-slate-50/80' },
  primary: { value: 'text-blue-900', activeBorder: 'border-blue-900 bg-blue-50/40' },
  danger: { value: 'text-rose-600', activeBorder: 'border-rose-500 bg-rose-50/40' },
  warning: { value: 'text-amber-600', activeBorder: 'border-amber-500 bg-amber-50/40' },
  success: { value: 'text-emerald-600', activeBorder: 'border-emerald-500 bg-emerald-50/40' },
  info: { value: 'text-sky-600', activeBorder: 'border-sky-500 bg-sky-50/40' },
};

export const TabOverview: React.FC<TabOverviewProps> = ({
  kpis,
  loading = false,
  error = null,
  onRetry,
  chartTitle,
  hasChartData = false,
  chartContent,
  emptyChartText = 'Chưa có dữ liệu biểu đồ',
  actionTitle,
  actionItems,
  emptyActionText = 'Không có mục nào cần xử lý ngay',
  className = '',
}) => {
  if (error) {
    return (
      <div className={`border-b border-slate-200 bg-rose-50/50 px-3 py-2 flex items-center justify-between gap-2 text-xs ${className}`}>
        <span className="text-rose-700 font-medium">{error}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 rounded-md border border-rose-300 bg-white text-rose-700 font-semibold hover:bg-rose-50 cursor-pointer"
          >
            Thử lại
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`border-b border-slate-200 bg-white ${className}`}>
      {/* KPI Bar - Thiết kế phẳng, các ô chỉ số gắn kết tinh gọn, viền mảnh, không card trôi nổi */}
      <div className="px-3 py-1.5 flex items-center gap-2 overflow-x-auto custom-scrollbar">
        {(kpis || []).filter(Boolean).slice(0, 5).map((kpi) => {
          const tone = TONE_CLASSES[kpi.tone || 'default'] || TONE_CLASSES.default;
          const clickable = Boolean(kpi.onClick);
          return (
            <button
              key={kpi.id}
              type="button"
              disabled={!clickable}
              onClick={kpi.onClick}
              className={`text-left px-3 py-1 rounded border transition-all shrink-0 ${
                kpi.active
                  ? tone.activeBorder
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 hover:border-slate-300'
              } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="text-[11px] font-semibold text-slate-500 truncate">
                {kpi.label}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-base font-bold tabular-nums ${loading ? 'opacity-50' : ''} ${tone.value}`}>
                  {kpi.value ?? 0}
                </span>
                {kpi.subValue && (
                  <span className="text-[11px] font-medium text-slate-400 truncate">
                    {kpi.subValue}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Biểu đồ mặc định luôn hiển thị trực tiếp nếu tab có cấu hình biểu đồ */}
      {chartContent && (
        <div className="border-t border-slate-100 px-2 pt-1.5 pb-0 bg-slate-50/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {chartTitle || 'Biểu đồ phân tích'}
            </span>
          </div>
          <div className="border-t border-slate-200/70">
            {hasChartData ? (
              chartContent
            ) : (
              <div className="py-4 text-center text-xs text-slate-400">
                {emptyChartText}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Danh sách cảnh báo & việc cần xử lý ngay */}
      {actionItems && (
        <div className="border-t border-slate-200 bg-white px-2 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">
            {actionTitle || 'Cảnh báo & Việc cần xử lý ngay'}
          </div>
          {actionItems.length === 0 ? (
            <div className="text-xs text-slate-400 py-2">{emptyActionText}</div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
              {actionItems.slice(0, 8).map((item) => {
                const badgeCls =
                  item.badgeTone === 'danger'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : item.badgeTone === 'warning'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : item.badgeTone === 'info'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 bg-white hover:bg-slate-50 transition-colors ${
                      item.onClick ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</div>
                      )}
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${badgeCls}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
