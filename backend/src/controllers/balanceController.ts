import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { calculateGroupBalances, calculateUserBalances } from '../services/balanceService';

// GET /api/groups/:id/balances
export const getGroupBalances = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: groupId } = req.params;
    const balances = await calculateGroupBalances(groupId);
    res.status(200).json(balances);
  } catch (error) {
    console.error('getGroupBalances error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/users/balances
export const getUserBalances = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }
    const balances = await calculateUserBalances(userId);
    res.status(200).json(balances);
  } catch (error) {
    console.error('getUserBalances error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
