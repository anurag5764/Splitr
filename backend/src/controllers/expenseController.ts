import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../prisma';
import { SplitType, Prisma } from '@prisma/client';
import {
  calculateEqualSplit,
  calculateUnequalSplit,
  calculatePercentageSplit,
  calculateShareSplit,
  SplitResult,
} from '../services/splitService';

// ── Helper ────────────────────────────────────────────────────────
const isGroupMember = async (groupId: string, userId: string): Promise<boolean> => {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return !!m;
};

// ── CREATE ────────────────────────────────────────────────────────
export const createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: groupId } = req.params;
    const { description, amount, splitType, paidById, splits } = req.body;
    const creatorId = req.user?.id;

    if (!creatorId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    if (!description || !amount || amount <= 0 || !splitType || !paidById || !splits) {
      res.status(400).json({ message: 'Missing or invalid expense fields' });
      return;
    }

    // Group must exist
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) { res.status(404).json({ message: 'Group not found' }); return; }

    // Payer must be a group member
    if (!(await isGroupMember(groupId, paidById))) {
      res.status(400).json({ message: 'Payer must be a member of the group' });
      return;
    }

    // Collect participant IDs
    const participantIds: string[] =
      splitType === SplitType.EQUAL ? splits : splits.map((s: { userId: string }) => s.userId);

    if (participantIds.length === 0) {
      res.status(400).json({ message: 'At least one participant is required' });
      return;
    }

    // All participants must be group members
    for (const uid of participantIds) {
      if (!(await isGroupMember(groupId, uid))) {
        res.status(400).json({ message: `User ${uid} is not a member of this group` });
        return;
      }
    }

    // Calculate splits
    let calculated: SplitResult[] = [];
    try {
      if (splitType === SplitType.EQUAL) {
        calculated = calculateEqualSplit(amount, participantIds);
      } else if (splitType === SplitType.EXACT) {
        calculated = calculateUnequalSplit(amount, splits);
      } else if (splitType === SplitType.PERCENTAGE) {
        calculated = calculatePercentageSplit(amount, splits);
      } else if (splitType === SplitType.SHARES) {
        calculated = calculateShareSplit(amount, splits);
      } else {
        res.status(400).json({ message: 'Invalid splitType' });
        return;
      }
    } catch (e: unknown) {
      res.status(400).json({ message: e instanceof Error ? e.message : 'Split calculation error' });
      return;
    }

    // Transaction: create expense + splits
    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          groupId,
          description,
          amount: new Prisma.Decimal(amount),
          splitType,
          paidById,
          createdById: creatorId,
        },
      });

      await tx.expenseSplit.createMany({
        data: calculated.map((cs) => {
          const raw = splitType === SplitType.EQUAL
            ? null
            : splits.find((s: { userId: string }) => s.userId === cs.userId);
          return {
            expenseId: exp.id,
            userId: cs.userId,
            owedAmount: new Prisma.Decimal(cs.owedAmount),
            percentage:
              splitType === SplitType.PERCENTAGE && raw
                ? new Prisma.Decimal(raw.percentage)
                : null,
            shares:
              splitType === SplitType.SHARES && raw ? raw.shares : null,
          };
        }),
      });

      return tx.expense.findUnique({
        where: { id: exp.id },
        include: {
          paidBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          splits: {
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          },
        },
      });
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('createExpense error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── GET GROUP EXPENSES ────────────────────────────────────────────
export const getExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: groupId } = req.params;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) { res.status(404).json({ message: 'Group not found' }); return; }

    const expenses = await prisma.expense.findMany({
      where: { groupId, isDeleted: false },
      include: {
        paidBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        splits: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.status(200).json(expenses);
  } catch (error) {
    console.error('getExpenses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── GET EXPENSE BY ID ─────────────────────────────────────────────
export const getExpenseById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        paidBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        splits: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    });

    if (!expense || expense.isDeleted) {
      res.status(404).json({ message: 'Expense not found' });
      return;
    }

    res.status(200).json(expense);
  } catch (error) {
    console.error('getExpenseById error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────
export const updateExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { description, amount, splitType, paidById, splits } = req.body;
    const requesterId = req.user?.id;

    if (!requesterId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) {
      res.status(404).json({ message: 'Expense not found' });
      return;
    }

    // Only creator can edit
    if (existing.createdById !== requesterId) {
      res.status(403).json({ message: 'Only the expense creator can edit this expense' });
      return;
    }

    if (!description || !amount || amount <= 0 || !splitType || !paidById || !splits) {
      res.status(400).json({ message: 'Missing or invalid expense fields' });
      return;
    }

    const groupId = existing.groupId!;

    if (!(await isGroupMember(groupId, paidById))) {
      res.status(400).json({ message: 'Payer must be a member of the group' });
      return;
    }

    const participantIds: string[] =
      splitType === SplitType.EQUAL ? splits : splits.map((s: { userId: string }) => s.userId);

    for (const uid of participantIds) {
      if (!(await isGroupMember(groupId, uid))) {
        res.status(400).json({ message: `User ${uid} is not a member of this group` });
        return;
      }
    }

    let calculated: SplitResult[] = [];
    try {
      if (splitType === SplitType.EQUAL) {
        calculated = calculateEqualSplit(amount, participantIds);
      } else if (splitType === SplitType.EXACT) {
        calculated = calculateUnequalSplit(amount, splits);
      } else if (splitType === SplitType.PERCENTAGE) {
        calculated = calculatePercentageSplit(amount, splits);
      } else if (splitType === SplitType.SHARES) {
        calculated = calculateShareSplit(amount, splits);
      } else {
        res.status(400).json({ message: 'Invalid splitType' });
        return;
      }
    } catch (e: unknown) {
      res.status(400).json({ message: e instanceof Error ? e.message : 'Split calculation error' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Delete old splits
      await tx.expenseSplit.deleteMany({ where: { expenseId: id } });

      // Update expense
      await tx.expense.update({
        where: { id },
        data: {
          description,
          amount: new Prisma.Decimal(amount),
          splitType,
          paidById,
        },
      });

      // Create new splits
      await tx.expenseSplit.createMany({
        data: calculated.map((cs) => {
          const raw = splitType === SplitType.EQUAL
            ? null
            : splits.find((s: { userId: string }) => s.userId === cs.userId);
          return {
            expenseId: id,
            userId: cs.userId,
            owedAmount: new Prisma.Decimal(cs.owedAmount),
            percentage:
              splitType === SplitType.PERCENTAGE && raw
                ? new Prisma.Decimal(raw.percentage)
                : null,
            shares:
              splitType === SplitType.SHARES && raw ? raw.shares : null,
          };
        }),
      });

      return tx.expense.findUnique({
        where: { id },
        include: {
          paidBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          splits: {
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          },
        },
      });
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('updateExpense error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── DELETE ────────────────────────────────────────────────────────
export const deleteExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requesterId = req.user?.id;

    if (!requesterId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense || expense.isDeleted) {
      res.status(404).json({ message: 'Expense not found' });
      return;
    }

    if (expense.createdById !== requesterId) {
      res.status(403).json({ message: 'Only the expense creator can delete this expense' });
      return;
    }

    // Hard delete — splits cascade via DB relation
    await prisma.expense.delete({ where: { id } });

    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('deleteExpense error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── GET EXPENSE CHAT HISTORY ──────────────────────────────────────
export const getExpenseChat = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: expenseId } = req.params;

    const chatMessages = await prisma.comment.findMany({
      where: { expenseId },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Reverse to get ASC order for rendering
    const formatted = chatMessages.reverse().map((c) => ({
      id: c.id,
      message: c.content,
      user: {
        id: c.author.id,
        name: c.author.name,
      },
      createdAt: c.createdAt,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error('getExpenseChat error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
