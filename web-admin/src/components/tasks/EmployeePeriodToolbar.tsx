import React from 'react';
import { CustomSelect } from '../common/CustomSelect';
import { TimePeriodType } from '../../utils/taskPeriodFilter';

export interface EmployeePeriodToolbarProps {
  // Bộ lọc Nhân sự
  engineers: Array<{ id: string; name: string; code?: string }>;
  selectedEmployeeId: string; // 'all' hoặc id nhân sự
  onEmployeeChange: (id: string) => void;

  // Bộ lọc Thời gian
  periodType: TimePeriodType;
  onPeriodChange: (type: TimePeriodType) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomRangeChange?: (startDate: string, endDate: string) => void;

  // Tùy chọn hiển thị
  showStatusFilter?: boolean;
  statusFilter?: 'all' | 'in_progress' | 'completed';
  onStatusFilterChange?: (status: 'all' | 'in_progress' | 'completed') => void;

  // Compact layout (dành cho modal hoặc màn hình hẹp)
  compact?: boolean;
}

export const EmployeePeriodToolbar: React.FC<EmployeePeriodToolbarProps> = ({
  engineers,
  selectedEmployeeId,
  onEmployeeChange,
  periodType,
  onPeriodChange,
  customStartDate = '',
  customEndDate = '',
  onCustomRangeChange,
  showStatusFilter = false,
  statusFilter = 'all',
  onStatusFilterChange,
  compact = false
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>
      {/* 1. Dropdown Chọn Nhân viên */}
      <div className="shrink-0 w-48 sm:w-56 min-w-0">
        <CustomSelect
          value={selectedEmployeeId}
          onChange={(e: any) => onEmployeeChange(e.target.value)}
          searchable={true}
          className="w-full h-[32px] text-xs font-semibold bg-white border-slate-200"
        >
          <option value="all">Tất cả Nhân viên</option>
          {engineers.map((eng) => (
            <option key={eng.id} value={eng.id}>
              {eng.name} {eng.code ? `(${eng.code})` : ''}
            </option>
          ))}
        </CustomSelect>
      </div>

      {/* 2. Tabs chuyển nhanh Thời gian: Hôm nay | Tháng này | Quý này | Tất cả */}
      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0 gap-0.5">
        <button
          type="button"
          onClick={() => onPeriodChange('all')}
          className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            periodType === 'all'
              ? 'bg-white text-primary shadow-xs ring-1 ring-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Tất cả
        </button>
        <button
          type="button"
          onClick={() => onPeriodChange('today')}
          className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            periodType === 'today'
              ? 'bg-white text-primary shadow-xs ring-1 ring-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Hôm nay
        </button>
        <button
          type="button"
          onClick={() => onPeriodChange('this_month')}
          className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            periodType === 'this_month'
              ? 'bg-white text-primary shadow-xs ring-1 ring-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Tháng này
        </button>
        <button
          type="button"
          onClick={() => onPeriodChange('this_quarter')}
          className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            periodType === 'this_quarter'
              ? 'bg-white text-primary shadow-xs ring-1 ring-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Quý này
        </button>
        <button
          type="button"
          onClick={() => onPeriodChange('custom')}
          className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            periodType === 'custom'
              ? 'bg-white text-primary shadow-xs ring-1 ring-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Tùy chọn
        </button>
      </div>

      {/* Tùy chọn dải ngày nếu periodType === 'custom' */}
      {periodType === 'custom' && onCustomRangeChange && (
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 h-[32px] text-xs shrink-0 shadow-2xs">
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => onCustomRangeChange(e.target.value, customEndDate)}
            className="border-0 p-0 text-[11px] font-medium text-slate-700 outline-none bg-transparent cursor-pointer"
          />
          <span className="text-slate-400 font-bold">→</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => onCustomRangeChange(customStartDate, e.target.value)}
            className="border-0 p-0 text-[11px] font-medium text-slate-700 outline-none bg-transparent cursor-pointer"
          />
        </div>
      )}

      {/* 3. Bộ lọc Trạng thái: Tất cả | Đang làm | Đã hoàn thành (nếu bật showStatusFilter) */}
      {showStatusFilter && onStatusFilterChange && (
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0 gap-0.5">
          <button
            type="button"
            onClick={() => onStatusFilterChange('all')}
            className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-white text-primary shadow-xs ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange('in_progress')}
            className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'in_progress'
                ? 'bg-white text-amber-700 shadow-xs ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang làm
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange('completed')}
            className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã hoàn thành
          </button>
        </div>
      )}
    </div>
  );
};
