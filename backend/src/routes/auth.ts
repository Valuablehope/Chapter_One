import { Router } from 'express';
import { body } from 'express-validator';
import { login, verifyToken, refreshToken, logout } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Login route with rate limiting to prevent brute force attacks
router.post(
  '/login',
  authRateLimiter, // Apply rate limiting before validation
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 1 })
      .withMessage('Password is required'),
  ],
  validateRequest,
  login
);

// Verify token route (protected)
router.get('/verify', authenticate, verifyToken);

// Refresh token route (protected) - extends token expiry without re-login
router.post('/refresh', authenticate, refreshToken);

// Logout route (protected) - clears the httpOnly cookie
router.post('/logout', authenticate, logout);

export default router;









