const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("budgetAPI", {
  load: () => ipcRenderer.invoke("budget:load"),
  save: (data) => ipcRenderer.invoke("budget:save", data),
  reset: () => ipcRenderer.invoke("budget:reset"),
  exportProfile: (args) => ipcRenderer.invoke("budget:export", args),
  pickImport: () => ipcRenderer.invoke("budget:pick"),
  decrypt: (args) => ipcRenderer.invoke("budget:decrypt", args),
});
