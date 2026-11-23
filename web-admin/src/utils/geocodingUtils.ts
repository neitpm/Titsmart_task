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
 * Tìm tọa độ từ chuỗi địa chỉ
 */
export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery || cleanQuery.length < 3) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      cleanQuery
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
