/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getVersion: () => Promise<string>;
    installUpdate?: () => Promise<void>;
    getUpdateStatus?: () => Promise<{status: string, percent?: number, version?: string, error?: string}>;
    getPlatform: () => Promise<string>;
    log: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;
    openLogs: () => Promise<{ success: boolean; error?: string }>;
    customerDisplayShow?: (payload: {
      storeName: string;
      amount: number;
    }) => Promise<{ ok: boolean }>;
    ipcRenderer?: {
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    };
  };
}











