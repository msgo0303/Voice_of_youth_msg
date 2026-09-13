'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { Form } from '@/types/database';
import { Sparkles, FileText, ArrowRight, Shield, MessageSquare, ExternalLink } from 'lucide-react';

export default function RootHomePage() {
  const { role, user } = useTelegramAuth();
  const [activeForms, setActiveForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPublicActiveForms() {
      try {
        const res = await fetch('/api/admin/forms?status=ACTIVE');
        const json = await res.json();
        if (res.ok && json.success) {
          setActiveForms(json.forms || []);
        }
      } catch (err) {
        console.error('Failed to fetch public active forms:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPublicActiveForms();
  }, []);

  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'VIEWER';

  return (
    <div className="min-h-screen bg-[#FAF8FF] text-slate-900 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span className="font-extrabold text-slate-900 text-lg tracking-tight">FormGram</span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link
              href="/admin"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isAdmin ? `관리자 센터 (${role})` : '관리자 로그인 (/admin)'}</span>
            </Link>
            <a
              href="https://t.me/Voymsg_bot"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition flex items-center space-x-1 border border-blue-200"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">텔레그램 봇</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 space-y-8">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Voice of Youth Telegram Platform</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">
            텔레그램과 연동되는 스마트 설문 플랫폼
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 leading-relaxed max-w-xl">
            전달받으신 설문 주소를 통해 바로 참여하시거나 진행 중인 활성 설문을 선택하여 응답해 주세요.
          </p>
          <div className="pt-2">
            <Link
              href="/admin"
              className="inline-flex items-center space-x-2 bg-white text-blue-700 hover:bg-blue-50 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm shadow-md transition"
            >
              <Shield className="w-4 h-4 text-blue-600" />
              <span>👑 관리자 센터 대시보드 바로가기 ➔</span>
            </Link>
          </div>
        </div>

        {/* Active Public Surveys */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>진행 중인 설문 목록</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {loading ? '불러오는 중...' : `총 ${activeForms.length}개`}
            </span>
          </div>

          {loading ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
              설문 목록을 불러오는 중입니다...
            </div>
          ) : activeForms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeForms.map((form) => (
                <Link
                  key={form.id}
                  href={`/survey/${form.id}`}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition space-y-3 flex flex-col justify-between group"
                >
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                      진행중
                    </span>
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition">
                      {form.title}
                    </h3>
                    {form.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{form.description}</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                    <span>설문 참여하기</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-sm">현재 공개 진행 중인 설문이 없습니다.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        © 2026 FormGram. Voice of Youth Telegram Mini App Platform.
      </footer>
    </div>
  );
}
