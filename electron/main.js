const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { encrypt, decrypt } = require("./vault");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.setAppUserModelId("local.budget");

let win;

function budgetFile() {
  return path.join(app.getPath("userData"), "budget.json");
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: "Budget",
    backgroundColor: "#F8FAFC",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "..", "src", "index.html"));
}

function ensureDesktopShortcut() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  try {
    const ico = path.join(process.resourcesPath, "icon.ico");
    shell.writeShortcutLink(path.join(app.getPath("desktop"), "Budget.lnk"), {
      target: process.execPath,
      cwd: path.dirname(process.execPath),
      description: "Ouvrir Budget",
      icon: fs.existsSync(ico) ? ico : process.execPath,
      iconIndex: 0,
      appUserModelId: "local.budget",
    });
  } catch (err) {
    console.error(err);
  }
}

if (gotLock) {
  app.whenReady().then(() => {
    createWindow();
    ensureDesktopShortcut();
  });

  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.on("window-all-closed", () => app.quit());
}

ipcMain.handle("budget:load", () => {
  try {
    return JSON.parse(fs.readFileSync(budgetFile(), "utf8"));
  } catch (err) {
    return null;
  }
});

ipcMain.handle("budget:save", (_event, data) => {
  fs.mkdirSync(path.dirname(budgetFile()), { recursive: true });
  fs.writeFileSync(budgetFile(), JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle("budget:reset", () => {
  try {
    fs.unlinkSync(budgetFile());
  } catch (err) {
    /* déjà absent */
  }
  return true;
});

ipcMain.handle("budget:export", async (_event, { password, payload, suggestedName }) => {
  const parent = BrowserWindow.getFocusedWindow();
  const picked = await dialog.showSaveDialog(parent, {
    title: "Exporter le profil",
    defaultPath: suggestedName || "profil.budget",
    filters: [{ name: "Profil Budget", extensions: ["budget"] }],
  });
  if (picked.canceled || !picked.filePath) return { canceled: true };
  const file = picked.filePath.endsWith(".budget") ? picked.filePath : picked.filePath + ".budget";
  fs.writeFileSync(file, JSON.stringify(encrypt(password, payload), null, 2));
  return { canceled: false, file };
});

ipcMain.handle("budget:pick", async () => {
  const parent = BrowserWindow.getFocusedWindow();
  const picked = await dialog.showOpenDialog(parent, {
    title: "Importer un profil",
    filters: [{ name: "Profil Budget", extensions: ["budget", "json"] }],
    properties: ["openFile"],
  });
  if (picked.canceled || !picked.filePaths[0]) return null;
  return fs.readFileSync(picked.filePaths[0], "utf8");
});

ipcMain.handle("budget:decrypt", (_event, { packed, password }) => {
  return decrypt(password, JSON.parse(packed));
});
