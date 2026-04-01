const { contextBridge, ipcRenderer } = require("electron");

// 安全地暴露 API 到渲染进程
contextBridge.exposeInMainWorld("electronAPI", {
  // 平台信息
  platform: process.platform,
  isElectron: true,

  // 文件操作
  listFiles: () => ipcRenderer.invoke("files:list"),
  readFile: (fileId) => ipcRenderer.invoke("files:read", fileId),
  saveFile: (data) => ipcRenderer.invoke("files:save", data),
  deleteFile: (fileId) => ipcRenderer.invoke("files:delete", fileId),
  renameFile: (data) => ipcRenderer.invoke("files:rename", data),
  getFilesPath: () => ipcRenderer.invoke("files:getPath"),
  openFilesFolder: () => ipcRenderer.invoke("files:openFolder"),

  // 排序顺序
  getFileOrder: () => ipcRenderer.invoke("files:getOrder"),
  saveFileOrder: (order) => ipcRenderer.invoke("files:saveOrder", order),

  // 菜单事件
  onMenuNew: (callback) => ipcRenderer.on("menu-new", callback),
  onMenuOpen: (callback) => ipcRenderer.on("menu-open", callback),
  onMenuSave: (callback) => ipcRenderer.on("menu-save", callback),
  onMenuSaveAs: (callback) => ipcRenderer.on("menu-save-as", callback),

  // 清理监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
