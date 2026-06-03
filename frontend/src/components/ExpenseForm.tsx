'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────
interface GroupMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface Group {
  id: string;
  name: string;
  currency: string;
  members: GroupMember[];
}

interface InitialSplit {
  userId: string;
  owedAmount: number;
  percentage?: number | null;
  shares?: number | null;
}

interface ExpenseFormProps {
  groupId: string;
  expenseId?: string;            // present → edit mode
  initialExpense?: {
    id: string;
    description: string;
    amount: number;
    splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';
    paidById: string;
    splits: InitialSplit[];
  };
  onSuccess: () => void;
  onCancel: () => void;
}

type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

export default function ExpenseForm({
  groupId,
  expenseId,
  initialExpense,
  onSuccess,
  onCancel,
}: ExpenseFormProps) {
  const queryClient = useQueryClient();

  const [description, setDescription] = useState(initialExpense?.description ?? '');
  const [amount, setAmount] = useState(initialExpense?.amount?.toString() ?? '');
  const [paidById, setPaidById] = useState(initialExpense?.paidById ?? '');
  const [splitType, setSplitType] = useState<SplitType>(initialExpense?.splitType ?? 'EQUAL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exactAmts, setExactAmts] = useState<Record<string, string>>({});
  const [pcts, setPcts] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch group so we know members
  const { data: group, isLoading } = useQuery<Group>({
    queryKey: ['group', groupId],
    queryFn: async () => (await api.get(`/groups/${groupId}`)).data,
  });

  // Seed defaults once group loads
  useEffect(() => {
    if (!group || group.members.length === 0) return;

    if (!initialExpense) {
      // Create mode — select everyone, payer = first member
      setPaidById(group.members[0].userId);
      const ids = group.members.map((m) => m.userId);
      setSelectedIds(ids);
      const blank: Record<string, string> = {};
      ids.forEach((id) => { blank[id] = ''; });
      setExactAmts(blank);
      setPcts(blank);
      const oneEach: Record<string, string> = {};
      ids.forEach((id) => { oneEach[id] = '1'; });
      setShares(oneEach);
    } else {
      // Edit mode — pre-fill from initialExpense
      const ids = initialExpense.splits.map((s) => s.userId);
      setSelectedIds(ids);
      const em: Record<string, string> = {};
      const pm: Record<string, string> = {};
      const sm: Record<string, string> = {};
      group.members.forEach((m) => {
        const sp = initialExpense.splits.find((s) => s.userId === m.userId);
        em[m.userId] = sp ? sp.owedAmount.toString() : '';
        pm[m.userId] = sp?.percentage != null ? sp.percentage.toString() : '';
        sm[m.userId] = sp?.shares != null ? sp.shares.toString() : '1';
      });
      setExactAmts(em);
      setPcts(pm);
      setShares(sm);
    }
  }, [group, initialExpense]);

  // Mutation
  const mutation = useMutation({
    mutationFn: async (payload: unknown) => {
      if (expenseId) return (await api.put(`/expenses/${expenseId}`, payload)).data;
      return (await api.post(`/groups/${groupId}/expenses`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      if (expenseId) queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : (err as any)?.response?.data?.message ?? 'Something went wrong';
      setFormError(msg);
    },
  });

  const toggleParticipant = (uid: string) =>
    setSelectedIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );

  const computedSum = () => {
    const n = parseFloat(amount) || 0;
    if (splitType === 'EQUAL') return n;
    if (splitType === 'EXACT')
      return selectedIds.reduce((s, id) => s + (parseFloat(exactAmts[id]) || 0), 0);
    if (splitType === 'PERCENTAGE')
      return selectedIds.reduce((s, id) => s + (parseFloat(pcts[id]) || 0), 0);
    return selectedIds.reduce((s, id) => s + (parseFloat(shares[id]) || 0), 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { setFormError('Amount must be a positive number'); return; }
    if (selectedIds.length === 0) { setFormError('Select at least one participant'); return; }

    type SplitPayloadItem = { userId: string; owedAmount?: number; percentage?: number; shares?: number };
    let splitsPayload: string[] | SplitPayloadItem[];

    if (splitType === 'EQUAL') {
      splitsPayload = selectedIds;
    } else if (splitType === 'EXACT') {
      const sum = computedSum();
      if (Math.abs(numAmount - sum) > 0.01) {
        setFormError(`Amounts sum to ${sum.toFixed(2)} but expense is ${numAmount.toFixed(2)}`);
        return;
      }
      splitsPayload = selectedIds.map((id) => ({ userId: id, owedAmount: parseFloat(exactAmts[id]) || 0 }));
    } else if (splitType === 'PERCENTAGE') {
      const sum = computedSum();
      if (Math.abs(100 - sum) > 0.01) {
        setFormError(`Percentages sum to ${sum.toFixed(1)}% — must equal 100%`);
        return;
      }
      splitsPayload = selectedIds.map((id) => ({ userId: id, percentage: parseFloat(pcts[id]) || 0 }));
    } else {
      const total = computedSum();
      if (total <= 0) { setFormError('Total shares must be greater than zero'); return; }
      splitsPayload = selectedIds.map((id) => ({ userId: id, shares: parseInt(shares[id], 10) || 1 }));
    }

    mutation.mutate({ description: description.trim(), amount: numAmount, splitType, paidById, splits: splitsPayload });
  };

  if (isLoading) return <div className="text-center py-8 text-slate-400 text-sm">Loading group…</div>;

  const numAmount = parseFloat(amount) || 0;
  const sum = computedSum();
  const pctOk = Math.abs(100 - sum) < 0.01;
  const amtOk = Math.abs(numAmount - sum) < 0.01;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs">
          {formError}
        </div>
      )}

      {/* Description + Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Description</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Dinner, Hotel"
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
            Amount ({group?.currency ?? 'USD'})
          </label>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition"
          />
        </div>
      </div>

      {/* Paid By + Split Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Paid By</label>
          <select
            value={paidById}
            onChange={(e) => setPaidById(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition cursor-pointer"
          >
            {group?.members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.user.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Split Method</label>
          <select
            value={splitType}
            onChange={(e) => setSplitType(e.target.value as SplitType)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition cursor-pointer"
          >
            <option value="EQUAL">Split Equally</option>
            <option value="EXACT">Exact Amounts</option>
            <option value="PERCENTAGE">By Percentage</option>
            <option value="SHARES">By Shares (2:1)</option>
          </select>
        </div>
      </div>

      {/* Participants */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
        {/* Header with live sum indicator */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-900">
          <h4 className="text-xs font-bold text-white">Participants</h4>
          {splitType !== 'EQUAL' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              splitType === 'PERCENTAGE'
                ? pctOk ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                : amtOk ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            }`}>
              {splitType === 'PERCENTAGE'
                ? `${sum.toFixed(1)}% / 100%`
                : `${group?.currency ?? ''} ${sum.toFixed(2)} / ${numAmount.toFixed(2)}`}
            </span>
          )}
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {group?.members.map((member) => {
            const checked = selectedIds.includes(member.userId);
            return (
              <div
                key={member.userId}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition ${
                  checked ? 'bg-slate-900/70 border border-slate-800/60' : 'opacity-40'
                }`}
              >
                {/* Checkbox + name */}
                <label className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleParticipant(member.userId)}
                    className="accent-emerald-500 h-4 w-4 rounded cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-white block truncate">{member.user.name}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{member.user.email}</span>
                  </div>
                </label>

                {/* Input area */}
                {checked && (
                  <div className="ml-3 w-28 shrink-0">
                    {splitType === 'EQUAL' && (
                      <span className="text-xs font-bold text-slate-400 block text-right">
                        {group.currency} {(numAmount / Math.max(1, selectedIds.length)).toFixed(2)}
                      </span>
                    )}
                    {splitType === 'EXACT' && (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">{group.currency}</span>
                        <input
                          type="number" step="0.01" placeholder="0.00"
                          value={exactAmts[member.userId] ?? ''}
                          onChange={(e) => setExactAmts({ ...exactAmts, [member.userId]: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg pl-7 pr-2 py-1 text-xs text-white text-right outline-none transition"
                        />
                      </div>
                    )}
                    {splitType === 'PERCENTAGE' && (
                      <div className="relative">
                        <input
                          type="number" step="0.1" placeholder="0"
                          value={pcts[member.userId] ?? ''}
                          onChange={(e) => setPcts({ ...pcts, [member.userId]: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg pl-2 pr-6 py-1 text-xs text-white text-right outline-none transition"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                      </div>
                    )}
                    {splitType === 'SHARES' && (
                      <input
                        type="number" min="1" placeholder="1"
                        value={shares[member.userId] ?? '1'}
                        onChange={(e) => setShares({ ...shares, [member.userId]: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-2 py-1 text-xs text-white text-right outline-none transition"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-3 pt-2 border-t border-slate-900">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium rounded-xl py-2.5 text-sm transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl py-2.5 text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center"
        >
          {mutation.isPending
            ? <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            : expenseId ? 'Save Changes' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}
