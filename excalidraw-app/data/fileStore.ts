import { atom } from "../app-jotai";

// 文件信息类型
export type LocalFileInfo = {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  modifiedAt: Date;
  size: number;
};

// 当前打开的文件
export const currentFileAtom = atom<LocalFileInfo | null>(null);

// 文件列表
export const filesListAtom = atom<LocalFileInfo[]>([]);

// 是否正在加载
export const filesLoadingAtom = atom<boolean>(false);

// 是否显示侧边栏
export const showFilesSidebarAtom = atom<boolean>(true);

// 当前文件是否已修改
export const fileModifiedAtom = atom<boolean>(false);

// 文件操作 store
export const fileStore = {
  // 加载文件列表
  loadFiles: async (): Promise<LocalFileInfo[]> => {
    if (!window.electronAPI) {
      console.warn("Electron API not available");

      return [];
    }

    const result = await window.electronAPI.listFiles();

    if (result.success) {
      return result.files.map((f) => ({
        ...f,
        createdAt: new Date(f.createdAt),
        modifiedAt: new Date(f.modifiedAt),
      }));
    }

    console.error("Failed to load files:", result.error);

    return [];
  },

  // 读取文件
  readFile: async (fileId: string) => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }

    const result = await window.electronAPI.readFile(fileId);

    if (result.success) {
      return result.data;
    }

    throw new Error(result.error);
  },

  // 保存文件
  saveFile: async (
    fileId: string,
    name: string,
    data: unknown,
  ): Promise<string> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }

    const result = await window.electronAPI.saveFile({ fileId, name, data });

    if (result.success && result.path) {
      return result.path;
    }

    throw new Error(result.error);
  },

  // 删除文件
  deleteFile: async (fileId: string): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }

    const result = await window.electronAPI.deleteFile(fileId);

    if (!result.success) {
      throw new Error(result.error);
    }
  },

  // 重命名文件
  renameFile: async (oldName: string, newName: string): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }

    const result = await window.electronAPI.renameFile({ oldName, newName });

    if (!result.success) {
      throw new Error(result.error);
    }
  },

  // 获取文件存储路径
  getFilesPath: async (): Promise<string> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }

    return window.electronAPI.getFilesPath();
  },

  // 打开文件目录
  openFilesFolder: async (): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }

    await window.electronAPI.openFilesFolder();
  },

  // 获取排序顺序
  getFileOrder: async (): Promise<string[]> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }

    const result = await window.electronAPI.getFileOrder();

    if (result.success) {
      return result.order;
    }

    throw new Error(result.error);
  },

  // 保存排序顺序
  saveFileOrder: async (order: string[]): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }

    const result = await window.electronAPI.saveFileOrder(order);

    if (!result.success) {
      throw new Error(result.error);
    }
  },
};

// 扩展 window 类型声明
declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      listFiles: () => Promise<{
        success: boolean;
        files: LocalFileInfo[];
        error?: string;
      }>;
      readFile: (
        fileId: string,
      ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      saveFile: (data: {
        fileId: string;
        name: string;
        data: unknown;
      }) => Promise<{ success: boolean; path?: string; error?: string }>;
      deleteFile: (
        fileId: string,
      ) => Promise<{ success: boolean; error?: string }>;
      renameFile: (data: {
        oldName: string;
        newName: string;
      }) => Promise<{ success: boolean; error?: string }>;
      getFilesPath: () => Promise<string>;
      openFilesFolder: () => Promise<void>;
      getFileOrder: () => Promise<{
        success: boolean;
        order: string[];
        error?: string;
      }>;
      saveFileOrder: (
        order: string[],
      ) => Promise<{ success: boolean; error?: string }>;
      onMenuNew: (callback: () => void) => void;
      onMenuOpen: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      onMenuSaveAs: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
