import { AttendanceGpsLocation, WorkShift } from '../types';

/**
 * Tính khoảng cách theo đường chim bay giữa 2 tọa độ GPS bằng công thức Haversine (kết quả trả về mét)
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 9999999;
  const R = 6371e3; // Bán kính trái đất (mét)
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Định dạng khoảng cách theo mét hoặc kilomet
 */
export function formatDistance(meters?: number): string {
  if (meters === undefined || meters === null || isNaN(meters)) return '—';
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Tạo liên kết Google Maps để xem vị trí
 */
export function getGoogleMapsLink(lat?: number, lng?: number): string {
  if (!lat || !lng) return '#';
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Tìm địa điểm hợp lệ gần nhất trong danh sách
 */
export function findNearestLocation(
  lat: number,
  lng: number,
  locations: AttendanceGpsLocation[]
): {
  nearestLocation: AttendanceGpsLocation | null;
  distanceMeters: number;
  isWithinRadius: boolean;
} {
  const activeLocs = (locations || []).filter(l => l.isActive);
  if (activeLocs.length === 0) {
    return { nearestLocation: null, distanceMeters: 0, isWithinRadius: true };
  }

  let minDistance = Infinity;
  let bestLoc: AttendanceGpsLocation | null = null;

  for (const loc of activeLocs) {
    const dist = calculateDistanceMeters(lat, lng, loc.latitude, loc.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      bestLoc = loc;
    }
  }

  const isWithinRadius = bestLoc ? minDistance <= (bestLoc.radiusMeters || 300) : false;

  return {
    nearestLocation: bestLoc,
    distanceMeters: minDistance,
    isWithinRadius
  };
}

/**
 * Đánh giá trạng thái chấm công theo ca (Đúng giờ / Đi trễ)
 */
export function evaluateShiftStatus(
  checkInIso: string,
  shift: WorkShift
): {
  status: 'on_time' | 'late';
  lateMinutes: number;
} {
  try {
    const d = new Date(checkInIso);
    const [startH, startM] = (shift.startTime || '08:00').split(':').map(Number);
    
    // Giờ bắt đầu ca trong ngày chấm công
    const shiftStart = new Date(d);
    shiftStart.setHours(startH, startM, 0, 0);

    const diffMinutes = Math.round((d.getTime() - shiftStart.getTime()) / 60000);
    const graceMinutes = shift.lateGraceMinutes ?? 15;

    if (diffMinutes <= graceMinutes) {
      return { status: 'on_time', lateMinutes: 0 };
    }
    return { status: 'late', lateMinutes: Math.max(0, diffMinutes) };
  } catch {
    return { status: 'on_time', lateMinutes: 0 };
  }
}

/**
 * Gợi ý ca làm việc phù hợp nhất với giờ hiện tại
 */
export function suggestBestShift(shifts: WorkShift[], now: Date = new Date()): WorkShift | null {
  const active = (shifts || []).filter(s => s.isActive);
  if (active.length === 0) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let closestShift: WorkShift | null = null;
  let minDiff = Infinity;

  for (const s of active) {
    const [h, m] = (s.startTime || '08:00').split(':').map(Number);
    const shiftMinutes = h * 60 + m;
    const diff = Math.abs(currentMinutes - shiftMinutes);
    if (diff < minDiff) {
      minDiff = diff;
      closestShift = s;
    }
  }

  return closestShift || active[0];
}
