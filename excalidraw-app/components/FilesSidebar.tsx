import { useCallback, useEffect, useState, useRef } from "react";
import { ExcalLogo } from "@excalidraw/excalidraw/components/icons";

import { useAtom, useAtomValue } from "../app-jotai";
import {
  currentFileAtom,
  filesListAtom,
  filesLoadingAtom,
  fileModifiedAtom,
  expandedFoldersAtom,
  fileStore,
  type ListItem,
  type FileItem,
  type CurrentFile,
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
  onOpenFile: (file: CurrentFile, data: unknown) => void;
  onNewFile: () => void;
}

export const FilesSidebar = ({ onOpenFile, onNewFile }: FilesSidebarProps) => {
  const [items, setItems] = useAtom(filesListAtom);
  const [loading, setLoading] = useAtom(filesLoadingAtom);
  const [currentFile, setCurrentFile] = useAtom(currentFileAtom);
  const modified = useAtomValue(fileModifiedAtom);
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);

  const [editingItem, setEditingItem] = useState<{
    type: "file" | "folder";
    name: string;
    folder: string | null;
  } | null>(null);
  const [newName, setNewName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: ListItem;
  } | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    type: "file" | "folder";
    name: string;
    folder: string | null;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    type: "file" | "folder";
    name: string;
    folder: string | null;
    position: "before" | "after" | "into";
  } | null>(null);

  // 删除确认对话框（文件和文件夹统一）
  const [deleteDialog, setDeleteDialog] = useState<{
    type: "file" | "folder";
    name: string;
    folder: string | null;
  } | null>(null);

  // 新建文件夹状态
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // 新建文件状态
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileNameState] = useState("");
  const [targetFolderForNewFile, setTargetFolderForNewFile] = useState<
    string | null
  >(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  const listRef = useRef<HTMLUListElement>(null);
  const isInitialLoad = useRef(true);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fileStore.loadFiles());
    } finally {
      setLoading(false);
    }
  }, [setItems, setLoading]);

  useEffect(() => {
    if (window.electronAPI && isInitialLoad.current) {
      isInitialLoad.current = false;
      loadFiles();
    }
  }, [loadFiles]);

  // 切换文件夹展开状态
  const toggleFolder = useCallback(
    (folderName: string) => {
      const newExpanded = new Set(expandedFolders);
      if (newExpanded.has(folderName)) {
        newExpanded.delete(folderName);
      } else {
        newExpanded.add(folderName);
      }
      setExpandedFolders(newExpanded);
    },
    [expandedFolders, setExpandedFolders],
  );

  // 新建文件
  const handleNewFile = useCallback((targetFolder?: string | null) => {
    setIsCreatingFile(true);
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "");
    setNewFileNameState(`画布_${timestamp}`);
    setTargetFolderForNewFile(targetFolder ?? null);
  }, []);

  // 完成创建文件
  const handleFinishCreateFile = useCallback(async () => {
    const trimmed = newFileName.trim();
    if (!trimmed) {
      setIsCreatingFile(false);
      setNewFileNameState("");
      setTargetFolderForNewFile(null);
      return;
    }

    const emptyData = {
      elements: [],
      appState: { viewBackgroundColor: "#ffffff", gridSize: null },
      files: {},
    };

    try {
      const actualName = await fileStore.saveFile(
        trimmed,
        emptyData,
        targetFolderForNewFile,
      );
      await loadFiles();
      setCurrentFile({ name: actualName, folder: targetFolderForNewFile });
      onNewFile();
    } catch (error) {
      console.error("Failed to create file:", error);
    }

    setIsCreatingFile(false);
    setNewFileNameState("");
    setTargetFolderForNewFile(null);
  }, [
    newFileName,
    targetFolderForNewFile,
    loadFiles,
    setCurrentFile,
    onNewFile,
  ]);

  // 新建文件夹
  const handleNewFolder = useCallback(() => {
    setIsCreatingFolder(true);
    setNewFolderName("新建文件夹");
  }, []);

  // 完成创建文件夹
  const handleFinishCreateFolder = useCallback(async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setIsCreatingFolder(false);
      setNewFolderName("");
      return;
    }
    try {
      await fileStore.createFolder(trimmed);
      await loadFiles();
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
    setIsCreatingFolder(false);
    setNewFolderName("");
  }, [newFolderName, loadFiles]);

  // 打开文件
  const handleOpenFile = useCallback(
    async (file: FileItem) => {
      try {
        const data = await fileStore.readFile(file.name, file.folder);
        setCurrentFile({ name: file.name, folder: file.folder });
        onOpenFile({ name: file.name, folder: file.folder }, data);
      } catch (error) {
        console.error("Failed to open file:", error);
      }
    },
    [setCurrentFile, onOpenFile],
  );

  // 删除
  const handleDelete = useCallback(async (item: ListItem) => {
    // 统一显示删除确认对话框
    setDeleteDialog({
      type: item.type,
      name: item.name,
      folder: item.type === "file" ? item.folder : null,
    });
    setContextMenu(null);
  }, []);

  // 处理删除确认
  const handleDeleteConfirm = useCallback(
    async (mode?: "release" | "delete") => {
      if (!deleteDialog) {
        return;
      }

      try {
        if (deleteDialog.type === "folder") {
          // 文件夹删除
          await fileStore.deleteFolder(deleteDialog.name, mode || "delete");
          await loadFiles();

          // 如果当前打开的文件在被删除的文件夹中，关闭它
          if (mode === "delete" && currentFile?.folder === deleteDialog.name) {
            setCurrentFile(null);
          }
        } else {
          // 文件删除
          await fileStore.deleteFile(deleteDialog.name, deleteDialog.folder);
          await loadFiles();

          // 如果删除的是当前打开的文件，关闭它
          if (
            currentFile?.name === deleteDialog.name &&
            currentFile?.folder === deleteDialog.folder
          ) {
            setCurrentFile(null);
          }
        }
      } catch (error) {
        console.error("Failed to delete:", error);
      }

      setDeleteDialog(null);
    },
    [deleteDialog, loadFiles, currentFile, setCurrentFile],
  );

  // 开始重命名
  const handleStartRename = useCallback((item: ListItem) => {
    setEditingItem({
      type: item.type,
      name: item.name,
      folder: item.type === "file" ? item.folder : null,
    });
    setNewName(item.name);
    setContextMenu(null);
  }, []);

  // 完成重命名
  const handleFinishRename = useCallback(async () => {
    const trimmed = newName.trim();
    if (!editingItem || !trimmed || trimmed === editingItem.name) {
      setEditingItem(null);
      setNewName("");
      return;
    }

    try {
      if (editingItem.type === "folder") {
        await fileStore.renameFolder(editingItem.name, trimmed);
      } else {
        await fileStore.renameFile(
          editingItem.name,
          editingItem.folder,
          trimmed,
        );
      }
      await loadFiles();
      if (
        editingItem.type === "file" &&
        currentFile?.name === editingItem.name &&
        currentFile?.folder === editingItem.folder
      ) {
        setCurrentFile({ name: trimmed, folder: editingItem.folder });
      }
    } catch (error) {
      console.error("Failed to rename:", error);
    }
    setEditingItem(null);
    setNewName("");
  }, [editingItem, newName, loadFiles, currentFile, setCurrentFile]);

  // 右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: ListItem) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, item });
    },
    [],
  );

  // 拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, item: ListItem) => {
    setDraggedItem({
      type: item.type,
      name: item.name,
      folder: item.type === "file" ? item.folder : null,
    });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.name);
  }, []);

  // 拖拽经过
  const handleDragOver = useCallback(
    (e: React.DragEvent, item: ListItem) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedItem) {
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      let position: "before" | "after" | "into";
      if (item.type === "folder" && y > height * 0.25 && y < height * 0.75) {
        position = "into";
      } else {
        position = y < height / 2 ? "before" : "after";
      }

      setDropTarget({
        type: item.type,
        name: item.name,
        folder: item.type === "file" ? item.folder : null,
        position,
      });
    },
    [draggedItem],
  );

  // 拖拽离开
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom
    ) {
      setDropTarget(null);
    }
  }, []);

  // 放下
  const handleDrop = useCallback(
    async (e: React.DragEvent, targetItem: ListItem) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);

      if (!draggedItem) {
        return;
      }

      // 不能拖到自己
      if (
        draggedItem.name === targetItem.name &&
        draggedItem.folder ===
          (targetItem.type === "file" ? targetItem.folder : null)
      ) {
        setDraggedItem(null);
        return;
      }

      try {
        if (draggedItem.type === "file" && targetItem.type === "folder") {
          // 文件拖入文件夹
          await fileStore.moveFile(
            draggedItem.name,
            draggedItem.folder,
            targetItem.name,
          );
          await loadFiles();
        } else if (draggedItem.type === "file" && targetItem.type === "file") {
          // 文件拖到文件旁边（同级）
          // 暂时不处理排序，只支持拖入文件夹
          setDraggedItem(null);
          return;
        } else if (draggedItem.type === "folder") {
          // 文件夹排序
          const newItems = [...items];
          const draggedIdx = newItems.findIndex(
            (i) => i.type === "folder" && i.name === draggedItem.name,
          );
          const targetIdx = newItems.findIndex(
            (i) => i.type === "folder" && i.name === targetItem.name,
          );
          if (draggedIdx !== -1 && targetIdx !== -1) {
            const [dragged] = newItems.splice(draggedIdx, 1);
            newItems.splice(targetIdx, 0, dragged);
            setItems(newItems);
            await fileStore.updateOrder(newItems);
          }
        }
      } catch (error) {
        console.error("Failed to move:", error);
      }
      setDraggedItem(null);
    },
    [draggedItem, items, loadFiles, setItems],
  );

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
  }, []);

  // 空白处放下
  const handleDropToRoot = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(null);
      if (!draggedItem || draggedItem.type !== "file") {
        return;
      }
      try {
        await fileStore.moveFile(draggedItem.name, draggedItem.folder, null);
        await loadFiles();
      } catch (error) {
        console.error("Failed to move:", error);
      }
      setDraggedItem(null);
    },
    [draggedItem, loadFiles],
  );

  // 点击空白关闭菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // F2 重命名快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2" && currentFile && !editingItem) {
        // 找到当前文件对应的 ListItem
        const item = items.find(
          (i) =>
            i.type === "file" &&
            i.name === currentFile.name &&
            i.folder === currentFile.folder,
        );
        if (item) {
          handleStartRename(item);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFile, editingItem, items, handleStartRename]);

  if (!window.electronAPI) {
    return null;
  }

  // 渲染项目
  const renderItem = (item: ListItem) => {
    const isFolder = item.type === "folder";
    const isExpanded = isFolder && expandedFolders.has(item.name);
    const isEditing =
      editingItem?.name === item.name &&
      (item.type === "folder" || editingItem?.folder === item.folder);
    const isDragging =
      draggedItem?.name === item.name &&
      (item.type === "folder" || draggedItem?.folder === item.folder);
    const isDropTarget =
      dropTarget?.name === item.name &&
      (item.type === "folder" ||
        dropTarget?.folder === (item as FileItem).folder);

    const isActive =
      !isFolder &&
      currentFile?.name === item.name &&
      currentFile?.folder === item.folder;

    return (
      <li
        key={`${item.type}:${item.name}:${
          item.type === "file" ? item.folder : ""
        }`}
        className={`files-sidebar__item ${isFolder ? "folder" : "file"} ${
          isActive ? "active" : ""
        } ${modified && isActive ? "modified" : ""} ${
          isDragging ? "dragging" : ""
        } ${
          isDropTarget && dropTarget?.position === "before" ? "drop-before" : ""
        } ${
          isDropTarget && dropTarget?.position === "after" ? "drop-after" : ""
        } ${
          isDropTarget && dropTarget?.position === "into" ? "drop-into" : ""
        }`}
        style={
          item.type === "file" && item.folder ? { paddingLeft: "24px" } : {}
        }
        onClick={() => {
          if (isEditing) {
            return;
          }
          if (isFolder) {
            toggleFolder(item.name);
          } else {
            handleOpenFile(item);
          }
        }}
        onContextMenu={(e) => handleContextMenu(e, item)}
        draggable={!isEditing}
        onDragStart={(e) => handleDragStart(e, item)}
        onDragOver={(e) => handleDragOver(e, item)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, item)}
        onDragEnd={handleDragEnd}
      >
        {isEditing ? (
          <input
            type="text"
            className="files-sidebar__rename-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleFinishRename();
              } else if (e.key === "Escape") {
                setEditingItem(null);
                setNewName("");
              }
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            {isFolder && (
              <span className="files-sidebar__folder-icon">
                {isExpanded ? "▼" : "▶"}
              </span>
            )}
            <span className="files-sidebar__item-name">
              {item.name}
              {modified && isActive && (
                <span className="files-sidebar__modified-dot">●</span>
              )}
            </span>
            {!isFolder && (
              <span className="files-sidebar__item-date">
                {formatDate((item as FileItem).modifiedAt)}
              </span>
            )}
          </>
        )}
      </li>
    );
  };

  // 过滤并排序显示的项目
  const visibleItems: ListItem[] = [];
  for (const item of items) {
    if (item.type === "folder") {
      visibleItems.push(item);
      if (expandedFolders.has(item.name)) {
        // 添加文件夹内的文件
        const folderFiles = items.filter(
          (i) => i.type === "file" && i.folder === item.name,
        );
        visibleItems.push(...folderFiles);
      }
    } else if (!item.folder) {
      // 根目录文件
      visibleItems.push(item);
    }
  }

  return (
    <div className="files-sidebar">
      <div className="files-sidebar__header">
        <div className="files-sidebar__title">
          <div className="files-sidebar__logo">{ExcalLogo}</div>
          <span>我的画布</span>
        </div>
        <div className="files-sidebar__actions">
          <button
            className="files-sidebar__new-btn"
            onClick={() => handleNewFile()}
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
          <button
            className="files-sidebar__folder-btn"
            onClick={handleNewFolder}
            title="新建文件夹"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="files-sidebar__content"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={handleDropToRoot}
      >
        {loading ? (
          <div className="files-sidebar__loading">加载中...</div>
        ) : (
          <>
            {isCreatingFolder && (
              <div className="files-sidebar__new-folder">
                <input
                  ref={newFolderInputRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={handleFinishCreateFolder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleFinishCreateFolder();
                    } else if (e.key === "Escape") {
                      setIsCreatingFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  autoFocus
                  placeholder="输入文件夹名称"
                />
              </div>
            )}
            {isCreatingFile && (
              <div
                className="files-sidebar__new-file"
                style={
                  targetFolderForNewFile ? { paddingLeft: "24px" } : undefined
                }
              >
                <input
                  ref={newFileInputRef}
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileNameState(e.target.value)}
                  onBlur={handleFinishCreateFile}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleFinishCreateFile();
                    } else if (e.key === "Escape") {
                      setIsCreatingFile(false);
                      setNewFileNameState("");
                      setTargetFolderForNewFile(null);
                    }
                  }}
                  autoFocus
                  placeholder="输入画布名称"
                />
              </div>
            )}
            {visibleItems.length === 0 &&
            !isCreatingFolder &&
            !isCreatingFile ? (
              <div className="files-sidebar__empty">
                <p>暂无画布</p>
                <button onClick={() => handleNewFile()}>创建第一个画布</button>
              </div>
            ) : (
              <ul className="files-sidebar__list" ref={listRef}>
                {visibleItems.map(renderItem)}
              </ul>
            )}
          </>
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
          {contextMenu.item.type === "folder" && (
            <button
              onClick={() => {
                handleNewFile(contextMenu.item.name);
                setContextMenu(null);
              }}
            >
              新建画布
            </button>
          )}
          <button
            onClick={() => {
              setContextMenu(null);
              handleStartRename(contextMenu.item);
            }}
          >
            重命名
          </button>
          <button
            onClick={() => {
              setContextMenu(null);
              handleDelete(contextMenu.item);
            }}
            className="danger"
          >
            删除
          </button>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteDialog && (
        <div className="files-sidebar__dialog-overlay">
          <div className="files-sidebar__dialog">
            <div className="files-sidebar__dialog-title">
              {deleteDialog.type === "folder"
                ? `删除文件夹 "${deleteDialog.name}"`
                : `删除文件 "${deleteDialog.name}"`}
            </div>
            <div className="files-sidebar__dialog-content">
              {deleteDialog.type === "folder" ? (
                <>
                  <button
                    onClick={() => handleDeleteConfirm("release")}
                    className="primary"
                  >
                    解放文件（保留文件到主目录）
                  </button>
                  <button
                    onClick={() => handleDeleteConfirm("delete")}
                    className="danger"
                  >
                    全部删除（包括所有文件）
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleDeleteConfirm()}
                  className="danger"
                >
                  确认删除
                </button>
              )}
              <button
                onClick={() => setDeleteDialog(null)}
                className="secondary"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
