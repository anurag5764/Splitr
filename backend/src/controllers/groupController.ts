import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../prisma';

// Helper to calculate user balance in a single group
const calculateUserBalanceInGroup = async (groupId: string, userId: string): Promise<number> => {
  try {
    // 1. Sum of all expenses paid by the user in this group
    const paidSum = await prisma.expense.aggregate({
      where: {
        groupId,
        paidById: userId,
        isDeleted: false,
      },
      _sum: {
        amount: true,
      },
    });

    // 2. Sum of all splits owed by the user in this group's expenses
    const owedSum = await prisma.expenseSplit.aggregate({
      where: {
        expense: {
          groupId,
          isDeleted: false,
        },
        userId,
      },
      _sum: {
        owedAmount: true,
      },
    });

    const paid = paidSum._sum.amount ? Number(paidSum._sum.amount) : 0;
    const owed = owedSum._sum.owedAmount ? Number(owedSum._sum.owedAmount) : 0;

    // 3. Sum of all settlements paid by the user in this group
    const settlementsPaidSum = await prisma.settlement.aggregate({
      where: { groupId, payerId: userId, status: 'CONFIRMED' },
      _sum: { amount: true },
    });

    // 4. Sum of all settlements received by the user in this group
    const settlementsReceivedSum = await prisma.settlement.aggregate({
      where: { groupId, payeeId: userId, status: 'CONFIRMED' },
      _sum: { amount: true },
    });

    const settlementsPaid = settlementsPaidSum._sum.amount ? Number(settlementsPaidSum._sum.amount) : 0;
    const settlementsReceived = settlementsReceivedSum._sum.amount ? Number(settlementsReceivedSum._sum.amount) : 0;

    return Number(((paid + settlementsPaid) - (owed + settlementsReceived)).toFixed(2));
  } catch (error) {
    console.error(`Error calculating balance for user ${userId} in group ${groupId}:`, error);
    return 0;
  }
};

export const getGroups = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Find all groups where the user is a member
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch user balances in parallel
    const groupsWithBalances = await Promise.all(
      groups.map(async (group) => {
        const userBalance = await calculateUserBalanceInGroup(group.id, userId);
        return {
          ...group,
          memberCount: group._count.members,
          userBalance,
        };
      })
    );

    res.status(200).json(groupsWithBalances);
  } catch (error) {
    console.error('getGroups controller error:', error);
    res.status(500).json({ message: 'Internal server error fetching groups' });
  }
};

export const createGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { name, description, imageUrl, type, currency } = req.body;

    if (!name || name.trim() === '') {
      res.status(400).json({ message: 'Group name is required' });
      return;
    }

    // Create group and add creator as ADMIN member in a transaction
    const newGroup = await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name,
          description,
          imageUrl,
          type: type || 'OTHER',
          currency: currency || 'USD',
        },
      });

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'ADMIN',
        },
      });

      return group;
    });

    res.status(201).json({
      ...newGroup,
      memberCount: 1,
      userBalance: 0,
    });
  } catch (error) {
    console.error('createGroup controller error:', error);
    res.status(500).json({ message: 'Internal server error creating group' });
  }
};

export const getGroupById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        expenses: {
          where: { isDeleted: false },
          include: {
            paidBy: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            splits: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            date: 'desc',
          },
        },
      },
    });

    if (!group) {
      res.status(404).json({ message: 'Group not found' });
      return;
    }

    const userBalance = await calculateUserBalanceInGroup(group.id, userId);

    res.status(200).json({
      ...group,
      userBalance,
    });
  } catch (error) {
    console.error('getGroupById controller error:', error);
    res.status(500).json({ message: 'Internal server error fetching group details' });
  }
};

export const addMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: groupId } = req.params;
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Member email is required' });
      return;
    }

    // Find the user by email
    const userToAdd = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!userToAdd) {
      res.status(404).json({ message: `User with email ${email} not found` });
      return;
    }

    // Check if user is already a member
    const existingMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: userToAdd.id,
        },
      },
    });

    if (existingMembership) {
      res.status(409).json({ message: 'User is already a member of this group' });
      return;
    }

    // Add member to group
    await prisma.groupMember.create({
      data: {
        groupId,
        userId: userToAdd.id,
        role: 'MEMBER',
      },
    });

    // Fetch and return the updated members array with all members
    const updatedMembers = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    res.status(201).json(updatedMembers);
  } catch (error) {
    console.error('addMember controller error:', error);
    res.status(500).json({ message: 'Internal server error adding group member' });
  }
};

export const removeMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: groupId, userId: targetUserId } = req.params;
    const requesterId = req.user?.id;

    if (!requesterId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // The requireGroupAdmin middleware ensures that requester is an admin in the group
    // Double check that the target user is currently in the group
    const targetMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMembership) {
      res.status(404).json({ message: 'Target user is not a member of this group' });
      return;
    }

    // Requirement: return 400 if trying to remove themselves when they are the only admin
    if (requesterId === targetUserId) {
      // Count other admins in the group
      const otherAdminsCount = await prisma.groupMember.count({
        where: {
          groupId,
          role: 'ADMIN',
          userId: {
            not: requesterId,
          },
        },
      });

      if (otherAdminsCount === 0) {
        res.status(400).json({
          message: 'Cannot remove yourself because you are the only group admin. Appoint another admin first.',
        });
        return;
      }
    }

    // Delete membership
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
    });

    res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('removeMember controller error:', error);
    res.status(500).json({ message: 'Internal server error removing group member' });
  }
};
