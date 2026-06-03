'use client';

import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex flex-col justify-between">
      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[130px] pointer-events-none" />

      {/* Navbar */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-slate-950 font-black text-xl">s</span>
          </div>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Splitr
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/login"
            className="text-slate-300 hover:text-white px-4 py-2 text-sm font-medium transition duration-200"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-95 active:scale-[0.98] transition duration-200 shadow-lg shadow-emerald-500/15"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl w-full mx-auto px-6 py-12 flex flex-col items-center text-center my-auto relative z-10">

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-500 max-w-3xl">
          Split bills. <br />
          Settle balances. <br />
          Keep the peace.
        </h1>

        <p className="text-slate-400 mt-6 text-base md:text-lg max-w-xl leading-relaxed">
          Share expenses with friends and roommates without the stress. We keep track of who owes who, simplify debts, and notify everyone instantly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-10 w-full sm:w-auto">
          <Link
            href="/register"
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 px-8 py-4 rounded-xl text-base font-bold hover:opacity-95 active:scale-[0.98] transition duration-200 shadow-lg shadow-emerald-500/15 flex items-center justify-center space-x-2"
          >
            <span>Create Free Account</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <Link
            href="/login"
            className="bg-slate-900/60 backdrop-blur border border-slate-800 text-slate-200 hover:text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-slate-900 transition duration-200 flex items-center justify-center"
          >
            Sign In with Email
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center text-slate-500 text-xs gap-4 relative z-10">
        <p>© 2026 Splitr Inc. Built with Next.js, Express, and Prisma.</p>
        <div className="flex space-x-6">
          <Link href="/login" className="hover:text-slate-400">Sign In</Link>
          <Link href="/register" className="hover:text-slate-400">Register</Link>
          <a href="/health" className="hover:text-slate-400">API Health</a>
        </div>
      </footer>
    </div>
  );
}
