const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,

  listFiles: () => ipcRenderer.invoke("files:list"),
  updateOrder: (order) => ipcRenderer.invoke("files:updateOrder", order),
  readFile: (name) => ipcRenderer.invoke("files:read", name),
  saveFile: (data) => ipcRenderer.invoke("files:save", data),
  deleteFile: (name) => ipcRenderer.invoke("files:delete", name),
  renameFile: (data) => ipcRenderer.invoke("files:rename", data),
  getFilesPath: () => ipcRenderer.invoke("files:getPath"),
  openFilesFolder: () => ipcRenderer.invoke("files:openFolder"),

  onMenuNew: (cb) => ipcRenderer.on("menu-new", cb),
  onMenuSave: (cb) => ipcRenderer.on("menu-save", cb),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
