import { Task, isTaskActuallyDone } from '../types';
import { parseTaskDiscussions } from './taskDiscussion';

export type TimePeriodType = 'all' | 'today' | 'this_month' | 'this_quarter' | 'custom';

export interface DateRange {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
}

export interface TaskTimeBounds {
  acceptedDate?: string;  // YYYY-MM-DD (ngày nhận việc / bắt đầu làm)
  completedDate?: string; // YYYY-MM-DD (ngày hoàn thành)
  dueDate?: string;       // YYYY-MM-DD (hạn hoàn thành)
  createdDate?: string;   // YYYY-MM-DD (ngày tạo)
  updatedDate?: string;   // YYYY-MM-DD (ngày cập nhật gần nhất)
}

/**
 * Kiểm tra xem nhân sự có được giao việc (hoặc thực hiện) công việc này không
 */
export function isTaskAssignedToPerson(task: Task, person: any): boolean {
  if (!person || !task || task.isSectionHeader) return false;
  const personId = String(person.id || '').trim().toLowerCase();
  const personUsername = String(person.username || '').trim().toLowerCase();
  const personCode = String(person.code || '').trim().toLowerCase();
  const personName = String(person.name || '').trim().toLowerCase();

  const assignedId = String(task.assignedEngineerId || '').trim().toLowerCase();
  const assignedName = String(task.assignedEngineerName || '').trim().toLowerCase();

  if (personId && assignedId === personId) return true;
  if (personUsername && assignedId === personUsername) return true;
  if (personCode && assignedId === personCode) return true;
  if (personName && assignedName === personName) return true;
  if (personName && assignedName && (assignedName.includes(personName) || personName.includes(assignedName))) return true;

  // Hỗ trợ trường hợp danh sách IDs gộp nhiều người qua dấu gạch đứng (|) hoặc phẩy
  if (personId && (assignedId.includes(personId) || String(task.assignedEngineerName || '').toLowerCase().includes(personId))) return true;

  return false;
}

/**
 * Lấy dải ngày bắt đầu và kết thúc theo định dạng YYYY-MM-DD dựa trên periodType
 */
export function getDateRangeForPeriod(
  periodType: TimePeriodType,
  customRange?: { startDate?: string; endDate?: string }
): DateRange | null {
  if (periodType === 'all') return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 - 11

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (periodType === 'today') {
    const todayStr = formatYMD(now);
    return { startDate: todayStr, endDate: todayStr };
  }

  if (periodType === 'this_month') {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { startDate: formatYMD(firstDay), endDate: formatYMD(lastDay) };
  }

  if (periodType === 'this_quarter') {
    const quarterIndex = Math.floor(month / 3); // 0 (Q1), 1 (Q2), 2 (Q3), 3 (Q4)
    const firstMonth = quarterIndex * 3;
    const firstDay = new Date(year, firstMonth, 1);
    const lastDay = new Date(year, firstMonth + 3, 0);
    return { startDate: formatYMD(firstDay), endDate: formatYMD(lastDay) };
  }

  if (periodType === 'custom') {
    if (!customRange?.startDate && !customRange?.endDate) return null;
    return {
      startDate: customRange?.startDate || '1970-01-01',
      endDate: customRange?.endDate || '2099-12-31'
    };
  }

  return null;
}

/**
 * Trích xuất các mốc thời gian nhận việc và hoàn thành của một công việc:
 * - Thời điểm nhận việc (acceptedDate): Ngày đầu tiên task chuyển sang 'Đang làm', hoặc ngày tạo/cập nhật lúc giao/nhận việc
 * - Thời điểm hoàn thành (completedDate): Ngày task được đánh dấu 'Hoàn thành' hoặc isDone = true (từ updatedAt hoặc lịch sử thảo luận/nghiệm thu)
 */
export function getTaskTimeBounds(task: Task): TaskTimeBounds {
  const result: TaskTimeBounds = {};

  if (task.dueDate) {
    result.dueDate = String(task.dueDate).slice(0, 10);
  }
  if (task.createdAt) {
    result.createdDate = String(task.createdAt).slice(0, 10);
  }
  if (task.updatedAt) {
    result.updatedDate = String(task.updatedAt).slice(0, 10);
  }

  const isDone = isTaskActuallyDone(task);

  // 1. Phân tích lịch sử thảo luận / thread nếu có
  try {
    const discussions = parseTaskDiscussions(task.notes, task.issue);
    if (Array.isArray(discussions) && discussions.length > 0) {
      // Tìm thời điểm nhận việc từ tin nhắn hệ thống hoặc trao đổi nhận việc
      for (const d of discussions) {
        const text = String(d.content || '').toLowerCase();
        const dateStr = d.createdAt ? String(d.createdAt).slice(0, 10) : '';
        if (dateStr && (text.includes('nhận việc') || text.includes('bắt đầu') || text.includes('tiến hành thi công'))) {
          if (!result.acceptedDate || dateStr < result.acceptedDate) {
            result.acceptedDate = dateStr;
          }
        }
        if (dateStr && isDone && (text.includes('hoàn thành') || text.includes('nghiệm thu đạt') || text.includes('đã xong'))) {
          if (!result.completedDate || dateStr > result.completedDate) {
            result.completedDate = dateStr;
          }
        }
      }
    }
  } catch {
    // fallback an toàn nếu notes không theo format JSON thread
  }

  // 2. Nếu task đã hoàn thành mà chưa có completedDate -> lấy updatedAt hoặc createdAt
  if (isDone) {
    if (!result.completedDate) {
      result.completedDate = result.updatedDate || result.createdDate;
    }
  }

  // 3. Nếu chưa có acceptedDate:
  // Nếu task đang làm hoặc đã hoàn thành, mốc nhận việc mặc định là createdAt (ngày được giao/nhận) hoặc updatedAt nếu tạo trước đó
  if (!result.acceptedDate) {
    result.acceptedDate = result.createdDate || result.updatedDate;
  }

  return result;
}

/**
 * Kiểm tra xem công việc có rơi vào khoảng thời gian range theo tiêu chí:
 * "thời gian này thì lọc theo lúc người đó nhận việc và hoàn thành"
 * 
 * Logic lọc:
 * 1. Với công việc ĐÃ HOÀN THÀNH:
 *    - Xem xét theo ngày hoàn thành (completedDate): nếu completedDate nằm trong [startDate, endDate] -> TRUE.
 *    - Nếu completedDate không có sẵn (công việc cũ) -> fallback kiểm tra updatedDate hoặc dueDate trong kỳ.
 * 
 * 2. Với công việc ĐANG LÀM / CHƯA XONG:
 *    - Xem xét theo thời điểm nhận việc / bắt đầu (acceptedDate):
 *      Nếu ngày nhận việc <= endDate (đã nhận trước hoặc trong kỳ) VÀ
 *      chưa hoàn thành trước khi kỳ bắt đầu (tức công việc đang được triển khai trong kỳ này) -> TRUE.
 *    - Đặc biệt nếu ngày nhận việc rơi trúng khoảng [startDate, endDate] -> chắc chắn TRUE.
 */
export function isTaskInPeriod(task: Task, range: DateRange | null): boolean {
  if (!range) return true; // 'all'

  const { startDate, endDate } = range;
  const timeBounds = getTaskTimeBounds(task);
  const isDone = isTaskActuallyDone(task);

  if (isDone) {
    // Với công việc hoàn thành: xét theo ngày hoàn thành
    const finishDate = timeBounds.completedDate || timeBounds.updatedDate || timeBounds.dueDate;
    if (finishDate) {
      return finishDate >= startDate && finishDate <= endDate;
    }
    // Fallback: nếu không có mốc ngày nào rõ ràng, kiểm tra createdDate
    return Boolean(timeBounds.createdDate && timeBounds.createdDate >= startDate && timeBounds.createdDate <= endDate);
  }

  // Với công việc Đang làm / Chưa xong:
  const startWorkDate = timeBounds.acceptedDate || timeBounds.createdDate || timeBounds.updatedDate;
  if (!startWorkDate) return true;

  // Nếu ngày nhận việc rơi trực tiếp vào khoảng thời gian đang lọc
  if (startWorkDate >= startDate && startWorkDate <= endDate) {
    return true;
  }

  // Nếu ngày nhận việc diễn ra trước kỳ này và vẫn đang triển khai:
  // (Công việc chưa xong và hạn hoàn thành nếu có >= startDate)
  if (startWorkDate <= endDate) {
    if (!timeBounds.dueDate || timeBounds.dueDate >= startDate) {
      return true;
    }
  }

  return false;
}
