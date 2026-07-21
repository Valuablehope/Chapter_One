/**
 * Workaround for two long-standing Chromium/Electron bugs on Windows, both
 * caused by window.print()/alert()/confirm() being synchronous — they block
 * the renderer's JS thread for as long as the native dialog stays open, which
 * is entirely user-paced (picking a printer, reading a message, etc.):
 *
 * 1. After the dialog closes, the window still looks focused, but keyboard
 *    events stop being delivered to input fields. Users had to minimize/
 *    restore or restart the app to type again.
 * 2. While the dialog is still open, if the user takes more than ~5 seconds
 *    to dismiss it, Chromium's hang watchdog decides the renderer is stuck
 *    and Electron fires 'unresponsive', which the main process was reacting
 *    to by popping an "Application Not Responding" dialog — a false alarm on
 *    top of a dialog the user just hasn't dismissed yet.
 *
 * The fix: tell the main process a blocking native dialog is starting (so it
 * ignores the false 'unresponsive' alarm — see 'app:print-starting' in
 * electron main) before making the call, and after it resolves, clear that
 * flag and cycle the BrowserWindow blur → focus (see 'app:refocus-window'),
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

function beginNativeDialog(): void {
  window.electronAPI?.printStarting?.();
}

function endNativeDialog(): void {
  window.electronAPI?.printEnding?.();
  restoreInputFocus();
}

export function installNativeDialogFocusFix(): void {
  // Plain browser (no Electron bridge) — the bug doesn't apply there.
  if (!window.electronAPI?.refocusWindow) return;

  const nativePrint = window.print.bind(window);
  window.print = () => {
    beginNativeDialog();
    try {
      nativePrint();
    } finally {
      endNativeDialog();
    }
  };

  const nativeAlert = window.alert.bind(window);
  window.alert = (message?: string) => {
    beginNativeDialog();
    try {
      nativeAlert(message);
    } finally {
      endNativeDialog();
    }
  };

  const nativeConfirm = window.confirm.bind(window);
  window.confirm = (message?: string): boolean => {
    beginNativeDialog();
    try {
      return nativeConfirm(message);
    } finally {
      endNativeDialog();
    }
  };
}
