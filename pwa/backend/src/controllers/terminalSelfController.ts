import { Request, Response } from 'express';
import { TerminalModel } from '../models/TerminalModel';
import { asyncHandler } from '../middleware/errorHandler';

/** Identifies which terminal row (if any) this specific machine is paired to. */
export const getSelfTerminal = asyncHandler(async (_req: Request, res: Response) => {
  const terminalId = process.env.TERMINAL_ID;
  if (!terminalId) {
    res.json({ success: true, data: { terminal_id: null } });
    return;
  }

  const terminal = await TerminalModel.findById(terminalId);
  if (!terminal) {
    // Paired to a terminal_id that no longer exists (e.g. deleted from admin panel)
    res.json({ success: true, data: { terminal_id: null } });
    return;
  }

  res.json({ success: true, data: terminal });
});
