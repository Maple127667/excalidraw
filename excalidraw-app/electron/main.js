const path = require("path");
const fs = require("fs");

const { app, BrowserWindow, shell, Menu, ipcMain } = require("electron");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
let mainWindow;

// 获取文件存储目录
function getFilesDir() {
  const documentsPath = app.getPath("documents");
  const excalidrawDir = path.join(documentsPath, "Excalidraw");
  if (!fs.existsSync(excalidrawDir)) {
    fs.mkdirSync(excalidrawDir, { recursive: true });
  }
  return excalidrawDir;
}

// 获取排序文件路径
function getOrderFilePath() {
  return path.join(getFilesDir(), ".order.json");
}

// 读取排序
function readOrder() {
  try {
    const filePath = getOrderFilePath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

// 写入排序
function writeOrder(order) {
  try {
    fs.writeFileSync(getOrderFilePath(), JSON.stringify(order, null, 2));
  } catch (error) {
    console.error("Error writing order:", error);
  }
}

// 获取文件列表（物理文件 + 排序）
function getFileList() {
  const filesDir = getFilesDir();
  const physicalFiles = fs
    .readdirSync(filesDir)
    .filter((f) => f.endsWith(".excalidraw"))
    .map((f) => f.replace(".excalidraw", ""));

  const order = readOrder();
  const orderedFiles = [];
  const remainingFiles = [];

  // 按排序顺序排列
  for (const name of order) {
    if (physicalFiles.includes(name)) {
      const filePath = path.join(filesDir, `${name}.excalidraw`);
      const stats = fs.statSync(filePath);
      orderedFiles.push({
        name,
        modifiedAt: stats.mtimeMs,
        size: stats.size,
      });
    }
  }

  // 新文件追加到末尾
  for (const name of physicalFiles) {
    if (!order.includes(name)) {
      const filePath = path.join(filesDir, `${name}.excalidraw`);
      const stats = fs.statSync(filePath);
      remainingFiles.push({
        name,
        modifiedAt: stats.mtimeMs,
        size: stats.size,
      });
    }
  }

  // 如果有新文件，更新排序文件
  if (remainingFiles.length > 0) {
    const newOrder = [...orderedFiles, ...remainingFiles].map((f) => f.name);
    writeOrder(newOrder);
  }

  return [...orderedFiles, ...remainingFiles];
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
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3080");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => (mainWindow = null));
  createMenu();
}

// IPC: 获取文件列表
ipcMain.handle("files:list", () => ({ success: true, files: getFileList() }));

// IPC: 更新排序
ipcMain.handle("files:updateOrder", (event, order) => {
  writeOrder(order);
  return { success: true };
});

// IPC: 读取文件
ipcMain.handle("files:read", (event, name) => {
  try {
    const filePath = path.join(getFilesDir(), `${name}.excalidraw`);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File not found" };
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 保存文件
ipcMain.handle("files:save", (event, { name, data }) => {
  try {
    const filePath = path.join(getFilesDir(), `${name}.excalidraw`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // 如果是新文件，添加到排序末尾
    const order = readOrder();
    if (!order.includes(name)) {
      order.push(name);
      writeOrder(order);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 删除文件
ipcMain.handle("files:delete", (event, name) => {
  try {
    const filePath = path.join(getFilesDir(), `${name}.excalidraw`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 从排序中移除
    const order = readOrder();
    writeOrder(order.filter((n) => n !== name));

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 重命名文件
ipcMain.handle("files:rename", (event, { oldName, newName }) => {
  try {
    const filesDir = getFilesDir();
    const oldPath = path.join(filesDir, `${oldName}.excalidraw`);
    const newPath = path.join(filesDir, `${newName}.excalidraw`);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }

    // 更新排序
    const order = readOrder();
    const idx = order.indexOf(oldName);
    if (idx !== -1) {
      order[idx] = newName;
      writeOrder(order);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 获取文件路径
ipcMain.handle("files:getPath", () => getFilesDir());

// IPC: 打开文件夹
ipcMain.handle("files:openFolder", () => shell.openPath(getFilesDir()));

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
        { type: "separator" },
        { label: "打开文件目录", click: () => shell.openPath(getFilesDir()) },
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
      submenu: ["undo", "redo", "cut", "copy", "paste", "selectAll"].map(
        (r) => ({ role: r }),
      ),
    },
    {
      label: "视图",
      submenu: [
        "reload",
        "toggleDevTools",
        "resetZoom",
        "zoomIn",
        "zoomOut",
        "togglefullscreen",
      ].map((r) => ({ role: r })),
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "访问官网",
          click: () => shell.openExternal("https://excalidraw.com"),
        },
      ],
    },
  ];

  if (process.platform === "darwin") {
    template.unshift({
      label: app.getName(),
      submenu: [{ role: "about" }, { role: "quit" }],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
app.on(
  "activate",
  () => BrowserWindow.getAllWindows().length === 0 && createWindow(),
);
