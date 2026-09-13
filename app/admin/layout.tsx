'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { LayoutDashboard, FileText, Users, ShieldAlert } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, isAuthenticated, user, role, error, setTestUserId } = useTelegramAuth();
  const [inputTgId, setInputTgId] = React.useState('');
  const [loginErr, setLoginErr] = React.useState<string | null>(null);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTgId || !inputTgId.trim()) return;
    setTestUserId(Number(inputTgId.trim()));
  };

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
        <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-slate-200 p-6 text-center space-y-5">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <div>
            <h2 className="text-lg font-bold text-slate-800">관리자 접근 인증</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              텔레그램 미니앱 외부(웹 브라우저)에서 어드민에 접속하려면<br />
              Supabase DB에 등록된 관리자 텔레그램 User ID로 인증하세요.
            </p>
          </div>

          {/* Admin Telegram ID Verification Form */}
          <form onSubmit={handleAdminLogin} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-left">
            <label className="text-xs font-bold text-slate-700 block">
              🔑 관리자 텔레그램 ID 인증
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="예: 1284576145"
                value={inputTgId}
                onChange={(e) => setInputTgId(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow transition shrink-0"
              >
                인증 접속
              </button>
            </div>
            <button
              type="button"
              onClick={() => setTestUserId(1284576145)}
              className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition text-center"
            >
              👑 SUPER_ADMIN 고민석 (1284576145) 바로 접속
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link href="/" className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">
              메인으로
            </Link>
            <a
              href="https://t.me/Voymsg_bot"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition"
            >
              텔레그램 봇 (@Voymsg_bot)
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
