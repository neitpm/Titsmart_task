import { app, BrowserWindow, ipcMain, shell, Tray, Menu, Notification, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import updatePkg from 'electron-updater';
import webpush from 'web-push';

// Cấu hình VAPID cho Web Push tới Apple APNs và Google FCM
try {
  webpush.setVapidDetails(
    'mailto:admin@titsmart.vn',
    'BPAuS3BAVsbHBUEJLS_d0lvmxZqLOj71iPBE7oZSIX-r_mbbosFY4JMBmPs_fDOfhQtWT1mpf-_A9c1cSNPip0c',
    '2eQfYJLlDO7jQpnpSMBiENSXTgvHhC4NAQoQzrsr8O0'
  );
} catch (e) {
  console.debug('Lỗi setVapidDetails trong Electron:', e);
}
const { autoUpdater } = updatePkg;

// ── Single Instance Lock (Tránh mở nhiều cửa sổ trùng lặp gây đơ/treo trắng màn hình) ─
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Nếu đã có tiến trình đang chạy ngầm, thoát ngay tiến trình mới mở này
  app.quit();
}

// Handle ES module dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isForceQuitting = false;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function getAppIcon() {
  const iconPaths = [
    path.join(__dirname, '../public/favicon.ico'),
    path.join(__dirname, '../dist/favicon.ico'),
    path.join(process.resourcesPath || '', 'favicon.ico'),
    path.join(__dirname, '../public/logo.png'),
    path.join(__dirname, '../dist/logo.png'),
  ];
  for (const p of iconPaths) {
    if (fs.existsSync(p)) {
      return nativeImage.createFromPath(p);
    }
  }
  return undefined;
}

function createTray() {
  if (tray) return;

  const icon = getAppIcon();
  tray = new Tray(icon || nativeImage.createEmpty());
  tray.setToolTip('TITSMART - Quản lý công việc');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mở TITSMART',
      click: () => {
        showMainWindow();
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Kiểm tra cập nhật...',
      click: () => {
        autoUpdater.checkForUpdates().catch(() => {});
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Thoát hoàn toàn',
      click: () => {
        isForceQuitting = true;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    showMainWindow();
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  const icon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: icon,
    autoHideMenuBar: true,
    show: false, // Tránh nhấp nháy trắng màn hình, chờ sẵn sàng mới hiển thị
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // KHÔNG ĐÓNG BĂNG/HẠ CHẾ TIẾN TRÌNH KHI ẨN XUỐNG TRAY
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(process.env.DIST || path.join(__dirname, '../dist'), 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Khi bấm nút [X], hiển thị modal xác nhận ở giao diện người dùng
  mainWindow.on('close', (e) => {
    if (!isForceQuitting && mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault();
      mainWindow.webContents.send('app:request-close');
    }
  });
}

// Khi người dùng bấm đúp mở icon app ngoài desktop trong lúc app đang chạy ngầm
app.on('second-instance', () => {
  showMainWindow();
});

function sendToRenderer(channel: string, data?: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function normalizeReleaseNotes(notes?: string | Array<{ version?: string; note?: string }>): string {
  if (Array.isArray(notes)) {
    return notes.map((n) => (typeof n === 'string' ? n : n?.note ?? '')).filter(Boolean).join('\n');
  }
  return notes ?? '';
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.disableWebInstaller = true;

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('update:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendToRenderer('update:status', {
      status: 'available',
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendToRenderer('update:status', { status: 'not-available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('update:status', { status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    sendToRenderer('update:status', { status: 'error', message: err?.message ?? String(err) });
  });

  ipcMain.on('update:check', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.on('update:download', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall();
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      sendToRenderer('update:status', { status: 'error', message: err?.message ?? String(err) });
    });
  }, 3000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 60000);
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.on('open-external', async (_, url) => {
  if (url && typeof url === 'string') {
    try {
      await shell.openExternal(url);
    } catch (error: any) {
      console.error('Failed to open url:', error);
    }
  }
});

// Chạy ngầm xuống khay hệ thống (giống Zalo PC)
ipcMain.on('app:minimize-to-tray', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
});

// Hiển thị thông báo Windows Native (kể cả khi app đang thu nhỏ / ẩn ở Tray)
ipcMain.on('app:show-notification', (_, { title, body, url }) => {
  if (Notification.isSupported()) {
    const icon = getAppIcon();
    const notif = new Notification({
      title: title || 'TITSMART',
      body: body || 'Bạn có thông báo mới.',
      icon: icon,
    });

    notif.on('click', () => {
      showMainWindow();
      if (url && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('navigate:url', url);
      }
    });

    notif.show();
  }
});

// Bắn Web Push Notification trực tiếp từ Electron tới Apple APNs / Google FCM
ipcMain.on('app:send-web-push', async (_, { subscription, payload }) => {
  try {
    if (!subscription || !subscription.endpoint) return;
    const subObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    await webpush.sendNotification(subObj, bodyStr);
    console.log('[Electron APNs] Bắn Web Push tới Apple/Google thành công!');
  } catch (err: any) {
    console.debug('[Electron APNs] Lỗi gửi Web Push:', err?.statusCode || err?.message || err);
  }
});

// Thoát hoàn toàn
ipcMain.on('app:confirm-quit', () => {
  isForceQuitting = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.quit();
});

// Permanent Session File persistence in App UserData directory
const sessionFilePath = path.join(app.getPath('userData'), 'auth_session.json');

ipcMain.on('session:save', (_, user) => {
  try {
    if (user) {
      fs.writeFileSync(sessionFilePath, JSON.stringify(user), 'utf-8');
    } else {
      if (fs.existsSync(sessionFilePath)) fs.unlinkSync(sessionFilePath);
    }
  } catch (err) {
    console.error('Failed to write auth_session.json:', err);
  }
});

ipcMain.on('session:load', (event) => {
  try {
    if (fs.existsSync(sessionFilePath)) {
      const raw = fs.readFileSync(sessionFilePath, 'utf-8');
      if (raw) {
        event.returnValue = JSON.parse(raw);
        return;
      }
    }
  } catch (err) {
    console.error('Failed to read auth_session.json:', err);
  }
  event.returnValue = null;
});

app.on('before-quit', () => {
  isForceQuitting = true;
});

app.on('window-all-closed', () => {
  // Khi người dùng đóng cửa sổ trên Windows, nếu có tray thì chỉ ẩn cửa sổ để tiếp tục nhận thông báo
  if (tray) {
    // Keep app running in background
  } else if (process.platform !== 'darwin') {
    app.quit();
    mainWindow = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showMainWindow();
  }
});

if (gotTheLock) {
  app.whenReady().then(() => {
    createWindow();
    createTray();
    setupAutoUpdater();
  });
}
