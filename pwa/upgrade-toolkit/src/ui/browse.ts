import { runCommand } from '../util/runCommand';

// Browsers cannot expose a real filesystem path from <input type="file">
// (sandboxed for security), so path fields are filled by asking Windows for
// a native picker instead — same shell-out pattern already used elsewhere
// in this toolkit (util/diskSpace.ts, config/discoverAppInstall.ts).
export async function pickFile(filter: string): Promise<string | null> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Filter = '${filter}'
$dialog.Multiselect = $false
if ($dialog.ShowDialog() -eq 'OK') { Write-Output $dialog.FileName } else { Write-Output '' }
`.trim();

  const result = await runCommand('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { timeoutMs: 5 * 60 * 1000 });
  const output = (result.stdout || '').trim();
  return output.length > 0 ? output : null;
}

export async function pickFolder(): Promise<string | null> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
if ($dialog.ShowDialog() -eq 'OK') { Write-Output $dialog.SelectedPath } else { Write-Output '' }
`.trim();

  const result = await runCommand('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { timeoutMs: 5 * 60 * 1000 });
  const output = (result.stdout || '').trim();
  return output.length > 0 ? output : null;
}
