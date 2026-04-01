import { atom } from "../app-jotai";

// 文件项类型
export type FileItem = {
  type: "file";
  name: string;
  folder: string | null;
  modifiedAt: number;
  size: number;
};

// 文件夹项类型
export type FolderItem = {
  type: "folder";
  name: string;
  modifiedAt: number;
};

// 列表项联合类型
export type ListItem = FileItem | FolderItem;

// 当前打开的文件
export type CurrentFile = {
  name: string;
  folder: string | null;
};

export const currentFileAtom = atom<CurrentFile | null>(null);
export const filesListAtom = atom<ListItem[]>([]);
export const filesLoadingAtom = atom<boolean>(false);
export const showFilesSidebarAtom = atom<boolean>(true);
export const fileModifiedAtom = atom<boolean>(false);

// 展开的文件夹状态
export const expandedFoldersAtom = atom<Set<string>>(new Set<string>());

export const fileStore = {
  loadFiles: async (): Promise<ListItem[]> => {
    if (!window.electronAPI) {
      return [];
    }
    const result = await window.electronAPI.listFiles();
    return result.success ? result.items : [];
  },

  updateOrder: async (order: ListItem[]): Promise<void> => {
    if (!window.electronAPI) {
      return;
    }
    await window.electronAPI.updateOrder(order);
  },

  // 文件夹操作
  createFolder: async (name: string): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.createFolder(name);
    if (!result.success) {
      throw new Error(result.error);
    }
  },

  deleteFolder: async (
    name: string,
    mode: "release" | "delete" = "delete",
  ): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.deleteFolder({ name, mode });
    if (!result.success) {
      throw new Error(result.error);
    }
  },

  renameFolder: async (oldName: string, newName: string): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.renameFolder({ oldName, newName });
    if (!result.success) {
      throw new Error(result.error);
    }
  },

  // 文件操作
  readFile: async (name: string, folder: string | null) => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.readFile({ name, folder });
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },

  saveFile: async (
    name: string,
    data: unknown,
    folder?: string | null,
    overwrite?: boolean,
  ): Promise<string> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.saveFile({
      name,
      data,
      folder: folder ?? null,
      overwrite: overwrite ?? false,
    });
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.name;
  },

  deleteFile: async (name: string, folder: string | null): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.deleteFile({ name, folder });
    if (!result.success) {
      throw new Error(result.error);
    }
  },

  renameFile: async (
    name: string,
    folder: string | null,
    newName: string,
  ): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.renameFile({
      name,
      folder,
      newName,
    });
    if (!result.success) {
      throw new Error(result.error);
    }
  },

  moveFile: async (
    name: string,
    fromFolder: string | null,
    toFolder: string | null,
  ): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.moveFile({
      name,
      fromFolder,
      toFolder,
    });
    if (!result.success) {
      throw new Error(result.error);
    }
  },

  openFilesFolder: async (): Promise<void> => {
    if (!window.electronAPI) {
      return;
    }
    await window.electronAPI.openFilesFolder();
  },
};

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      listFiles: () => Promise<{
        success: boolean;
        items: ListItem[];
        error?: string;
      }>;
      updateOrder: (order: ListItem[]) => Promise<{ success: boolean }>;
      createFolder: (
        name: string,
      ) => Promise<{ success: boolean; error?: string }>;
      deleteFolder: (data: {
        name: string;
        mode: "release" | "delete";
      }) => Promise<{ success: boolean; error?: string }>;
      renameFolder: (data: {
        oldName: string;
        newName: string;
      }) => Promise<{ success: boolean; error?: string }>;
      readFile: (data: {
        name: string;
        folder: string | null;
      }) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      saveFile: (data: {
        name: string;
        data: unknown;
        folder: string | null;
        overwrite?: boolean;
      }) => Promise<{ success: boolean; name: string; error?: string }>;
      deleteFile: (data: {
        name: string;
        folder: string | null;
      }) => Promise<{ success: boolean; error?: string }>;
      renameFile: (data: {
        name: string;
        folder: string | null;
        newName: string;
      }) => Promise<{ success: boolean; error?: string }>;
      moveFile: (data: {
        name: string;
        fromFolder: string | null;
        toFolder: string | null;
      }) => Promise<{ success: boolean; error?: string }>;
      getFilesPath: () => Promise<string>;
      openFilesFolder: () => Promise<void>;
      onMenuNew: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
