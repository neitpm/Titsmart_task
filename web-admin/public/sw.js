// TITSMART Service Worker - Xử lý thông báo đẩy (Web Push) trên iOS PWA & Trình duyệt Web
const CACHE_NAME = 'titsmart-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Lắng nghe sự kiện Push từ máy chủ (Apple APNs / Web Push) khi người dùng đã đóng web / PWA
self.addEventListener('push', (event) => {
  let title = 'TITSMART';
  let body = 'Bạn có thông báo mới từ hệ thống Quản lý Công việc.';
  let data = {};
  let icon = '/logo_256.png';
  let badge = '/logo_256.png';

  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      body = payload.body || body;
      data = payload.data || {};
      if (payload.icon) icon = payload.icon;
      if (payload.badge) badge = payload.badge;
    } catch (e) {
      body = event.data.text() || body;
    }
  }

  const options = {
    body: body,
    icon: icon,
    badge: badge,
    vibrate: [200, 100, 200, 100, 200],
    data: data,
    tag: String(data.id || (Date.now() + '-' + Math.floor(Math.random() * 1000))),
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Khi người dùng bấm vào thông báo trên màn hình khóa hoặc thanh thông báo của iPhone
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Nếu đã có cửa sổ PWA đang mở thì focus vào
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if (targetUrl && client.navigate) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Nếu chưa có thì mở cửa sổ mới
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
