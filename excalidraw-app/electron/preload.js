const { contextBridge, ipcRenderer } = require("electron");

// 安全地暴露 API 到渲染进程
contextBridge.exposeInMainWorld("electronAPI", {
  // 平台信息
  platform: process.platform,
  isElectron: true,

  // 文件操作（可选扩展功能）
  onMenuNew: (callback) => ipcRenderer.on("menu-new", callback),
  onMenuOpen: (callback) => ipcRenderer.on("menu-open", callback),
  onMenuSave: (callback) => ipcRenderer.on("menu-save", callback),

  // 清理监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
