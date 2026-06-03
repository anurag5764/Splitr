'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import ExpenseForm from '@/components/ExpenseForm';
import Link from 'next/link';
import ChatWindow from '@/components/ChatWindow';

// ── Types ─────────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Split {
  id: string;
  userId: string;
  owedAmount: string;
  percentage: string | null;
  shares: number | null;
  user: User;
}

interface Expense {
  id: string;
  description: string;
  amount: string;
  currency: string;
  splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';
  date: string;
  notes: string | null;
  paidById: string;
  createdById: string;
  groupId: string;
  paidBy: User;
  createdBy: User;
  splits: Split[];
}

const SPLIT_LABELS: Record<string, string> = {
  EQUAL: 'Split Equally',
  EXACT: 'Exact Amounts',
  PERCENTAGE: 'By Percentage',
  SHARES: 'By Shares',
};

export default function ExpenseDetailPage() {
  const { id: groupId, eid: expenseId } = useParams() as { id: string; eid: string };
  const router = useRouter();
  const { user, hydrate, isHydrated } = useAuthStore();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  const { data: expense, isLoading, error } = useQuery<Expense>({
    queryKey: ['expense', expenseId],
    queryFn: async () => (await api.get(`/expenses/${expenseId}`)).data,
    enabled: isHydrated && !!user && !!expenseId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => (await api.delete(`/expenses/${expenseId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      router.push(`/groups/${groupId}`);
    },
    onError: (err: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPageError((err as any)?.response?.data?.message ?? 'Failed to delete expense.');
    },
  });

  const handleDelete = () => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    setPageError(null);
    deleteMutation.mutate();
  };

  // Loading state
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  // Error state
  if (error || !expense) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-6 rounded-2xl text-center max-w-md">
          <h2 className="text-lg font-bold mb-2">Expense Not Found</h2>
          <p className="text-sm text-rose-300/70 mb-4">
            This expense may have been deleted or you don&apos;t have access to it.
          </p>
          <Link
            href={`/groups/${groupId}`}
            className="inline-block bg-slate-900 border border-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-slate-800 transition"
          >
            Back to Group
          </Link>
        </div>
      </div>
    );
  }

  const isCreator = expense.createdById === user?.id;
  const totalAmount = parseFloat(expense.amount);
  const parsedDate = new Date(expense.date).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-16">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-900/20 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href={`/groups/${groupId}`}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="font-bold text-base text-white tracking-tight">Expense Details</span>
          </div>

          {isCreator && !isEditing && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-xl transition"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-sm font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1.5 rounded-xl transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {pageError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm">
            {pageError}
          </div>
        )}

        {/* Edit mode */}
        {isEditing ? (
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl">
            <h2 className="text-base font-bold text-white mb-5">Edit Expense</h2>
            <ExpenseForm
              groupId={groupId}
              expenseId={expenseId}
              initialExpense={{
                id: expense.id,
                description: expense.description,
                amount: totalAmount,
                splitType: expense.splitType,
                paidById: expense.paidById,
                splits: expense.splits.map((s) => ({
                  userId: s.userId,
                  owedAmount: parseFloat(s.owedAmount),
                  percentage: s.percentage ? parseFloat(s.percentage) : null,
                  shares: s.shares,
                })),
              }}
              onSuccess={() => {
                setIsEditing(false);
                queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });
                queryClient.invalidateQueries({ queryKey: ['group', groupId] });
              }}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        ) : (
          <>
            {/* Summary card */}
            <div className="bg-slate-900/30 border border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">{expense.description}</h1>
                <p className="text-xs text-slate-500 mt-1">
                  {parsedDate} · Added by <span className="font-semibold text-slate-400">{expense.createdBy.name}</span>
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-700">
                  {SPLIT_LABELS[expense.splitType]}
                </span>
              </div>
              <div className="shrink-0 sm:text-right">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total</span>
                <span className="text-3xl font-black text-emerald-400">
                  {expense.currency ?? 'USD'} {totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Who paid */}
            <div className="bg-slate-900/20 border border-slate-800 p-5 rounded-3xl space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Paid By</h3>
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-emerald-400 shrink-0">
                  {expense.paidBy.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{expense.paidBy.name}</p>
                  <p className="text-xs text-slate-500">{expense.paidBy.email}</p>
                </div>
                <span className="ml-auto text-base font-black text-white">
                  {expense.currency ?? 'USD'} {totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Splits breakdown */}
            <div className="bg-slate-900/20 border border-slate-800 p-5 rounded-3xl space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Split Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                      <th className="pb-2 font-semibold">Participant</th>
                      {expense.splitType === 'PERCENTAGE' && (
                        <th className="pb-2 font-semibold text-right">%</th>
                      )}
                      {expense.splitType === 'SHARES' && (
                        <th className="pb-2 font-semibold text-right">Shares</th>
                      )}
                      <th className="pb-2 font-semibold text-right">Owes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {expense.splits.map((split) => {
                      const isSelf = split.userId === user?.id;
                      const owedAmt = parseFloat(split.owedAmount);
                      return (
                        <tr key={split.id} className="hover:bg-slate-900/30 transition">
                          <td className="py-3 pr-4">
                            <div className="flex items-center space-x-2.5">
                              <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                                {split.user.name[0].toUpperCase()}
                              </div>
                              <div>
                                <span className="font-medium text-white block leading-tight">
                                  {split.user.name}
                                  {isSelf && <span className="text-slate-500 text-[10px] ml-1">(you)</span>}
                                </span>
                                <span className="text-[10px] text-slate-500">{split.user.email}</span>
                              </div>
                            </div>
                          </td>
                          {expense.splitType === 'PERCENTAGE' && (
                            <td className="py-3 text-right text-slate-400 font-semibold">
                              {split.percentage ? `${parseFloat(split.percentage).toFixed(1)}%` : '—'}
                            </td>
                          )}
                          {expense.splitType === 'SHARES' && (
                            <td className="py-3 text-right text-slate-400 font-semibold">
                              {split.shares ?? '—'}
                            </td>
                          )}
                          <td className="py-3 text-right font-black text-white">
                            {expense.currency ?? 'USD'} {owedAmt.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chat Comments Window */}
            <ChatWindow expenseId={expenseId} />
          </>
        )}
      </main>
    </div>
  );
}
