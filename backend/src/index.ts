import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────
import authRouter from './routes/auth';
import groupRouter from './routes/groups';
import expenseRouter from './routes/expenses';
import balanceRouter from './routes/balances';
import settlementRouter from './routes/settlements';
app.use('/api/auth', authRouter);
app.use('/api/groups', groupRouter);
app.use('/api', expenseRouter);
app.use('/api', balanceRouter);
app.use('/api', settlementRouter);



// ── HTTP + WebSocket server ──────────────────────────────────────
const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

import { registerChatHandler } from './socket/chatHandler';
registerChatHandler(io);

// ── Start ────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export { io };
