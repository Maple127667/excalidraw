# Excalidraw Electron 桌面应用配置

## 已完成的配置

1. ✅ Electron 主进程文件: `excalidraw-app/electron/main.js`
2. ✅ 预加载脚本: `excalidraw-app/electron/preload.js`
3. ✅ package.json 脚本配置
4. ✅ electron-builder 打包配置

## 需要手动完成的步骤

### 1. 清理锁定的 electron 目录

由于之前的安装过程中 electron 目录被锁定，需要手动删除：

```bash
# 在项目根目录执行
# 1. 关闭所有可能占用文件的进程（VSCode、终端等）
# 2. 手动删除以下目录：
#    - node_modules/electron
#    - node_modules/.electron-*
#    - excalidraw-app/node_modules/electron
#    - excalidraw-app/node_modules/.electron-*
```

### 2. 安装依赖

```bash
# 配置镜像
yarn config set registry https://registry.npmmirror.com
yarn config set electron_mirror https://npmmirror.com/mirrors/electron/

# 在项目根目录安装
yarn add -W -D electron@^33.0.0 electron-builder@^25.1.8 concurrently@^9.1.0 wait-on@^8.0.0
```

## 使用方法

安装完成后，可执行以下命令：

### 开发模式

```bash
cd excalidraw-app
yarn electron:dev
```

- 启动 Vite 开发服务器
- 自动打开 Electron 窗口
- 支持热重载

### 打包应用

```bash
# Windows
yarn electron:build:win

# macOS
yarn electron:build:mac

# Linux
yarn electron:build:linux
```

打包后的安装包在 `excalidraw-app/dist-electron/` 目录。

## 配置说明

### package.json 关键配置

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "concurrently \"yarn start\" \"wait-on http://localhost:3000 && cross-env NODE_ENV=development electron .\"",
    "electron:build": "yarn build && electron-builder",
    "electron:build:win": "yarn build && electron-builder --win",
    "electron:build:mac": "yarn build && electron-builder --mac",
    "electron:build:linux": "yarn build && electron-builder --linux"
  },
  "build": {
    "appId": "com.excalidraw.app",
    "productName": "Excalidraw",
    "directories": { "output": "dist-electron" },
    "files": ["electron/**/*", "build/**/*"]
  }
}
```

### 主要功能

- 🖥️ 原生桌面应用体验
- 📁 支持文件拖拽打开
- 🔗 外部链接自动用浏览器打开
- 📋 完整的菜单栏（文件、编辑、视图、帮助）
- 🌙 自动适配系统主题
- 📦 支持打包为 Windows/macOS/Linux 安装包

## 常见问题

### Q: electron 安装失败/超时？

A: 使用国内镜像：

```bash
yarn config set electron_mirror https://npmmirror.com/mirrors/electron/
```

### Q: 打包后白屏？

A: 检查 `main.js` 中的 `loadFile` 路径是否正确指向 `build/index.html`

### Q: 开发模式启动慢？

A: 首次启动需要等待 Vite 编译，后续会使用缓存加速
