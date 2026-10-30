import { supabase } from '../lib/supabase';

export interface PushNotificationPayload {
  to?: string | string[]; // ExpoPushToken hoặc danh sách tokens
  title: string;
  body: string;
  data?: any;
  sound?: string;
  channelId?: string;
}

// Khóa công khai VAPID chuẩn RFC 8292 cho Web Push W3C
export const VAPID_PUBLIC_KEY = 'BLFTgigFY3W-mLHbsOsooxEDu4BpUbUz19RKTpLlyzHyAt-gteKH_9S66ZRIoOIEbNLUleilOym8KDOWs5GhZ9g';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Gửi Push Notification tới máy chủ Expo Push Service
 * Máy chủ Expo sẽ tự động bắn tiếp tới Google FCM (Android) hoặc Apple APNs (iPhone)
 * Điện thoại người nhận dù tắt ứng dụng / khóa màn hình vẫn sẽ rung và hiện Banner
 */
export async function sendExpoPushNotification(payload: PushNotificationPayload): Promise<boolean> {
  const { to, title, body, data, sound = 'default', channelId = 'titsmart_tasks' } = payload;
  if (!to || (Array.isArray(to) && to.length === 0)) return false;

  const tokens = Array.isArray(to) ? to : [to];
  const validTokens = tokens.filter((t) => t && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')));

  if (validTokens.length === 0) return false;

  const messages = validTokens.map((pushToken) => ({
    to: pushToken,
    sound,
    title,
    body,
    data: data || {},
    channelId,
    priority: 'high',
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    return response.ok;
  } catch (error) {
    console.debug('Lỗi khi gửi Expo Push Notification:', error);
    return false;
  }
}

/**
 * Đăng ký Web Push Subscription trên Android Chrome / iPhone PWA và lưu lên Cloud
 */
export async function registerWebDeviceToken(userId?: string, username?: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;

    // 1. Kiểm tra quyền Notification
    if (!('Notification' in window)) return false;

    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return false;

    // 2. Lấy Service Worker registration
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;

    // 3. Đăng ký Push Subscription nếu trình duyệt hỗ trợ (Android Chrome & iOS Safari Standalone)
    let pushSubscription = null;
    if ('pushManager' in reg) {
      try {
        pushSubscription = await reg.pushManager.getSubscription();
        if (!pushSubscription) {
          const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          pushSubscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }
      } catch (subErr) {
        console.debug('Lỗi pushManager subscribe (chưa có FCM/VAPID backend hoặc bị hạn chế):', subErr);
      }
    }

    // 4. Sinh token / ID định danh cho thiết bị này
    let localDeviceId = localStorage.getItem('titsmart_web_device_id');
    if (!localDeviceId) {
      localDeviceId = `WebDevice_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('titsmart_web_device_id', localDeviceId);
    }

    const payload = {
      user_id: userId || null,
      username: username || 'anonymous',
      device_id: localDeviceId,
      token: localDeviceId,
      push_subscription: pushSubscription ? JSON.stringify(pushSubscription) : null,
      platform: /Android/i.test(navigator.userAgent)
        ? 'android_web'
        : (/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios_pwa' : 'web_browser'),
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    };

    // 5. Lưu lên bảng activity_logs (Cloud)
    const { data: existing } = await supabase
      .from('activity_logs')
      .select('id')
      .eq('icon', 'DEVICE_PUSH_TOKEN')
      .eq('project', localDeviceId)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('activity_logs')
        .update({
          user: username || 'anonymous',
          action: JSON.stringify(payload),
          timestamp: new Date().toISOString(),
        })
        .eq('id', existing[0].id);
    } else {
      await supabase.from('activity_logs').insert([
        {
          user: username || 'anonymous',
          action: JSON.stringify(payload),
          project: localDeviceId,
          icon: 'DEVICE_PUSH_TOKEN',
          badge_bg: 'bg-emerald-100',
          icon_color: 'text-emerald-600',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    return true;
  } catch (err) {
    console.debug('Lỗi registerWebDeviceToken:', err);
    return false;
  }
}

/**
 * Tra cứu danh sách Token của các kỹ sư / người dùng mục tiêu từ Cloud
 * và tự động gửi thông báo đẩy đến điện thoại của họ
 */
export async function pushToUsers(
  targetUsernamesOrIds: string[],
  title: string,
  body: string,
  extraData?: any
) {
  if (!targetUsernamesOrIds || targetUsernamesOrIds.length === 0) return;

  try {
    const { data: records, error } = await supabase
      .from('activity_logs')
      .select('user, action, project')
      .eq('icon', 'DEVICE_PUSH_TOKEN');

    if (error || !records || records.length === 0) return;

    const expoTokensToSend: string[] = [];

    for (const rec of records) {
      try {
        const parsed = JSON.parse(rec.action);
        const token = parsed?.token || rec.project;
        const matchesUser =
          targetUsernamesOrIds.includes(rec.user) ||
          targetUsernamesOrIds.includes(parsed?.username) ||
          targetUsernamesOrIds.includes(parsed?.user_id);

        if (matchesUser) {
          if (token && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) {
            if (!expoTokensToSend.includes(token)) {
              expoTokensToSend.push(token);
            }
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }

    if (expoTokensToSend.length > 0) {
      await sendExpoPushNotification({
        to: expoTokensToSend,
        title,
        body,
        data: extraData,
      });
    }
  } catch (err) {
    console.debug('Lỗi pushToUsers:', err);
  }
}
