# Splitr (Monorepo)

A premium, full-stack split expense sharing application built using a modern TypeScript tech stack.

## Live Deployment & Repository
* **Live Application URL**: [https://splitr-clone-nextjs.vercel.app](https://splitr-zeta.vercel.app)
* **GitHub Repository**: [https://github.com/anuragdeshmukh/splitr](https://github.com/anurag5764/Splitr)

---

## AI Assistant Disclosure
This application was designed, structured, and implemented in pair programming collaboration with **Claude (claude.ai)**. AI was leveraged for architecture layout, algorithm optimization (simplifying netting debts), and UI/UX design components.

---

## Features
* **Custom Auth Session Management**: JWT auth tokens stored securely in Zustand store, synchronized to cookies for Next.js middleware routing security.
* **Group Management**: Group creation (Home, Trip, Couple, Other) with Admin/Member permissions and invite management.
* **Flexible Expense Splitting Engine**: Supports Equal split, Exact/Unequal splits, Percentage splits, and Shares/Weight splits. Includes automatic fractional remainder rules.
* **Simplified Debt Netting Engine**: Automates bidirectional and multi-party netting inside groups (e.g., Alice owes Bob $50 and Bob owes Alice $30 nets down to Bob owing Alice $20).
* **Safe Settlement Actions**: Input validations checking positive value constraints, group bounds, and over-settlement barriers ($\pm 0.01$ precision checks) alongside notes logs.
* **Real-time Chat Comments**: Real-time websocket comments on individual expense details, built using Socket.IO.
* **Premium Dashboard & UI**: Glassmorphism aesthetic with high contrast dark mode, emerald theme accents, loading state skeletons, and responsive layouts.

---

## Technical Stack
* **Frontend**: Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, Axios, Zustand, TanStack React Query, Socket.IO Client.
* **Backend**: Node.js, Express, TypeScript, Prisma ORM, Socket.IO, PostgreSQL, JWT (jsonwebtoken), bcrypt.

---

## Local Setup Instructions

### Prerequisites
* Node.js v18+
* PostgreSQL running locally

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/anuragdeshmukh/splitr.git
cd splitr
```

Install backend dependencies:
```bash
cd backend
npm install
```

Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### 2. Database Migration & Seeding
Create a `.env` file in the `backend` folder with your postgres connection string:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/splitr_db?schema=public"
JWT_SECRET="super-secret-random-jwt-key"
JWT_EXPIRES_IN="7d"
PORT=4000
CLIENT_URL="http://localhost:3000"
```

Run migrations and seed the database:
```bash
cd ../backend
npx prisma db push
npx prisma db seed
```

### 3. Frontend Environment Configuration
Create a `.env.local` file in the `frontend` folder:
```env
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
NEXT_PUBLIC_WS_URL="http://localhost:4000"
```

### 4. Running the Development Servers
Start the backend dev server (from the `backend` folder):
```bash
npm run dev
```

Start the frontend dev server (from the `frontend` folder):
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`.

---

## Test Credentials
Evaluators can log in using these pre-seeded test accounts:
* **Alice**: `alice@test.com` / `password123`
* **Bob**: `bob@test.com` / `password123`
* **Charlie**: `charlie@test.com` / `password123`
