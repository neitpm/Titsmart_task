import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// ── 1. Đăng ký Service Worker cho PWA (Đặc biệt cho iOS Web PWA) ───────────────
export const registerServiceWorker = async () => {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      return reg;
    } catch (err) {
      console.debug('ServiceWorker registration error:', err);
    }
  }
  return null;
};

// ── 2. Sound Effect Player ───────────────────────────────────────────────────
export const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 500);
  } catch (err) {
    console.debug('Audio context sound error:', err);
  }
};

// ── 3. Request System Permissions (Desktop + Mobile + iOS PWA) ────────────────
export const requestSystemNotificationPermission = async (): Promise<boolean> => {
  try {
    // 3A. Mobile via Capacitor
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return true;
      const requested = await LocalNotifications.requestPermissions();
      return requested.display === 'granted';
    }

    // Đảm bảo Service Worker đã được đăng ký cho PWA
    await registerServiceWorker();

    // 3B. Desktop Browser / iOS Safari PWA / Electron
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
    }
  } catch (err) {
    console.error('Lỗi khi xin quyền thông báo hệ thống:', err);
  }
  return false;
};

// ── 4. Dispatch System Notification (Lock screen & Desktop banner) ────────────
export interface SystemNotificationOptions {
  id?: string | number;
  title: string;
  body: string;
  data?: any;
  url?: string;
  silent?: boolean;
}

export const sendSystemNotification = async (options: SystemNotificationOptions) => {
  const { id, title, body, data, url, silent } = options;

  if (!silent) {
    playNotificationSound();
  }

  // 4A. Electron Desktop App: Tận dụng IPC gửi thông báo Windows Native (kể cả khi đang ẩn ở System Tray)
  if (typeof window !== 'undefined' && window.electronAPI?.showNotification) {
    try {
      window.electronAPI.showNotification({
        title,
        body,
        url,
      });
      return;
    } catch (e) {
      console.debug('Electron showNotification error, falling back to Web Notification:', e);
    }
  }

  try {
    // 4B. Mobile (iOS / Android Native Capacitor) -> Push to Lock Screen & Banner
    if (Capacitor.isNativePlatform()) {
      const numericId = typeof id === 'number' 
        ? id 
        : Math.abs(String(id || Date.now()).split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)) % 1000000;

      await LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: body,
            id: numericId,
            schedule: { at: new Date(Date.now() + 50) },
            sound: 'beep.wav',
            extra: { data, url }
          }
        ]
      });
      return;
    }

    // 4C. iOS PWA / Service Worker Notification (Bắt buộc trên iOS để hiện thông báo khi đóng web)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && 'showNotification' in registration) {
        if (Notification.permission === 'granted') {
          const notifTag = typeof id === 'string' ? id : `titsmart-notif-${Date.now()}`;
          await registration.showNotification(title, {
            body: body,
            icon: '/logo_256.png',
            badge: '/logo_256.png',
            tag: notifTag,
            data: { url: url || '/' },
          });
          return;
        }
      }
    }

    // 4D. Desktop / Web Browser thông thường
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const notifTag = typeof id === 'string' ? id : `titsmart-notif-${Date.now()}`;
        const notif = new Notification(title, {
          body: body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notifTag,
          silent: false,
          requireInteraction: false
        });

        notif.onclick = () => {
          try {
            window.focus();
            if (url) {
              window.location.hash = url;
            }
          } catch {}
          notif.close();
        };
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            new Notification(title, {
              body: body,
              icon: '/favicon.ico',
              badge: '/favicon.ico'
            });
          }
        });
      }
    }
  } catch (err) {
    console.debug('Lỗi hiển thị thông báo hệ thống:', err);
  }
};
