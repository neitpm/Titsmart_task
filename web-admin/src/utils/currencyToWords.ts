/**
 * Chuyển đổi số tiền VNĐ sang chữ tiếng Việt chuẩn xác
 * Hỗ trợ các số lớn đến hàng nghìn tỷ
 */
export function numberToVietnameseWords(num: number | string): string {
  if (num === null || num === undefined || num === '') return '';
  const n = typeof num === 'string' ? Number(String(num).replace(/\D/g, '')) : Number(num);
  if (isNaN(n) || n === 0) return 'Không đồng';
  if (n < 0) return 'Âm ' + numberToVietnameseWords(Math.abs(n)).toLowerCase();

  const ChuSo = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const Tien = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  function readGroupOfThree(threeDigits: number, showZeroHundred: boolean): string {
    let tram = Math.floor(threeDigits / 100);
    let chuc = Math.floor((threeDigits % 100) / 10);
    let donvi = threeDigits % 10;
    let res = '';

    if (tram > 0 || showZeroHundred) {
      res += ChuSo[tram] + ' trăm ';
    }

    if (chuc === 0 && donvi !== 0) {
      if (tram > 0 || showZeroHundred) res += 'lẻ ';
    } else if (chuc === 1) {
      res += 'mười ';
    } else if (chuc > 1) {
      res += ChuSo[chuc] + ' mươi ';
    }

    if (chuc > 0 && donvi === 1) {
      res += (chuc === 1 ? 'một' : 'mốt');
    } else if (chuc > 0 && donvi === 5) {
      res += 'lăm';
    } else if (donvi > 0 || (tram === 0 && chuc === 0 && !showZeroHundred)) {
      if (donvi > 0) res += ChuSo[donvi];
    }

    return res.trim();
  }

  // Chia số thành các nhóm 3 chữ số
  const groups: number[] = [];
  let temp = Math.floor(n);
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  let textArr: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const grp = groups[i];
    if (grp > 0) {
      const showZero = i < groups.length - 1;
      const readGrp = readGroupOfThree(grp, showZero);
      const unit = Tien[i] ? ' ' + Tien[i] : '';
      textArr.push(readGrp + unit);
    }
  }

  const result = textArr.join(' ').replace(/\s+/g, ' ').trim();
  if (!result) return 'Không đồng';
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}
