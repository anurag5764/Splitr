import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { requireGroupMember } from '../middleware/groupAuth';
import { getGroupBalances, getUserBalances } from '../controllers/balanceController';

const router = Router();

// Group-level balances (must be a member)
router.get('/groups/:id/balances', verifyToken, requireGroupMember, getGroupBalances);

// Current user's balances across all groups
router.get('/users/balances', verifyToken, getUserBalances);

export default router;
