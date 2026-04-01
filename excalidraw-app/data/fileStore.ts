import { atom } from "../app-jotai";

// 文件信息（简化：name 即标识符）
export type LocalFileInfo = {
  name: string;
  modifiedAt: number;
  size: number;
};

export const currentFileAtom = atom<LocalFileInfo | null>(null);
export const filesListAtom = atom<LocalFileInfo[]>([]);
export const filesLoadingAtom = atom<boolean>(false);
export const showFilesSidebarAtom = atom<boolean>(true);
export const fileModifiedAtom = atom<boolean>(false);

export const fileStore = {
  loadFiles: async (): Promise<LocalFileInfo[]> => {
    if (!window.electronAPI) {
      return [];
    }
    const result = await window.electronAPI.listFiles();
    return result.success ? result.files : [];
  },

  updateOrder: async (order: string[]): Promise<void> => {
    if (!window.electronAPI) {
      return;
    }
    await window.electronAPI.updateOrder(order);
  },

  readFile: async (name: string) => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.readFile(name);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },

  saveFile: async (name: string, data: unknown): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.saveFile({ name, data });
    if (!result.success) {
      throw new Error(result.error);
    }
  },

  deleteFile: async (name: string): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.deleteFile(name);
    if (!result.success) {
      throw new Error(result.error);
    }
  },

  renameFile: async (oldName: string, newName: string): Promise<void> => {
    if (!window.electronAPI) {
      throw new Error("Electron API not available");
    }
    const result = await window.electronAPI.renameFile({ oldName, newName });
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
        files: LocalFileInfo[];
        error?: string;
      }>;
      updateOrder: (order: string[]) => Promise<{ success: boolean }>;
      readFile: (
        name: string,
      ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      saveFile: (data: {
        name: string;
        data: unknown;
      }) => Promise<{ success: boolean; error?: string }>;
      deleteFile: (
        name: string,
      ) => Promise<{ success: boolean; error?: string }>;
      renameFile: (data: {
        oldName: string;
        newName: string;
      }) => Promise<{ success: boolean; error?: string }>;
      getFilesPath: () => Promise<string>;
      openFilesFolder: () => Promise<void>;
      onMenuNew: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
