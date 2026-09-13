'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { Form, Question, FormStatus } from '@/types/database';
import { getTelegramMiniAppUrl } from '@/lib/telegramLink';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Edit3,
  Users,
  FileText,
  MessageSquare,
  Share2,
  Download,
  UserCheck
} from 'lucide-react';

interface ResponseDetail {
  id: string;
  telegram_user_id: number;
  telegram_username?: string | null;
  telegram_first_name?: string | null;
  submitted_at: string;
  answers: Array<{
    id: string;
    question_id: string;
    question_snapshot: {
      title: string;
      type: string;
      description?: string | null;
    };
    answer_value: string;
  }>;
}

export default function AdminFormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;
  const { role, initData, telegramUserId, user } = useTelegramAuth();

  const [form, setForm] = useState<Form & { responseCount: number } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tabs & Responses State
  const [activeTab, setActiveTab] = useState<'info' | 'responses'>('info');
  const [responses, setResponses] = useState<ResponseDetail[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Topic binding state for existing surveys
  const [topicChatIdInput, setTopicChatIdInput] = useState('');
  const [topicIdInput, setTopicIdInput] = useState('');
  const [topicSaving, setTopicSaving] = useState(false);
  const [topicSaveSuccess, setTopicSaveSuccess] = useState(false);

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {};
    if (initData) headers['x-telegram-init-data'] = initData;

    const effectiveUserId =
      telegramUserId ||
      user?.id ||
      (typeof window !== 'undefined' ? localStorage.getItem('formgram_test_user_id') : null);

    if (effectiveUserId) {
      headers['x-telegram-user-id'] = effectiveUserId.toString();
    }
    return headers;
  };

  const fetchResponses = async () => {
    setLoadingResponses(true);
    setResponsesError(null);
    try {
      const res = await fetch(`/api/admin/forms/${formId}/responses`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok && json.success) {
        setResponses(json.responses || []);
      } else {
        setResponsesError(json.error || '답변 목록을 불러오지 못했습니다.');
      }
    } catch (err: any) {
      setResponsesError(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setLoadingResponses(false);
    }
  };

  useEffect(() => {
    async function fetchFormDetail() {
      try {
        const res = await fetch(`/api/admin/forms/${formId}`, { headers: getAuthHeaders() });
        const json = await res.json();

        if (res.ok && json.success) {
          setForm(json.form);
          setQuestions(json.questions || []);
          if (json.form.response_chat_id) setTopicChatIdInput(json.form.response_chat_id.toString());
          if (json.form.response_topic_id) setTopicIdInput(json.form.response_topic_id.toString());
        } else {
          setError(json.error || '설문 정보를 불러올 수 없습니다.');
        }
      } catch (err: any) {
        setError(err.message || '네트워크 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    if (formId) {
      fetchFormDetail();
      fetchResponses();
    }
  }, [formId, initData, telegramUserId, user?.id]);

  const handleStatusChange = async (newStatus: FormStatus) => {
    if (!form || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/admin/forms/${formId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setForm((prev) => prev ? { ...prev, status: newStatus } : null);
      } else {
        alert(json.error || '상태 변경에 실패했습니다.');
      }
    } catch (err: any) {
      alert(err.message || '네트워크 오류');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSaveTopicSetting = async () => {
    if (!form || topicSaving) return;
    setTopicSaving(true);
    setTopicSaveSuccess(false);
    try {
      const res = await fetch(`/api/admin/forms/${formId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          response_chat_id: topicChatIdInput ? Number(topicChatIdInput) : null,
          response_topic_id: topicIdInput ? Number(topicIdInput) : null
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setForm((prev) =>
          prev
            ? {
                ...prev,
                response_chat_id: topicChatIdInput ? Number(topicChatIdInput) : null,
                response_topic_id: topicIdInput ? Number(topicIdInput) : null
              }
            : null
        );
        setTopicSaveSuccess(true);
        setTimeout(() => setTopicSaveSuccess(false), 3000);
      } else {
        alert(json.error || '토픽 연동 설정 저장에 실패했습니다.');
      }
    } catch (err: any) {
      alert(err.message || '네트워크 오류');
    } finally {
      setTopicSaving(false);
    }
  };

  const handleCopy = (text: string, typeTag: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(typeTag);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyAllResponses = () => {
    if (responses.length === 0) return;
    let exportText = `📋 [${form?.title}] 제출 답변 목록 (총 ${responses.length}건)\n====================================\n\n`;

    responses.forEach((resp, rIdx) => {
      exportText += `[응답 #${rIdx + 1}] ${resp.telegram_first_name || '이용자'}${resp.telegram_username ? ` (@${resp.telegram_username})` : ''} | ${new Date(resp.submitted_at).toLocaleString('ko-KR')}\n`;
      resp.answers.forEach((ans) => {
        exportText += `  • ${ans.question_snapshot.title}: ${ans.answer_value || '(응답 없음)'}\n`;
      });
      exportText += `------------------------------------\n\n`;
    });

    handleCopy(exportText, 'all_responses');
  };

  const tgUrl = getTelegramMiniAppUrl(formId);
  const webUrl = typeof window !== 'undefined' ? `${window.location.origin}/survey/${formId}` : `/survey/${formId}`;

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        설문 정보를 불러오는 중입니다...
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-4">
        <h2 className="text-lg font-bold text-slate-900">설문을 찾을 수 없습니다</h2>
        <p className="text-xs text-slate-500">{error || '요청하신 설문 정보가 존재하지 않습니다.'}</p>
        <button
          onClick={() => router.push('/admin/forms')}
          className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
        >
          설문 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const isViewOnly = role === 'VIEWER';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push('/admin/forms')}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <select
                value={form.status}
                disabled={isViewOnly || statusUpdating}
                onChange={(e) => handleStatusChange(e.target.value as FormStatus)}
                className={`text-xs font-extrabold px-2.5 py-1 rounded-full uppercase border focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                  form.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : form.status === 'CLOSED'
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                <option value="ACTIVE">● ACTIVE (진행중)</option>
                <option value="CLOSED">🔒 CLOSED (마감)</option>
                <option value="ARCHIVED">📦 ARCHIVED (보관)</option>
              </select>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{form.title}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">설문 관리 및 응답 내용 확인</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          {!isViewOnly && (
            <Link
              href={`/admin/forms/${form.id}/edit`}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-xl transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>편집</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main View Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center space-x-2 ${
            activeTab === 'info'
              ? 'border-blue-600 text-blue-600 bg-white shadow-sm rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>설문 정보 & 공유 링크</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('responses');
            if (responses.length === 0) fetchResponses();
          }}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center space-x-2 ${
            activeTab === 'responses'
              ? 'border-blue-600 text-blue-600 bg-white shadow-sm rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>제출된 답변 목록 ({form.responseCount}건)</span>
        </button>
      </div>

      {/* TAB 1: FORM INFO & SHARE LINKS */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {/* Share Links Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
              <Share2 className="w-4 h-4 text-blue-600" />
              <span>설문 응답 링크 복사 및 공유</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Telegram Mini App Link */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>📱 텔레그램 미니앱 링크</span>
                  <span className="text-[10px] text-blue-600 font-medium">텔레그램 인앱 전용</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={tgUrl}
                  className="w-full bg-white border border-slate-200 rounded-lg text-xs px-3 py-2 text-slate-700 font-mono focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(tgUrl, 'tg')}
                  className={`w-full py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 border ${
                    copiedType === 'tg'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
                  }`}
                >
                  {copiedType === 'tg' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'tg' ? '텔레그램 링크 복사됨!' : '텔레그램 링크 복사'}</span>
                </button>
              </div>

              {/* Web Survey Link */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>🌐 웹 브라우저 직접 링크</span>
                  <span className="text-[10px] text-slate-500 font-medium">모든 브라우저 가능</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={webUrl}
                  className="w-full bg-white border border-slate-200 rounded-lg text-xs px-3 py-2 text-slate-700 font-mono focus:outline-none"
                />
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCopy(webUrl, 'web')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 border ${
                      copiedType === 'web'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-700 text-white hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    {copiedType === 'web' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'web' ? '웹 링크 복사됨!' : '웹 링크 복사'}</span>
                  </button>
                  <a
                    href={webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Notification Topic Settings Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span>📌 텔레그램 응답 알림 토픽 연동 설정</span>
              </div>
              {topicSaveSuccess && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  ✓ 토픽 연동 저장 완료!
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              이 설문에 새로운 응답이 제출되면 지정한 텔레그램 그룹 Chat ID와 토픽 ID(Thread ID)로 실시간 알림이 발송됩니다. (기존 생성된 설문도 자유롭게 변경/연동 가능)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  텔레그램 그룹 Chat ID
                </label>
                <input
                  type="text"
                  placeholder="예: -1003721720880"
                  value={topicChatIdInput}
                  onChange={(e) => setTopicChatIdInput(e.target.value)}
                  disabled={isViewOnly || topicSaving}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  토픽 ID (Thread ID)
                </label>
                <input
                  type="text"
                  placeholder="예: 2 (일반 채팅방은 빈칸)"
                  value={topicIdInput}
                  onChange={(e) => setTopicIdInput(e.target.value)}
                  disabled={isViewOnly || topicSaving}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            {!isViewOnly && (
              <div className="flex justify-end">
                <button
                  onClick={handleSaveTopicSetting}
                  disabled={topicSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-sm"
                >
                  {topicSaving ? '저장 중...' : '토픽 연동 설정 저장'}
                </button>
              </div>
            )}
          </div>

          {/* Meta Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">총 제출 응답 수</p>
                <p className="text-lg font-extrabold text-slate-900">{form.responseCount}건</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">질문 개수</p>
                <p className="text-lg font-extrabold text-slate-900">{questions.length}개</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">설문 생성일</p>
                <p className="text-xs font-bold text-slate-900 pt-0.5">
                  {new Date(form.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
          </div>

          {/* Questions Preview */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>포함된 질문 목록 ({questions.length}개)</span>
            </h3>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {questions.map((q, idx) => (
                <div key={q.id || idx} className="p-4 space-y-1.5 bg-slate-50/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-500">Q{idx + 1}.</span>
                      <span className="text-sm font-bold text-slate-900">{q.title}</span>
                      {q.required && <span className="text-[10px] text-red-500 font-bold">*필수</span>}
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      {q.type}
                    </span>
                  </div>
                  {q.description && <p className="text-xs text-slate-500 pl-6">{q.description}</p>}
                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div className="pl-6 pt-1 flex flex-wrap gap-1.5">
                      {q.options.map((opt, optIdx) => (
                        <span key={optIdx} className="text-xs bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUBMITTED RESPONSES VIEWER */}
      {activeTab === 'responses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>제출된 전체 응답 ({responses.length}건)</span>
            </h3>

            {responses.length > 0 && (
              <button
                onClick={handleCopyAllResponses}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
              >
                {copiedType === 'all_responses' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'all_responses' ? '전체 답변 복사됨!' : '전체 답변 텍스트 복사'}</span>
              </button>
            )}
          </div>

          {responsesError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
              ⚠️ {responsesError}
            </div>
          )}

          {loadingResponses ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              제출된 응답 목록을 불러오는 중입니다...
            </div>
          ) : responses.length > 0 ? (
            <div className="space-y-4">
              {responses.map((resp, idx) => (
                <div key={resp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                  {/* Respondent Info Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center">
                        #{responses.length - idx}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {resp.telegram_first_name || '이용자'}
                          </span>
                          {resp.telegram_username && (
                            <span className="text-xs text-blue-600 font-medium">
                              @{resp.telegram_username}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          ID: {resp.telegram_user_id} | 제출일: {new Date(resp.submitted_at).toLocaleString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Submitted Answers Stream */}
                  <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                    {resp.answers.map((ans, aIdx) => (
                      <div key={ans.id || aIdx} className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">
                          Q. {ans.question_snapshot.title}
                        </p>
                        <div className="text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 font-medium whitespace-pre-wrap">
                          ↳ {ans.answer_value || '(응답 없음)'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-sm">아직 제출된 응답이 없습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
