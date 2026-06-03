export interface SplitResult {
  userId: string;
  owedAmount: number;
}

export interface PercentageParticipant {
  userId: string;
  percentage: number;
}

export interface ShareParticipant {
  userId: string;
  shares: number;
}

// Round to 2 decimal places
const round2 = (val: number): number => Math.round(val * 100) / 100;

export const calculateEqualSplit = (
  amount: number,
  participantIds: string[]
): SplitResult[] => {
  const n = participantIds.length;
  if (n === 0) throw new Error('Participants list cannot be empty');

  const base = Math.floor((amount / n) * 100) / 100;
  const remainder = round2(amount - base * n);

  return participantIds.map((userId, index) => ({
    userId,
    owedAmount: index === 0 ? round2(base + remainder) : base,
  }));
};

export const calculateUnequalSplit = (
  amount: number,
  participants: SplitResult[]
): SplitResult[] => {
  if (participants.length === 0) throw new Error('Participants list cannot be empty');

  const sum = participants.reduce((acc, p) => acc + p.owedAmount, 0);
  if (Math.abs(amount - sum) > 0.01) {
    throw new Error(
      `Sum of unequal splits (${sum}) does not match the expense amount (${amount}) within 0.01 tolerance.`
    );
  }

  return participants.map((p) => ({ userId: p.userId, owedAmount: round2(p.owedAmount) }));
};

export const calculatePercentageSplit = (
  amount: number,
  participants: PercentageParticipant[]
): SplitResult[] => {
  if (participants.length === 0) throw new Error('Participants list cannot be empty');

  const sumPct = participants.reduce((acc, p) => acc + p.percentage, 0);
  if (Math.abs(100 - sumPct) > 0.01) {
    throw new Error(`Sum of percentages (${sumPct}%) must equal 100% within 0.01 tolerance.`);
  }

  const splits = participants.map((p) => ({
    userId: p.userId,
    owedAmount: round2((p.percentage / 100) * amount),
  }));

  // Assign remainder to first participant to avoid floating-point drift
  const sumExceptFirst = splits.slice(1).reduce((acc, s) => acc + s.owedAmount, 0);
  splits[0].owedAmount = round2(amount - sumExceptFirst);

  return splits;
};

export const calculateShareSplit = (
  amount: number,
  participants: ShareParticipant[]
): SplitResult[] => {
  if (participants.length === 0) throw new Error('Participants list cannot be empty');

  const totalShares = participants.reduce((acc, p) => acc + p.shares, 0);
  if (totalShares <= 0) throw new Error('Total shares must be greater than zero');

  const splits = participants.map((p) => ({
    userId: p.userId,
    owedAmount: round2((p.shares / totalShares) * amount),
  }));

  const sumExceptFirst = splits.slice(1).reduce((acc, s) => acc + s.owedAmount, 0);
  splits[0].owedAmount = round2(amount - sumExceptFirst);

  return splits;
};
