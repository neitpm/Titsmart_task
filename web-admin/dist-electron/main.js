import { ipcMain as s, shell as T, Notification as b, app as a, BrowserWindow as S, nativeImage as D, Tray as k, Menu as j } from "electron";
import i from "path";
import { fileURLToPath as F } from "url";
import d from "fs";
import I from "electron-updater";
const { autoUpdater: n } = I, R = F(import.meta.url), l = i.dirname(R);
let o = null, c = null, h = !1;
const v = process.env.VITE_DEV_SERVER_URL;
function m() {
  const e = [
    i.join(l, "../public/favicon.ico"),
    i.join(l, "../dist/favicon.ico"),
    i.join(process.resourcesPath || "", "favicon.ico"),
    i.join(l, "../public/logo.png"),
    i.join(l, "../dist/logo.png")
  ];
  for (const t of e)
    if (d.existsSync(t))
      return D.createFromPath(t);
}
function M() {
  if (c) return;
  const e = m();
  c = new k(e || D.createEmpty()), c.setToolTip("TITSMART - Quản lý công việc");
  const t = j.buildFromTemplate([
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
        h = !0, o && !o.isDestroyed() && o.destroy(), a.quit();
      }
    }
  ]);
  c.setContextMenu(t), c.on("double-click", () => {
    f();
  });
}
function f() {
  if (!o || o.isDestroyed()) {
    w();
    return;
  }
  o.isMinimized() && o.restore(), o.show(), o.focus();
}
function w() {
  const e = m();
  o = new S({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: e,
    autoHideMenuBar: !0,
    webPreferences: {
      preload: i.join(l, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), v ? (o.loadURL(v), o.webContents.openDevTools()) : o.loadFile(i.join(process.env.DIST || i.join(l, "../dist"), "index.html")), o.webContents.setWindowOpenHandler(({ url: t }) => ((t.startsWith("http://") || t.startsWith("https://")) && T.openExternal(t), { action: "deny" })), o.on("close", (t) => {
    !h && o && !o.isDestroyed() && (t.preventDefault(), o.hide());
  });
}
function r(e, t) {
  o && !o.isDestroyed() && o.webContents.send(e, t);
}
function E(e) {
  return Array.isArray(e) ? e.map((t) => typeof t == "string" ? t : (t == null ? void 0 : t.note) ?? "").filter(Boolean).join(`
`) : e ?? "";
}
function P() {
  a.isPackaged && (n.autoDownload = !0, n.autoInstallOnAppQuit = !0, n.disableDifferentialDownload = !0, n.disableWebInstaller = !0, n.on("checking-for-update", () => {
    r("update:status", { status: "checking" });
  }), n.on("update-available", (e) => {
    r("update:status", {
      status: "available",
      version: e.version,
      releaseNotes: E(e.releaseNotes)
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
  }), s.on("update:check", () => {
    n.checkForUpdates();
  }), s.on("update:download", () => {
    n.downloadUpdate();
  }), s.on("update:install", () => {
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
s.on("open-external", async (e, t) => {
  if (t && typeof t == "string")
    try {
      await T.openExternal(t);
    } catch (u) {
      console.error("Failed to open url:", u);
    }
});
s.on("app:minimize-to-tray", () => {
  o && !o.isDestroyed() && o.hide();
});
s.on("app:show-notification", (e, { title: t, body: u, url: y }) => {
  if (b.isSupported()) {
    const _ = m(), g = new b({
      title: t || "TITSMART",
      body: u || "Bạn có thông báo mới.",
      icon: _
    });
    g.on("click", () => {
      f(), y && o && !o.isDestroyed() && o.webContents.send("navigate:url", y);
    }), g.show();
  }
});
s.on("app:confirm-quit", () => {
  h = !0, o && !o.isDestroyed() && o.destroy(), a.quit();
});
const p = i.join(a.getPath("userData"), "auth_session.json");
s.on("session:save", (e, t) => {
  try {
    t ? d.writeFileSync(p, JSON.stringify(t), "utf-8") : d.existsSync(p) && d.unlinkSync(p);
  } catch (u) {
    console.error("Failed to write auth_session.json:", u);
  }
});
s.on("session:load", (e) => {
  try {
    if (d.existsSync(p)) {
      const t = d.readFileSync(p, "utf-8");
      if (t) {
        e.returnValue = JSON.parse(t);
        return;
      }
    }
  } catch (t) {
    console.error("Failed to read auth_session.json:", t);
  }
  e.returnValue = null;
});
a.on("before-quit", () => {
  h = !0;
});
a.on("window-all-closed", () => {
  c || process.platform !== "darwin" && (a.quit(), o = null);
});
a.on("activate", () => {
  S.getAllWindows().length === 0 ? w() : f();
});
a.whenReady().then(() => {
  w(), M(), P();
});
