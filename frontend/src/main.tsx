import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Configure global error logging for Electron
if (window.electronAPI) {
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    window.electronAPI.log('error', `Uncaught Error: ${event.error?.message || event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    window.electronAPI.log('error', `Unhandled Promise Rejection: ${event.reason}`);
  });

  // Forward console logs to file in production
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isDev) {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog(...args);
      window.electronAPI.log('info', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
    };

    console.error = (...args) => {
      originalError(...args);
      window.electronAPI.log('error', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
    };

    console.warn = (...args) => {
      originalWarn(...args);
      window.electronAPI.log('warn', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
    };
  }

  window.electronAPI.log('info', 'Frontend initialized');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#111827',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            borderRadius: '8px',
            padding: '16px',
          },
          success: {
            iconTheme: {
              primary: '#3582e2',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </ErrorBoundary>
  </React.StrictMode>,
);

