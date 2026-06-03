'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import InviteModal from '@/components/InviteModal';
import ExpenseForm from '@/components/ExpenseForm';
import BalanceSummary from '@/components/BalanceSummary';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: User;
}

interface Split {
  id: string;
  userId: string;
  owedAmount: number;
  user: {
    id: string;
    name: string;
  };
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  paidById: string;
  paidBy: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  splits: Split[];
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  type: string;
  currency: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  members: GroupMember[];
  expenses: Expense[];
  userBalance: number;
}

interface SettlementUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Settlement {
  id: string;
  groupId: string | null;
  payerId: string;
  payeeId: string;
  amount: number | string;
  currency: string;
  note: string | null;
  status: string;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
  payer: SettlementUser;
  payee: SettlementUser;
}

export default function GroupDetailsPage() {
  const { id } = useParams() as { id: string };
  const { user, hydrate, isHydrated } = useAuthStore();
  const queryClient = useQueryClient();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Load auth state
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Fetch group details
  const { data: group, isLoading, error } = useQuery<GroupDetail>({
    queryKey: ['group', id],
    queryFn: async () => {
      const response = await api.get(`/groups/${id}`);
      return response.data;
    },
    enabled: isHydrated && !!user && !!id,
  });

  // Fetch group settlements
  const { data: settlements, isLoading: isSettlementsLoading } = useQuery<Settlement[]>({
    queryKey: ['settlements', id],
    queryFn: async () => {
      const response = await api.get(`/groups/${id}/settlements`);
      return response.data;
    },
    enabled: isHydrated && !!user && !!id,
  });

  // Check if current user is admin of the group
  const currentUserMembership = group?.members.find((m) => m.userId === user?.id);
  const isAdmin = currentUserMembership?.role === 'ADMIN';

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const response = await api.delete(`/groups/${id}/members/${targetUserId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      setRemoveError(null);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      console.error('Error removing group member:', err);
      setRemoveError(err.response?.data?.message || 'Failed to remove member.');
    },
  });

  const handleRemoveMember = (targetUserId: string, targetName: string) => {
    if (window.confirm(`Are you sure you want to remove ${targetName} from the group?`)) {
      setRemoveError(null);
      removeMemberMutation.mutate(targetUserId);
    }
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-emerald-400';
    if (balance < 0) return 'text-rose-400';
    return 'text-slate-400';
  };

  const getBalanceText = (balance: number, currency: string) => {
    if (balance > 0) return `Owes you ${currency} ${Math.abs(balance).toFixed(2)}`;
    if (balance < 0) return `You owe ${currency} ${Math.abs(balance).toFixed(2)}`;
    return 'Settled up';
  };

  const getGroupIcon = (type?: string) => {
    switch (type) {
      case 'HOME': return '🏠';
      case 'TRIP': return '✈️';
      case 'COUPLE': return '❤️';
      default: return '📦';
    }
  };

  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-6 rounded-2xl text-center max-w-md">
          <h2 className="text-lg font-bold mb-2">Error Loading Group</h2>
          <p className="text-sm text-rose-350/80 mb-4">
            You might not have access to this group or it has been deleted.
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-slate-900 border border-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-slate-850 transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-12">
      {/* Top Header / Navigation Bar */}
      <header className="border-b border-slate-900 bg-slate-900/20 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-900 border border-slate-850/30 transition flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center space-x-2">
              <span className="text-xl">{getGroupIcon(group.type)}</span>
              <h1 className="font-extrabold text-xl tracking-tight text-white">{group.name}</h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isAdmin && (
              <button
                onClick={() => setIsInviteOpen(true)}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-4 py-2 rounded-xl border border-emerald-500/20 hover:border-emerald-500/30 transition text-sm flex items-center space-x-2"
              >
                <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Invite Member</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {removeError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm mb-6 flex items-start space-x-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{removeError}</span>
          </div>
        )}

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column — Balance + Expenses */}
          <div className="lg:col-span-2 space-y-6">
            {/* Balance Card Summary */}
            <div className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Your Group Balance</span>
                <h2 className={`text-3xl font-black mt-1 ${getBalanceColor(group.userBalance)}`}>
                  {getBalanceText(group.userBalance, group.currency)}
                </h2>
              </div>

              <div className="text-center sm:text-right">
                <span className="text-xs text-slate-500 block">Total Group Expenses</span>
                <span className="text-lg font-bold text-white mt-1 block">
                  {group.currency} {group.expenses.reduce((acc, exp) => acc + parseFloat(String(exp.amount)), 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Expenses List */}
            <div className="bg-slate-900/10 border border-slate-900 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white tracking-tight">Expenses</h3>
                <button
                  onClick={() => setIsExpenseOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition text-xs flex items-center space-x-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Expense</span>
                </button>
              </div>

              {group.expenses.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center">
                  <span className="text-3xl mb-3">💵</span>
                  <h4 className="text-sm font-semibold text-slate-350 mb-1">No expenses recorded</h4>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Start tracking tabs by logging your first expense.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {group.expenses.map((expense) => {
                    const parsedDate = new Date(expense.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    });

                    const userOwedSplit = expense.splits.find((s) => s.userId === user?.id);
                    const paidBySelf = expense.paidById === user?.id;

                    let expenseStatusText = '';
                    let expenseStatusColor = 'text-slate-400';

                    if (paidBySelf) {
                      const expAmt = parseFloat(String(expense.amount));
                      const owedAmt = userOwedSplit ? parseFloat(String(userOwedSplit.owedAmount)) : 0;
                      const totalOwedOthers = expAmt - owedAmt;
                      expenseStatusText = `You lent ${group.currency} ${totalOwedOthers.toFixed(2)}`;
                      expenseStatusColor = 'text-emerald-400';
                    } else if (userOwedSplit) {
                      expenseStatusText = `You owe ${group.currency} ${parseFloat(String(userOwedSplit.owedAmount)).toFixed(2)}`;
                      expenseStatusColor = 'text-rose-400';
                    } else {
                      expenseStatusText = 'Not involved';
                    }

                    return (
                      <Link key={expense.id} href={`/groups/${group.id}/expense/${expense.id}`} className="block group">
                        <div className="bg-slate-900/40 border border-slate-850/60 p-4 rounded-2xl flex items-center justify-between hover:border-emerald-500/30 hover:bg-slate-900/60 transition cursor-pointer">
                          <div className="flex items-center space-x-4">
                            <div className="bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-850/50 text-center shrink-0">
                              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                {parsedDate.split(' ')[0]}
                              </span>
                              <span className="text-sm font-bold text-white block">
                                {parsedDate.split(' ')[1]}
                              </span>
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{expense.description}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Paid by <span className="font-semibold text-slate-400">{expense.paidBy.name}</span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-sm font-bold block text-white">
                              {group.currency} {parseFloat(String(expense.amount)).toFixed(2)}
                            </span>
                            <span className={`text-[10px] font-semibold mt-0.5 block ${expenseStatusColor}`}>
                              {expenseStatusText}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Settlement History */}
            <div className="bg-slate-900/10 border border-slate-900 rounded-3xl p-6">
              <h3 className="text-lg font-bold text-white tracking-tight mb-6">Settlement History</h3>
              {isSettlementsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((n) => (
                    <div key={n} className="h-14 bg-slate-900/40 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : !settlements || settlements.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-2xl mb-2 block">🤝</span>
                  <h4 className="text-xs font-semibold text-slate-400">No settlements recorded yet</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Settle up outstanding balances to see payment history here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map((settlement) => {
                    const dateStr = new Date(settlement.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                    return (
                      <div
                        key={settlement.id}
                        className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-850/50 rounded-2xl transition hover:border-slate-800"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                            ✓
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-white block truncate">
                              <span className="text-rose-400 font-bold">{settlement.payer.name}</span>
                              {' paid '}
                              <span className="text-emerald-400 font-bold">{settlement.payee.name}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              {dateStr} {settlement.note && `• "${settlement.note}"`}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-black text-emerald-400 shrink-0 ml-3">
                          +{group.currency}{parseFloat(String(settlement.amount)).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Members List Panel */}
            <div className="bg-slate-900/10 border border-slate-900 rounded-3xl p-6 h-fit space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-white tracking-tight">Group Members</h3>
                <span className="text-xs text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                  {group.members.length}
                </span>
              </div>

              <div className="space-y-3">
                {group.members.map((member) => {
                  const isMemberSelf = member.userId === user?.id;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-850/50 rounded-xl"
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-emerald-400 shrink-0">
                          {member.user.name[0].toUpperCase()}
                        </div>
                        <div className="truncate">
                          <span className="text-sm font-medium text-white block truncate">
                            {member.user.name} {isMemberSelf && <span className="text-slate-500">(you)</span>}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {member.user.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-2">
                        {member.role === 'ADMIN' ? (
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                            Admin
                          </span>
                        ) : (
                          isAdmin && (
                            <button
                              onClick={() => handleRemoveMember(member.userId, member.user.name)}
                              disabled={removeMemberMutation.isPending}
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-900 transition"
                              title="Remove member"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Balances Panel */}
            <div className="bg-slate-900/10 border border-slate-900 rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white tracking-tight">Balances</h3>
              <BalanceSummary groupId={group.id} />
            </div>
          </div>
        </div>
      </main>

      {/* Invite Member Modal */}
      <InviteModal
        groupId={group.id}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      {/* Add Expense Modal */}
      {isExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsExpenseOpen(false)}
          />
          <div className="relative z-10 bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-white tracking-tight">Add an Expense</h2>
              <button
                onClick={() => setIsExpenseOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ExpenseForm
              groupId={group.id}
              onSuccess={() => { setIsExpenseOpen(false); }}
              onCancel={() => setIsExpenseOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
