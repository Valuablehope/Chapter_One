/**
 * Workaround for a long-standing Chromium/Electron bug on Windows: after any
 * native blocking dialog closes — window.print()'s print dialog, alert(),
 * confirm() — the window still looks focused, but keyboard events stop being
 * delivered to input fields. Users had to minimize/restore or restart the app
 * to type again.
 *
 * The fix: after every native dialog resolves, ask the main process to cycle
 * the BrowserWindow blur → focus (see 'app:refocus-window' in electron main),
 * which re-activates keyboard input delivery.
 *
 * installNativeDialogFocusFix() patches window.print/alert/confirm globally so
 * every existing and future call site is covered. restoreInputFocus() is also
 * exported for flows that print from a popup window (window.open + print),
 * where closing the child window triggers the same bug on the main window.
 */

export function restoreInputFocus(): void {
  // Small delay so the dialog/child-window teardown finishes before the
  // blur → focus cycle; refocusing while the dialog is still closing is a no-op.
  window.setTimeout(() => {
    window.electronAPI?.refocusWindow?.();
  }, 150);
}

export function installNativeDialogFocusFix(): void {
  // Plain browser (no Electron bridge) — the bug doesn't apply there.
  if (!window.electronAPI?.refocusWindow) return;

  const nativePrint = window.print.bind(window);
  window.print = () => {
    nativePrint();
    restoreInputFocus();
  };

  const nativeAlert = window.alert.bind(window);
  window.alert = (message?: string) => {
    nativeAlert(message);
    restoreInputFocus();
  };

  const nativeConfirm = window.confirm.bind(window);
  window.confirm = (message?: string): boolean => {
    const result = nativeConfirm(message);
    restoreInputFocus();
    return result;
  };
}
