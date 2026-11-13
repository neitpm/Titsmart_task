import { stripDiscussionThread } from './taskDiscussion';

/**
 * Làm sạch ghi chú:
 * - Loại bỏ các thẻ hệ thống nội bộ: [order:00001], [section], [contractor], [owner], [tech-status:...], [STATUS:...], [FUND_ID:...]
 * - Chuyển đổi định dạng ngày ISO kỹ thuật (2026-11-13T02:54:05.800Z) thành dạng giờ:phút ngày/tháng/năm thân thiện người dùng
 * - Loại bỏ chuỗi tự chèn như: 'Nhà thầu cung cấp', 'Chủ đầu tư cung cấp', 'Import từ phụ lục dự án', 'Đồng bộ từ phụ lục khi tạo dự án'
 * - Nếu không có ghi chú thực tế từ người dùng/file Excel -> trả về chuỗi rỗng ''
 */
export const cleanNotes = (value?: string): string => {
  if (!value) return '';
  let res = stripDiscussionThread(String(value || ''))
    .replace(/\[order:[\d.]+\]/g, '')
    .replace(/\[section\]/gi, '')
    .replace(/\[contractor\]/gi, '')
    .replace(/\[owner\]/gi, '')
    .replace(/\[tech-status:[^\]]+\]/gi, '')
    .replace(/\[STATUS:[^\]]+\]/gi, '')
    .replace(/\[FOLLOWERS:[^\]]*\]/gi, '')
    .replace(/\[ASSIGNER:[^\]]*\]/gi, '')
    .replace(/\[doc-track\]/gi, '')
    .replace(/\[doc-track\s*\]/gi, '')
    .replace(/\[DOC-NOTE\]/gi, '')
    .replace(/\[DOC-DATA\]/gi, '')
    .replace(/\[FUND_ID:[^\]]+\]/gi, '')
    .replace(/Nhà thầu cung cấp/gi, '')
    .replace(/Chủ đầu tư cung cấp/gi, '')
    .replace(/Import từ phụ lục dự án/gi, '')
    .replace(/Đồng bộ từ phụ lục khi tạo dự án/gi, '')
    .split('[DOC-NOTE]')[0]
    .replace(/[\[\]]/g, '')
    .split('|')
    .map(s => s.trim())
    .filter(s => Boolean(s) && !s.startsWith('{') && !s.includes('"senderId"') && s !== ']')
    .join(' | ')
    .trim();

  // Định dạng lại các mốc thời gian ISO kỹ thuật nếu có
  res = res.replace(/lúc\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/gi, (match, iso) => {
    try {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('vi-VN');
        return `lúc ${timeStr} ${dateStr}`;
      }
    } catch {}
    return match;
  });

  return res;
};
