import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface InviteModalProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteModal({ groupId, isOpen, onClose }: InviteModalProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const inviteMemberMutation = useMutation({
    mutationFn: async (memberEmail: string) => {
      const response = await api.post(`/groups/${groupId}/members`, { email: memberEmail });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate the cache for this specific group to reload member list
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      setSuccess(`Successfully added member!`);
      setEmail('');
      setError(null);
      
      // Auto-close after a short delay
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      console.error('Error adding group member:', err);
      setError(err.response?.data?.message || 'Failed to add member. Check the email address.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Email address is required');
      return;
    }

    inviteMemberMutation.mutate(targetEmail);
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
          <h2 className="text-xl font-bold text-white tracking-tight">Invite Group Member</h2>
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

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-xl text-xs mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-white outline-none transition text-sm"
              placeholder="friend@email.com"
            />
            <p className="text-[10px] text-slate-500 ml-1">
              The user must already have a registered Splitwise account.
            </p>
          </div>

          <div className="flex space-x-3 pt-4 border-t border-slate-800/30">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-300 font-medium rounded-xl py-3 text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteMemberMutation.isPending}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-semibold rounded-xl py-3 text-sm hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center"
            >
              {inviteMemberMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-950"></div>
              ) : (
                'Add Member'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
