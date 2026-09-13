'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { FileText, MessageSquare, Plus, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';

interface FormStat {
  id: string;
  title: string;
  status: string;
  created_at: string;
  responseCount: number;
}

interface RecentResponse {
  id: string;
  form_id: string;
  telegram_first_name?: string;
  telegram_username?: string;
  submitted_at: string;
}

interface DashboardData {
  activeFormsCount: number;
  totalResponsesCount: number;
  activeForms: FormStat[];
  recentResponses: RecentResponse[];
}

export default function AdminDashboardPage() {
  const { user, role, initData, telegramUserId, isAuthenticated } = useTelegramAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const headers: Record<string, string> = {};
        if (initData) headers['x-telegram-init-data'] = initData;
        if (telegramUserId) headers['x-telegram-user-id'] = telegramUserId.toString();

        const res = await fetch('/api/admin/dashboard', { headers });

        const json = await res.json();
        if (res.ok && json.success) {
          setData(json.stats);
        } else {
          setError(json.error || '대시보드 데이터를 불러오지 못했습니다.');
        }
      } catch (err: any) {
        setError(err.message || '네트워크 오류');
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated || initData || telegramUserId) {
      fetchDashboard();
    } else {
      setLoading(false);
    }
  }, [initData, telegramUserId, isAuthenticated]);

  const canCreateForm = role === 'SUPER_ADMIN' || role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold mb-1">
            {user?.first_name || '관리자'}님, 환영합니다! 👋
          </h1>
          <p className="text-blue-100 text-sm">
            권한: <span className="font-semibold underline">{role}</span> | 실시간 설문 현황과 제출된 응답을 모니터링하세요.
          </p>
        </div>

        {canCreateForm && (
          <Link
            href="/admin/forms/new"
            className="inline-flex items-center space-x-2 bg-white text-blue-700 px-4 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-blue-50 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>새 설문 만들기</span>
          </Link>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">활성 설문 수</p>
            <p className="text-2xl font-black text-slate-900">{loading ? '...' : data?.activeFormsCount || 0}개</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">전체 응답 수</p>
            <p className="text-2xl font-black text-slate-900">{loading ? '...' : data?.totalResponsesCount || 0}건</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Active Forms & Recent Responses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Forms Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>활성 설문 목록</span>
            </h2>
            <Link href="/admin/forms?status=ACTIVE" className="text-xs font-semibold text-blue-600 hover:underline flex items-center">
              전체보기 <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-6 text-sm text-slate-500">로딩 중...</div>
          ) : data?.activeForms && data.activeForms.length > 0 ? (
            <div className="space-y-3">
              {data.activeForms.map((form) => (
                <Link
                  key={form.id}
                  href={`/admin/forms/${form.id}?tab=responses`}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-300 transition flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-blue-600 transition">{form.title}</h3>
                    <p className="text-xs text-slate-500">
                      생성일: {new Date(form.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center space-x-1 bg-blue-600 group-hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{form.responseCount}건 응답 보기 ➔</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              현재 진행 중인 활성 설문이 없습니다.
            </div>
          )}
        </div>

        {/* Recent Responses Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span>최근 응답 제출</span>
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-6 text-sm text-slate-500">로딩 중...</div>
          ) : data?.recentResponses && data.recentResponses.length > 0 ? (
            <div className="space-y-3">
              {data.recentResponses.map((resp) => (
                <Link
                  key={resp.id}
                  href={`/admin/forms/${resp.form_id}?tab=responses`}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-300 transition flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <p className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition">
                      {resp.telegram_first_name || '응답자'} {resp.telegram_username ? `(@${resp.telegram_username})` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(resp.submitted_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition">
                    답변 보기 ➔
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              제출된 응답이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
