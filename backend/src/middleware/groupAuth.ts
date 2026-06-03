import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import prisma from '../prisma';

export const requireGroupMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const groupId = req.params.id || req.params.groupId || req.body.groupId;
    const userId = req.user?.id;

    if (!groupId) {
      res.status(400).json({ message: 'Group ID is required' });
      return;
    }

    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ message: 'Access denied: You are not a member of this group' });
      return;
    }

    next();
  } catch (error) {
    console.error('Group member validation error:', error);
    res.status(500).json({ message: 'Internal server error validating group membership' });
  }
};

export const requireGroupAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const groupId = req.params.id || req.params.groupId || req.body.groupId;
    const userId = req.user?.id;

    if (!groupId) {
      res.status(400).json({ message: 'Group ID is required' });
      return;
    }

    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ message: 'Access denied: You are not a member of this group' });
      return;
    }

    if (membership.role !== 'ADMIN') {
      res.status(403).json({ message: 'Access denied: Admin privileges required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Group admin validation error:', error);
    res.status(500).json({ message: 'Internal server error validating group admin privileges' });
  }
};
