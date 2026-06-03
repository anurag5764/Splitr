# BUILD_PLAN.md — Development Journey & Design Plan

This document outlines the design, architecture decisions, and development processes followed in creating the Splitr Clone application.

---

## 1. Studying Splitr Core Flow
Splitr relies on a few key pillars:
1. **Groups as Contexts**: Expenses almost always belong to a group. Even "non-group" expenses are conceptually groups of size 2.
2. **Flexible Splitting**: Expenses can be divided equally, by exact figures, by percentages, or by shares/weights.
3. **Netting/Simplification**: If Alice owes Bob $10 and Bob owes Alice $5, the system nets it down to Alice owing Bob $5. In multi-person groups, debts are simplified to minimize the total number of transactions.
4. **Settling up**: A settlement is a payment record that clears a debt between two users. It must decrease the net amount owed.

---

## 2. Architecture Decisions & Rationale

* **Monorepo Structure**: Keep backend and frontend independent but in one repository. This simplifies dependency tracking and makes deployment of separate Vercel (frontend) and Railway (backend) tasks clear.
* **Express & Node (TypeScript)**: Standard, lightweight web application backend. TypeScript provides compile-time safety on inputs and DB query returns.
* **PostgreSQL + Prisma ORM**: Rich support for relations (Users $\leftrightarrow$ Groups $\leftrightarrow$ Expenses $\leftrightarrow$ Splits). Prisma facilitates transaction scopes (crucial for inserting an expense and its splits together safely) and type-safe database queries.
* **Socket.IO**: Real-time websocket integration is perfect for comment threads on individual expenses, reducing polling overhead.
* **Zustand + React Query (TanStack)**:
  * Zustand handles simple global client-side state (User Auth, session tokens).
  * React Query handles server-state cache synchronization (invalidating lists, refreshing query caches automatically on updates).

---

## 3. How AI Was Used (Prompts, Iteration & Feedback)
AI was leveraged continuously to optimize algorithms and bootstrap layouts:
1. **Initial Prompts**: "Generate a relational database schema for a Splitr clone using Prisma and PostgreSQL."
   * *Feedback*: Added unique constraints on friendship requests and memberships to prevent duplicates.
2. **Algorithm Design**: "How do I net off bidirectional debts in SQL or TypeScript memory?"
   * *AI Suggestion*: Process raw transactions into a `debtMap[debtor][payer]` and net them using reciprocal pairs.
3. **Socket Integration**: "Secure Socket.io connection using standard JWT auth headers in React client and Node server."
   * *AI Suggestion*: Validate the handshake auth token inside Socket.io middleware (`io.use`) and reject before connections open.

---

## 4. Tradeoffs & Simplifications
1. **Multi-Party Simplification**: We implemented complete **bidirectional netting** and **counterparty netting**. Full global graph-cycles simplification (e.g., A owes B, B owes C, C owes A) across all groups was skipped to keep the calculations fast and database loads light.
2. **Friendship Status**: Friend requests exist in the schema, but we simplified member additions to groups by letting users invite anyone by their email directly, making group creation frictionless.
3. **No Third-Party Payment Integrations**: Settlements are recorded as manual entries with custom notes. Actual funds transfers (Venmo, PayPal) are outside the application boundary.

---

## 5. Future Enhancements & Improvements
Given more time, we would implement:
1. **Push Notifications**: Live web-push notifications using Service Workers when someone adds an expense or requests a settlement.
2. **Optimistic UI Updates**: Immediately show messages or settlement additions on the screen before the network roundtrip completes.
3. **Global Graph Debt Minimization**: Implement a DFS/BFS cycle-detection algorithm to simplify debts globally across the entire application instead of per-group.
4. **Expense Categories & Graphs**: Add charts showing spending distributions by category over time.
