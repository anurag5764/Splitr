import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me } from '../controllers/authController';
import { verifyToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';

const router = Router();

// Validation chains
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  validateRequest,
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validateRequest,
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', verifyToken, me);

export default router;
