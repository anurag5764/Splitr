import { useEffect, useState, useCallback, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import api from '../lib/api';

export interface ChatMessage {
  id: string;
  message: string;
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export const useChat = (expenseId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socketRef = useRef<any>(null);

  // Fetch chat history
  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const response = await api.get(`/expenses/${expenseId}/chat`);
        if (active) {
          setMessages(response.data);
        }
      } catch (err) {
        console.error('Failed to load chat history', err);
      } finally {
        if (active) {
          setIsLoadingHistory(false);
        }
      }
    };

    if (expenseId) {
      fetchHistory();
    }

    return () => {
      active = false;
    };
  }, [expenseId]);

  // Connect socket and handle events
  useEffect(() => {
    if (!expenseId) return;

    const socket = connectSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('join_expense', { expenseId });
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        // Prevent duplicate messages
        if (prev.some((m) => m.id === msg.id)) {
          return prev;
        }
        return [...prev, msg];
      });
    };

    // If socket is already connected when this mounts, join the room
    if (socket.connected) {
      onConnect();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new_message', onNewMessage);

    // Initial connection attempt check
    setIsConnected(socket.connected);

    return () => {
      socket.emit('leave_expense', { expenseId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_message', onNewMessage);
      disconnectSocket();
    };
  }, [expenseId]);

  // Send message helper
  const sendMessage = useCallback((message: string) => {
    const socket = socketRef.current || getSocket();
    if (socket && message.trim()) {
      socket.emit('send_message', {
        expenseId,
        message: message.trim(),
      });
    }
  }, [expenseId]);

  return {
    messages,
    isConnected,
    isLoadingHistory,
    sendMessage,
  };
};
