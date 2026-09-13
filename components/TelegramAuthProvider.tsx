'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { TelegramUser } from '@/lib/telegramAuth';
import { AdminRole } from '@/types/database';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: TelegramUser | null;
  role: AdminRole | 'USER';
  initData: string;
  error: string | null;
}

const TelegramAuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
  role: 'USER',
  initData: '',
  error: null
});

export const useTelegramAuth = () => useContext(TelegramAuthContext);

export function TelegramAuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    role: 'USER',
    initData: '',
    error: null
  });

  useEffect(() => {
    async function initTelegramAuth() {
      // Check if window.Telegram is available
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        const initData = tg.initData;

        if (!initData) {
          setAuthState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            role: 'USER',
            initData: '',
            error: 'Not inside Telegram Mini App or missing initData'
          });
          return;
        }

        try {
          // Verify with backend
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
              error: null
            });
          } else {
            setAuthState({
              isLoading: false,
              isAuthenticated: false,
              user: null,
              role: 'USER',
              initData,
              error: data.error || 'Authentication failed'
            });
          }
        } catch (err: any) {
          setAuthState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            role: 'USER',
            initData,
            error: err.message || 'Network error during auth verification'
          });
        }
      } else {
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          role: 'USER',
          initData: '',
          error: 'Telegram WebApp SDK not detected'
        });
      }
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
