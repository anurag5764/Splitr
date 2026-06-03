# AI_CONTEXT.md

## 1. Project Overview
## 2. Product Scope & Requirements
## 3. Architecture Decisions
## 4. Tech Stack (with rationale)
## 5. Database Schema (Prisma schema + ERD)
## 6. API Design (all endpoints)
## 7. Business Logic (split algorithms + balance calc)
## 8. Frontend Structure (folder tree + state strategy)
## 9. Deployment Plan
## 10. Testing Plan
## 11. Tradeoffs & Simplifications
## 12. Prompts Used & AI Responses
## 13. Change Log (updated after each phase)
## 14. Known Issues & Limitations
## 15. Future Enhancements

---

## 1. Project Overview
A full-stack, real-time bill-splitting monorepo application. It simplifies shared group finances by calculating net balances, netting off reciprocal debts, supporting flexible splitting ratios (equal, exact amounts, percentages, shares), and offering real-time expense comment threads via websockets.

## 2. Product Scope & Requirements
* **Authentication**: Email/password registration and login with field validations. Sessions are persisted via JWT in Zustand and cookies.
* **Groups**: Create groups, designate roles (Admin/Member), invite others by email, and view individual member shares.
* **Expense Management**: Add, edit, and delete expenses inside group scopes.
* **Split Customization**: Even split distributions, exact custom values, percentage ratios, and share weighting factors.
* **Simplification & Netting**: Automatic bidirectional netting.
* **Settlements**: Log manual settlement payments to clear debts. Validates against over-settlement.
* **Real-time Comments**: Instant comment streams on expense pages.

## 3. Architecture Decisions
* **Separation of Concerns**: Independent Next.js 14 client communicating with an Express HTTP + Socket.IO server.
* **Unified Database Access**: Prisma ORM maps structured tables to PostgreSQL. Keeps mutations atomic using transactional queries.
* **Server-State Synchronization**: TanStack Query manages API cache data, ensuring updates trigger instant background invalidations without manually reloading pages.

## 4. Tech Stack (with rationale)
* **Express & Node.js**: Clean, high-throughput backend runtime.
* **PostgreSQL + Prisma**: PostgreSQL offers relational consistency. Prisma generates type-safe database clients automatically.
* **Next.js 14 (App Router)**: File-based routing, client-side state hydration, and built-in API proxy options.
* **TailwindCSS**: CSS layout designs.
* **Zustand**: Lightweight client-side session store.
* **Socket.IO**: Fallback HTTP long-polling and websocket layers for robust communication.

## 5. Database Schema (Prisma schema + ERD)
* **`User`**: ID, email (unique), passwordHash, name, avatarUrl, currency.
* **`Group`**: name, description, type, currency, isArchived.
* **`GroupMember`**: groupId, userId, role (ADMIN/MEMBER).
* **`Expense`**: description, amount, splitType, paidById, createdById, groupId.
* **`ExpenseSplit`**: expenseId, userId, owedAmount, percentage, shares.
* **`Settlement`**: groupId, payerId, payeeId, amount, note, status.
* **`Comment`**: expenseId, authorId, content.
* **`Friendship`**: initiatorId, receiverId, status (PENDING/ACCEPTED).
* **`Notification`**: userId, title, body, isRead.

## 6. API Design (all endpoints)
* **Auth**:
  * `POST /api/auth/register` - Create user.
  * `POST /api/auth/login` - Verify credentials, returns JWT.
  * `GET /api/auth/me` - Fetch authenticated user details.
* **Groups**:
  * `POST /api/groups` - Create a group.
  * `GET /api/groups` - Fetch user's active groups.
  * `GET /api/groups/:id` - Fetch single group details.
  * `POST /api/groups/:id/members` - Invite member by email.
  * `DELETE /api/groups/:id/members/:uid` - Remove member.
  * `GET /api/groups/:id/balances` - Fetch group-level netted balances.
* **Expenses**:
  * `POST /api/groups/:id/expenses` - Create group expense.
  * `GET /api/expenses/:id` - Fetch expense details.
  * `PUT /api/expenses/:id` - Edit expense details.
  * `DELETE /api/expenses/:id` - Delete expense.
  * `GET /api/expenses/:id/chat` - Fetch chat comments log.
* **Settlements**:
  * `POST /api/groups/:id/settlements` - Record a payment.
  * `GET /api/groups/:id/settlements` - Fetch group payments log.
* **Users**:
  * `GET /api/users/balances` - Fetch global user credits/debits per friend.

---

## 7. Business Logic (split algorithms + balance calc)

### 7.1 Splitting Algorithms
Our split math engine (`backend/src/services/splitService.ts`) supports:
* **Equal Split**: Evenly divides the amount, floor-rounding to 2 decimal places. The remaining pennies are assigned to the first participant to guarantee that the sum of splits equals the exact total.
* **Exact Split**: Verifies that the manually provided participant amounts sum up precisely to the total expense (with a $\pm 0.01$ tolerance).
* **Percentage Split**: Computes participant portions based on percentages. First participant takes any float-point rounding remainders. Verifies that the sum of percentages equals exactly 100%.
* **Shares Split**: Computes portion proportions dynamically based on relative shares/weights (e.g., $2:1:1$). Remainder rule applies to the first participant.

### 7.2 Debt Simplification and Netting
Our balance calculation engine (`backend/src/services/balanceService.ts`) uses a `debtMap` to simplify and net out balances:
1. **Raw Debt Accumulation**:
   * Collects all group splits where the participant is not the payer, adding positive debt:
     $$\text{debtMap}[\text{debtor}][\text{payer}] += \text{amountOwed}$$
2. **Settlement Deduction**:
   * Deducts confirmed settlements from the map:
     $$\text{debtMap}[\text{payer}][\text{payee}] -= \text{amountSettled}$$
3. **N-Way Netting & Simplification**:
   * Iterates through every pair of users $A$ and $B$.
   * If both $A \text{ owes } B \text{ (\$}X\text{)}$ and $B \text{ owes } A \text{ (\$}Y\text{)}$ exist:
     * We calculate $\text{net} = X - Y$.
     * If $\text{net} > 0$, we set $A \text{ owes } B \text{ = } \text{net}$ and $B \text{ owes } A \text{ = 0}$.
     * If $\text{net} < 0$, we set $B \text{ owes } A \text{ = } -\text{net}$ and $A \text{ owes } B \text{ = 0}$.
     * If $\text{net} = 0$, both are set to 0.
4. **Global Aggregation**:
   * For user global balances, we traverse all group-level simplified balance sheets, netting the current user's credits and debits per unique counterparty to construct a single global net balance dashboard.

---

## 8. Frontend Structure (folder tree + state strategy)
Our frontend is organized modularly under Next.js 14 App Router:
* **`/src/app/(app)`**: Contains protected client-side routes (`dashboard`, `groups/[id]`, `groups/[id]/expense/[eid]`).
* **`/src/components`**: Houses reusable UI widgets (`ChatWindow`, `SettleUpModal`, `ExpenseForm`, etc.).
* **`/src/hooks`**: Custom hooks for business logic and sockets (`useChat`).
* **`/src/store`**: Client-side state managers (`authStore.ts` using Zustand).
* **`/src/lib`**: Core utilities including API instance configs (`api.ts`) and WS socket connections (`socket.ts`).

## 9. Deployment Plan

### Backend Deployment (e.g., Railway, Heroku)
1. **Database Setup**:
   * Provision a PostgreSQL database (e.g., Railway, Supabase).
   * Configure `DATABASE_URL` matching the target postgres host.
2. **Environment Variables**:
   * `DATABASE_URL`: PostgreSQL connection string.
   * `PORT`: Dynamically assigned by host (defaults to `4000` locally).
   * `CLIENT_URL`: URL of the deployed Next.js application.
   * `JWT_SECRET`: Secure encryption secret string.
3. **Build & Start Configurations**:
   * Procfile defined: `web: node dist/index.js`.
   * Execution scripts inside `package.json` support standard deployment pipelines:
     * `npm run build` runs `tsc` compiling TS code to `./dist`.
     * `npm start` runs `node dist/index.js` serving the HTTP + WebSocket server.
   * Run migrations and seeds in release task:
     * Sync schema: `npx prisma db push`
     * Seed initial users: `npx prisma db seed` (registers Alice, Bob, and Charlie test accounts).

### Frontend Deployment (e.g., Vercel, Netlify)
1. **Environment Variables**:
   * `NEXT_PUBLIC_API_URL`: Base REST API endpoint URL of deployed backend (e.g., `https://my-backend.railway.app/api`).
   * `NEXT_PUBLIC_WS_URL`: WebSocket URL matching the backend URL (e.g., `https://my-backend.railway.app`).
2. **Build Parameters**:
   * Build Command: `npm run build`
   * Output directory: `.next`
   * Vercel will automatically manage optimization and packaging. Standalone Next.js output is not required.

---

## 13. Change Log (updated after each phase)

---

### Phase 1 — Project Scaffold
**Date:** 2026-06-02  
**Status:** ✅ Complete

#### What was done
Full monorepo scaffold for a Splitwise-clone with a Node.js/Express backend and a Next.js 14 frontend. No feature code was written — this phase covers project structure, tooling, environment wiring, and the full database schema.

---

#### Folder Structure (node_modules and build outputs excluded)

```
splitwise/
├── .gitignore
├── AI_CONTEXT.md
│
├── backend/
│   ├── .env                        ← DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT, NODE_ENV, CLIENT_URL
│   ├── .env.example                ← safe copy committed to git
│   ├── package.json
│   ├── tsconfig.json               ← strict, ES2020, commonjs out → dist/
│   ├── prisma/
│   │   └── schema.prisma           ← full DB schema (9 models, 7 enums)
│   └── src/
│       └── index.ts                ← Express + CORS + Socket.IO entry point
│
└── frontend/
    ├── .env.local                  ← NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
    ├── .env.example                ← safe copy committed to git
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── tsconfig.json
    └── src/
        └── app/
            ├── globals.css
            ├── layout.tsx
            └── page.tsx
```

---

#### Packages Installed

**Backend** (`/backend/package.json`)

| Package | Version | Role |
|---|---|---|
| `express` | ^4.19.2 | HTTP server framework |
| `prisma` | ^5.14.0 | DB migration CLI |
| `@prisma/client` | ^5.14.0 | Type-safe DB client |
| `jsonwebtoken` | ^9.0.2 | JWT auth tokens |
| `bcrypt` | ^5.1.1 | Password hashing |
| `cors` | ^2.8.5 | Cross-origin middleware |
| `dotenv` | ^16.4.5 | Environment variable loader |
| `socket.io` | ^4.7.5 | WebSocket server |
| `express-validator` | ^7.1.0 | Request validation |
| `typescript` *(dev)* | ^5.4.5 | TypeScript compiler |
| `ts-node` *(dev)* | ^10.9.2 | Run TS directly in dev |
| `nodemon` *(dev)* | ^3.1.3 | Auto-restart on file change |
| `@types/express` *(dev)* | ^4.17.21 | Express type definitions |
| `@types/node` *(dev)* | ^20.14.2 | Node type definitions |
| `@types/bcrypt` *(dev)* | ^5.0.2 | bcrypt type definitions |
| `@types/jsonwebtoken` *(dev)* | ^9.0.6 | JWT type definitions |

**Frontend** (`/frontend/package.json`)

| Package | Version | Role |
|---|---|---|
| `next` | 14.x | App Router + SSR framework |
| `react` / `react-dom` | 18.x | UI library |
| `typescript` | ^5.x | TypeScript compiler |
| `tailwindcss` | ^3.x | Utility-first CSS |
| `axios` | latest | HTTP client for API calls |
| `zustand` | latest | Lightweight global state |
| `@tanstack/react-query` | latest | Server-state / data fetching |
| `socket.io-client` | latest | WebSocket client |
| `eslint` + `eslint-config-next` | 8.x | Linting |

**Backend npm scripts:**
```
npm run dev          → nodemon --exec ts-node src/index.ts
npm run build        → tsc
npm run start        → node dist/index.js
npm run db:generate  → prisma generate
npm run db:migrate   → prisma migrate dev
npm run db:studio    → prisma studio
npm run db:seed      → ts-node prisma/seed.ts
```

---

#### Prisma Schema (`/backend/prisma/schema.prisma`)

**Database:** PostgreSQL via `DATABASE_URL` env var  
**ID strategy:** `cuid()` on all models  
**Prisma Client:** generated successfully (`v5.22.0`)

**Models & key fields:**

| Model | Key Fields | Relations |
|---|---|---|
| `User` | id, email (unique), name, passwordHash, avatarUrl, currency | GroupMember, Expense (payer/creator), ExpenseSplit, Settlement (payer/payee), Friendship, Notification |
| `Friendship` | initiatorId, receiverId, status | → User (x2); @@unique([initiatorId, receiverId]) |
| `Group` | name, description, imageUrl, type, currency, isArchived | GroupMember[], Expense[] |
| `GroupMember` | groupId, userId, role | → Group, User; @@unique([groupId, userId]) |
| `Expense` | groupId?, description, amount (Decimal 12,2), currency, category, splitType, date, receiptUrl, isDeleted, paidById, createdById | → Group?, User (payer), User (creator); ExpenseSplit[], Comment[] |
| `ExpenseSplit` | expenseId, userId, owedAmount (Decimal 12,2), percentage?, shares?, isSettled | → Expense, User; @@unique([expenseId, userId]) |
| `Settlement` | groupId?, payerId, payeeId, amount (Decimal 12,2), currency, note, status, settledAt? | → User (payer), User (payee) |
| `Comment` | expenseId, authorId, content | → Expense |
| `Notification` | userId, type, title, body, data (Json?), isRead | → User |

**Enums:**

| Enum | Values |
|---|---|
| `FriendshipStatus` | PENDING, ACCEPTED, BLOCKED |
| `GroupType` | HOME, TRIP, COUPLE, OTHER |
| `GroupMemberRole` | ADMIN, MEMBER |
| `ExpenseCategory` | FOOD, TRANSPORT, ACCOMMODATION, ENTERTAINMENT, SHOPPING, UTILITIES, HEALTH, EDUCATION, GENERAL |
| `SplitType` | EQUAL, EXACT, PERCENTAGE, SHARES |
| `SettlementStatus` | PENDING, CONFIRMED, REJECTED |
| `NotificationType` | EXPENSE_ADDED, EXPENSE_UPDATED, EXPENSE_DELETED, SETTLEMENT_REQUESTED, SETTLEMENT_CONFIRMED, FRIEND_REQUEST, FRIEND_ACCEPTED, GROUP_INVITE, REMINDER |

---

#### Environment Variables

**Backend (`.env`):**
```
DATABASE_URL      postgresql connection string
JWT_SECRET        signing secret for JWTs
JWT_EXPIRES_IN    token lifetime (default: 7d)
PORT              server port (default: 5000)
NODE_ENV          development | production
CLIENT_URL        allowed CORS origin (default: http://localhost:3000)
```

**Frontend (`.env.local`):**
```
NEXT_PUBLIC_API_URL    base URL for REST API calls
NEXT_PUBLIC_WS_URL     base URL for Socket.IO connection
```

---

#### Entry Point (`/backend/src/index.ts`)
- Loads `.env` via `dotenv`
- Mounts CORS middleware (scoped to `CLIENT_URL`)
- Mounts `express.json()` + `express.urlencoded()`
- Exposes `GET /health` → `{ status: "ok", timestamp }`
- Creates `http.Server` + attaches `socket.io` with matching CORS config
- Logs connected/disconnected socket IDs
- Listens on `PORT`, prints `🚀 Server running on http://localhost:{PORT}`

---

### Phase 2 — Authentication System
**Date:** 2026-06-03  
**Status:** ✅ Complete

#### What was done
Implemented a secure token-based authentication system across both backend and frontend.

**Backend Implementation:**
- **Global Prisma Client (`backend/src/prisma.ts`)**: Initialized global client.
- **Request Authentication Middleware (`backend/src/middleware/auth.ts`)**: Custom token verification middleware that authenticates JWT requests and attaches user models (minus password hashes) to the request context.
- **Request Validator Middleware (`backend/src/middleware/validate.ts`)**: Custom Express request validation response handler formatting field-level validation errors.
- **Auth Controller (`backend/src/controllers/authController.ts`)**: Handles `/register` (hashing passwords using bcrypt with 10 rounds, validating unique email constraint), `/login` (verifying email existence and matching password hashes), and `/me` (returning authenticated request user).
- **Auth Routes (`backend/src/routes/auth.ts`)**: Maps auth controller actions to endpoints with express-validator schemas.
- **Router Hook (`backend/src/index.ts`)**: Mounted auth routes under `/api/auth` prefix.

**Key Technical Details:**
- **JWT Payload Structure**: `{ userId: string, email: string }`
- **Token Expiry**: `7d` (configured via `JWT_EXPIRES_IN` in `.env`)
- **Validation Rules**:
  - `email`: Must be a valid email format.
  - `password`: Must be at least 6 characters.
  - `name`: Must be at least 2 characters (on registration).
  - Returns `400 Bad Request` with field-level path/message errors on validation failure.
  - Returns `409 Conflict` if the email address is already in use.

**Frontend Implementation:**
- **Auth Store (`frontend/src/store/authStore.ts`)**: Zustand store managing token, user, hydration status, persistence to `localStorage`, and cookie syncing to support server-side edge middleware redirects.
- **API Client (`frontend/src/lib/api.ts`)**: Custom Axios client attaching authentication bearer headers on all requests and intercepting `401 Unauthorized` responses to clear auth sessions and redirect to `/login`.
- **Next.js Middleware (`frontend/src/middleware.ts`)**: Implements edge-routing rules redirecting unauthenticated users from `/dashboard` (and subpaths) to `/login`, and authenticated users from `/login` and `/register` to `/dashboard`.
- **Register & Login Forms (`frontend/src/app/(auth)/register/page.tsx`, `/login/page.tsx`)**: Responsive, interactive glassmorphic forms with error alerts, loading indicators, custom redirects, and field-level validation errors.
- **Dashboard Skeleton (`frontend/src/app/dashboard/page.tsx`)**: Home base displaying the logged-in user profile info and providing logout action triggering cookie cleanup.
- **Landing Page (`frontend/src/app/page.tsx`)**: Replaced default Next.js starter page with premium, feature-driven welcome layout containing quick-access links to register/login.

**Verification Results:**
- Verified endpoint flows using custom automated cURL test suite targeting `/register` (success/conflict/errors), `/login` (success/unauthorized), and `/me` (authorized/fake tokens), confirming all return codes (`200`, `201`, `400`, `401`, `409`) operate correctly.

---

### Phase 3 — Group Management
**Date:** 2026-06-03  
**Status:** ✅ Complete

#### What was done
Implemented full group creation, membership roles, invitation logic, dynamic balance summary computation, and details view.

**Backend Implementation:**
- **Group Middleware (`backend/src/middleware/groupAuth.ts`)**: Custom membership validators verifying access controls on groups via token payload mapping.
  - `requireGroupMember`: Inspects `req.params.id` / `groupId` and checks if the authenticated user (`req.user.id`) exists as a relation in the `GroupMember` table. Returns `403 Forbidden` if they are not in the group.
  - `requireGroupAdmin`: Performs the same check but enforces that the member's `role` is `'ADMIN'`. Returns `403 Forbidden` if role is `'MEMBER'`.
- **Group Controller (`backend/src/controllers/groupController.ts`)**: Handles group fetch, creations (adding creators as `ADMIN` inside transaction scope), get by ID, add members (validating email presence/409 checks), and remove members (enforcing only-admin deletion bounds). Calculates net user balances across groups dynamically (`Total Paid - Total Owed`).
- **Group Router (`backend/src/routes/groups.ts`)**: Mounts endpoints under JWT token checks and group role authentications.
- **Root Router (`backend/src/index.ts`)**: Mounts group route prefixes under `/api/groups`.

**API Changes & Technical Refinements:**
- **Member Invite Response Update (`POST /api/groups/:id/members`)**: Refined to return the **updated full array of group members** with nested user information (name, email, avatarUrl, id) instead of just the single created membership record. This allows direct array overrides on the client side if desired.
- **Member Deletion Validation**: Built protection block inside `removeMember` that prevents the sole admin of a group from removing themselves without first designating another admin.

**Frontend Implementation:**
- **Dashboard Page (`frontend/src/app/(app)/dashboard/page.tsx`)**: Private dashboard layout displaying aggregated net balances at the top, list collections of `GroupCard` components, and modal triggers.
- **Group Details Page (`frontend/src/app/(app)/groups/[id]/page.tsx`)**: Group layout displaying specific group type icon, user's group balance, summary metrics, invited members (with admin deletion triggers), and itemized expenses.
- **Group Cards (`frontend/src/components/GroupCard.tsx`)**: Visual widgets showcasing individual group information, member count, and balance alerts.
- **Create Group Modal (`frontend/src/components/CreateGroupModal.tsx`)**: Interactive glassmorphic modal with name, type selectors, currency configurations, and mutation invalidate hooks.
- **Invite Modal (`frontend/src/components/InviteModal.tsx`)**: Email inviter component sending POST targets and triggering list refreshes.
- **React Query Wrapper (`frontend/src/app/providers.tsx`)**: Setup client-side TanStack React Query cache engine.

**Verification Results:**
- Verified all endpoints using automated test script (`test_groups.sh` and `test_user_groups.sh`), registering `201 Created` for groups and members, `200 OK` for listings, `403 Forbidden` for non-member access, and `400 Bad Request` for sole admin leaves.

---

### Phase 4 — Expense Splitting Engine
**Date:** 2026-06-03  
**Status:** ✅ Complete

#### What was done
Implemented full multi-algorithm expense splitting logic (Equal, Exact/Unequal, Percentage, Shares/Weights) on both the backend and frontend.

**Backend Implementation:**
- **Split Service (`backend/src/services/splitService.ts`)**: Core logic module containing pure functions for equal, exact, percentage, and shares divisions. Implemented custom remainder rules allocating rounding fractions to the first participant to ensure mathematical exactness.
- **Expense Controller (`backend/src/controllers/expenseController.ts`)**: Handles transaction-scoped creates, updates, and deletes for expenses, updating linked `ExpenseSplit` records with cascade structures and validating group membership permissions.
- **Expense Routes (`backend/src/routes/expenses.ts`)**: Nested routes `/groups/:id/expenses` (using `requireGroupMember` check) and individual endpoint IDs `/expenses/:id` loaded under the central Express router.

**Frontend Implementation:**
- **Expense Form (`frontend/src/components/ExpenseForm.tsx`)**: Reusable input dashboard supporting equal split checkboxes, exact values, percentages (with total validation checks), and shares multipliers.
- **Group Page Integration (`frontend/src/app/(app)/groups/[id]/page.tsx`)**: Incorporated an "Add Expense" modal trigger and wrapped expense list cards in clickable links mapping to `/groups/[id]/expense/[eid]`.
- **Expense Details Page (`frontend/src/app/(app)/groups/[id]/expense/[eid]/page.tsx`)**: Added breakdown data grid, total sums, creator restrictions on edit/delete actions, and instant refetch invalidation bindings.

**Verification Results:**
- Verified all splitting scenarios (equal splits, exact amounts, percentage checks, and share fractions) with a dedicated automated shell runner (`test_expenses.sh`), confirming dynamic balance calculations and cascade deletes.

### Phase 5 — Balance Engine & Settlement
**Date:** 2026-06-03  
**Status:** ✅ Complete

**Backend Implementation:**
- **Balance Service (`backend/src/services/balanceService.ts`)**: Builds a group debt graph from expenses and settlements, nets out bidirectional balances, and aggregates user-level net balances globally across all groups.
- **Settlement Controller & Routes (`backend/src/controllers/settlementController.ts` & `backend/src/routes/settlements.ts`)**: Provides endpoints to record verified balance settlements between group members.

**Frontend Implementation:**
- **Balance Summary Sidebar (`frontend/src/components/BalanceSummary.tsx`)**: Renders Simplified Debts ("A owes B $amount") with a "Settle Up" action trigger within the group details sidebar.
- **Dashboard Balance Widget (`frontend/src/app/(app)/dashboard/page.tsx`)**: Reconstructed to display total amount owed (green), total amount you owe (red), and a detailed breakdown of net balances by friend.

---

### Phase 6 — Settlement Validations & History
**Date:** 2026-06-03  
**Status:** ✅ Complete

**Backend Implementation:**
- **Settlement Controller Validation (`backend/src/controllers/settlementController.ts`)**: Added validations checking that amount is positive, payer and payee are active group members, and the payment amount does not exceed the current net balance owed (with $\pm 0.01$ floating-point tolerance). Over-settlement checks explicitly reject payment requests and return `400 Bad Request` if `amount > netOwed + 0.01`.
- **Settlement History Route (`backend/src/routes/settlements.ts`)**: Added `GET /api/groups/:id/settlements` to fetch group settlement logs ordered chronologically desc.

**Frontend Implementation:**
- **SettleUpModal (`frontend/src/components/SettleUpModal.tsx`)**: Modal offering custom amount inputs (with a 'Max Owed' quick-fill shortcut), custom notes, error validation summaries, and cache invalidation hooks.
- **Settlement History Panel (`frontend/src/app/(app)/groups/[id]/page.tsx`)**: Shows a log card detailing transaction history (who paid whom, amount, date, and notes).

---

### Phase 7 — Real-Time Chat Comments
**Date:** 2026-06-03  
**Status:** ✅ Complete

**Backend Implementation:**
- **Socket.io Bootstrapping (`backend/src/index.ts`)**: Integrated Socket.io Server into the existing HTTP server instance, configured CORS settings, and added fallback transports support (`transports: ['polling', 'websocket']`) prioritizing HTTP long-polling for hosting compatibility (e.g. Railway).
- **JWT Verification**: Validates the JWT parsed from `socket.handshake.auth.token` using Socket.io connection middleware (`io.use`). Rejects the connection with an `Authentication error` if invalid or missing.
- **Chat Handler & Event Specifications (`backend/src/socket/chatHandler.ts`)**:
  * **Incoming events**:
    * `join_expense`: payload `{ expenseId }`. Joins client socket to room `expense:${expenseId}` after verifying that the user belongs to the group of that specific expense.
    * `leave_expense`: payload `{ expenseId }`. Leaves the room room.
    * `send_message`: payload `{ expenseId, message }`. Persists comment to the database and broadcasts the comment to the room.
  * **Outgoing events**:
    * `new_message`: payload `{ id, message, user: { id, name }, createdAt }`. Emitted to all clients in the corresponding room.
    * `error_message`: payload `{ message }`. Emitted directly back to the sender if permission checks fail.
- **History Route (`backend/src/routes/expenses.ts`)**: Added `GET /api/expenses/:id/chat` fetching the last 50 comments ordered ascending.

**Frontend Implementation:**
- **Socket helper (`frontend/src/lib/socket.ts`)**: Manages lazy Socket singleton instantiation, authentication token loading, and safe connection lifecycle methods with identical transport preferences (`['polling', 'websocket']`).
- **`useChat` Hook (`frontend/src/hooks/useChat.ts`)**: Connects to Socket on component mount, handles automatic room joining/leaving actions, listens to `new_message` events to append them to local state, and exposes a `sendMessage` trigger.
- **ChatWindow UI (`frontend/src/components/ChatWindow.tsx`)**: Glassmorphic scrollable layout on the Expense details view. Features: bubbles aligned by sender context, status badge (amber `Connecting...` or green pulsing `LIVE` light), message text validation, and scroll-to-bottom effects.

---

### Phase 8 — Database Seeding & Security Refinements
**Date:** 2026-06-03  
**Status:** ✅ Complete

**Implementation:**
- **Seed Script (`backend/prisma/seed.ts`)**: Built transactional seed script using Prisma Client and `bcrypt` password hashing to set up evaluator accounts (`alice@test.com`, `bob@test.com`, `charlie@test.com`) with password `password123`.
- **Dependency Bindings (`backend/package.json`)**: Configured `"prisma": { "seed": "ts-node prisma/seed.ts" }` and `"db:seed"` runner scripts.

---

### Phase 9 — Deployment & Production Verification
**Date:** 2026-06-03  
**Status:** ✅ Complete

**Implementation:**
- **Procfile Configuration (`backend/Procfile`)**: Declared web build runtime start task matching transpiled directory paths.
- **Production Builds**: Transpiled and verified successful compilation of both the Next.js client (`npm run build`) and Node.js backend.
- **Config Audits**: Verified environment loading parameters (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`) dynamically.

---

## 10. Testing Plan
* **Automated Integration Testing**: Used custom executable shell runners (`test_groups.sh`, `test_expenses.sh`, `test_chat_api.sh`) asserting status codes, validations, and payloads.
* **Manual Interaction Verification**: Utilized Browser Subagent tests to perform end-to-end user actions (registration, group creates, expense allocations, settlements, and live chats) recording WebP walkthroughs to ensure UX quality.

## 11. Tradeoffs & Simplifications
* **Netting Cycles**: Opted for bidirectional counterparty netting inside groups rather than solving the global N-party cycles graph across all groups, maintaining low database search overhead.
* **Payment Integrations**: Omitted Venmo/PayPal interfaces, relying on manual settlement logging.

## 12. Prompts Used & AI Responses
* *Prisma Modeling*: "Build a Prisma postgres schema representing users, groups, expenses, splits, settlements, and comments."
* *Simplification Algorithms*: "Design a TypeScript service netting debts between users A and B, accounting for unequal fractions and penny division rules."
* *WebSocket Handshakes*: "Secure a Socket.io server connection by parsing JWT parameters during the initial connection handshake."

---

## 13. Change Log (updated after each phase)
*Refer to the chronological phase records documented above.*

---

## 14. Known Issues & Limitations
* **Connection Re-establishes**: Handshake auth parameters load at connection start; changing accounts requires a socket restart.
* **Penny Allocation**: Remainder pennies are consistently allocated to the first participant in split lists.

## 15. Future Enhancements
* **Global Minimization**: Implement a DFS cycle reduction algorithm for global debt simplification.
* **Optimistic Sockets**: Feed comment changes to client state optimistically before DB commits finish.
* **Push Actions**: Add browser push notifications for settlements and new expense allocations.