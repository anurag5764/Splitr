'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface SettleUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  payerId: string;
  payerName: string;
  payeeId: string;
  payeeName: string;
  suggestedAmount: number;
}

export default function SettleUpModal({
  isOpen,
  onClose,
  groupId,
  payerId,
  payerName,
  payeeId,
  payeeName,
  suggestedAmount,
}: SettleUpModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset or prefill when modal is opened or properties change
  useEffect(() => {
    if (isOpen) {
      setAmount(suggestedAmount.toFixed(2));
      setNote('');
      setError(null);
    }
  }, [isOpen, suggestedAmount]);

  const settleMutation = useMutation({
    mutationFn: async (payload: {
      payerId: string;
      payeeId: string;
      amount: number;
      note?: string;
    }) => {
      const response = await api.post(`/groups/${groupId}/settlements`, payload);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate balances query, group data query, and settlements history queries
      queryClient.invalidateQueries({ queryKey: ['groupBalances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['settlements', groupId] });
      queryClient.invalidateQueries({ queryKey: ['userBalances'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      onClose();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      console.error('Error settling up:', err);
      setError(err.response?.data?.message || 'Failed to record settlement. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (parsedAmount > suggestedAmount + 0.01) {
      setError(`Amount cannot exceed the total balance owed ($${suggestedAmount.toFixed(2)}).`);
      return;
    }

    settleMutation.mutate({
      payerId,
      payeeId,
      amount: parsedAmount,
      note: note.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative z-10 animate-scaleIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white tracking-tight">Record a Payment</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2.5 rounded-xl text-xs mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transfer Info */}
          <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl flex items-center justify-between gap-3 text-center">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">Payer</span>
              <span className="text-sm font-bold text-rose-400 block mt-1 truncate">{payerName}</span>
            </div>
            
            <div className="shrink-0 flex flex-col items-center justify-center px-2">
              <svg className="w-6 h-6 text-slate-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">Payee</span>
              <span className="text-sm font-bold text-emerald-400 block mt-1 truncate">{payeeName}</span>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                Amount
              </label>
              <button
                type="button"
                onClick={() => setAmount(suggestedAmount.toFixed(2))}
                className="text-[10px] font-bold text-emerald-400 hover:underline"
              >
                Max Owed (${suggestedAmount.toFixed(2)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-bold">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={suggestedAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-850 rounded-2xl py-3 pl-8 pr-4 text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500 transition text-lg font-bold"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Note input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block ml-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-2xl py-3 px-4 text-white placeholder-slate-650 focus:outline-none focus:border-emerald-500 transition text-sm"
              placeholder="e.g. Paid cash, Venmo, Bank transfer"
            />
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-semibold px-4 py-3 rounded-2xl transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={settleMutation.isPending}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-lg shadow-emerald-500/10 hover:opacity-95 active:scale-[0.98] transition text-sm disabled:opacity-50"
            >
              {settleMutation.isPending ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
