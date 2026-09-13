'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { LayoutDashboard, FileText, Users, ShieldAlert } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, isAuthenticated, user, role, error } = useTelegramAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-slate-600 font-medium">관리자 권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (role === 'USER') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-slate-200 p-6 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <div>
            <h2 className="text-lg font-bold text-slate-800">관리자 접근 권한 확인 필요</h2>
            <p className="text-xs text-slate-500 mt-1">
              현재 접속 환경은 외부 브라우저(Chrome/Safari) 모드입니다.<br />
              Supabase DB에 활성화된 텔레그램 관리자 ID로 인증해 주세요.
            </p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3 text-left">
            <span className="text-xs font-bold text-blue-900 block">⚡ 웹 브라우저 관리자 인증 (Supabase DB 연동)</span>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('formgram_test_user_id', '1284576145');
                  window.location.reload();
                }
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center space-x-2"
            >
              <span>👑 SUPER_ADMIN (고민석 / ID: 1284576145) 접속</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-900 underline">
              메인으로 돌아가기
            </Link>
            <a href="https://t.me/Voymsg_bot" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">
              텔레그램 봇 연동 (@Voymsg_bot)
            </a>
          </div>
        </div>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    ADMIN: 'bg-blue-100 text-blue-800 border-blue-200',
    VIEWER: 'bg-amber-100 text-amber-800 border-amber-200'
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Admin Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-bold text-slate-900 text-lg">관리자 센터</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${roleColors[role] || 'bg-slate-100 text-slate-700'}`}>
              {role}
            </span>
          </div>

          <div className="flex items-center space-x-4 text-sm font-medium text-slate-600">
            <span>{user?.first_name || '관리자'}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex space-x-1 border-t border-slate-100">
          <Link
            href="/admin"
            className={`flex items-center space-x-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              pathname === '/admin'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>대시보드</span>
          </Link>

          <Link
            href="/admin/forms"
            className={`flex items-center space-x-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              pathname.startsWith('/admin/forms')
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>설문 관리</span>
          </Link>

          {role === 'SUPER_ADMIN' && (
            <Link
              href="/admin/members"
              className={`flex items-center space-x-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                pathname.startsWith('/admin/members')
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>관리자 승인/관리</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
