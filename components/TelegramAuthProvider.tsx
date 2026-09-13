'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { TelegramUser } from '@/lib/telegramAuth';
import { AdminRole } from '@/types/database';

const DEFAULT_SUPER_ADMIN_ID = 1284576145; // 고민석 Telegram User ID

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: TelegramUser | null;
  role: AdminRole | 'USER';
  initData: string;
  telegramUserId: number | null;
  error: string | null;
  setTestUserId: (userId: number) => void;
}

const TelegramAuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
  role: 'USER',
  initData: '',
  telegramUserId: null,
  error: null,
  setTestUserId: () => {}
});

export const useTelegramAuth = () => useContext(TelegramAuthContext);

export function TelegramAuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    role: 'USER',
    initData: '',
    telegramUserId: null,
    error: null,
    setTestUserId: () => {}
  });

  const verifyUserByUserId = async (userId: number) => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_user_id: userId })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: true,
          user: data.user,
          role: data.role,
          telegramUserId: userId,
          error: null
        }));
      } else {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
          user: null,
          role: 'USER',
          telegramUserId: userId,
          error: data.error || 'Authentication failed'
        }));
      }
    } catch (err: any) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        role: 'USER',
        telegramUserId: userId,
        error: err.message || 'Network error'
      }));
    }
  };

  const handleSetTestUserId = (userId: number) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('formgram_test_user_id', userId.toString());
    }
    setAuthState((prev) => ({ ...prev, isLoading: true }));
    verifyUserByUserId(userId);
  };

  useEffect(() => {
    async function initTelegramAuth() {
      // 1. Check if window.Telegram WebApp is available inside Telegram Mini App
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        const initData = tg.initData;

        try {
          const res = await fetch('/api/auth/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
          });

          const data = await res.json();

          if (res.ok && data.success) {
            setAuthState({
              isLoading: false,
              isAuthenticated: true,
              user: data.user,
              role: data.role,
              initData,
              telegramUserId: data.user?.id || null,
              error: null,
              setTestUserId: handleSetTestUserId
            });
            return;
          }
        } catch (err: any) {
          console.warn('Telegram initData verification failed:', err);
        }
      }

      // 2. External Browser Fallback (Chrome/Safari testing)
      const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('formgram_test_user_id') : null;
      const targetUserId = savedUserId ? Number(savedUserId) : DEFAULT_SUPER_ADMIN_ID;

      setAuthState((prev) => ({ ...prev, setTestUserId: handleSetTestUserId }));
      verifyUserByUserId(targetUserId);
    }

    initTelegramAuth();
  }, []);

  return (
    <TelegramAuthContext.Provider value={authState}>
      {children}
    </TelegramAuthContext.Provider>
  );
}

// Global TypeScript declaration for Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: any;
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        close: () => void;
      };
    };
  }
}
