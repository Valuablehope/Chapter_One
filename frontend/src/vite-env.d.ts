/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getVersion: () => Promise<string>;
    installUpdate?: () => Promise<void>;
    getPlatform: () => Promise<string>;
    log: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;
    openLogs: () => Promise<{ success: boolean; error?: string }>;
    ipcRenderer?: {
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    };
  };
}











