import api from './api';
import { Terminal } from './adminService';

export interface SelfTerminal extends Omit<Partial<Terminal>, 'terminal_id'> {
  terminal_id: string | null;
}

export const terminalService = {
  /** Which terminal row (if any) THIS machine is paired to. */
  async getSelf(): Promise<SelfTerminal> {
    const response = await api.get<{ success: boolean; data: SelfTerminal }>('/terminal-self');
    return response.data.data;
  },

  async pair(code: string): Promise<{ success: boolean; terminal_id?: string; name?: string; error?: string }> {
    if (!window.electronAPI?.pairTerminal) {
      return { success: false, error: 'Pairing is only available in the desktop app.' };
    }
    return window.electronAPI.pairTerminal(code);
  },
};
