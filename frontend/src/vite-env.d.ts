/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    log: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;
    ipcRenderer?: {
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    };
  };
}











