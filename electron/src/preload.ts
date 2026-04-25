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
  customerDisplayShow: (payload: { storeName: string; amount: number }) =>
    ipcRenderer.invoke('customer-display:show', payload),
  // Setup Wizard Methods
  setupIsComplete: () => ipcRenderer.invoke('setup:isComplete'),
  setupSaveConfig: (config: Record<string, string>) => ipcRenderer.invoke('setup:saveConfig', config),
  setupInstallPostgres: (args: { password: string, port: string }) => ipcRenderer.invoke('setup:installPostgres', args),
  setupRunMigrations: (args: { password: string, port: string }) => ipcRenderer.invoke('setup:runMigrations', args),
  setupCreateAdmin: (args: { password: string, port: string }) => ipcRenderer.invoke('setup:createAdmin', args),
  setupInitializeStore: (args: { storeName: string, password: string, port: string }) => ipcRenderer.invoke('setup:initializeStore', args),
  setupInstallService: () => ipcRenderer.invoke('setup:installService'),
  setupComplete: () => ipcRenderer.invoke('setup:complete'),
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
      customerDisplayShow: (payload: {
        storeName: string;
        amount: number;
      }) => Promise<{ ok: boolean }>;
      setupIsComplete: () => Promise<boolean>;
      setupSaveConfig: (config: Record<string, string>) => Promise<{success: boolean, error?: string}>;
      setupInstallPostgres: (args: { password: string, port: string }) => Promise<{success: boolean, skipped?: boolean, error?: string}>;
      setupRunMigrations: (args: { password: string, port: string }) => Promise<{success: boolean, error?: string}>;
      setupCreateAdmin: (args: { password: string, port: string }) => Promise<{success: boolean, error?: string}>;
      setupInitializeStore: (args: { storeName: string, password: string, port: string }) => Promise<{success: boolean, error?: string}>;
      setupInstallService: () => Promise<{success: boolean, error?: string}>;
      setupComplete: () => Promise<void>;
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











