'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import GroupCard from '@/components/GroupCard';
import CreateGroupModal from '@/components/CreateGroupModal';

interface Group {
  id: string;
  name: string;
  description: string | null;
  type: string;
  currency: string;
  memberCount: number;
  userBalance: number;
  createdAt: string;
  updatedAt: string;
}

interface UserNetBalance {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  netAmount: number; // positive = they owe you; negative = you owe them
}

export default function DashboardPage() {
  const { user, logout, hydrate, isHydrated } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load auth state
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Fetch groups
  const { data: groups, isLoading: isGroupsLoading, error: groupsError } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await api.get('/groups');
      return response.data;
    },
    enabled: isHydrated && !!user,
  });

  // Fetch user balances
  const { data: userBalances, isLoading: isBalancesLoading } = useQuery<UserNetBalance[]>({
    queryKey: ['userBalances'],
    queryFn: async () => {
      const response = await api.get('/users/balances');
      return response.data;
    },
    enabled: isHydrated && !!user,
  });

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Calculate overall net balance from userBalances (or groups)
  const netBalance = groups ? groups.reduce((acc, group) => acc + group.userBalance, 0) : 0;

  const totalOwed = userBalances
    ? userBalances.filter((b) => b.netAmount > 0).reduce((sum, b) => sum + b.netAmount, 0)
    : 0;

  const totalOwe = userBalances
    ? userBalances.filter((b) => b.netAmount < 0).reduce((sum, b) => sum + Math.abs(b.netAmount), 0)
    : 0;

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-emerald-400';
    if (balance < 0) return 'text-rose-400';
    return 'text-slate-400';
  };

  const getBalanceStatusText = (balance: number) => {
    if (balance > 0) return 'Overall, you are owed';
    if (balance < 0) return 'Overall, you owe';
    return 'You are completely settled up';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Navigation Top Header */}
      <header className="border-b border-slate-900 bg-slate-900/20 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <span className="text-slate-950 font-black text-xl">s</span>
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-350">
              Splitwise
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-semibold text-emerald-400">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <span className="text-sm font-medium text-slate-300 hidden sm:inline">
                {user?.name}
              </span>
            </div>
            <button
              onClick={logout}
              className="text-xs font-semibold text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 hover:border-rose-500/20 px-3 py-1.5 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Net Balance Overview Panel */}
        <section className="bg-slate-900/30 border border-slate-850 p-6 rounded-3xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              {getBalanceStatusText(netBalance)}
            </p>
            <h1 className={`text-4xl font-black mt-2 tracking-tight ${getBalanceColor(netBalance)}`}>
              ${Math.abs(netBalance).toFixed(2)}
            </h1>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-semibold px-6 py-3 rounded-2xl shadow-lg shadow-emerald-500/10 hover:opacity-95 active:scale-[0.98] transition flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Create New Group</span>
          </button>
        </section>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Group Cards Grid Section (Left 2 Columns) */}
          <section className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white tracking-tight">Your Groups</h2>
              {groups && groups.length > 0 && (
                <span className="text-xs text-slate-400">
                  {groups.length} active {groups.length === 1 ? 'group' : 'groups'}
                </span>
              )}
            </div>

            {isGroupsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-slate-900/30 border border-slate-850 h-44 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : groupsError ? (
              <div className="bg-rose-500/5 border border-rose-500/10 text-rose-400 p-6 rounded-2xl text-center">
                Failed to load groups. Refresh page or try again.
              </div>
            ) : groups && groups.length === 0 ? (
              <div className="bg-slate-900/25 border border-slate-850/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                <span className="text-4xl mb-4">📦</span>
                <h3 className="text-lg font-bold text-white mb-2">No groups yet</h3>
                <p className="text-sm text-slate-400 max-w-sm mb-6">
                  Create a group for trips, house bills, or lunch tabs to start splitting costs.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-slate-900 hover:bg-slate-850 text-emerald-400 font-semibold px-5 py-2.5 rounded-xl border border-slate-800 hover:border-emerald-500/30 transition text-sm"
                >
                  Get Started
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {groups?.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            )}
          </section>

          {/* Balances Sidebar (Right 1 Column) */}
          <aside className="space-y-6">
            {/* Owed/Owe Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-950/10 border border-emerald-500/15 p-4 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">You are owed</span>
                <span className="text-xl font-black text-emerald-400 block mt-1">
                  ${totalOwed.toFixed(2)}
                </span>
              </div>
              <div className="bg-rose-950/10 border border-rose-500/15 p-4 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">You owe</span>
                <span className="text-xl font-black text-rose-400 block mt-1">
                  ${totalOwe.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Individual Breakdown List */}
            <div className="bg-slate-900/10 border border-slate-900 rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white tracking-tight">Balances by Friend</h3>

              {isBalancesLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((n) => (
                    <div key={n} className="h-12 bg-slate-900/40 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : !userBalances || userBalances.length === 0 ? (
                <div className="text-center py-6">
                  <span className="text-2xl mb-1 block">🤝</span>
                  <p className="text-xs text-slate-500">You are completely settled up with everyone!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userBalances.map((b) => {
                    const isOwed = b.netAmount > 0;
                    return (
                      <div
                        key={b.userId}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          isOwed ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'
                        }`}
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isOwed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}>
                            {b.name[0].toUpperCase()}
                          </div>
                          <div className="truncate">
                            <span className="text-sm font-semibold text-white block truncate">{b.name}</span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {isOwed ? 'owes you' : 'you owe'}
                            </span>
                          </div>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ${isOwed ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${Math.abs(b.netAmount).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Modal for Group Creation */}
      <CreateGroupModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
