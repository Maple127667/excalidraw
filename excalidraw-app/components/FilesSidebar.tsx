import { useCallback, useEffect, useState } from "react";

import { ExcalLogo } from "@excalidraw/excalidraw/components/icons";

import { useAtom, useAtomValue } from "../app-jotai";

import {
  currentFileAtom,
  filesListAtom,
  filesLoadingAtom,
  fileModifiedAtom,
  fileStore,
  type LocalFileInfo,
} from "../data/fileStore";

import "./FilesSidebar.scss";

// 格式化日期
const formatDate = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return "今天";
  }
  if (days === 1) {
    return "昨天";
  }
  if (days < 7) {
    return `${days} 天前`;
  }
  return date.toLocaleDateString("zh-CN");
};

interface FilesSidebarProps {
  onOpenFile: (file: LocalFileInfo, data: unknown) => void;
  onNewFile: () => void;
  getCurrentData: () => {
    elements: unknown;
    appState: unknown;
    files: unknown;
  } | null;
}

export const FilesSidebar = ({ onOpenFile, onNewFile }: FilesSidebarProps) => {
  const [files, setFiles] = useAtom(filesListAtom);
  const [loading, setLoading] = useAtom(filesLoadingAtom);
  const [currentFile, setCurrentFile] = useAtom(currentFileAtom);
  const modified = useAtomValue(fileModifiedAtom);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: LocalFileInfo;
  } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // 加载文件列表并应用排序
  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const fileList = await fileStore.loadFiles();
      const order = await fileStore.getFileOrder();

      // 如果有保存的排序，按排序排列
      if (order.length > 0) {
        const orderedFiles: LocalFileInfo[] = [];
        const remainingFiles: LocalFileInfo[] = [];

        // 先按保存的顺序添加
        for (const id of order) {
          const file = fileList.find((f) => f.id === id);
          if (file) {
            orderedFiles.push(file);
          }
        }

        // 添加新文件（不在排序中的）
        for (const file of fileList) {
          if (!order.includes(file.id)) {
            remainingFiles.push(file);
          }
        }

        setFiles([...orderedFiles, ...remainingFiles]);
      } else {
        setFiles(fileList);
      }
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setLoading(false);
    }
  }, [setFiles, setLoading]);

  // 保存排序
  const saveOrder = useCallback(async (newFiles: LocalFileInfo[]) => {
    try {
      const order = newFiles.map((f) => f.id);
      await fileStore.saveFileOrder(order);
    } catch (error) {
      console.error("Failed to save order:", error);
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      loadFiles();
    }
  }, [loadFiles]);

  // 新建文件
  const handleNewFile = useCallback(async () => {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "");
    const name = `画布_${timestamp}`;
    const id = name;

    const emptyData = {
      elements: [],
      appState: {
        viewBackgroundColor: "#ffffff",
        gridSize: null,
      },
      files: {},
    };

    try {
      await fileStore.saveFile(id, name, emptyData);
      await loadFiles();
      setCurrentFile({
        id,
        name,
        path: "",
        createdAt: new Date(),
        modifiedAt: new Date(),
        size: 0,
      });
      onNewFile();
    } catch (error) {
      console.error("Failed to create file:", error);
    }
  }, [loadFiles, setCurrentFile, onNewFile]);

  // 打开文件
  const handleOpenFile = useCallback(
    async (file: LocalFileInfo) => {
      try {
        const result = await fileStore.readFile(file.id);
        if (result) {
          setCurrentFile(file);
          onOpenFile(file, result);
        }
      } catch (error) {
        console.error("Failed to open file:", error);
      }
    },
    [setCurrentFile, onOpenFile],
  );

  // 删除文件
  const handleDeleteFile = useCallback(
    async (file: LocalFileInfo) => {
      if (!confirm(`确定要删除 "${file.name}" 吗？`)) {
        return;
      }

      try {
        await fileStore.deleteFile(file.id);
        await loadFiles();

        if (currentFile?.id === file.id) {
          setCurrentFile(null);
        }
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    },
    [currentFile, loadFiles, setCurrentFile],
  );

  // 开始重命名
  const handleStartRename = useCallback((file: LocalFileInfo) => {
    setEditingId(file.id);
    setEditingName(file.name);
    setContextMenu(null);
  }, []);

  // 完成重命名
  const handleFinishRename = useCallback(
    async (file: LocalFileInfo) => {
      if (editingName.trim() && editingName !== file.name) {
        try {
          await fileStore.renameFile(file.name, editingName.trim());
          await loadFiles();

          if (currentFile?.id === file.id) {
            setCurrentFile({
              ...currentFile,
              name: editingName.trim(),
            });
          }
        } catch (error) {
          console.error("Failed to rename file:", error);
        }
      }
      setEditingId(null);
      setEditingName("");
    },
    [editingName, loadFiles, currentFile, setCurrentFile],
  );

  // 右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: LocalFileInfo) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, file });
    },
    [],
  );

  // 拖拽开始
  const handleDragStart = useCallback(
    (e: React.DragEvent, file: LocalFileInfo) => {
      setDraggedId(file.id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", file.id);
    },
    [],
  );

  // 拖拽经过
  const handleDragOver = useCallback(
    (e: React.DragEvent, file: LocalFileInfo) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverId(file.id);
    },
    [],
  );

  // 拖拽离开
  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  // 放下
  const handleDrop = useCallback(
    (e: React.DragEvent, targetFile: LocalFileInfo) => {
      e.preventDefault();
      setDragOverId(null);

      if (!draggedId || draggedId === targetFile.id) {
        setDraggedId(null);
        return;
      }

      // 重新排序
      const newFiles = [...files];
      const draggedIndex = newFiles.findIndex((f) => f.id === draggedId);
      const targetIndex = newFiles.findIndex((f) => f.id === targetFile.id);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [draggedFile] = newFiles.splice(draggedIndex, 1);
        newFiles.splice(targetIndex, 0, draggedFile);
        setFiles(newFiles);
        saveOrder(newFiles);
      }

      setDraggedId(null);
    },
    [draggedId, files, setFiles, saveOrder],
  );

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  // 点击空白处关闭菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);

    return () => window.removeEventListener("click", handleClick);
  }, []);

  // 检测是否在 Electron 中
  if (!window.electronAPI) {
    return null;
  }

  return (
    <div className="files-sidebar">
      <div className="files-sidebar__header">
        <div className="files-sidebar__title">
          <div className="files-sidebar__logo">{ExcalLogo}</div>
          <span>我的画布</span>
        </div>
        <button
          className="files-sidebar__new-btn"
          onClick={handleNewFile}
          title="新建画布"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="files-sidebar__content">
        {loading ? (
          <div className="files-sidebar__loading">加载中...</div>
        ) : files.length === 0 ? (
          <div className="files-sidebar__empty">
            <p>暂无画布</p>
            <button onClick={handleNewFile}>创建第一个画布</button>
          </div>
        ) : (
          <ul className="files-sidebar__list">
            {files.map((file) => (
              <li
                key={file.id}
                className={`files-sidebar__item ${
                  currentFile?.id === file.id ? "active" : ""
                } ${
                  modified && currentFile?.id === file.id ? "modified" : ""
                } ${dragOverId === file.id ? "drag-over" : ""} ${
                  draggedId === file.id ? "dragging" : ""
                }`}
                onClick={() => handleOpenFile(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
                draggable
                onDragStart={(e) => handleDragStart(e, file)}
                onDragOver={(e) => handleDragOver(e, file)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, file)}
                onDragEnd={handleDragEnd}
              >
                {editingId === file.id ? (
                  <input
                    type="text"
                    className="files-sidebar__rename-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleFinishRename(file)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleFinishRename(file);
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                        setEditingName("");
                      }
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="files-sidebar__item-name">
                      {file.name}
                      {modified && currentFile?.id === file.id && (
                        <span className="files-sidebar__modified-dot">●</span>
                      )}
                    </span>
                    <span className="files-sidebar__item-date">
                      {formatDate(new Date(file.modifiedAt))}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="files-sidebar__footer">
        <button
          onClick={() => fileStore.openFilesFolder()}
          title="打开文件目录"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          打开文件夹
        </button>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="files-sidebar__context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => handleStartRename(contextMenu.file)}>
            重命名
          </button>
          <button
            onClick={() => handleDeleteFile(contextMenu.file)}
            className="danger"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
};
