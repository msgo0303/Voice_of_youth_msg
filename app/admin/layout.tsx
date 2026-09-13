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
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 mb-1">관리자 접근 권한이 없습니다</h2>
          <p className="text-sm text-slate-600 mb-4">
            현재 계정({user?.first_name || '사용자'})은 일반 사용자 권한입니다.<br />
            관리자 기능에 접근하려면 SUPER_ADMIN 승인이 필요합니다.
          </p>
          {error && <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded mb-4">{error}</p>}
          <Link href="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
            메인 페이지로 돌아가기
          </Link>
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
