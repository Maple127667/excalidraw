const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,

  // 文件列表
  listFiles: () => ipcRenderer.invoke("files:list"),
  updateOrder: (order) => ipcRenderer.invoke("files:updateOrder", order),

  // 文件夹操作
  createFolder: (name) => ipcRenderer.invoke("files:createFolder", name),
  deleteFolder: (data) => ipcRenderer.invoke("files:deleteFolder", data),
  renameFolder: (data) => ipcRenderer.invoke("files:renameFolder", data),

  // 文件操作
  readFile: (data) => ipcRenderer.invoke("files:read", data),
  saveFile: (data) => ipcRenderer.invoke("files:save", data),
  deleteFile: (data) => ipcRenderer.invoke("files:delete", data),
  renameFile: (data) => ipcRenderer.invoke("files:rename", data),
  moveFile: (data) => ipcRenderer.invoke("files:move", data),

  // 其他
  getFilesPath: () => ipcRenderer.invoke("files:getPath"),
  openFilesFolder: () => ipcRenderer.invoke("files:openFolder"),

  // 菜单事件
  onMenuNew: (cb) => ipcRenderer.on("menu-new", cb),
  onMenuSave: (cb) => ipcRenderer.on("menu-save", cb),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
