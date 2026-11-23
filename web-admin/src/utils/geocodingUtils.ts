/**
 * Tiện ích hỗ trợ tìm kiếm tọa độ địa lý (Geocoding) cho Dự án và Công trình
 * Sử dụng OpenStreetMap Nominatim API chuẩn mở, miễn phí, chính xác tại Việt Nam
 */

export interface GeocodingResult {
  displayName: string;
  latitude: number;
  longitude: number;
}

/**
 * Thực hiện 1 truy vấn đơn lẻ tới OpenStreetMap Nominatim API
 */
async function fetchNominatim(q: string): Promise<GeocodingResult | null> {
  const cleanQ = (q || '').trim();
  if (!cleanQ || cleanQ.length < 3) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      cleanQ
    )}&countrycodes=vn&limit=1&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'vi,en',
        'User-Agent': 'TitsmartWorkManagement/3.8 (contact@titsmart.vn)'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          displayName: item.display_name,
          latitude: lat,
          longitude: lng
        };
      }
    }
    return null;
  } catch (err) {
    console.debug('[Geocoding] Query failed:', err);
    return null;
  }
}

/**
 * Tìm tọa độ thông minh:
 * Thử địa chỉ gốc -> nếu chứa số nhà/hẻm chi tiết (VD: 87/8/2 Đ. Số 2, Tăng Nhơn...)
 * hệ thống sẽ tự động bóc tách số nhà/hẻm để tìm theo tên đường + phường/xã/tỉnh
 * giúp tìm chính xác ngay cả khi bản đồ chưa đánh số nhà chi tiết trong hẻm.
 */
export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery || cleanQuery.length < 3) return null;

  // 1. Thử tìm kiếm nguyên văn chuỗi ban đầu
  const directResult = await fetchNominatim(cleanQuery);
  if (directResult) return directResult;

  // 2. Tạo danh sách các biến thể tối ưu cho địa chỉ Việt Nam
  const variants: string[] = [];

  // Chuẩn hóa tiền tố đường viết tắt: 'Đ.' hoặc 'D.' -> 'Đường'
  let normalized = cleanQuery.replace(/\b[ĐDđd]\.\s*/g, 'Đường ');

  // Bóc tách số nhà hoặc số hẻm ở đầu (VD: 87/8/2, 87/8, Số 12A, 12/3...)
  const withoutHouseNumber = normalized
    .replace(/^(\s*(số\s+)?\d+([A-Za-z]?)([\/\-]\d+)*\s*,?\s*)/i, '')
    .trim();

  if (withoutHouseNumber && withoutHouseNumber !== cleanQuery && withoutHouseNumber.length >= 3) {
    variants.push(withoutHouseNumber);
  }

  // Tách theo dấu phẩy để fallback từ cụ thể đến vùng lớn hơn (Bỏ bớt ngõ/hẻm/đoạn đầu)
  const segments = cleanQuery.split(',').map(s => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    // Bỏ phần đầu tiên (thường là số nhà/ngõ/hẻm)
    const broaderQuery = segments.slice(1).join(', ');
    if (broaderQuery && !variants.includes(broaderQuery)) {
      variants.push(broaderQuery);
    }
  }

  // Lần lượt thử các biến thể
  for (const variant of variants) {
    const res = await fetchNominatim(variant);
    if (res) return res;
  }

  return null;
}

/**
 * Lấy tọa độ GPS hiện tại của thiết bị qua Geolocation API
 */
export function getCurrentDeviceLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Thiết bị hoặc trình duyệt không hỗ trợ định vị GPS.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      },
      (err) => {
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
