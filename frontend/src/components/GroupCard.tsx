import React from 'react';
import Link from 'next/link';

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    currency: string;
    memberCount: number;
    userBalance: number;
  };
}

export default function GroupCard({ group }: GroupCardProps) {
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

  const getGroupIcon = (type: string) => {
    switch (type) {
      case 'HOME':
        return '🏠';
      case 'TRIP':
        return '✈️';
      case 'COUPLE':
        return '❤️';
      default:
        return '📦';
    }
  };

  return (
    <Link href={`/groups/${group.id}`}>
      <div className="bg-slate-900/50 backdrop-blur border border-slate-800/80 hover:border-emerald-500/50 p-5 rounded-2xl transition duration-300 hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5 group flex flex-col justify-between min-h-[168px] cursor-pointer">
        {/* Top row — icon + member count */}
        <div>
          <div className="flex justify-between items-start">
            <span className="text-2xl p-2 bg-slate-950/60 rounded-xl border border-slate-800/50">
              {getGroupIcon(group.type)}
            </span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-950/40 border border-slate-800/30 px-2.5 py-1 rounded-full whitespace-nowrap">
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>

          <h3 className="text-base font-bold text-white mt-3 tracking-tight group-hover:text-emerald-400 transition-colors truncate">
            {group.name}
          </h3>
          {group.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{group.description}</p>
          )}
        </div>

        {/* Bottom — balance, stacked so text never overflows */}
        <div className="mt-3 pt-3 border-t border-slate-800/30">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-0.5">
            Balance
          </span>
          <span className={`text-sm font-bold block truncate ${getBalanceColor(group.userBalance)}`}>
            {getBalanceText(group.userBalance, group.currency)}
          </span>
        </div>
      </div>
    </Link>
  );
}
