'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth, token, hydrate, isHydrated } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Hydrate auth store on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isHydrated && token) {
      router.push('/dashboard');
    }
  }, [isHydrated, token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/register', { name, email, password });
      const { user, token: responseToken } = response.data;
      
      // Update state and cookie
      setAuth(user, responseToken);
      
      // Navigate to dashboard
      router.push('/dashboard');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.response?.status === 400 && err.response?.data?.errors) {
        // Handle express-validation array errors
        const validationErrors: { [key: string]: string } = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        err.response.data.errors.forEach((validationErr: any) => {
          if (validationErr.path) {
            validationErrors[validationErr.path] = validationErr.msg;
          }
        });
        setErrors(validationErrors);
      } else if (err.response?.status === 409 && err.response?.data?.errors) {
        // Handle database duplicate email conflict
        const validationErrors: { [key: string]: string } = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        err.response.data.errors.forEach((validationErr: any) => {
          if (validationErr.path) {
            validationErrors[validationErr.path] = validationErr.msg;
          }
        });
        setErrors(validationErrors);
      } else {
        setGeneralError(err.response?.data?.message || 'An error occurred during registration. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[120px]" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          {/* Logo Icon */}
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
            <span className="text-slate-950 font-black text-2xl">s</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Get started
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Create a new account to start splitting bills
          </p>
        </div>

        {generalError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm mb-6 flex items-start space-x-2 animate-shake">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block ml-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={`w-full bg-slate-950/60 border ${
                errors.name ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500'
              } focus:ring-1 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition duration-250`}
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="text-xs text-rose-400 ml-1 mt-1">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full bg-slate-950/60 border ${
                errors.email ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500'
              } focus:ring-1 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition duration-250`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="text-xs text-rose-400 ml-1 mt-1">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block ml-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`w-full bg-slate-950/60 border ${
                errors.password ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500'
              } focus:ring-1 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition duration-250`}
              placeholder="•••••••• (Min. 6 chars)"
            />
            {errors.password && (
              <p className="text-xs text-rose-400 ml-1 mt-1">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-semibold rounded-xl py-3.5 mt-2 hover:opacity-95 active:scale-[0.98] transition duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-slate-950"></div>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        <p className="text-slate-500 text-center mt-8 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition duration-150">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
