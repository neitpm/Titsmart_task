import { Task } from '../types';

export type TimePeriodType = 'all' | 'today' | 'this_month' | 'this_quarter' | 'custom';

export interface DateRange {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
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
 * Kiểm tra xem công việc t có phát sinh hoặc diễn ra trong khoảng thời gian range không.
 * Tiêu chí xem xét:
 * 1. dueDate (Hạn hoàn thành) nằm trong khoảng
 * 2. createdAt / updatedAt nằm trong khoảng
 * 3. Nếu là công việc đang làm (chưa hoàn thành), nếu dueDate >= startDate thì vẫn tính là đang làm trong kỳ.
 */
export function isTaskInPeriod(task: Task, range: DateRange | null): boolean {
  if (!range) return true; // 'all'

  const { startDate, endDate } = range;

  // Lấy các mốc ngày của công việc (YYYY-MM-DD)
  const dueStr = task.dueDate ? String(task.dueDate).slice(0, 10) : '';
  const createdStr = task.createdAt ? String(task.createdAt).slice(0, 10) : '';
  const updatedStr = task.updatedAt ? String(task.updatedAt).slice(0, 10) : '';

  // 1. Nếu hạn hoàn thành rơi vào khoảng thời gian
  if (dueStr && dueStr >= startDate && dueStr <= endDate) {
    return true;
  }

  // 2. Nếu ngày cập nhật hoặc ngày tạo rơi vào khoảng thời gian
  if (updatedStr && updatedStr >= startDate && updatedStr <= endDate) {
    return true;
  }
  if (createdStr && createdStr >= startDate && createdStr <= endDate) {
    return true;
  }

  // 3. Nếu là công việc đang làm (chưa hoàn thành) và được tạo trước khi kết thúc khoảng thời gian,
  // đồng thời hạn hoàn thành (nếu có) chưa hết trước khi khoảng thời gian bắt đầu
  const isDone = task.isDone || task.status === 'Hoàn thành' || (task.progress !== undefined && task.progress >= 1);
  if (!isDone) {
    // Nếu tạo trước khi hết kỳ và chưa hoàn thành
    if (createdStr && createdStr <= endDate) {
      if (!dueStr || dueStr >= startDate) {
        return true;
      }
    }
  }

  return false;
}

