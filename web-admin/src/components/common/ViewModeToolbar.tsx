import React from 'react';
import { useUIStore } from '../../services/uiStore';
import { CustomSelect } from './CustomSelect';

export type AppViewMode = 'grid' | 'compact_grid' | 'table' | 'table_detailed' | 'kanban';

export const VIEW_MODE_LABELS: Record<AppViewMode, string> = {
  grid: '⊞ Dạng thẻ',
  compact_grid: '▦ Thẻ thu gọn',
  table: '☰ Bảng gọn',
  table_detailed: '☷ Bảng chi tiết',
  kanban: '▥ Bảng Kanban',
};

export const ALL_VIEW_MODES: AppViewMode[] = ['grid', 'compact_grid', 'table', 'table_detailed', 'kanban'];

/**
 * Fallback chế độ xem nếu tab không hỗ trợ chế độ hiện tại.
 * Quy tắc:
 * - Nếu appViewMode nằm trong supported thì lấy appViewMode.
 * - Nếu appViewMode là kanban mà không có: fallback sang table_detailed -> table -> grid.
 * - Mặc định fallback về mode đầu tiên trong supported.
 */
export function resolveViewMode(
  preferredMode: AppViewMode,
  supportedModes: AppViewMode[]
): AppViewMode {
  if (supportedModes.includes(preferredMode)) return preferredMode;
  if (preferredMode === 'kanban') {
    if (supportedModes.includes('table_detailed')) return 'table_detailed';
    if (supportedModes.includes('table')) return 'table';
  }
  return supportedModes[0] || 'table';
}

interface ViewModeToolbarProps {
  currentMode: AppViewMode;
  onModeChange: (mode: AppViewMode) => void;
  supportedModes?: AppViewMode[];
  className?: string;
}

export const ViewModeToolbar: React.FC<ViewModeToolbarProps> = ({
  currentMode,
  onModeChange,
  supportedModes = ALL_VIEW_MODES,
  className = '',
}) => {
  // Nếu tab chỉ hỗ trợ 1 kiểu duy nhất thì không cần hiển thị combobox
  if (supportedModes.length <= 1) return null;

  return (
    <div className={`inline-flex items-center ${className}`}>
      <CustomSelect
        value={currentMode}
        onChange={(e) => onModeChange(e.target.value as AppViewMode)}
        className="h-[34px] min-w-[135px] sm:min-w-[150px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-2xs outline-none focus:border-primary shrink-0 cursor-pointer"
        title="Chế độ hiển thị danh sách"
      >
        {supportedModes.map((mode) => (
          <option key={mode} value={mode}>
            {VIEW_MODE_LABELS[mode]}
          </option>
        ))}
      </CustomSelect>
    </div>
  );
};
