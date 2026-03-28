import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  getUpdateStatus: () => ipcRenderer.invoke('app:getUpdateStatus'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  log: (level: string, message: string) => ipcRenderer.send('app:log', { level, message }),
  openLogs: () => ipcRenderer.invoke('app:openLogs'),
  ipcRenderer: {
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
    removeListener: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback);
    },
  },
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      installUpdate: () => Promise<void>;
      getUpdateStatus: () => Promise<{status: string, percent?: number, version?: string, error?: string}>;
      getPlatform: () => Promise<string>;
      log: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;
      openLogs: () => Promise<{ success: boolean; error?: string }>;
      ipcRenderer: {
        on: (channel: string, callback: (...args: any[]) => void) => void;
        removeListener: (channel: string, callback: (...args: any[]) => void) => void;
      };
    };
    electron?: {
      ipcRenderer: {
        on: (channel: string, callback: (...args: any[]) => void) => void;
        removeListener: (channel: string, callback: (...args: any[]) => void) => void;
      };
    };
  }
}











