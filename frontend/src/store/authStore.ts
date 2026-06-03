import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

// Helper to set cookie
const setCookie = (name: string, value: string, days = 7) => {
  if (typeof document === 'undefined') return;
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax; Secure`;
};

// Helper to delete cookie
const eraseCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax; Secure`;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isHydrated: false,

  setAuth: (user, token) => {
    // Save to store
    set({ user, token });

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      // Persist to cookie for Next.js middleware support
      setCookie('token', token, 7);
    }
  },

  logout: () => {
    // Clear store
    set({ user: null, token: null });

    // Clear localStorage and cookie
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      eraseCookie('token');
    }
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      if (token && user) {
        set({ user, token, isHydrated: true });
        // Sync cookie just in case
        setCookie('token', token, 7);
      } else {
        set({ isHydrated: true });
      }
    } catch (e) {
      console.error('Failed to hydrate auth store', e);
      set({ isHydrated: true });
    }
  },
}));
