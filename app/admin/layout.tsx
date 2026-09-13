'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { LayoutDashboard, FileText, Users, ShieldAlert } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, isAuthenticated, user, role, error } = useTelegramAuth();
  const [requestStatus, setRequestStatus] = React.useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [requestMsg, setRequestMsg] = React.useState<string | null>(null);

  const handleApplyAdmin = async () => {
    setRequestStatus('submitting');
    setRequestMsg(null);
    try {
      const res = await fetch('/api/user/admin-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_role: 'ADMIN' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRequestStatus('success');
        setRequestMsg(data.message || '관리자 승인 신청이 완료되었습니다.');
      } else {
        setRequestStatus('error');
        setRequestMsg(data.error || '관리자 승인 신청 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      setRequestStatus('error');
      setRequestMsg(err.message || '네트워크 오류가 발생했습니다.');
    }
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
            <h2 className="text-lg font-bold text-slate-800">관리자 전용 페이지</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              접근 권한이 없습니다.<br />
              Supabase DB에 등록된 관리자 텔레그램 계정만 접근할 수 있습니다.
            </p>
          </div>

          {requestStatus === 'success' ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs space-y-1">
              <p className="font-bold">✅ 신청 완료</p>
              <p>{requestMsg}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requestMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                  {requestMsg}
                </div>
              )}
              <button
                type="button"
                onClick={handleApplyAdmin}
                disabled={requestStatus === 'submitting'}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {requestStatus === 'submitting' ? '신청 처리 중...' : '📋 관리자 권한 승인 신청하기'}
              </button>
            </div>
          )}

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
