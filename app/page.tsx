'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { Sparkles, MessageSquare, Link2 } from 'lucide-react';

export default function RootHomePage() {
  const router = useRouter();
  const { role, isLoading: authLoading } = useTelegramAuth();
  const [minLoadingDone, setMinLoadingDone] = useState(false);

  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'VIEWER';

  // 1. Artificial 1-second minimum loading timer for smooth UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingDone(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // 2. Redirection effect based on start_param or admin status
  useEffect(() => {
    if (authLoading) return;

    let targetFormId: string | null = null;
    if (typeof window !== 'undefined') {
      const tgStartParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      const urlParams = new URLSearchParams(window.location.search);
      const urlStartParam =
        urlParams.get('tgWebAppStartParam') ||
        urlParams.get('startapp') ||
        urlParams.get('start_param') ||
        urlParams.get('formId');

      const rawParam = tgStartParam || urlStartParam;
      if (rawParam) {
        targetFormId = rawParam.startsWith('form_') ? rawParam.replace('form_', '') : rawParam;
      }
    }

    if (targetFormId) {
      router.replace(`/survey/${targetFormId}`);
    } else if (isAdmin) {
      router.replace('/admin');
    }
  }, [router, isAdmin, authLoading]);

  // Show loading screen while auth is loading, initial 1s timer is running, or admin is being redirected
  if (authLoading || !minLoadingDone || isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAF8FF] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 animate-pulse">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="font-extrabold text-slate-900 text-xl tracking-tight">FormGram</h1>
            <p className="text-xs text-slate-500 font-medium">
              {isAdmin ? '관리자 센터로 이동 중입니다...' : '서비스를 불러오는 중입니다...'}
            </p>
          </div>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Non-Admin Fallback Landing View
  return (
    <div className="min-h-screen bg-[#FAF8FF] text-slate-900 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span className="font-extrabold text-slate-900 text-lg tracking-tight">FormGram</span>
          </div>

          <a
            href="https://t.me/Voymsg_bot"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border border-blue-200"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>텔레그램 봇</span>
          </a>
        </div>
      </header>

      {/* Main Guidance */}
      <main className="max-w-4xl mx-auto px-4 py-12 flex-1 flex flex-col justify-center items-center">
        <div className="w-full bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 text-center space-y-5 shadow-sm max-w-lg">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <Link2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">전달받으신 설문 주소로 접속해 주세요</h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              개별 설문 링크(예: Telegram 딥링크)를 통해 접속하시면 해당 설문 작성 페이지로 바로 이동합니다.<br />
              전달받으신 설문 링크를 확인해 주세요.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="https://t.me/Voymsg_bot"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition"
            >
              <MessageSquare className="w-4 h-4" />
              <span>텔레그램 봇 메인으로 이동 (@Voymsg_bot)</span>
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        © 2026 FormGram. Voice of Youth Telegram Mini App Platform.
      </footer>
    </div>
  );
}
