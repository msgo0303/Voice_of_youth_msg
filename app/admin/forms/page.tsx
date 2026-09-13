'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { FormStatus } from '@/types/database';
import { Search, Plus, FileText, Lock, Archive, Eye } from 'lucide-react';

interface FormItem {
  id: string;
  title: string;
  description?: string;
  status: FormStatus;
  deadline_at?: string;
  created_at: string;
  responseCount: number;
}

export default function AdminFormsPage() {
  const { role, initData } = useTelegramAuth();
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchForms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/forms?status=${statusFilter}&query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'x-telegram-init-data': initData
        }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setForms(json.forms || []);
      }
    } catch (err) {
      console.error('Failed to fetch forms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initData) {
      fetchForms();
    } else {
      setLoading(false);
    }
  }, [initData, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchForms();
  };

  const canEditForm = role === 'SUPER_ADMIN' || role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">설문 관리</h1>
          <p className="text-sm text-slate-500">생성된 설문을 관리하고 응답 상태를 조회합니다.</p>
        </div>

        {canEditForm ? (
          <Link
            href="/admin/forms/new"
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-blue-700 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>새 설문 작성</span>
          </Link>
        ) : (
          <span className="inline-flex items-center space-x-1 text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg font-semibold">
            <Eye className="w-3.5 h-3.5" />
            <span>VIEWER (조회 전용 모드)</span>
          </span>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl space-x-1">
          {['ACTIVE', 'CLOSED', 'ARCHIVED', 'ALL'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'ACTIVE' && '활성'}
              {st === 'CLOSED' && '종료됨'}
              {st === 'ARCHIVED' && '보관됨'}
              {st === 'ALL' && '전체'}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="설문 제목 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </form>
      </div>

      {/* Forms Table / Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">설문 목록을 불러오는 중...</div>
        ) : forms.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {forms.map((form) => (
              <div key={form.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        form.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : form.status === 'CLOSED'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {form.status}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">{form.title}</h3>
                  </div>

                  {form.description && <p className="text-xs text-slate-600 line-clamp-1">{form.description}</p>}

                  <div className="flex items-center space-x-4 text-xs text-slate-400">
                    <span>생성일: {new Date(form.created_at).toLocaleDateString('ko-KR')}</span>
                    {form.deadline_at && <span>마감일: {new Date(form.deadline_at).toLocaleDateString('ko-KR')}</span>}
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto shrink-0">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
                    {form.responseCount}건 응답
                  </span>

                  <Link
                    href={`/admin/forms/${form.id}`}
                    className="px-3.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition"
                  >
                    응답/통계
                  </Link>

                  {canEditForm && (
                    <Link
                      href={`/admin/forms/${form.id}/edit`}
                      className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                    >
                      편집
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-sm">해당 조건에 맞는 설문이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
