import { useCallback, useEffect, useState, useRef } from "react";
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

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
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
}

type DragPosition = "before" | "after" | null;

export const FilesSidebar = ({ onOpenFile, onNewFile }: FilesSidebarProps) => {
  const [files, setFiles] = useAtom(filesListAtom);
  const [loading, setLoading] = useAtom(filesLoadingAtom);
  const [currentFile, setCurrentFile] = useAtom(currentFileAtom);
  const modified = useAtomValue(fileModifiedAtom);

  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: LocalFileInfo;
  } | null>(null);
  const [draggedName, setDraggedName] = useState<string | null>(null);
  const [dragOverName, setDragOverName] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<DragPosition>(null);
  const [dropToEnd, setDropToEnd] = useState(false);

  const listRef = useRef<HTMLUListElement>(null);
  const isInitialLoad = useRef(true);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await fileStore.loadFiles());
    } finally {
      setLoading(false);
    }
  }, [setFiles, setLoading]);

  const saveOrder = useCallback(async (newFiles: LocalFileInfo[]) => {
    await fileStore.updateOrder(newFiles.map((f) => f.name));
  }, []);

  useEffect(() => {
    if (window.electronAPI && isInitialLoad.current) {
      isInitialLoad.current = false;
      loadFiles();
    }
  }, [loadFiles]);

  const handleNewFile = useCallback(async () => {
    const name = `画布_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "")}`;
    const emptyData = {
      elements: [],
      appState: { viewBackgroundColor: "#ffffff", gridSize: null },
      files: {},
    };
    try {
      await fileStore.saveFile(name, emptyData);
      await loadFiles();
      setCurrentFile({ name, modifiedAt: Date.now(), size: 0 });
      onNewFile();
    } catch (error) {
      console.error("Failed to create file:", error);
    }
  }, [loadFiles, setCurrentFile, onNewFile]);

  const handleOpenFile = useCallback(
    async (file: LocalFileInfo) => {
      try {
        const data = await fileStore.readFile(file.name);
        setCurrentFile(file);
        onOpenFile(file, data);
      } catch (error) {
        console.error("Failed to open file:", error);
      }
    },
    [setCurrentFile, onOpenFile],
  );

  const handleDeleteFile = useCallback(
    async (file: LocalFileInfo) => {
      if (!confirm(`确定要删除 "${file.name}" 吗？`)) {
        return;
      }
      try {
        await fileStore.deleteFile(file.name);
        await loadFiles();
        if (currentFile?.name === file.name) {
          setCurrentFile(null);
        }
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    },
    [currentFile, loadFiles, setCurrentFile],
  );

  const handleStartRename = useCallback((file: LocalFileInfo) => {
    setEditingName(file.name);
    setNewName(file.name);
    setContextMenu(null);
  }, []);

  const handleFinishRename = useCallback(
    async (file: LocalFileInfo) => {
      const trimmed = newName.trim();
      if (trimmed && trimmed !== file.name) {
        try {
          await fileStore.renameFile(file.name, trimmed);
          await loadFiles();
          if (currentFile?.name === file.name) {
            setCurrentFile({ ...currentFile, name: trimmed });
          }
        } catch (error) {
          console.error("Failed to rename file:", error);
        }
      }
      setEditingName(null);
      setNewName("");
    },
    [newName, loadFiles, currentFile, setCurrentFile],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: LocalFileInfo) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, file });
    },
    [],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, file: LocalFileInfo) => {
      setDraggedName(file.name);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", file.name);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, file: LocalFileInfo) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDropToEnd(false);
      const rect = e.currentTarget.getBoundingClientRect();
      setDragOverName(file.name);
      setDragPosition(
        e.clientY < rect.top + rect.height / 2 ? "before" : "after",
      );
    },
    [],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom
    ) {
      setDragOverName(null);
      setDragPosition(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, target: LocalFileInfo) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverName(null);
      setDragPosition(null);

      if (!draggedName || draggedName === target.name) {
        setDraggedName(null);
        return;
      }

      const newFiles = [...files];
      const draggedIdx = newFiles.findIndex((f) => f.name === draggedName);
      const targetIdx = newFiles.findIndex((f) => f.name === target.name);

      if (draggedIdx !== -1 && targetIdx !== -1) {
        const [dragged] = newFiles.splice(draggedIdx, 1);
        const insertIdx = dragPosition === "after" ? targetIdx : targetIdx;
        newFiles.splice(insertIdx, 0, dragged);
        setFiles(newFiles);
        saveOrder(newFiles);
      }
      setDraggedName(null);
    },
    [draggedName, files, setFiles, saveOrder, dragPosition],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedName(null);
    setDragOverName(null);
    setDragPosition(null);
    setDropToEnd(false);
  }, []);

  const handleListDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!draggedName || !listRef.current) {
        return;
      }
      const items = listRef.current.querySelectorAll(".files-sidebar__item");
      if (items.length === 0) {
        return;
      }
      const lastRect = items[items.length - 1].getBoundingClientRect();
      if (e.clientY > lastRect.bottom) {
        setDragOverName(null);
        setDragPosition(null);
        setDropToEnd(true);
      } else {
        setDropToEnd(false);
      }
      e.dataTransfer.dropEffect = "move";
    },
    [draggedName],
  );

  const handleDropToEnd = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropToEnd(false);
      if (!draggedName) {
        return;
      }
      const newFiles = [...files];
      const idx = newFiles.findIndex((f) => f.name === draggedName);
      if (idx !== -1) {
        const [dragged] = newFiles.splice(idx, 1);
        newFiles.push(dragged);
        setFiles(newFiles);
        saveOrder(newFiles);
      }
      setDraggedName(null);
    },
    [draggedName, files, setFiles, saveOrder],
  );

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

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

      <div
        className="files-sidebar__content"
        onDragOver={handleListDragOver}
        onDrop={handleDropToEnd}
      >
        {loading ? (
          <div className="files-sidebar__loading">加载中...</div>
        ) : files.length === 0 ? (
          <div className="files-sidebar__empty">
            <p>暂无画布</p>
            <button onClick={handleNewFile}>创建第一个画布</button>
          </div>
        ) : (
          <ul className="files-sidebar__list" ref={listRef}>
            {files.map((file) => (
              <li
                key={file.name}
                className={`files-sidebar__item ${
                  currentFile?.name === file.name ? "active" : ""
                } ${
                  modified && currentFile?.name === file.name ? "modified" : ""
                } ${draggedName === file.name ? "dragging" : ""} ${
                  dragOverName === file.name && dragPosition === "before"
                    ? "drag-over-before"
                    : ""
                } ${
                  dragOverName === file.name && dragPosition === "after"
                    ? "drag-over-after"
                    : ""
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
                {editingName === file.name ? (
                  <input
                    type="text"
                    className="files-sidebar__rename-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={() => handleFinishRename(file)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleFinishRename(file);
                      } else if (e.key === "Escape") {
                        setEditingName(null);
                        setNewName("");
                      }
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="files-sidebar__item-name">
                      {file.name}
                      {modified && currentFile?.name === file.name && (
                        <span className="files-sidebar__modified-dot">●</span>
                      )}
                    </span>
                    <span className="files-sidebar__item-date">
                      {formatDate(file.modifiedAt)}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {dropToEnd && (
          <div className="files-sidebar__drop-end-indicator">
            放置到此处（末尾）
          </div>
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
