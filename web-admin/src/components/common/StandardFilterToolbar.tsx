import React, { useState, useEffect, ReactNode } from 'react';
import { CustomSelect } from './CustomSelect';

export interface FilterSelectOption {
  value: string | undefined;
  label: string | undefined;
}

export interface FilterSelectConfig {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[] | string[];
  placeholder?: string;
  minWidth?: string;
  maxWidth?: string;
}

export interface DateRangeFilterConfig {
  label: string;
  fromDate: string;
  toDate: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

export interface StandardFilterToolbarProps {
  /** Bộ lọc dạng Combobox/Select bên trái */
  selectFilters?: FilterSelectConfig[];
  /** Bộ lọc khoảng ngày (Từ - Đến) */
  dateRange?: DateRangeFilterConfig;
  /** Giá trị ô tìm kiếm nhanh */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  /** Nút reset toàn bộ bộ lọc */
  onResetFilters?: () => void;
  /** Hiển thị tổng số kết quả sau lọc */
  totalCount?: number;
  totalCountLabel?: string;
  /** Nút khôi phục độ rộng cột mặc định (khi bảng bật resize) */
  onResetColumnWidths?: () => void;
  /** Các nút hành động nghiệp vụ bổ sung (VD: Thêm đầu mục, Yêu cầu...) */
  actionButtons?: ReactNode;
  /** Dropdown Nhập/Xuất file nếu có */
  importExportComponent?: ReactNode;
  /** Custom extra filter elements */
  children?: ReactNode;
  className?: string;
}

export const StandardFilterToolbar: React.FC<StandardFilterToolbarProps> = ({
  selectFilters = [],
  dateRange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  onResetFilters,
  totalCount,
  totalCountLabel = 'kết quả',
  onResetColumnWidths,
  actionButtons,
  importExportComponent,
  children,
  className = '',
}) => {
  // Kiểm tra xem có điều kiện lọc nào đang khác mặc định không
  const hasActiveFilters =
    selectFilters.some((f) => f.value && f.value !== 'all' && f.value !== '') ||
    (dateRange && (dateRange.fromDate || dateRange.toDate)) ||
    (searchQuery && searchQuery.trim().length > 0);

  return (
    <div
      className={`bg-white border-b border-slate-200 px-3 py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 text-xs select-none ${className}`}
    >
      {/* KHU VỰC BÊN TRÁI: CÁC BỘ LỌC NGHIỆP VỤ & NGÀY THÁNG (CÓ THANH CUỘN NGANG VỚI TAY KÉO RÕ RÀNG) */}
      <div className="flex items-center gap-2 overflow-x-auto table-scrollbar custom-scrollbar pb-1.5 pt-0.5 flex-nowrap shrink min-w-0">
        {/* Biểu tượng Lọc + Tổng số kết quả */}
        <div className="flex items-center gap-1 text-slate-500 shrink-0 font-medium mr-0.5">
          <span className="material-symbols-outlined text-[16px] text-slate-400">filter_list</span>
          {typeof totalCount === 'number' && (
            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-600 whitespace-nowrap">
              {totalCount} {totalCountLabel}
            </span>
          )}
        </div>

        {/* Các dropdown combobox bộ lọc */}
        {selectFilters.map((filter) => {
          const formattedOptions: FilterSelectOption[] = filter.options.map((opt) =>
            typeof opt === 'string'
              ? { value: opt, label: opt === 'all' ? 'Tất cả' : opt }
              : opt
          );

          return (
            <div key={filter.id} className="flex items-center gap-1 shrink-0">
              <span className="text-slate-500 font-medium whitespace-nowrap text-[11px]">
                {filter.label}:
              </span>
              <CustomSelect
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className={`${filter.minWidth || 'min-w-[65px]'} ${
                  filter.maxWidth || 'max-w-[120px]'
                } border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs h-7`}
              >
                {formattedOptions.map((opt) => {
                  let display = opt.label;
                  if (display && display.length > 25) display = display.slice(0, 25) + '...';
                  return (
                    <option key={opt.value} value={opt.value}>
                      {display}
                    </option>
                  );
                })}
              </CustomSelect>
            </div>
          );
        })}

        {/* Bộ lọc khoảng ngày (nếu có) */}
        {dateRange && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-slate-500 font-medium whitespace-nowrap text-[11px]">
              {dateRange.label}:
            </span>
            <div className="flex items-center gap-1 border border-slate-200 rounded px-1.5 py-0.5 bg-white shadow-2xs h-7">
              <span className="text-slate-400 font-medium whitespace-nowrap text-[10.5px]">Từ</span>
              <input
                type="date"
                value={dateRange.fromDate}
                onChange={(e) => dateRange.onFromChange(e.target.value)}
                className="bg-transparent border-none outline-none text-[11px] w-[92px] text-slate-700 cursor-pointer"
              />
              <span className="text-slate-300">|</span>
              <span className="text-slate-400 font-medium whitespace-nowrap text-[10.5px]">Đến</span>
              <input
                type="date"
                value={dateRange.toDate}
                onChange={(e) => dateRange.onToChange(e.target.value)}
                className="bg-transparent border-none outline-none text-[11px] w-[92px] text-slate-700 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Nút Xóa bộ lọc (khi có bộ lọc được kích hoạt) */}
        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Xóa tất cả điều kiện lọc và tìm kiếm"
          >
            <span className="material-symbols-outlined text-[13px]">filter_alt_off</span>
            <span>Xóa lọc</span>
          </button>
        )}

        {children}
      </div>

      {/* KHU VỰC BÊN PHẢI: TÌM KIẾM NHANH + NÚT THAO TÁC + IMPORT/EXPORT */}
      <div className="flex items-center gap-1.5 md:ml-auto shrink-0 flex-nowrap justify-end">
        {/* Ô tìm kiếm nhanh */}
        {onSearchChange && (
          <div className="relative w-36 sm:w-44 lg:w-48 h-8 flex items-center shrink-0">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-8 pl-8 pr-6 bg-slate-100 border-none rounded text-xs focus:ring-1 focus:ring-primary focus:bg-white transition-all outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            )}
          </div>
        )}

        {/* Các nút hành động riêng */}
        {actionButtons}

        {/* Dropdown Nhập / Xuất file */}
        {importExportComponent}
      </div>
    </div>
  );
};
