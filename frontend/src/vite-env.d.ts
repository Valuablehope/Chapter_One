/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
  };
}











