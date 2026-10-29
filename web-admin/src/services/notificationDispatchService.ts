import { supabase } from '../lib/supabase';

export interface PushNotificationPayload {
  to?: string | string[]; // ExpoPushToken hoặc danh sách tokens
  title: string;
  body: string;
  data?: any;
  sound?: string;
  channelId?: string;
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
  const validTokens = tokens.filter((t) => t && t.startsWith('ExponentPushToken['));

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
    // 1. Tìm các Token đã lưu trong activity_logs
    const { data: records, error } = await supabase
      .from('activity_logs')
      .select('user, action, project')
      .eq('icon', 'DEVICE_PUSH_TOKEN');

    if (error || !records || records.length === 0) return;

    const tokensToSend: string[] = [];

    for (const rec of records) {
      try {
        const parsed = JSON.parse(rec.action);
        const token = parsed?.token || rec.project;
        const matchesUser =
          targetUsernamesOrIds.includes(rec.user) ||
          targetUsernamesOrIds.includes(parsed?.username) ||
          targetUsernamesOrIds.includes(parsed?.user_id);

        if (matchesUser && token && token.startsWith('ExponentPushToken[')) {
          if (!tokensToSend.includes(token)) {
            tokensToSend.push(token);
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }

    if (tokensToSend.length > 0) {
      await sendExpoPushNotification({
        to: tokensToSend,
        title,
        body,
        data: extraData,
      });
    }
  } catch (err) {
    console.debug('Lỗi pushToUsers:', err);
  }
}
