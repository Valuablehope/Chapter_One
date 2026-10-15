import { Router, Request, Response } from 'express';

const router = Router();

// API routes will be added here in later phases
router.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Chapter One POS API v4.0',
    version: '4.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
    },
  });
});

export default router;

