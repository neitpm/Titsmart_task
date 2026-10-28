import ExcelJS from 'exceljs';
import { Engineer, LeaveRequest } from '../types';

export interface AttendanceMonthlyExportOptions {
  month: number; // 1 - 12
  year: number;  // ví dụ 2026
  logs: Array<{
    id: string;
    userId: string;
    userName: string;
    checkInTime: string;
    checkOutTime?: string;
    notes?: string;
  }>;
  leaves?: LeaveRequest[];
  engineers: Engineer[];
}

export async function exportMonthlyAttendanceTitsmart({
  month,
  year,
  logs,
  leaves = [],
  engineers,
}: AttendanceMonthlyExportOptions): Promise<void> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TITSMART System';
  workbook.lastModifiedBy = 'TITSMART System';

  const sheetName = `CC T${month}`;
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  // Số lượng cột tổng cộng: 4 cột cố định (STT, Mã, Tên, HC/TC) + N ngày + 14 cột tổng hợp
  const summaryHeadersCount = 14;
  const totalCols = 4 + daysInMonth + summaryHeadersCount;

  // 1. TIÊU ĐỀ BẢNG CHẤM CÔNG (Row 1)
  ws.getCell('A1').value = `BẢNG CHẤM CÔNG THÁNG ${month}/${year}`;
  ws.getCell('A1').font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  ws.mergeCells(1, 1, 1, totalCols);
  ws.getRow(1).height = 30;

  // 2. HEADER BẢNG CHẤM CÔNG (Rows 2 & 3)
  // Row 2: STT, Mã NV, Tên NV, Loại công, Ngày 1..N, Tổng hợp
  // Row 3: Thứ trong tuần
  const headerRow2 = ws.getRow(2);
  const headerRow3 = ws.getRow(3);
  headerRow2.height = 28;
  headerRow3.height = 22;

  ws.getCell('A2').value = 'STT';
  ws.getCell('B2').value = 'Mã \r\nnhân viên';
  ws.getCell('C2').value = 'Tên nhân viên';
  ws.getCell('D2').value = '';

  ws.mergeCells('A2:A3');
  ws.mergeCells('B2:B3');
  ws.mergeCells('C2:C3');
  ws.mergeCells('D2:D3');

  // Điền ngày và thứ (Cột E tương ứng colIndex 5)
  const weekdaysMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  for (let d = 1; d <= daysInMonth; d++) {
    const colIdx = 4 + d; // Day 1 = Col 5 (E)
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = weekdaysMap[dateObj.getDay()];

    const cellDate = ws.getCell(2, colIdx);
    cellDate.value = d;
    cellDate.alignment = { vertical: 'middle', horizontal: 'center' };
    cellDate.font = { name: 'Times New Roman', size: 10, bold: true };

    const cellDow = ws.getCell(3, colIdx);
    cellDow.value = dayOfWeek;
    cellDow.alignment = { vertical: 'middle', horizontal: 'center' };
    cellDow.font = { name: 'Times New Roman', size: 9, bold: true };
    if (dayOfWeek === 'CN') {
      cellDow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' }, // Đỏ nhạt Chủ Nhật
      };
      cellDate.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' },
      };
    }
  }

  // Các cột tổng hợp cuối bảng
  const summaryStartCol = 4 + daysInMonth + 1; // sau ngày cuối cùng
  const summaryHeaders = [
    { key: 'workDays', label: 'Ngày\r\n công thường' },
    { key: 'sundayDays', label: 'Ngày công CN' },
    { key: 'ot15', label: 'Giờ công\r\n tăng ca (1.5)' },
    { key: 'ot20', label: 'Giờ công\r\n tăng ca (2.0)' },
    { key: 'ot30', label: 'Giờ công \r\ntăng ca (3.0)' },
    { key: 'unauthorized', label: 'KP\r\nkhông phép' },
    { key: 'personalLeave', label: 'P \r\n(Việc Riêng)' },
    { key: 'annualLeave', label: 'PN\r\nPhép năm' },
    { key: 'sickLeave', label: 'FB\r\nnghỉ ốm' },
    { key: 'holiday', label: 'Lễ' },
    { key: 'signature', label: 'Ký Tên' },
    { key: 'totalWork', label: 'Tổng cộng\r\n ngày công' },
    { key: 'otOver5', label: 'tăng ca\r\n trên 5h' },
    { key: 'otNight', label: 'giờ công\r\n TC đêm' },
  ];

  summaryHeaders.forEach((col, idx) => {
    const colIdx = summaryStartCol + idx;
    const cell = ws.getCell(2, colIdx);
    cell.value = col.label;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.font = { name: 'Times New Roman', size: 9, bold: true };
    ws.mergeCells(2, colIdx, 3, colIdx);
  });

  // 3. TẬP HỢP DỮ LIỆU NHÂN VIÊN & ĐIỂM DANH
  // Chuẩn hóa tên nhân viên để tránh trùng lặp do tài khoản hoặc userId khác nhau
  const normalizeName = (s: string) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u0111\u0110]/g, 'd')
      .replace(/\s+/g, ' ');

  interface UnifiedEmployee {
    id: string;
    code: string;
    name: string;
    userIds: Set<string>;
  }

  const employeeMap = new Map<string, UnifiedEmployee>();

  // 1. Thêm từ danh sách nhân sự chính thức (engineers)
  engineers.forEach((eng, i) => {
    if (!eng.name || !eng.name.trim()) return;
    const key = normalizeName(eng.name);
    if (employeeMap.has(key)) {
      employeeMap.get(key)!.userIds.add(eng.id);
    } else {
      employeeMap.set(key, {
        id: eng.id,
        code: eng.code || String(employeeMap.size + 1).padStart(3, '0'),
        name: eng.name.trim(),
        userIds: new Set([eng.id]),
      });
    }
  });

  // 2. Gom thêm từ logs chấm công (nếu trùng tên với nhân sự đã có -> gộp userIds; nếu mới hoàn toàn -> thêm mới)
  logs.forEach(l => {
    if (!l.userName && !l.userId) return;
    const name = (l.userName || '').trim() || 'Nhân viên';
    const key = normalizeName(name);
    if (employeeMap.has(key)) {
      if (l.userId) employeeMap.get(key)!.userIds.add(l.userId);
    } else {
      employeeMap.set(key, {
        id: l.userId,
        code: String(employeeMap.size + 1).padStart(3, '0'),
        name: name,
        userIds: new Set(l.userId ? [l.userId] : []),
      });
    }
  });

  // Sắp xếp danh sách nhân viên theo tên tiếng Việt và gán lại mã nhân viên liên tục từ 001..
  const employeeList = Array.from(employeeMap.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map((emp, index) => ({
      ...emp,
      code: String(index + 1).padStart(3, '0'),
    }));

  // Xây dựng map tra cứu chấm công theo [userId][dayOfMonth]
  const logByEmpDay: Record<string, Record<number, { durationHours: number; otHours: number }>> = {};
  logs.forEach(l => {
    if (!l.checkInTime || !l.userId) return;
    const d = new Date(l.checkInTime);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const day = d.getDate();
      if (!logByEmpDay[l.userId]) logByEmpDay[l.userId] = {};
      
      let hours = 8; // Mặc định chấm công tính 8h
      let ot = 0;
      if (l.checkOutTime) {
        const ms = new Date(l.checkOutTime).getTime() - new Date(l.checkInTime).getTime();
        const totalH = Math.max(0, ms / 3600000);
        if (totalH > 8.5) {
          hours = 8;
          ot = Math.round((totalH - 8.5) * 10) / 10;
        } else if (totalH >= 4 && totalH < 7.5) {
          hours = 4;
        } else if (totalH < 4) {
          hours = 0;
        } else {
          hours = 8;
        }
      }
      logByEmpDay[l.userId][day] = { durationHours: hours, otHours: ot };
    }
  });

  // Xây dựng map nghỉ phép đã duyệt [userId][dayOfMonth]
  const leaveByEmpDay: Record<string, Record<number, string>> = {};
  leaves.filter(lv => lv.status === 'APPROVED' || lv.status === 'APPROVED_STEP1').forEach(lv => {
    if (!lv.userId) return;
    const sDate = new Date(lv.startDate);
    const eDate = new Date(lv.endDate);
    for (let cur = new Date(sDate); cur <= eDate; cur.setDate(cur.getDate() + 1)) {
      if (cur.getFullYear() === year && cur.getMonth() + 1 === month) {
        const d = cur.getDate();
        if (!leaveByEmpDay[lv.userId]) leaveByEmpDay[lv.userId] = {};
        if (lv.leaveType === 'Nghỉ phép năm') leaveByEmpDay[lv.userId][d] = 'PN';
        else if (lv.leaveType === 'Nghỉ bệnh') leaveByEmpDay[lv.userId][d] = 'FB';
        else if (lv.leaveType === 'Nghỉ không lương') leaveByEmpDay[lv.userId][d] = 'KP';
        else leaveByEmpDay[lv.userId][d] = 'P';
      }
    }
  });

  // 4. RENDER CÁC HÀNG NHÂN VIÊN (Mỗi người 2 dòng: HC và TC)
  let currentRow = 4;

  employeeList.forEach((emp, empIdx) => {
    const rHC = currentRow;
    const rTC = currentRow + 1;

    // Dòng 1: Hành chính (HC)
    ws.getCell(`A${rHC}`).value = empIdx + 1;
    ws.getCell(`B${rHC}`).value = emp.code;
    ws.getCell(`C${rHC}`).value = emp.name;
    ws.getCell(`D${rHC}`).value = 'HC';

    // Dòng 2: Tăng ca (TC)
    ws.getCell(`D${rTC}`).value = 'TC';

    // Merge các cột thông tin nhân viên qua 2 dòng
    ws.mergeCells(`A${rHC}:A${rTC}`);
    ws.mergeCells(`B${rHC}:B${rTC}`);
    ws.mergeCells(`C${rHC}:C${rTC}`);

    // Định dạng font & alignment cho cột thông tin
    ['A', 'B', 'D'].forEach(c => {
      ws.getCell(`${c}${rHC}`).alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getCell(`${c}${rHC}`).font = { name: 'Times New Roman', size: 10, bold: c === 'D' };
    });
    ws.getCell(`D${rTC}`).alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell(`D${rTC}`).font = { name: 'Times New Roman', size: 10, bold: true };

    ws.getCell(`C${rHC}`).alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getCell(`C${rHC}`).font = { name: 'Times New Roman', size: 10, bold: true };

    // Điền dữ liệu từng ngày trong tháng
    let totalNormalDays = 0;
    let totalSundayDays = 0;
    let totalOtHours = 0;
    let countKP = 0;
    let countP = 0;
    let countPN = 0;
    let countFB = 0;
    let countLe = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const colIdx = 4 + d;
      const dateObj = new Date(year, month - 1, d);
      const isSunday = dateObj.getDay() === 0;

      // Lấy dữ liệu điểm danh và nghỉ phép từ tất cả các userIds của nhân viên
      let logData: { durationHours: number; otHours: number } | undefined = undefined;
      for (const uId of emp.userIds) {
        const found = logByEmpDay[uId]?.[d];
        if (found) {
          if (!logData) {
            logData = { ...found };
          } else {
            logData.durationHours = Math.max(logData.durationHours, found.durationHours);
            logData.otHours = Math.max(logData.otHours, found.otHours);
          }
        }
      }

      let leaveSign: string | undefined = undefined;
      for (const uId of emp.userIds) {
        const found = leaveByEmpDay[uId]?.[d];
        if (found) {
          leaveSign = found;
          break;
        }
      }

      const cellHC = ws.getCell(rHC, colIdx);
      const cellTC = ws.getCell(rTC, colIdx);

      cellHC.alignment = { vertical: 'middle', horizontal: 'center' };
      cellTC.alignment = { vertical: 'middle', horizontal: 'center' };
      cellHC.font = { name: 'Times New Roman', size: 9 };
      cellTC.font = { name: 'Times New Roman', size: 9 };

      // Xác định ký hiệu HC
      if (leaveSign) {
        cellHC.value = leaveSign;
        if (leaveSign === 'PN') countPN++;
        else if (leaveSign === 'P') countP++;
        else if (leaveSign === 'KP') countKP++;
        else if (leaveSign === 'FB') countFB++;
      } else if (logData && logData.durationHours > 0) {
        cellHC.value = logData.durationHours;
        if (isSunday) {
          totalSundayDays += logData.durationHours === 8 ? 1 : 0.5;
        } else {
          totalNormalDays += logData.durationHours === 8 ? 1 : 0.5;
        }
      } else if (!isSunday && !logData) {
        // Ngày thường không check-in
        cellHC.value = '';
      }

      // Tăng ca (TC)
      if (logData && logData.otHours > 0) {
        cellTC.value = logData.otHours;
        totalOtHours += logData.otHours;
      }

      // Background Chủ nhật
      if (isSunday) {
        cellHC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        cellTC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    }

    // Điền các cột tổng kết (Dòng HC & Merge sang TC)
    const summaryValues = [
      totalNormalDays || 0, // Ngày công thường
      totalSundayDays || 0, // Ngày công CN
      totalOtHours || 0,    // Giờ công tăng ca (1.5)
      0,                    // TC 2.0
      0,                    // TC 3.0
      countKP,              // KP không phép
      countP,               // P việc riêng
      countPN,              // PN phép năm
      countFB,              // FB nghỉ ốm
      countLe,              // Lễ
      '',                   // Ký tên
      totalNormalDays + totalSundayDays + countPN + countLe, // Tổng cộng ngày công
      0,                    // Tăng ca trên 5h
      0,                    // Giờ công TC đêm
    ];

    summaryValues.forEach((val, idx) => {
      const colIdx = summaryStartCol + idx;
      const cell = ws.getCell(rHC, colIdx);
      cell.value = val !== 0 ? val : 0;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { name: 'Times New Roman', size: 9, bold: idx === 11 || idx === 0 };
      ws.mergeCells(rHC, colIdx, rTC, colIdx);
    });

    currentRow += 2;
  });

  // 5. ĐỊNH DẠNG BORDER CHO TOÀN BỘ BẢNG
  for (let r = 2; r < currentRow; r++) {
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    }
  }

  // 6. CẤU HÌNH ĐỘ RỘNG CỘT
  ws.getColumn(1).width = 5;  // STT
  ws.getColumn(2).width = 10; // Mã NV
  ws.getColumn(3).width = 22; // Tên NV
  ws.getColumn(4).width = 5;  // HC/TC
  for (let d = 1; d <= daysInMonth; d++) {
    ws.getColumn(4 + d).width = 3.6; // Cột ngày
  }
  for (let idx = 0; idx < summaryHeaders.length; idx++) {
    ws.getColumn(summaryStartCol + idx).width = 9;
  }

  // 7. XUẤT FILE CHO TRÌNH DUYỆT TẢI VỀ
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `BANG_CHAM_CONG_T${month}_${year}_TITSMART.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
