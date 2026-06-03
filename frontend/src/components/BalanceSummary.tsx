'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import SettleUpModal from './SettleUpModal';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface GroupBalance {
  fromUserId: string;
  toUserId: string;
  fromUser: UserInfo;
  toUser: UserInfo;
  amount: number;
}

interface BalanceSummaryProps {
  groupId: string;
}

export default function BalanceSummary({ groupId }: BalanceSummaryProps) {
  const { user } = useAuthStore();
  const [selectedSettlement, setSelectedSettlement] = useState<{
    payerId: string;
    payerName: string;
    payeeId: string;
    payeeName: string;
    suggestedAmount: number;
  } | null>(null);

  const { data: balances, isLoading } = useQuery<GroupBalance[]>({
    queryKey: ['groupBalances', groupId],
    queryFn: async () => (await api.get(`/groups/${groupId}/balances`)).data,
    enabled: !!groupId && !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((n) => (
          <div key={n} className="h-10 bg-slate-900/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!balances || balances.length === 0) {
    return (
      <div className="text-center py-6 flex flex-col items-center">
        <span className="text-2xl mb-2">🎉</span>
        <p className="text-sm font-semibold text-slate-400">All settled up!</p>
        <p className="text-xs text-slate-600 mt-0.5">No outstanding balances in this group.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {balances.map((b, i) => {
        const isCurrentUserDebtor = b.fromUserId === user?.id;
        const isCurrentUserCreditor = b.toUserId === user?.id;

        return (
          <div
            key={i}
            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border gap-3 transition ${
              isCurrentUserDebtor
                ? 'bg-rose-500/5 border-rose-500/15'
                : isCurrentUserCreditor
                ? 'bg-emerald-500/5 border-emerald-500/15'
                : 'bg-slate-900/30 border-slate-800/50'
            }`}
          >
            {/* Avatars + names */}
            <div className="flex items-center space-x-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-rose-400 shrink-0">
                {b.fromUser.name[0].toUpperCase()}
              </div>
              <svg className="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                {b.toUser.name[0].toUpperCase()}
              </div>
              <span className="text-xs text-slate-300 truncate ml-1">
                <span className={`font-bold ${isCurrentUserDebtor ? 'text-rose-400' : 'text-white'}`}>
                  {isCurrentUserDebtor ? 'You' : b.fromUser.name}
                </span>
                {' owes '}
                <span className={`font-bold ${isCurrentUserCreditor ? 'text-emerald-400' : 'text-white'}`}>
                  {isCurrentUserCreditor ? 'you' : b.toUser.name}
                </span>
              </span>
            </div>

            {/* Action Row */}
            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <span className={`text-sm font-black ${
                isCurrentUserDebtor ? 'text-rose-400' : isCurrentUserCreditor ? 'text-emerald-400' : 'text-white'
              }`}>
                ${b.amount.toFixed(2)}
              </span>

              <button
                onClick={() => setSelectedSettlement({
                  payerId: b.fromUserId,
                  payerName: b.fromUser.name,
                  payeeId: b.toUserId,
                  payeeName: b.toUser.name,
                  suggestedAmount: b.amount,
                })}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-2.5 py-1 rounded-lg transition text-[10px] uppercase tracking-wider shrink-0"
              >
                Settle Up
              </button>
            </div>
          </div>
        );
      })}

      {/* Settle Up Modal */}
      {selectedSettlement && (
        <SettleUpModal
          isOpen={!!selectedSettlement}
          onClose={() => setSelectedSettlement(null)}
          groupId={groupId}
          payerId={selectedSettlement.payerId}
          payerName={selectedSettlement.payerName}
          payeeId={selectedSettlement.payeeId}
          payeeName={selectedSettlement.payeeName}
          suggestedAmount={selectedSettlement.suggestedAmount}
        />
      )}
    </div>
  );
}
