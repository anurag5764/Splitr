import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../prisma';
import { calculateGroupBalances } from '../services/balanceService';

// POST /api/groups/:id/settlements
export const createSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: groupId } = req.params;
    const { payerId, payeeId, amount, note } = req.body;

    if (!payerId || !payeeId || !amount) {
      res.status(400).json({ message: 'payerId, payeeId, and amount are required' });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ message: 'Amount must be a positive number' });
      return;
    }

    // 1. Validate payer and payee are group members
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        userId: { in: [payerId, payeeId] },
      },
    });

    if (members.length < 2) {
      res.status(400).json({ message: 'Payer and payee must be members of the group' });
      return;
    }

    // 2. Validate amount <= what payer owes payee (query current balance, allow +-0.01 tolerance)
    const currentBalances = await calculateGroupBalances(groupId);
    const balanceEntry = currentBalances.find(
      (b) => b.fromUserId === payerId && b.toUserId === payeeId
    );

    const maxAllowedDebt = balanceEntry ? balanceEntry.amount : 0;

    // Allow +-0.01 tolerance
    if (parsedAmount > maxAllowedDebt + 0.01) {
      res.status(400).json({
        message: `Amount $${parsedAmount.toFixed(2)} exceeds the maximum owed amount of $${maxAllowedDebt.toFixed(2)}`
      });
      return;
    }

    // 3. Create settlement record
    await prisma.settlement.create({
      data: {
        groupId,
        payerId,
        payeeId,
        amount: parsedAmount,
        note: note || 'Settled up balance',
        status: 'CONFIRMED',
        settledAt: new Date(),
      },
    });

    // 4. Return updated group balances
    const updatedBalances = await calculateGroupBalances(groupId);
    res.status(201).json(updatedBalances);
  } catch (error) {
    console.error('createSettlement error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/groups/:id/settlements
export const getSettlements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: groupId } = req.params;

    const settlements = await prisma.settlement.findMany({
      where: { groupId },
      include: {
        payer: { select: { id: true, name: true, email: true, avatarUrl: true } },
        payee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(settlements);
  } catch (error) {
    console.error('getSettlements error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
