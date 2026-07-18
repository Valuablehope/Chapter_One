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
  refocusWindow: () => ipcRenderer.send('app:refocus-window'),
  getPrinters: () => ipcRenderer.invoke('app:getPrinters'),
  printSilent: (deviceName?: string, html?: string, paperSize?: string) => ipcRenderer.invoke('app:print-silent', deviceName, html, paperSize),
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
  ipcRenderer: (() => {
    // Map original callbacks → their ipcRenderer wrappers so removeListener works correctly.
    // Without this, removeListener(channel, callback) would try to remove the user callback
    // directly, but ipcRenderer.on registered an anonymous wrapper — so the removal was a no-op
    // and listeners leaked on every Layout mount/unmount.
    const wrapperMap = new Map<(...args: any[]) => void, (...args: any[]) => void>();
    return {
      on: (channel: string, callback: (...args: any[]) => void) => {
        const wrapper = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
        wrapperMap.set(callback, wrapper);
        ipcRenderer.on(channel, wrapper);
      },
      removeListener: (channel: string, callback: (...args: any[]) => void) => {
        const wrapper = wrapperMap.get(callback);
        if (wrapper) {
          ipcRenderer.removeListener(channel, wrapper);
          wrapperMap.delete(callback);
        }
      },
    };
  })(),
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      installUpdate: () => Promise<void>;
      getUpdateStatus: () => Promise<{status: string, percent?: number, version?: string, error?: string, backupPath?: string}>;
      getPlatform: () => Promise<string>;
      log: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;
      openLogs: () => Promise<{ success: boolean; error?: string }>;
      refocusWindow: () => void;
      getPrinters: () => Promise<any[]>;
      printSilent: (deviceName?: string, html?: string, paperSize?: string) => Promise<{ success: boolean; error?: string }>;
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











