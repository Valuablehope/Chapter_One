import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import './styles/receiptPrint.css';
// Apply persisted theme immediately (before first paint)
import { getTheme } from './styles/themes';
(function initTheme() {
  const id = localStorage.getItem('pos-theme') ?? 'classic';
  const theme = getTheme(id);
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute('data-theme', id);
})();

// Apply persisted font sizes immediately (before first paint)
(function initFontSizes() {
  type Scale = 'sm' | 'md' | 'lg' | 'xl';
  const hScale = (localStorage.getItem('pos-heading-size') ?? 'md') as Scale;
  const bScale = (localStorage.getItem('pos-body-size')    ?? 'md') as Scale;

  const headingPx: Record<Scale, Record<string, string>> = {
    sm: { 'text-xl': '15px', 'text-2xl': '18px', 'text-3xl': '20px', 'text-4xl': '24px' },
    md: { 'text-xl': '20px', 'text-2xl': '24px', 'text-3xl': '30px', 'text-4xl': '36px' },
    lg: { 'text-xl': '23px', 'text-2xl': '28px', 'text-3xl': '36px', 'text-4xl': '42px' },
    xl: { 'text-xl': '26px', 'text-2xl': '32px', 'text-3xl': '40px', 'text-4xl': '48px' },
  };
  const bodyPx: Record<Scale, Record<string, string>> = {
    sm: { 'text-xs': '9px',  'text-sm': '11px', 'text-base': '12px', 'text-lg': '13px' },
    md: { 'text-xs': '12px', 'text-sm': '14px', 'text-base': '16px', 'text-lg': '18px' },
    lg: { 'text-xs': '13px', 'text-sm': '15px', 'text-base': '17px', 'text-lg': '20px' },
    xl: { 'text-xs': '14px', 'text-sm': '17px', 'text-base': '19px', 'text-lg': '22px' },
  };

  const hRules = Object.entries(headingPx[hScale]).map(([c, px]) => `.${c} { font-size: ${px} !important; }`).join('\n');
  const bRules = Object.entries(bodyPx[bScale]).map(([c, px])   => `.${c} { font-size: ${px} !important; }`).join('\n');

  const tag = document.createElement('style');
  tag.id = 'pos-font-overrides';
  tag.textContent = `/* boot font-sizes: heading=${hScale} body=${bScale} */\n${hRules}\n${bRules}`;
  document.head.appendChild(tag);
})();

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

import { I18nProvider } from './i18n/I18nContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
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

