import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

interface JwtPayload {
  userId: string;
}

export const registerChatHandler = (io: Server) => {
  // Authentication middleware for Socket.IO
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-me';
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.data.user = user;
      next();
    } catch (error) {
      console.error('[WS Auth Error]', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[WS] Client connected: ${socket.id} (User: ${socket.data.user?.name})`);

    // On join_expense
    socket.on('join_expense', async ({ expenseId }: { expenseId: string }) => {
      try {
        const userId = socket.data.user?.id;
        if (!userId) {
          socket.emit('error_message', { message: 'Unauthorized' });
          return;
        }

        // Verify user is a member of that expense's group
        const expense = await prisma.expense.findUnique({
          where: { id: expenseId },
          select: { groupId: true },
        });

        if (!expense) {
          socket.emit('error_message', { message: 'Expense not found' });
          return;
        }

        if (expense.groupId) {
          const membership = await prisma.groupMember.findUnique({
            where: {
              groupId_userId: {
                groupId: expense.groupId,
                userId,
              },
            },
          });

          if (!membership) {
            socket.emit('error_message', { message: 'Unauthorized: Not a member of the group' });
            return;
          }
        } else {
          // Individual/friend expense: verify participant or payer/creator
          const splits = await prisma.expenseSplit.findMany({
            where: { expenseId },
            select: { userId: true },
          });
          const isParticipant = splits.some((s) => s.userId === userId);
          const isPayerOrCreator = await prisma.expense.findFirst({
            where: {
              id: expenseId,
              OR: [{ paidById: userId }, { createdById: userId }],
            },
          });

          if (!isParticipant && !isPayerOrCreator) {
            socket.emit('error_message', { message: 'Unauthorized: Not participant of this expense' });
            return;
          }
        }

        socket.join(`expense:${expenseId}`);
        console.log(`[WS] User ${socket.data.user?.name} joined room expense:${expenseId}`);
      } catch (err) {
        console.error('[WS Join Error]', err);
        socket.emit('error_message', { message: 'Failed to join room' });
      }
    });

    // On leave_expense
    socket.on('leave_expense', ({ expenseId }: { expenseId: string }) => {
      socket.leave(`expense:${expenseId}`);
      console.log(`[WS] User ${socket.data.user?.name} left room expense:${expenseId}`);
    });

    // On send_message
    socket.on('send_message', async ({ expenseId, message }: { expenseId: string; message: string }) => {
      try {
        const userId = socket.data.user?.id;
        if (!userId) return;

        if (!message || !message.trim()) return;

        // Save comment
        const comment = await prisma.comment.create({
          data: {
            expenseId,
            authorId: userId,
            content: message.trim(),
          },
          include: {
            author: { select: { id: true, name: true } },
          },
        });

        // Emit new_message to all clients in the room
        io.to(`expense:${expenseId}`).emit('new_message', {
          id: comment.id,
          message: comment.content,
          user: {
            id: comment.author.id,
            name: comment.author.name,
          },
          createdAt: comment.createdAt,
        });
      } catch (err) {
        console.error('[WS Send Message Error]', err);
        socket.emit('error_message', { message: 'Failed to deliver message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });
};
