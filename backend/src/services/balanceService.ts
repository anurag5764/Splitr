import prisma from '../prisma';

// ── Types ─────────────────────────────────────────────────────────
interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface GroupBalance {
  fromUserId: string;
  toUserId: string;
  fromUser: UserInfo;
  toUser: UserInfo;
  amount: number; // always > 0: fromUser owes toUser this amount
}

export interface UserNetBalance {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  netAmount: number; // positive = they owe you; negative = you owe them
}

// ── Internal debt map helper ──────────────────────────────────────
type DebtMap = Record<string, Record<string, number>>;

const addDebt = (map: DebtMap, from: string, to: string, amount: number) => {
  if (!map[from]) map[from] = {};
  map[from][to] = (map[from][to] || 0) + amount;
};

/**
 * Simplify the debt graph: if A owes B $10 and B owes A $6,
 * net them off so only A owes B $4.
 */
const simplifyDebts = (map: DebtMap): DebtMap => {
  const users = Object.keys(map);
  for (const a of users) {
    for (const b of Object.keys(map[a] || {})) {
      const ab = map[a]?.[b] || 0;
      const ba = map[b]?.[a] || 0;
      if (ab > 0 && ba > 0) {
        const net = ab - ba;
        if (net > 0) {
          map[a][b] = net;
          map[b][a] = 0;
        } else if (net < 0) {
          map[a][b] = 0;
          map[b][a] = -net;
        } else {
          map[a][b] = 0;
          map[b][a] = 0;
        }
      }
    }
  }
  return map;
};

// ── calculateGroupBalances ────────────────────────────────────────
export const calculateGroupBalances = async (groupId: string): Promise<GroupBalance[]> => {
  // 1. Fetch all non-deleted expenses + their splits
  const expenses = await prisma.expense.findMany({
    where: { groupId, isDeleted: false },
    include: {
      splits: true,
      paidBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  const debtMap: DebtMap = {};

  // 2. Build debt map from splits
  for (const expense of expenses) {
    for (const split of expense.splits) {
      // Only create a debt if the split participant is NOT the payer
      if (split.userId !== expense.paidById) {
        addDebt(debtMap, split.userId, expense.paidById, Number(split.owedAmount));
      }
    }
  }

  // 3. Apply settlements (reduce debts)
  const settlements = await prisma.settlement.findMany({
    where: { groupId, status: 'CONFIRMED' },
  });
  for (const s of settlements) {
    addDebt(debtMap, s.payerId, s.payeeId, -Number(s.amount));
  }

  // 4. Simplify bidirectional debts
  simplifyDebts(debtMap);

  // 5. Collect all relevant user IDs for a single batch fetch
  const userIds = new Set<string>();
  for (const [from, targets] of Object.entries(debtMap)) {
    for (const [to, amt] of Object.entries(targets)) {
      if (amt > 0.01) { userIds.add(from); userIds.add(to); }
    }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const userMap: Record<string, UserInfo> = {};
  for (const u of users) userMap[u.id] = u;

  // 6. Build result
  const result: GroupBalance[] = [];
  for (const [fromId, targets] of Object.entries(debtMap)) {
    for (const [toId, amount] of Object.entries(targets)) {
      if (amount > 0.01 && userMap[fromId] && userMap[toId]) {
        result.push({
          fromUserId: fromId,
          toUserId: toId,
          fromUser: userMap[fromId],
          toUser: userMap[toId],
          amount: Math.round(amount * 100) / 100,
        });
      }
    }
  }

  return result;
};

// ── calculateUserBalances ─────────────────────────────────────────
export const calculateUserBalances = async (userId: string): Promise<UserNetBalance[]> => {
  // Get all groups the user belongs to
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });

  const netMap: Record<string, number> = {}; // otherUserId → net amount

  for (const { groupId } of memberships) {
    const balances = await calculateGroupBalances(groupId);
    for (const b of balances) {
      if (b.fromUserId === userId) {
        // Current user owes b.toUser
        netMap[b.toUserId] = (netMap[b.toUserId] || 0) - b.amount;
      } else if (b.toUserId === userId) {
        // b.fromUser owes current user
        netMap[b.fromUserId] = (netMap[b.fromUserId] || 0) + b.amount;
      }
    }
  }

  // Filter out near-zero and fetch user info
  const otherIds = Object.keys(netMap).filter((id) => Math.abs(netMap[id]) > 0.01);
  if (otherIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });

  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    netAmount: Math.round((netMap[u.id] || 0) * 100) / 100,
  }));
};
