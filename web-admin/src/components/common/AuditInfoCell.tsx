import React, { useState } from 'react';
import { useRealtimeStore } from '../../services/realtimeStore';
import { Modal } from './Modal';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/apiSupabase';

export const formatAuditDateTime = (isoString?: string): string => {
  if (!isoString || typeof isoString !== 'string') return '';
  const str = isoString.trim();
  if (!str) return '';
  if (/^\d{1,2}:\d{2}\s+\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    return str;
  }
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${timeStr} ${dateStr}`;
  } catch {
    return str;
  }
};

export const parseAuditTime = (str?: string): number => {
  if (!str || typeof str !== 'string') return 0;
  const trimmed = str.trim();
  if (!trimmed) return 0;

  const vnMatch = trimmed.match(/(?:(\d{1,2}):(\d{2})(?::\d{2})?\s+)?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (vnMatch) {
    const [, hh = '0', mm = '0', d, m, y] = vnMatch;
    const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  const isoMs = new Date(trimmed).getTime();
  return isNaN(isoMs) ? 0 : isoMs;
};

const getActionBadge = (action: string) => {
  const clean = action.toLowerCase();
  if (clean.includes('checkintime') || clean.includes('chấm công') || clean.includes('điểm danh')) {
    return { icon: 'fingerprint', color: 'text-purple-700 bg-purple-50 border-purple-200' };
  }
  if (clean.includes('nghiệm thu') || clean.includes('hoàn thành')) {
    return { icon: 'verified', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  if (clean.includes('giao công việc') || clean.includes('giao việc') || clean.includes('phân công')) {
    return { icon: 'assignment_ind', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  }
  if (clean.includes('nhận việc') || clean.includes('xác nhận')) {
    return { icon: 'task_alt', color: 'text-teal-700 bg-teal-50 border-teal-200' };
  }
  if (clean.includes('thắc mắc') || clean.includes('trao đổi')) {
    return { icon: 'help_center', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  if (clean.includes('xóa') || clean.includes('hủy')) {
    return { icon: 'cancel', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  }
  if (clean.includes('cấp quỹ') || clean.includes('unc') || clean.includes('tạm ứng')) {
    return { icon: 'payments', color: 'text-purple-700 bg-purple-50 border-purple-200' };
  }
  return { icon: 'edit_note', color: 'text-slate-600 bg-slate-100 border-slate-200' };
};

/**
 * Từ action text + projectCode → tạo URL navigate tới nguồn gốc thông báo.
 * Trả về null nếu không xác định được.
 */
export const getLogNavigatePath = (action: string, projectCode?: string): string | null => {
  if (!action) return null;
  const a = action.toLowerCase();

  // Helper: trích tên task trong ngoặc kép
  const extractQuoted = (str: string): string => {
    const m = str.match(/["""](.*?)["""]/);
    return m ? m[1] : '';
  };
  const taskName = extractQuoted(action);
  // Một số nhật ký không đặt tên hạng mục trong dấu ngoặc kép mà ghi sau dấu
  // hai chấm, ví dụ: "Cập nhật Mua hàng nhà thầu: Cáp đồng bọc 2x4mm2".
  const colonItem = action.includes(':')
    ? action.substring(action.indexOf(':') + 1).trim()
    : '';
  const referencedItem = taskName || colonItem;

  // Link tới task cụ thể
  const isTaskAction =
    a.includes('công việc') || a.includes('hạng mục') ||
    a.includes('nghiệm thu') || a.includes('giao việc') ||
    a.includes('nhận việc') || a.includes('phân công') ||
    a.includes('thắc mắc') || a.includes('trao đổi') || a.includes('phản hồi');

  // Các cập nhật mua hàng nhà thầu/vật tư trong bảng dự án thực chất gắn với
  // một dòng công việc. Mở tab Tiến độ và highlight đúng dòng đó để người
  // dùng nhìn thấy ngay nội dung vừa thay đổi.
  const isTaskMaterialUpdate =
    (a.includes('mua hàng nhà thầu') || a.includes('mua sắm hàng hóa')) &&
    Boolean(referencedItem);
  if (isTaskMaterialUpdate && projectCode) {
    return `/projects/${encodeURIComponent(projectCode)}/tasks?highlight=${encodeURIComponent(referencedItem)}`;
  }

  if (isTaskAction && projectCode && referencedItem) {
    return `/projects/${encodeURIComponent(projectCode)}/tasks?highlight=${encodeURIComponent(referencedItem)}`;
  }
  if (isTaskAction && projectCode) {
    return `/projects/${encodeURIComponent(projectCode)}/tasks`;
  }

  // Link tới tab Vật tư & Chi phí, chọn đúng nhóm theo nội dung nhật ký
  if (a.includes('mua hàng nhà thầu') || a.includes('mua hàng') || a.includes('mua sắm') || a.includes('nhà thầu') || a.includes('vật tư') || a.includes('kế hoạch vật tư')) {
    if (projectCode) return `/projects/${encodeURIComponent(projectCode)}/cost-plan?tab=TECH`;
  }
  // Nếu là nhật ký liên quan đến Cấp quỹ / Tạm ứng / Chuyển khoản / UNC / Xác nhận nhận tiền -> Mở thẳng popup danh sách Duyệt cấp quỹ
  if (a.includes('cấp quỹ') || a.includes('tạm ứng') || a.includes('chuyển khoản') || a.includes('unc') || a.includes('nhận tiền')) {
    if (projectCode && projectCode !== 'COMPANY' && projectCode !== 'Hệ thống') {
      return `/projects/${encodeURIComponent(projectCode)}/cost-plan?tab=EXPENSE&openFundRequests=true`;
    }
    return `/cost-plan?tab=EXPENSE&openFundRequests=true`;
  }
  if (a.includes('chi phí') || a.includes('phiếu chi') || a.includes('thanh toán')) {
    if (projectCode) return `/projects/${encodeURIComponent(projectCode)}/cost-plan?tab=EXPENSE`;
  }

  // Link tới hồ sơ
  if (a.includes('hồ sơ') || a.includes('tài liệu') || a.includes('văn bản')) {
    if (projectCode) return `/projects/${encodeURIComponent(projectCode)}/documents`;
  }

  // Link tới nhật ký hiện trường
  if (a.includes('hiện trường') || a.includes('nhật ký') || a.includes('field log')) {
    if (projectCode) return `/projects/${encodeURIComponent(projectCode)}/field-logs`;
  }

  // Link tới kho dự án (Kiểm tra từ riêng biệt để tránh trùng với 'chuyển khoản', 'khóa', 'khoản'...)
  const isKhoAction = /(?:^|[^\p{L}\p{N}])(kho|tồn\s*kho|nhập\s*kho|xuất\s*kho|inventory)(?:[^\p{L}\p{N}]|$)/iu.test(a);
  if (isKhoAction) {
    if (projectCode) return `/projects/${encodeURIComponent(projectCode)}/inventory`;
  }

  // Link tới tổng quan dự án (cập nhật thông tin dự án)
  if (projectCode && (a.includes('dự án') || a.includes('tổng quan') || a.includes('thông tin dự án'))) {
    return `/projects/${encodeURIComponent(projectCode)}/overview`;
  }

  // Fallback: overview
  if (projectCode) return `/projects/${encodeURIComponent(projectCode)}/overview`;
  return null;
};

const cleanDisplayNotes = (val: string) => {
  return String(val || '')
    .replace(/\[tech-status:[^\]]+\]/gi, '')
    .replace(/\[FOLLOWERS:[^\]]+\]/gi, '')
    .replace(/\[ASSIGNER:[^\]]+\]/gi, '')
    .replace(/\[order:[\d.]+\]/gi, '')
    .replace(/\[section\]/gi, '')
    .replace(/\[contractor\]/gi, '')
    .replace(/\[owner\]/gi, '')
    .replace(/\[STATUS:[^\]]+\]/gi, '')
    .replace(/\[DOC-DATA\]/gi, '')
    .replace(/\[DOC-NOTE\]/gi, '')
    .replace(/\[DOC-FILENAME\]/gi, '')
    .replace(/\[THREAD:[^\]]+\]/gi, '')
    .replace(/Nhà thầu cung cấp/gi, '')
    .replace(/Chủ đầu tư cung cấp/gi, '')
    .replace(/Import từ phụ lục dự án/gi, '')
    .replace(/Đồng bộ từ phụ lục khi tạo dự án/gi, '')
    .trim();
};

const renderChangeBadge = (val: string, type: 'before' | 'after') => {
  if (!val || val === '—' || val === '(trống)') return <span className="text-slate-400 italic font-normal">Chưa có</span>;
  const clean = val.toLowerCase().trim();

  // Nhóm trạng thái cần làm / chưa làm / tồn đọng (tạo nên số thông báo dự án)
  if (clean === 'chưa làm' || clean.includes('chưa làm')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
        {val}
      </span>
    );
  }
  if (clean === 'chờ nhận việc' || clean.includes('chờ nhận việc')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-300 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        {val}
      </span>
    );
  }
  if (clean === 'chờ nghiệm thu' || clean.includes('chờ nghiệm thu')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-300 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
        {val}
      </span>
    );
  }
  if (clean === 'có thắc mắc' || clean.includes('thắc mắc') || clean.includes('vướng mắc')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-400 shadow-2xs">
        <span className="material-symbols-outlined text-[12px] text-amber-700">warning</span>
        {val}
      </span>
    );
  }
  if (clean === 'hoàn thành' || clean.includes('đã hoàn thành') || clean.includes('đáp ứng') || clean === 'đã có hàng') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
        <span className="material-symbols-outlined text-[12px] text-emerald-600">check_circle</span>
        {val}
      </span>
    );
  }
  if (clean === 'đang làm' || clean.includes('đang thi công') || clean === 'in progress') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-300 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
        {val}
      </span>
    );
  }

  // Giá trị thường
  return (
    <span className={type === 'before' ? 'text-rose-700 font-medium' : 'text-slate-800 font-semibold'}>
      {val}
    </span>
  );
};

const formatAuditDetail = (value: string): string => {
  return String(value || '')
    .replace(/,?\s*Ghi chú\s*:\s*(?:"[^"]*"\s*[-=]+>\s*)?\[tech-status:[^\]]+\]/gi, '')
    .replace(/\[tech-status:[^\]]+\]/gi, '')
    .replace(/\[FOLLOWERS:[^\]]+\]/gi, '')
    .replace(/\[ASSIGNER:[^\]]+\]/gi, '')
    .replace(/\[THREAD:[^\]]+\]/gi, '')
    .replace(/,?\s*Người thực hiện\s*:\s*"[^"]*"\s*[-=]+>\s*"[0-9a-f-]{20,}"/gi, '')
    .replace(/,?\s*assignerId\s*:\s*"[^"]*"\s*[-=]+>\s*"[0-9a-f-]{20,}"/gi, '')
    .replace(/,?\s*assignerName\s*:\s*"[^"]*"\s*[-=]+>\s*"[^"]*"/gi, '')
    .replace(/\bfollowerNames\s*:/gi, 'Người theo dõi:')
    .replace(/\s*,\s*(?=(?:Đầu mục|TT Đặt hàng|Tình trạng kỹ thuật|Ghi chú|Trạng thái|Phân công|Người theo dõi|Tiến độ|Khối lượng|ĐVT)\s*:)/gi, '\n')
    .replace(/\s+-\s+(?=(?:Đầu mục|TT Đặt hàng|Tình trạng kỹ thuật|Ghi chú|Trạng thái|Phân công|Người theo dõi|Tiến độ|Khối lượng|ĐVT)\s*:)/gi, '\n')
    .replace(/\s*\|\s*/g, '\n')
    .trim();
};

const parseAuditChangeRows = (value: string): Array<{ field: string; before: string; after: string }> => {
  const normalized = String(value || '').replace(/\bfollowerNames\s*:/gi, 'Người theo dõi:').replace(/\s+/g, ' ').trim();
  const rows: Array<{ field: string; before: string; after: string }> = [];
  const fieldNames = [
    'TT Đặt hàng', 'Tình trạng kỹ thuật', 'Ghi chú', 'Trạng thái', 'Phân công', 'Người theo dõi',
    'Thi công', 'Tiến độ', 'Khối lượng', 'ĐVT', 'Tên', 'Hạn hoàn thành', 'Vấn đề'
  ].join('|');
  const pattern = new RegExp(`(${fieldNames})\\s*:\\s*["“]?([^"”]+?)["”]?\\s*[-=]+>\\s*["“]?([^"”]+?)["”]?(?=,\\s*(?:${fieldNames})\\s*:|$)`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    rows.push({
      field: match[1].trim(),
      before: match[2].replace(/^"|"$/g, '').split('|')[0].trim(),
      after: match[3].replace(/^"|"$/g, '').split('|')[0].trim(),
    });
  }
  return rows.filter(row => {
    if (row.field.toLowerCase() !== 'ghi chú') return true;
    const combined = `${row.before} ${row.after}`.toLowerCase();
    return Boolean(combined.trim()) && !combined.includes('tech-status') && !combined.includes('[tech-status:');
  });
};

const renderActionText = (text: string, timestamp?: string) => {
  if (!text) return text;

  // Handle JSON action payload (e.g. attendance records or system logs)
  if (text.startsWith('{') && (text.includes('"userId"') || text.includes('"checkInTime"') || text.includes('"action"'))) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.checkInTime || parsed.checkOutTime) {
        const inTime = formatAuditDateTime(parsed.checkInTime);
        const outTime = parsed.checkOutTime ? formatAuditDateTime(parsed.checkOutTime) : '';
        return (
          <div className="leading-snug">
            <span className="font-semibold text-slate-800">Thực hiện chấm công / điểm danh</span>
            <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
              Vào ca: <strong>{inTime}</strong>{outTime ? ` • Ra ca: ${outTime}` : ''}
            </div>
          </div>
        );
      }
      if (parsed.action) {
        text = String(parsed.action);
      } else if (parsed.type || parsed.note) {
        text = `Hoạt động hệ thống: ${parsed.note || parsed.type}`;
      }
    } catch {
      // Fallback to normal string processing if JSON parse fails
    }
  }

  let mainText = text;
  let detailText = '';
  const detailIndex = text.indexOf(' |Detail:');
  if (detailIndex !== -1) {
    mainText = text.substring(0, detailIndex);
    detailText = text.substring(detailIndex + 9);
  }

  // Format detail text sạch sẽ, loại bỏ code metadata
  if (detailText) {
    const parts = detailText.split('->').map(s => s.trim());
    if (parts.length === 2 && detailText.includes('Ghi chú:')) {
      const fromVal = cleanDisplayNotes(parts[0].replace(/^.*Ghi chú:\s*"?/i, '').replace(/"?$/, ''));
      const toVal = cleanDisplayNotes(parts[1].replace(/^"?/, '').replace(/"?$/, ''));
      if (fromVal || toVal) {
        detailText = `Ghi chú: "${fromVal}" → "${toVal}"`;
      } else {
        detailText = '';
      }
    }
  }

  const splitIndex = mainText.indexOf(': ');
  let renderedMain;
  if (splitIndex !== -1) {
    const actionPart = mainText.substring(0, splitIndex + 1);
    const variablePart = mainText.substring(splitIndex + 2);
    renderedMain = (
      <>
        <span>{actionPart}</span> <strong className="font-bold text-slate-900">{variablePart}</strong>
      </>
    );
  } else {
    renderedMain = <>{mainText}</>;
  }

  return (
    <div className="leading-snug">
      <div>{renderedMain}</div>
      {detailText ? (
        <details
          className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white text-[11px] font-sans shadow-2xs"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-slate-500">difference</span>
              Xem chi tiết thay đổi
            </span>
            <span className="material-symbols-outlined text-[15px] text-slate-400">expand_more</span>
          </summary>
          <div className="border-t border-slate-200 bg-slate-50 px-2.5 py-2 text-slate-600">
            {parseAuditChangeRows(detailText).length > 0 ? (
              <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                <table className="w-full min-w-[520px] border-collapse text-[10.5px]">
                  <thead className="bg-slate-100 text-left text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-2 py-1.5">Nội dung</th>
                      <th className="border-b border-slate-200 px-2 py-1.5">Trước đây</th>
                      <th className="border-b border-slate-200 px-2 py-1.5">Sau khi cập nhật</th>
                      <th className="border-b border-slate-200 px-2 py-1.5 whitespace-nowrap">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseAuditChangeRows(detailText).map((row, index) => (
                      <tr key={`${row.field}-${index}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors">
                        <td className="px-2.5 py-1.5 font-semibold text-slate-700 whitespace-nowrap">{row.field}</td>
                        <td className="px-2.5 py-1.5">{renderChangeBadge(row.before, 'before')}</td>
                        <td className="px-2.5 py-1.5">{renderChangeBadge(row.after, 'after')}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-500 font-mono text-[10px]">{formatAuditDateTime(timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="whitespace-pre-line leading-relaxed">{formatAuditDetail(detailText)}</div>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
};

interface AuditUserLogItem {
  action: string;
  timestamp: string;
  rawTimeMs: number;
}

interface AuditUserInfo {
  name: string;
  count: number;
  lastTime: string;
  rawTimeMs: number;
  title?: string;
  logs: AuditUserLogItem[];
}

export const AuditInfoCell: React.FC<{ 
  updatedBy?: string; 
  updatedAt?: string; 
  projectCode?: string; 
  itemTitle?: string;
  taskDiscussions?: Array<{ senderName: string; senderRole?: string; type: string; content: string; createdAt: string }>;
  className?: string;
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
  hideTrigger?: boolean;
}> = ({
  updatedBy,
  updatedAt,
  projectCode,
  itemTitle,
  taskDiscussions,
  className = '',
  forceOpen,
  onForceOpenHandled,
  hideTrigger = false,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [scopedLogs, setScopedLogs] = useState<any[] | null>(null);
  const navigate = useNavigate();

  // Mở modal khi forceOpen thay đổi sang true (từ nút chuông bên ngoài)
  React.useEffect(() => {
    if (forceOpen) {
      setShowModal(true);
      onForceOpenHandled?.();
    }
  }, [forceOpen]);
  React.useEffect(() => {
    if (!showModal || !projectCode) return;
    let cancelled = false;
    api.activityLogs.getAll(projectCode).then((logs: any[]) => {
      if (!cancelled) setScopedLogs(logs);
    }).catch(() => { if (!cancelled) setScopedLogs([]); });
    return () => { cancelled = true; };
  }, [showModal, projectCode]);
  const [expandedUser, setExpandedUser] = useState<Record<string, boolean>>({});
  const activityLogs = useRealtimeStore(s => s.activityLogs);
  const engineers = useRealtimeStore(s => s.engineers);
  const projects = useRealtimeStore(s => s.projects);

  const formattedTime = formatAuditDateTime(updatedAt);
  const isSystemOrEmpty = !updatedBy || updatedBy.trim() === '';

  const toggleExpand = (userName: string) => {
    setExpandedUser(prev => ({ ...prev, [userName]: !prev[userName] }));
  };

  const userList = React.useMemo(() => {
    if (!showModal) return [];
    const map = new Map<string, AuditUserInfo>();

    const normalizeUser = (nameStr?: string): string => {
      const trimmed = String(nameStr || '').trim();
      if (!trimmed) return '';
      if (trimmed.toLowerCase() === 'admin' || trimmed.toLowerCase() === 'quản trị hệ thống') {
        return 'Quản trị hệ thống';
      }
      return trimmed;
    };

    const cleanItemTitle = (itemTitle || '').trim().toLowerCase();

    // 1. Tích hợp dòng thảo luận / thắc mắc / giao việc từ taskDiscussions (nếu có)
    if (taskDiscussions && taskDiscussions.length > 0) {
      taskDiscussions.forEach(disc => {
        const u = normalizeUser(disc.senderName || 'Người tham gia');
        const logTimeMs = parseAuditTime(disc.createdAt);
        const displayTime = formatAuditDateTime(disc.createdAt);
        let actionLabel = 'Trao đổi / Thảo luận công việc';
        if (disc.type === 'question') actionLabel = `Thắc mắc: "${disc.content}"`;
        else if (disc.type === 'reply') actionLabel = `Phản hồi hướng dẫn: "${disc.content}"`;
        else if (disc.type === 'assign_note') actionLabel = `Ghi chú giao việc: "${disc.content}"`;
        else if (disc.type === 'system' || disc.content.toLowerCase().includes('nghiệm thu') || disc.content.toLowerCase().includes('hoàn thành') || disc.content.toLowerCase().includes('nhận việc')) {
          actionLabel = disc.content;
        } else {
          actionLabel = `Ghi chú: "${disc.content}"`;
        }

        if (!map.has(u)) {
          const eng = (engineers || []).find(e => e?.name?.toLowerCase() === u.toLowerCase());
          const title = u === 'Quản trị hệ thống' ? 'Chủ tịch / Admin' : (disc.senderRole || eng?.title);
          map.set(u, {
            name: u,
            count: 1,
            lastTime: displayTime,
            rawTimeMs: logTimeMs,
            title,
            logs: [{ action: actionLabel, timestamp: disc.createdAt, rawTimeMs: logTimeMs }]
          });
        } else {
          const existing = map.get(u)!;
          existing.count += 1;
          if (logTimeMs > existing.rawTimeMs) {
            existing.rawTimeMs = logTimeMs;
            existing.lastTime = displayTime;
          }
          if (!existing.logs.some(l => l.action === actionLabel && l.timestamp === disc.createdAt)) {
            existing.logs.push({ action: actionLabel, timestamp: disc.createdAt, rawTimeMs: logTimeMs });
          }
        }
      });
    }

    // 2. Lọc activityLogs theo dự án và tên hạng mục (nếu có)
    // Gộp cả scopedLogs từ server và activityLogs từ store để hiển thị tức thì mọi hành động vừa diễn ra
    const rawCombinedLogs = [...(scopedLogs || []), ...(activityLogs || [])];
    const seenLogKeys = new Set<string>();
    const sourceLogs = rawCombinedLogs.filter(log => {
      if (!log) return false;
      const key = `${log.id || ''}:::${log.action || ''}:::${log.timestamp || ''}`;
      if (seenLogKeys.has(key)) return false;
      seenLogKeys.add(key);
      return true;
    });
    const filteredLogs = sourceLogs.filter(log => {
      if (!log) return false;
      const logAction = String(log.action || '').toLowerCase();

      // Nếu có tên công việc / hạng mục cụ thể (itemTitle), ưu tiên khớp đúng công việc này
      if (cleanItemTitle && cleanItemTitle.length >= 3) {
        if (logAction.includes(cleanItemTitle)) {
          return true;
        }
      }

      // Khớp theo mã dự án
      if (projectCode) {
        const logProj = String(log.project || '').trim().toLowerCase();
        const pCode = String(projectCode).trim().toLowerCase();
        let isProjectMatch = logProj === pCode;
        if (!isProjectMatch) {
          const matchedProj = projects.find(p => p.code?.toLowerCase() === pCode || p.id?.toLowerCase() === pCode);
          if (matchedProj && matchedProj.name) {
            isProjectMatch = logProj === matchedProj.name.trim().toLowerCase();
          }
        }
        if (!isProjectMatch) return false;

        // Nếu có itemTitle mà log không chứa itemTitle và là loại log cụ thể khác, bỏ qua để tránh nhiễm log vật tư / công việc khác
        if (cleanItemTitle && cleanItemTitle.length >= 3) {
          // Bỏ qua các log chứa tên công việc khác
          if (logAction.includes('kế hoạch vật tư') || logAction.includes('mua sắm') || logAction.includes('vật tư:')) {
            return false;
          }
        }
        return true;
      }

      // Nếu không có cả projectCode lẫn itemTitle khớp thì chỉ lấy log chung
      return !projectCode && !cleanItemTitle;
    });

    filteredLogs.forEach(log => {
      const rawUser = String(log.user || '').trim();
      if (!rawUser || rawUser === 'Excel Sync' || rawUser.toLowerCase().includes('excel')) return;
      const u = normalizeUser(rawUser);
      const logTimeMs = parseAuditTime(log.timestamp);
      const displayTime = formatAuditDateTime(log.timestamp);
      const actionText = String(log.action || '').trim() || 'Cập nhật thông tin trên hệ thống';
      const actionMain = actionText.split(' |Detail:')[0].trim();
      const itemPart = actionMain.includes(':')
        ? actionMain.substring(actionMain.indexOf(':') + 1).trim().toLowerCase()
        : actionMain.toLowerCase();
      const timeBucket = logTimeMs ? Math.floor(logTimeMs / 60000) : actionText;
      const mergeKey = `${timeBucket}:::${itemPart}`;

      if (!map.has(u)) {
        const eng = (engineers || []).find(e => e?.name?.toLowerCase() === u.toLowerCase());
        const title = u === 'Quản trị hệ thống' ? 'Chủ tịch / Admin' : eng?.title;
        map.set(u, {
          name: u,
          count: 1,
          lastTime: displayTime,
          rawTimeMs: logTimeMs,
          title,
          logs: [{ action: actionText, timestamp: log.timestamp, rawTimeMs: logTimeMs, mergeKey } as any]
        });
      } else {
        const existing = map.get(u)!;
        existing.count += 1;
        if (logTimeMs > existing.rawTimeMs) {
          existing.rawTimeMs = logTimeMs;
          existing.lastTime = displayTime;
        }
        const sameHistory = (existing.logs as any[]).find(l =>
          l.mergeKey === mergeKey || (l.action === actionText && l.timestamp === log.timestamp)
        );
        if (sameHistory) {
          const incomingDetail = actionText.split(' |Detail:')[1]?.trim();
          const currentDetail = String(sameHistory.action).split(' |Detail:')[1]?.trim();
          if (incomingDetail && incomingDetail !== currentDetail && !String(currentDetail || '').includes(incomingDetail)) {
            sameHistory.action = `${String(sameHistory.action).split(' |Detail:')[0]} |Detail:${currentDetail ? `${currentDetail}; ${incomingDetail}` : incomingDetail}`;
          }
        } else {
          existing.logs.push({ action: actionText, timestamp: log.timestamp, rawTimeMs: logTimeMs, mergeKey } as any);
        }
      }
    });

    // 3. Đảm bảo người cập nhật gần nhất của dòng (updatedBy) luôn có mặt
    const currentMs = parseAuditTime(updatedAt);
    if (updatedBy && updatedBy !== 'Excel Sync' && !updatedBy.toLowerCase().includes('excel')) {
      const u = normalizeUser(updatedBy);
      if (!map.has(u)) {
        const eng = (engineers || []).find(e => e?.name?.toLowerCase() === u.toLowerCase());
        const title = u === 'Quản trị hệ thống' ? 'Chủ tịch / Admin' : eng?.title;
        map.set(u, {
          name: u,
          count: 1,
          lastTime: formattedTime,
          rawTimeMs: currentMs,
          title,
          logs: [{ action: itemTitle ? `Cập nhật thông tin công việc: "${itemTitle}"` : 'Cập nhật thông tin trên hệ thống', timestamp: updatedAt || '', rawTimeMs: currentMs }]
        });
      } else {
        const existing = map.get(u)!;
        if (currentMs > existing.rawTimeMs) {
          existing.rawTimeMs = currentMs;
          existing.lastTime = formattedTime;
        }
        if (existing.logs.length === 0) {
          existing.logs.push({ action: itemTitle ? `Cập nhật thông tin công việc: "${itemTitle}"` : 'Cập nhật thông tin trên hệ thống', timestamp: updatedAt || '', rawTimeMs: currentMs });
        }
      }
    }

    // Sort logs inside each user by rawTimeMs descending
    const currentNorm = normalizeUser(updatedBy);
    return Array.from(map.values()).map(u => ({
      ...u,
      count: u.logs.length,
      logs: u.logs.sort((a, b) => b.rawTimeMs - a.rawTimeMs)
    })).sort((a, b) => {
      if (currentNorm && a.name.toLowerCase() === currentNorm.toLowerCase()) return -1;
      if (currentNorm && b.name.toLowerCase() === currentNorm.toLowerCase()) return 1;
      return b.rawTimeMs - a.rawTimeMs;
    });
  }, [showModal, activityLogs, scopedLogs, engineers, updatedBy, updatedAt, formattedTime, projectCode, itemTitle, taskDiscussions]);

  // Khi được mở từ nút chuông dự án (hideTrigger + forceOpen), vẫn phải
  // dựng Modal kể cả khi dòng cập nhật tổng quan của dự án đang trống.
  if (isSystemOrEmpty && !formattedTime && !hideTrigger && !forceOpen) {
    return <div className="text-center w-full"><span className="text-slate-300 italic text-[10px]">-</span></div>;
  }

  if (isSystemOrEmpty && !hideTrigger && !forceOpen) {
    return <div className="text-center w-full"><span className="text-slate-300 italic text-[10px]">-</span></div>;
  }

  return (
    <>
      {!hideTrigger && <div 
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        title={`Click để xem danh sách người cập nhật và lịch sử chi tiết`}
        className={`flex flex-col items-center justify-center text-center text-[10px] leading-tight w-full cursor-pointer hover:bg-slate-100/80 p-1 rounded transition-colors group/audit ${className}`}
      >
        <span className="font-bold text-slate-700 truncate w-full group-hover/audit:text-primary underline decoration-dotted decoration-slate-300 underline-offset-2">
          {updatedBy}
        </span>
        {formattedTime && (
          <span className="text-slate-400 font-mono text-[9px] mt-0.5" title={formattedTime}>
            {formattedTime}
          </span>
        )}
      </div>}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Danh sách người cập nhật & Lịch sử thao tác"
        icon="history"
        size="lg"
      >
        <div className="p-3 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-slate-500 font-medium">
            Chi tiết nhân sự và nhật ký các nội dung cập nhật trên hệ thống:
          </p>

          {userList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs italic">
              Chưa có lịch sử cập nhật.
            </div>
          ) : (
            <div className="space-y-4">
              {userList.map((user, index) => {
                const isLatest = index === 0;
                const isExpanded = Boolean(expandedUser[user.name]);
                const displayedLogs = isExpanded ? user.logs : user.logs.slice(0, 4);
                const hasMore = user.logs.length > 4;

                return (
                  <div 
                    key={user.name} 
                    className={`border rounded-xl overflow-hidden bg-white shadow-xs transition-all ${
                      isLatest ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                    }`}
                  >
                    {/* User Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isLatest ? 'bg-primary text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">{user.name}</span>
                            {isLatest && (
                              <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200 shrink-0">
                                Vừa cập nhật
                              </span>
                            )}
                          </div>
                          {user.title && <p className="text-[10.5px] text-slate-400 truncate mt-0.5">{user.title}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                        {user.lastTime && (
                          <span className="text-[11px] text-slate-600 font-mono font-bold">
                            {user.lastTime}
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-400">
                          Tổng cộng {user.logs.length} nhật ký
                        </span>
                      </div>
                    </div>

                    {/* Table-based Log List to Prevent ANY Text Overlap */}
                    <div className="p-3 bg-white">
                      <div className="overflow-x-auto border border-slate-100 rounded-lg">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50/70 border-b border-slate-100">
                              <th className="py-2 px-3 font-semibold">Nội dung cập nhật</th>
                              <th className="py-2 px-3 font-semibold text-right w-36 whitespace-nowrap">Thời gian</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {displayedLogs.map((log, lIdx) => {
                              const badge = getActionBadge(log.action);
                              return (
                                <tr
                                  key={lIdx}
                                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                  title="Mở nội dung đã phát sinh thông báo"
                                  onClick={() => {
                                    const target = getLogNavigatePath(log.action, projectCode);
                                    if (target) {
                                      setShowModal(false);
                                      navigate(target, { state: { reset: Date.now() } });
                                    }
                                  }}
                                >
                                  <td className="py-2.5 px-3 text-slate-800 text-[11px] align-top">
                                    <div className="flex items-start gap-2">
                                      <span className={`material-symbols-outlined text-[15px] shrink-0 mt-0.5 p-0.5 rounded border ${badge.color}`}>
                                        {badge.icon}
                                      </span>
                                      <div className="min-w-0 flex-1 break-words">
                                        {renderActionText(log.action, log.timestamp)}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-[10.5px] text-slate-500 whitespace-nowrap align-top font-medium">
                                    {formatAuditDateTime(log.timestamp)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {hasMore && (
                        <button
                          onClick={() => toggleExpand(user.name)}
                          className="mt-2.5 text-[11px] font-bold text-primary hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors px-1"
                        >
                          <span>{isExpanded ? 'Thu gọn nhật ký' : `Xem thêm ${user.logs.length - 4} nội dung cập nhật khác...`}</span>
                          <span className="material-symbols-outlined text-[14px]">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowModal(false); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </Modal>
    </>
  );
};
