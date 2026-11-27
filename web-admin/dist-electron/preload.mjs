"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  on: (channel, callback) => {
    electron.ipcRenderer.on(channel, (_, data) => callback(data));
  },
  send: (channel, data) => {
    electron.ipcRenderer.send(channel, data);
  },
  // Auto-update
  onUpdateStatus: (callback) => {
    electron.ipcRenderer.on("update:status", (_, payload) => callback(payload));
  },
  checkForUpdates: () => electron.ipcRenderer.send("update:check"),
  downloadUpdate: () => electron.ipcRenderer.send("update:download"),
  installUpdate: () => electron.ipcRenderer.send("update:install"),
  openExternal: (url) => electron.ipcRenderer.send("open-external", url),
  saveSession: (user) => electron.ipcRenderer.send("session:save", user),
  loadSessionSync: () => electron.ipcRenderer.sendSync("session:load"),
  onRequestClose: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("app:request-close", handler);
    return () => electron.ipcRenderer.removeListener("app:request-close", handler);
  },
  confirmQuit: () => electron.ipcRenderer.send("app:confirm-quit"),
  // Minimize to System Tray & Notifications (như Zalo PC)
  minimizeToTray: () => electron.ipcRenderer.send("app:minimize-to-tray"),
  showNotification: (options) => {
    electron.ipcRenderer.send("app:show-notification", options);
  },
  sendWebPush: (options) => {
    electron.ipcRenderer.send("app:send-web-push", options);
  }
});
