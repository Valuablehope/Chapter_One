/// <reference types="vite/client" />

declare global {
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
      setupIsComplete: () => Promise<boolean>;
      setupSaveConfig: (config: Record<string, string>) => Promise<{success: boolean, error?: string}>;
      setupInstallPostgres: (args: { password: string, port: string }) => Promise<{success: boolean, skipped?: boolean, error?: string}>;
      setupRunMigrations: (args: { password: string, port: string }) => Promise<{success: boolean, error?: string}>;
      setupCreateAdmin: (args: { password: string, port: string }) => Promise<{success: boolean, error?: string}>;
      setupInitializeStore: (args: { storeName: string, password: string, port: string }) => Promise<{success: boolean, error?: string}>;
      setupInstallService: () => Promise<{success: boolean, error?: string}>;
      setupComplete: () => Promise<void>;
      getPrinters?: () => Promise<string[]>;
      printSilent?: (printerName?: string) => Promise<{ success: boolean; error?: string }>;
      ipcRenderer?: {
        on: (channel: string, callback: (...args: any[]) => void) => void;
        removeListener: (channel: string, callback: (...args: any[]) => void) => void;
      };
    };
  }
}

export {};











