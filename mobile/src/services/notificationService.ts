import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Thiết lập handler xử lý khi thông báo đến (kể cả khi app đang mở hoặc đang chạy nền)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

/**
 * Đăng ký Push Notification trên thiết bị di động
 * Trả về Expo Push Token duy nhất của thiết bị
 */
export async function registerForPushNotificationsAsync(userId?: string, username?: string): Promise<string | null> {
  let token: string | null = null;

  try {
    // Cấu hình Channel Notification đặc biệt cho Android để có âm thanh & rung cao nhất
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('titsmart_tasks', {
        name: 'Thông báo nhiệm vụ TITSMART',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00236f',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
    }

    // Xin quyền người dùng (Hiển thị Pop-up Cho phép Thông báo)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Người dùng chưa cấp quyền nhận thông báo Push Notification!');
      return null;
    }

    // Lấy token từ Expo Push Service
    const pushTokenData = await Notifications.getExpoPushTokenAsync().catch((err) => {
      console.warn('Lỗi lấy Expo Push Token (có thể đang chạy trong Simulator):', err);
      return null;
    });

    if (pushTokenData && pushTokenData.data) {
      token = pushTokenData.data;
    }

    // Nếu lấy được token và có user, lưu/cập nhật token lên Supabase
    if (token && (userId || username)) {
      await syncPushTokenToCloud(token, userId, username);
    }
  } catch (error) {
    console.warn('Lỗi trong tiến trình registerForPushNotificationsAsync:', error);
  }

  return token;
}

/**
 * Lưu Token thiết bị lên Cloud (bảng activity_logs với icon DEVICE_PUSH_TOKEN)
 * Giúp mọi backend/web-admin có thể tra cứu và gửi thông báo đẩy đến điện thoại này
 */
export async function syncPushTokenToCloud(token: string, userId?: string, username?: string) {
  try {
    const payload = {
      user_id: userId || null,
      username: username || 'anonymous',
      token: token,
      platform: Platform.OS,
      device_model: Platform.select({ ios: 'iPhone/iPad', android: 'Android Phone', default: 'Web/Other' }),
      updated_at: new Date().toISOString(),
    };

    // Kiểm tra xem đã lưu token này trước đó chưa
    const { data: existing } = await supabase
      .from('activity_logs')
      .select('id')
      .eq('icon', 'DEVICE_PUSH_TOKEN')
      .eq('project', token)
      .limit(1);

    if (existing && existing.length > 0) {
      // Cập nhật bản ghi cũ
      await supabase
        .from('activity_logs')
        .update({
          user: username || 'anonymous',
          action: JSON.stringify(payload),
          timestamp: new Date().toISOString(),
        })
        .eq('id', existing[0].id);
    } else {
      // Tạo bản ghi lưu token mới
      await supabase.from('activity_logs').insert([
        {
          user: username || 'anonymous',
          action: JSON.stringify(payload),
          project: token, // Dùng cột project làm Unique Key chứa Token
          icon: 'DEVICE_PUSH_TOKEN',
          badge_bg: 'bg-emerald-100',
          icon_color: 'text-emerald-600',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    console.log('Đã đồng bộ Push Token thành công lên hệ thống Cloud!');
  } catch (err) {
    console.warn('Lỗi lưu Token lên Cloud:', err);
  }
}
