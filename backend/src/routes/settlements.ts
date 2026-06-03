import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { requireGroupMember } from '../middleware/groupAuth';
import { createSettlement, getSettlements } from '../controllers/settlementController';

const router = Router();

// Create settlement in group (must be group member)
router.post('/groups/:id/settlements', verifyToken, requireGroupMember, createSettlement);

// Get settlements for group (must be group member)
router.get('/groups/:id/settlements', verifyToken, requireGroupMember, getSettlements);

export default router;
