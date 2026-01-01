/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    ipcRenderer?: {
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    };
  };
}











