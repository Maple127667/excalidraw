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

// 获取索引文件路径
function getIndexFilePath() {
  return path.join(getFilesDir(), ".index.json");
}

// 读取索引
function readIndex() {
  try {
    const filePath = getIndexFilePath();
    if (!fs.existsSync(filePath)) {
      return { folders: [], order: [] };
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { folders: [], order: [] };
  }
}

// 写入索引
function writeIndex(index) {
  try {
    fs.writeFileSync(getIndexFilePath(), JSON.stringify(index, null, 2));
  } catch (error) {
    console.error("Error writing index:", error);
  }
}

// 扫描物理文件并同步索引
function scanFiles() {
  const filesDir = getFilesDir();
  const index = readIndex();

  // 扫描文件夹
  const physicalFolders = fs
    .readdirSync(filesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);

  // 扫描根目录文件
  const physicalRootFiles = fs
    .readdirSync(filesDir, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith(".excalidraw"))
    .map((f) => f.name.replace(".excalidraw", ""));

  // 扫描子目录文件
  const folderFiles = {};
  for (const folder of physicalFolders) {
    const folderPath = path.join(filesDir, folder);
    folderFiles[folder] = fs
      .readdirSync(folderPath)
      .filter((f) => f.endsWith(".excalidraw"))
      .map((f) => f.replace(".excalidraw", ""));
  }

  // 同步文件夹列表
  index.folders = physicalFolders;

  // 同步排序：移除不存在的项，添加新发现的项
  const existingItems = new Set();
  const newOrder = [];

  // 保留已有项
  for (const item of index.order) {
    if (item.type === "folder" && physicalFolders.includes(item.name)) {
      newOrder.push(item);
      existingItems.add(`folder:${item.name}`);
    } else if (item.type === "file") {
      const folder = item.folder || "";
      const files = folder ? folderFiles[folder] || [] : physicalRootFiles;
      if (files.includes(item.name)) {
        newOrder.push(item);
        existingItems.add(`file:${folder}:${item.name}`);
      }
    }
  }

  // 添加新发现的文件夹
  for (const folder of physicalFolders) {
    if (!existingItems.has(`folder:${folder}`)) {
      newOrder.push({ type: "folder", name: folder });
      existingItems.add(`folder:${folder}`);
    }
  }

  // 添加新发现的文件
  for (const name of physicalRootFiles) {
    if (!existingItems.has(`file::${name}`)) {
      newOrder.push({ type: "file", name, folder: null });
    }
  }
  for (const [folder, files] of Object.entries(folderFiles)) {
    for (const name of files) {
      if (!existingItems.has(`file:${folder}:${name}`)) {
        newOrder.push({ type: "file", name, folder });
      }
    }
  }

  index.order = newOrder;
  writeIndex(index);
  return index;
}

// 获取文件列表（带详细信息）
function getFileList() {
  const filesDir = getFilesDir();
  const index = scanFiles();

  return index.order.map((item) => {
    if (item.type === "folder") {
      const folderPath = path.join(filesDir, item.name);
      const stats = fs.statSync(folderPath);
      return {
        type: "folder",
        name: item.name,
        modifiedAt: stats.mtimeMs,
      };
    }
    const folder = item.folder || "";
    const filePath = path.join(
      filesDir,
      folder
        ? path.join(folder, `${item.name}.excalidraw`)
        : `${item.name}.excalidraw`,
    );
    const stats = fs.existsSync(filePath)
      ? fs.statSync(filePath)
      : { mtimeMs: 0, size: 0 };
    return {
      type: "file",
      name: item.name,
      folder: folder || null,
      modifiedAt: stats.mtimeMs,
      size: stats.size,
    };
  });
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
ipcMain.handle("files:list", () => ({ success: true, items: getFileList() }));

// IPC: 更新排序
ipcMain.handle("files:updateOrder", (event, order) => {
  const index = readIndex();
  index.order = order;
  writeIndex(index);
  return { success: true };
});

// IPC: 创建文件夹
ipcMain.handle("files:createFolder", (event, name) => {
  try {
    const folderPath = path.join(getFilesDir(), name);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }

    // 添加到索引
    const index = readIndex();
    const exists = index.order.some(
      (item) => item.type === "folder" && item.name === name,
    );
    if (!exists) {
      index.order.push({ type: "folder", name });
      writeIndex(index);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 删除文件夹
ipcMain.handle("files:deleteFolder", (event, { name, mode }) => {
  try {
    const filesDir = getFilesDir();
    const folderPath = path.join(filesDir, name);

    if (!fs.existsSync(folderPath)) {
      return { success: false, error: "Folder not found" };
    }

    const index = readIndex();

    if (mode === "release") {
      // 解放模式：将文件移到主目录
      const files = fs
        .readdirSync(folderPath)
        .filter((f) => f.endsWith(".excalidraw"));

      for (const file of files) {
        const oldPath = path.join(folderPath, file);
        const newPath = path.join(filesDir, file);

        // 如果主目录有同名文件，添加后缀
        let targetPath = newPath;
        if (fs.existsSync(newPath)) {
          const baseName = file.replace(".excalidraw", "");
          let counter = 1;
          while (
            fs.existsSync(
              path.join(filesDir, `${baseName}_${counter}.excalidraw`),
            )
          ) {
            counter++;
          }
          targetPath = path.join(filesDir, `${baseName}_${counter}.excalidraw`);
        }

        fs.renameSync(oldPath, targetPath);

        // 更新索引
        const oldFileName = file.replace(".excalidraw", "");
        const newFileName = path.basename(targetPath, ".excalidraw");
        for (const item of index.order) {
          if (
            item.type === "file" &&
            item.name === oldFileName &&
            item.folder === name
          ) {
            item.name = newFileName;
            item.folder = null;
          }
        }
      }

      // 删除空文件夹
      fs.rmdirSync(folderPath);

      // 从索引中移除文件夹
      index.order = index.order.filter(
        (item) => !(item.type === "folder" && item.name === name),
      );
    } else {
      // 删除模式：删除文件夹及其所有内容
      fs.rmSync(folderPath, { recursive: true });

      // 从索引中移除文件夹及其所有文件
      index.order = index.order.filter(
        (item) =>
          !(item.type === "folder" && item.name === name) &&
          !(item.type === "file" && item.folder === name),
      );
    }

    index.folders = index.folders.filter((f) => f !== name);
    writeIndex(index);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 重命名文件夹
ipcMain.handle("files:renameFolder", (event, { oldName, newName }) => {
  try {
    const filesDir = getFilesDir();
    const oldPath = path.join(filesDir, oldName);
    const newPath = path.join(filesDir, newName);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }
    // 更新索引中的文件夹名
    const index = readIndex();
    for (const item of index.order) {
      if (item.type === "folder" && item.name === oldName) {
        item.name = newName;
      } else if (item.type === "file" && item.folder === oldName) {
        item.folder = newName;
      }
    }
    index.folders = index.folders.map((f) => (f === oldName ? newName : f));
    writeIndex(index);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 读取文件
ipcMain.handle("files:read", (event, { name, folder }) => {
  try {
    const filesDir = getFilesDir();
    const normalizedFolder = folder || null;
    const filePath = normalizedFolder
      ? path.join(filesDir, normalizedFolder, `${name}.excalidraw`)
      : path.join(filesDir, `${name}.excalidraw`);

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
ipcMain.handle(
  "files:save",
  (event, { name, folder, data, overwrite = false }) => {
    try {
      const filesDir = getFilesDir();
      const normalizedFolder = folder || null;
      const targetDir = normalizedFolder
        ? path.join(filesDir, normalizedFolder)
        : filesDir;

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      let finalName = name;
      let filePath = path.join(targetDir, `${finalName}.excalidraw`);

      // 如果不覆盖且文件已存在，添加后缀
      if (!overwrite && fs.existsSync(filePath)) {
        let counter = 1;
        while (fs.existsSync(filePath)) {
          finalName = `${name}(${counter})`;
          filePath = path.join(targetDir, `${finalName}.excalidraw`);
          counter++;
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      // 更新索引（如果文件不存在于索引中，添加它）
      const index = readIndex();
      const exists = index.order.some(
        (item) =>
          item.type === "file" &&
          item.name === finalName &&
          (item.folder || null) === normalizedFolder,
      );

      if (!exists) {
        index.order.push({
          type: "file",
          name: finalName,
          folder: normalizedFolder,
        });
        writeIndex(index);
      }

      return { success: true, name: finalName };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

// IPC: 删除文件
ipcMain.handle("files:delete", (event, { name, folder }) => {
  try {
    const filesDir = getFilesDir();

    // 统一 folder 为 null（处理 undefined 情况）
    const normalizedFolder = folder || null;

    // 构造文件路径
    const filePath = normalizedFolder
      ? path.join(filesDir, normalizedFolder, `${name}.excalidraw`)
      : path.join(filesDir, `${name}.excalidraw`);

    // 删除物理文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 从索引中移除
    const index = readIndex();
    const beforeLength = index.order.length;
    index.order = index.order.filter(
      (item) =>
        !(
          item.type === "file" &&
          item.name === name &&
          (item.folder || null) === normalizedFolder
        ),
    );

    if (index.order.length !== beforeLength) {
      writeIndex(index);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 重命名文件
ipcMain.handle("files:rename", (event, { name, folder, newName }) => {
  try {
    const filesDir = getFilesDir();
    const normalizedFolder = folder || null;

    const oldPath = normalizedFolder
      ? path.join(filesDir, normalizedFolder, `${name}.excalidraw`)
      : path.join(filesDir, `${name}.excalidraw`);

    const newPath = normalizedFolder
      ? path.join(filesDir, normalizedFolder, `${newName}.excalidraw`)
      : path.join(filesDir, `${newName}.excalidraw`);

    if (!fs.existsSync(oldPath)) {
      return { success: false, error: "File not found" };
    }

    fs.renameSync(oldPath, newPath);

    // 更新索引
    const index = readIndex();
    for (const item of index.order) {
      if (
        item.type === "file" &&
        item.name === name &&
        (item.folder || null) === normalizedFolder
      ) {
        item.name = newName;
      }
    }
    writeIndex(index);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC: 移动文件到文件夹
ipcMain.handle("files:move", (event, { name, fromFolder, toFolder }) => {
  try {
    const filesDir = getFilesDir();
    const normalizedFrom = fromFolder || null;
    const normalizedTo = toFolder || null;

    // 构造源路径
    const oldPath = normalizedFrom
      ? path.join(filesDir, normalizedFrom, `${name}.excalidraw`)
      : path.join(filesDir, `${name}.excalidraw`);

    // 构造目标目录和路径
    const targetDir = normalizedTo
      ? path.join(filesDir, normalizedTo)
      : filesDir;
    const newPath = path.join(targetDir, `${name}.excalidraw`);

    // 确保目标目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 检查源文件是否存在
    if (!fs.existsSync(oldPath)) {
      return { success: false, error: "Source file not found" };
    }

    // 移动文件
    fs.renameSync(oldPath, newPath);

    // 更新索引
    const index = readIndex();
    for (const item of index.order) {
      if (
        item.type === "file" &&
        item.name === name &&
        (item.folder || null) === normalizedFrom
      ) {
        item.folder = normalizedTo;
      }
    }
    writeIndex(index);

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
