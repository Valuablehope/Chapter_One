import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSelfTerminal } from '../controllers/terminalSelfController';

const router = Router();

// Any authenticated role can check this machine's own pairing status
router.use(authenticate);

router.get('/', getSelfTerminal);

export default router;
