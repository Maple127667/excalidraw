const path = require("path");

const fs = require("fs");

const { app, BrowserWindow, shell, Menu, ipcMain } = require("electron");

// 开发环境检测
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow;

// 获取用户文档目录下的 Excalidraw 文件夹
function getFilesDir() {
  const documentsPath = app.getPath("documents");
  const excalidrawDir = path.join(documentsPath, "Excalidraw");

  // 确保目录存在
  if (!fs.existsSync(excalidrawDir)) {
    fs.mkdirSync(excalidrawDir, { recursive: true });
  }

  return excalidrawDir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: "Excalidraw",
    icon: path.join(__dirname, "../public/favicon-32x32.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
    // 禁用默认菜单栏
    autoHideMenuBar: true,
  });

  // 开发模式加载本地服务器
  if (isDev) {
    mainWindow.loadURL("http://localhost:3080");
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式加载构建后的文件
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // 创建菜单
  createMenu();
}

// IPC: 获取文件列表
ipcMain.handle("files:list", async () => {
  try {
    const filesDir = getFilesDir();
    const files = fs.readdirSync(filesDir);

    const fileInfos = files
      .filter((file) => file.endsWith(".excalidraw"))
      .map((file) => {
        const filePath = path.join(filesDir, file);
        const stats = fs.statSync(filePath);

        return {
          id: file.replace(".excalidraw", ""),
          name: file.replace(".excalidraw", ""),
          path: filePath,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          size: stats.size,
        };
      });

    // 不再自动排序，保持文件系统顺序
    return { success: true, files: fileInfos };
  } catch (error) {
    console.error("Error listing files:", error);

    return { success: false, error: error.message };
  }
});

// IPC: 获取排序顺序
ipcMain.handle("files:getOrder", async () => {
  try {
    const filesDir = getFilesDir();
    const orderPath = path.join(filesDir, ".order.json");

    if (!fs.existsSync(orderPath)) {
      return { success: true, order: [] };
    }

    const content = fs.readFileSync(orderPath, "utf-8");
    const order = JSON.parse(content);

    return { success: true, order };
  } catch (error) {
    console.error("Error getting file order:", error);

    return { success: false, error: error.message };
  }
});

// IPC: 保存排序顺序
ipcMain.handle("files:saveOrder", async (event, order) => {
  try {
    const filesDir = getFilesDir();
    const orderPath = path.join(filesDir, ".order.json");

    fs.writeFileSync(orderPath, JSON.stringify(order, null, 2), "utf-8");

    return { success: true };
  } catch (error) {
    console.error("Error saving file order:", error);

    return { success: false, error: error.message };
  }
});

// IPC: 读取文件
ipcMain.handle("files:read", async (event, fileId) => {
  try {
    const filesDir = getFilesDir();
    const filePath = path.join(filesDir, `${fileId}.excalidraw`);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File not found" };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    return { success: true, data };
  } catch (error) {
    console.error("Error reading file:", error);

    return { success: false, error: error.message };
  }
});

// IPC: 保存文件
ipcMain.handle("files:save", async (event, { fileId, name, data }) => {
  try {
    const filesDir = getFilesDir();
    const fileName = name || fileId;
    const filePath = path.join(filesDir, `${fileName}.excalidraw`);

    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, "utf-8");

    return { success: true, path: filePath };
  } catch (error) {
    console.error("Error saving file:", error);

    return { success: false, error: error.message };
  }
});

// IPC: 删除文件
ipcMain.handle("files:delete", async (event, fileId) => {
  try {
    const filesDir = getFilesDir();
    const filePath = path.join(filesDir, `${fileId}.excalidraw`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting file:", error);

    return { success: false, error: error.message };
  }
});

// IPC: 重命名文件
ipcMain.handle("files:rename", async (event, { oldName, newName }) => {
  try {
    const filesDir = getFilesDir();
    const oldPath = path.join(filesDir, `${oldName}.excalidraw`);
    const newPath = path.join(filesDir, `${newName}.excalidraw`);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }

    return { success: true };
  } catch (error) {
    console.error("Error renaming file:", error);

    return { success: false, error: error.message };
  }
});

// IPC: 获取文件存储路径
ipcMain.handle("files:getPath", async () => {
  return getFilesDir();
});

// IPC: 打开文件所在目录
ipcMain.handle("files:openFolder", async () => {
  const filesDir = getFilesDir();
  shell.openPath(filesDir);
});

function createMenu() {
  const template = [
    {
      label: "文件",
      submenu: [
        {
          label: "新建",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow.webContents.send("menu-new"),
        },
        {
          label: "保存",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow.webContents.send("menu-save"),
        },
        {
          label: "另存为",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => mainWindow.webContents.send("menu-save-as"),
        },
        { type: "separator" },
        {
          label: "打开文件目录",
          click: () => {
            const filesDir = getFilesDir();
            shell.openPath(filesDir);
          },
        },
        { type: "separator" },
        {
          label: "退出",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Alt+F4",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "访问官网",
          click: () => shell.openExternal("https://excalidraw.com"),
        },
        {
          label: "文档",
          click: () => shell.openExternal("https://docs.excalidraw.com"),
        },
      ],
    },
  ];

  // macOS 特殊菜单
  if (process.platform === "darwin") {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 应用准备就绪
app.whenReady().then(createWindow);

// 所有窗口关闭时退出（macOS除外）
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// macOS 激活应用
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 处理未捕获的异常
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
