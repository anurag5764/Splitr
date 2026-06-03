import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { requireGroupMember } from '../middleware/groupAuth';
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseChat,
} from '../controllers/expenseController';

const router = Router();

// Nested under group — verifyToken first so req.user is set before requireGroupMember runs
router.get('/groups/:id/expenses',  verifyToken, requireGroupMember, getExpenses);
router.post('/groups/:id/expenses', verifyToken, requireGroupMember, createExpense);

// Individual expense routes
router.get('/expenses/:id',      verifyToken, getExpenseById);
router.put('/expenses/:id',      verifyToken, updateExpense);
router.delete('/expenses/:id',   verifyToken, deleteExpense);
router.get('/expenses/:id/chat', verifyToken, getExpenseChat);

export default router;
