import { app as s, ipcMain as a, shell as v, Notification as b, BrowserWindow as S, nativeImage as k, Tray as I, Menu as j } from "electron";
import i from "path";
import { fileURLToPath as F } from "url";
import d from "fs";
import R from "electron-updater";
const { autoUpdater: n } = R, D = s.requestSingleInstanceLock();
D || s.quit();
const M = F(import.meta.url), l = i.dirname(M);
let t = null, c = null, h = !1;
const T = process.env.VITE_DEV_SERVER_URL;
function w() {
  const e = [
    i.join(l, "../public/favicon.ico"),
    i.join(l, "../dist/favicon.ico"),
    i.join(process.resourcesPath || "", "favicon.ico"),
    i.join(l, "../public/logo.png"),
    i.join(l, "../dist/logo.png")
  ];
  for (const o of e)
    if (d.existsSync(o))
      return k.createFromPath(o);
}
function E() {
  if (c) return;
  const e = w();
  c = new I(e || k.createEmpty()), c.setToolTip("TITSMART - Quản lý công việc");
  const o = j.buildFromTemplate([
    {
      label: "Mở TITSMART",
      click: () => {
        f();
      }
    },
    {
      type: "separator"
    },
    {
      label: "Kiểm tra cập nhật...",
      click: () => {
        n.checkForUpdates().catch(() => {
        });
      }
    },
    {
      type: "separator"
    },
    {
      label: "Thoát hoàn toàn",
      click: () => {
        h = !0, t && !t.isDestroyed() && t.destroy(), s.quit();
      }
    }
  ]);
  c.setContextMenu(o), c.on("double-click", () => {
    f();
  });
}
function f() {
  if (!t || t.isDestroyed()) {
    m();
    return;
  }
  t.isMinimized() && t.restore(), t.show(), t.focus();
}
function m() {
  const e = w();
  t = new S({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: e,
    autoHideMenuBar: !0,
    show: !1,
    // Tránh nhấp nháy trắng màn hình, chờ sẵn sàng mới hiển thị
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: i.join(l, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      backgroundThrottling: !1
      // KHÔNG ĐÓNG BĂNG/HẠ CHẾ TIẾN TRÌNH KHI ẨN XUỐNG TRAY
    }
  }), t.once("ready-to-show", () => {
    t && !t.isDestroyed() && (t.show(), t.focus());
  }), T ? (t.loadURL(T), t.webContents.openDevTools()) : t.loadFile(i.join(process.env.DIST || i.join(l, "../dist"), "index.html")), t.webContents.setWindowOpenHandler(({ url: o }) => ((o.startsWith("http://") || o.startsWith("https://")) && v.openExternal(o), { action: "deny" })), t.on("close", (o) => {
    !h && t && !t.isDestroyed() && (o.preventDefault(), t.webContents.send("app:request-close"));
  });
}
s.on("second-instance", () => {
  f();
});
function r(e, o) {
  t && !t.isDestroyed() && t.webContents.send(e, o);
}
function P(e) {
  return Array.isArray(e) ? e.map((o) => typeof o == "string" ? o : (o == null ? void 0 : o.note) ?? "").filter(Boolean).join(`
`) : e ?? "";
}
function U() {
  s.isPackaged && (n.autoDownload = !0, n.autoInstallOnAppQuit = !0, n.disableDifferentialDownload = !0, n.disableWebInstaller = !0, n.on("checking-for-update", () => {
    r("update:status", { status: "checking" });
  }), n.on("update-available", (e) => {
    r("update:status", {
      status: "available",
      version: e.version,
      releaseNotes: P(e.releaseNotes)
    });
  }), n.on("update-not-available", (e) => {
    r("update:status", { status: "not-available", version: e.version });
  }), n.on("download-progress", (e) => {
    r("update:status", {
      status: "downloading",
      percent: Math.round(e.percent),
      transferred: e.transferred,
      total: e.total,
      bytesPerSecond: e.bytesPerSecond
    });
  }), n.on("update-downloaded", (e) => {
    r("update:status", { status: "downloaded", version: e.version });
  }), n.on("error", (e) => {
    r("update:status", { status: "error", message: (e == null ? void 0 : e.message) ?? String(e) });
  }), a.on("update:check", () => {
    n.checkForUpdates();
  }), a.on("update:download", () => {
    n.downloadUpdate();
  }), a.on("update:install", () => {
    n.quitAndInstall();
  }), setTimeout(() => {
    n.checkForUpdates().catch((e) => {
      r("update:status", { status: "error", message: (e == null ? void 0 : e.message) ?? String(e) });
    });
  }, 3e3), setInterval(() => {
    n.checkForUpdates().catch(() => {
    });
  }, 6e4));
}
a.on("open-external", async (e, o) => {
  if (o && typeof o == "string")
    try {
      await v.openExternal(o);
    } catch (u) {
      console.error("Failed to open url:", u);
    }
});
a.on("app:minimize-to-tray", () => {
  t && !t.isDestroyed() && t.hide();
});
a.on("app:show-notification", (e, { title: o, body: u, url: y }) => {
  if (b.isSupported()) {
    const _ = w(), g = new b({
      title: o || "TITSMART",
      body: u || "Bạn có thông báo mới.",
      icon: _
    });
    g.on("click", () => {
      f(), y && t && !t.isDestroyed() && t.webContents.send("navigate:url", y);
    }), g.show();
  }
});
a.on("app:confirm-quit", () => {
  h = !0, t && !t.isDestroyed() && t.destroy(), s.quit();
});
const p = i.join(s.getPath("userData"), "auth_session.json");
a.on("session:save", (e, o) => {
  try {
    o ? d.writeFileSync(p, JSON.stringify(o), "utf-8") : d.existsSync(p) && d.unlinkSync(p);
  } catch (u) {
    console.error("Failed to write auth_session.json:", u);
  }
});
a.on("session:load", (e) => {
  try {
    if (d.existsSync(p)) {
      const o = d.readFileSync(p, "utf-8");
      if (o) {
        e.returnValue = JSON.parse(o);
        return;
      }
    }
  } catch (o) {
    console.error("Failed to read auth_session.json:", o);
  }
  e.returnValue = null;
});
s.on("before-quit", () => {
  h = !0;
});
s.on("window-all-closed", () => {
  c || process.platform !== "darwin" && (s.quit(), t = null);
});
s.on("activate", () => {
  S.getAllWindows().length === 0 ? m() : f();
});
D && s.whenReady().then(() => {
  m(), E(), U();
});
