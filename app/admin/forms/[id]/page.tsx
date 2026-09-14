'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  BarChart3,
  Star,
  PieChart,
  ListFilter,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  Search,
  Send
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

interface AnalyticsData {
  summary: {
    total_responses: number;
    overall_avg_satisfaction: number | null;
  };
  question_analytics: Array<{
    question_id: string;
    title: string;
    type: string;
    answered_count: number;
    option_breakdown?: Array<{ option: string; count: number; percentage: number }>;
    average_score?: number;
    score_distribution?: Array<{ score: number; count: number; percentage: number }>;
    reasons?: Array<{ user_name: string; score: number; reason: string; submitted_at: string }>;
    recent_text_answers?: Array<{ user_name: string; username?: string | null; text: string; submitted_at: string }>;
  }>;
}

export default function AdminFormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formId = params.id as string;
  const initialTab = (searchParams.get('tab') as 'info' | 'responses' | 'analytics') || 'info';

  const { role, initData, telegramUserId, user } = useTelegramAuth();

  const [form, setForm] = useState<Form & { responseCount: number } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tabs & States
  const [activeTab, setActiveTab] = useState<'info' | 'responses' | 'analytics'>(initialTab);
  const [responses, setResponses] = useState<ResponseDetail[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [responsesError, setResponsesError] = useState<string | null>(null);

  // Analytics State
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Response Filtering State
  const [responseSearchQuery, setResponseSearchQuery] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState('ALL');

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Topic binding state
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

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`/api/admin/forms/${formId}/analytics`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok && json.success) {
        setAnalytics(json);
      } else {
        setAnalyticsError(json.error || '통계 데이터를 계산하지 못했습니다.');
      }
    } catch (err: any) {
      setAnalyticsError(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setLoadingAnalytics(false);
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
      fetchAnalytics();
    }
  }, [formId, initData, telegramUserId, user?.id]);

  const handleStatusChange = async (newStatus: FormStatus) => {
    if (!form || statusUpdating) return;
    const actionLabel = newStatus === 'ACTIVE' ? '재활성화(ACTIVE)' : newStatus === 'CLOSED' ? '종료(CLOSED)' : '보관(ARCHIVED)';
    if (!confirm(`설문 [${form.title}]의 상태를 "${actionLabel}"(으)로 변경하시겠습니까?`)) {
      return;
    }

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

  const handleDuplicateForm = async () => {
    if (!form || duplicating) return;
    if (!confirm(`[${form.title}] 설문을 복사하시겠습니까?\n(설문 설정 및 질문 목록만 복사되어 종료(CLOSED) 상태로 새 설문이 생성됩니다. 기존 응답은 복사되지 않습니다.)`)) {
      return;
    }

    setDuplicating(true);
    try {
      const res = await fetch(`/api/admin/forms/${formId}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (res.ok && json.success && json.form) {
        alert(json.message || '설문이 성공적으로 복사되었습니다.');
        router.push(`/admin/forms/${json.form.id}`);
      } else {
        alert(json.error || '설문 복사에 실패했습니다.');
      }
    } catch (err: any) {
      alert(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setDuplicating(false);
    }
  };

  const handleDeleteForm = async () => {
    if (!form || deleting) return;

    if (form.responseCount > 0) {
      alert(`[삭제 불가 안내]\n제출된 응답이 ${form.responseCount}건 존재하므로 설문을 영구 삭제할 수 없습니다.\n데이터 보존을 위해 상태를 "보관(ARCHIVED)"으로 변경해 주세요.`);
      return;
    }

    if (!confirm(`[경고] 설문 [${form.title}]을(를) 영구 삭제하시겠습니까?\n삭제된 설문 및 질문 데이터는 복구할 수 없습니다.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/forms/${formId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert('설문이 성공적으로 삭제되었습니다.');
        router.push('/admin/forms');
      } else {
        alert(json.error || '설문 삭제에 실패했습니다.');
      }
    } catch (err: any) {
      alert(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
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
      resp.answers?.forEach((ans) => {
        exportText += `  • ${ans.question_snapshot?.title || '질문'}: ${ans.answer_value || '(응답 없음)'}\n`;
      });
      exportText += `------------------------------------\n\n`;
    });

    handleCopy(exportText, 'all_responses');
  };

  const handleDownloadCsv = async () => {
    if (typeof window === 'undefined') return;
    try {
      const headers: Record<string, string> = {};
      const initData = window.Telegram?.WebApp?.initData;
      if (initData) {
        headers['x-telegram-init-data'] = initData;
      }
      const testUserId = localStorage.getItem('formgram_test_user_id');
      if (testUserId) {
        headers['x-telegram-user-id'] = testUserId;
      }

      let exportUrl = `/api/admin/forms/${formId}/export`;
      if (testUserId && !initData) {
        exportUrl += `?user_id=${testUserId}`;
      }

      const res = await fetch(exportUrl, { headers });
      if (!res.ok) {
        let errMessage = 'CSV 다운로드 권한이 없거나 실패했습니다.';
        try {
          const errJson = await res.json();
          if (errJson.error) errMessage = errJson.error;
        } catch (e) {}
        alert(errMessage);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (form?.title || 'survey').replace(/[^a-zA-Z0-9가-힣]/g, '_');
      a.download = `FormGram_${safeTitle}_responses.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('CSV export failed:', err);
      alert('CSV 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleDownloadJson = () => {
    if (!analytics) return;
    const jsonStr = JSON.stringify(analytics, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FormGram_analytics_${formId}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
              <h1 className="text-lg font-extrabold text-slate-900">{form.title}</h1>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  form.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : form.status === 'CLOSED'
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {form.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">생성일: {new Date(form.created_at).toLocaleDateString('ko-KR')}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {!isViewOnly && (
            <>
              <button
                onClick={handleDuplicateForm}
                disabled={duplicating}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center space-x-1 transition disabled:opacity-50"
                title="설문 복사 (질문/설정만 복사, 응답 제외, CLOSED 상태로 생성)"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{duplicating ? '복사 중...' : '복사'}</span>
              </button>

              <button
                onClick={() => router.push(`/admin/forms/${form.id}/edit`)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center space-x-1 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>편집</span>
              </button>

              <button
                onClick={handleDeleteForm}
                disabled={deleting}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center space-x-1 transition disabled:opacity-50"
                title={form.responseCount > 0 ? "응답이 존재하는 설문은 영구 삭제 불가 (보관 사용)" : "응답 0건인 설문 영구 삭제"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? '삭제 중...' : '삭제'}</span>
              </button>
            </>
          )}

          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {(['ACTIVE', 'CLOSED', 'ARCHIVED'] as FormStatus[]).map((st) => (
              <button
                key={st}
                disabled={isViewOnly || statusUpdating}
                onClick={() => handleStatusChange(st)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                  form.status === st
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">총 응답 수</p>
            <p className="text-xl font-extrabold text-slate-900">{analytics?.summary.total_responses || responses.length}건</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">평균 만족도 점수</p>
            <p className="text-xl font-extrabold text-indigo-900">
              {analytics?.summary.overall_avg_satisfaction ? `${analytics.summary.overall_avg_satisfaction} / 5.0` : '평가 정보 없음'}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">총 문항 수</p>
            <p className="text-xl font-extrabold text-slate-900">{questions.length}개 문항</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'info'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>설문 정보 & 공유 링크</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('responses');
            fetchResponses();
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'responses'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>개별 응답 목록 ({responses.length}건)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('analytics');
            fetchAnalytics();
          }}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
            activeTab === 'analytics'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>통계 시각화 및 분석</span>
        </button>
      </div>

      {/* TAB 1: FORM INFO & SHARE LINKS */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {/* Share Links Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-1.5">
              <Share2 className="w-4 h-4 text-blue-600" />
              <span>설문 공유 및 참여 링크</span>
            </h3>

            <div className="space-y-3">
              {/* Telegram Deep Link */}
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900">📱 텔레그램 미니앱 전용 딥링크</span>
                  <button
                    onClick={() => handleCopy(tgUrl, 'tg')}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center space-x-1"
                  >
                    {copiedType === 'tg' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'tg' ? '복사됨' : '링크 복사'}</span>
                  </button>
                </div>
                <p className="text-xs font-mono text-slate-600 break-all bg-white p-2 rounded-lg border border-blue-200/50">
                  {tgUrl}
                </p>
              </div>

              {/* Web Link */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">🌐 일반 웹 브라우저 접속 링크</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopy(webUrl, 'web')}
                      className="text-[11px] font-bold text-slate-700 hover:text-slate-900 flex items-center space-x-1"
                    >
                      {copiedType === 'web' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedType === 'web' ? '복사됨' : '링크 복사'}</span>
                    </button>
                    <a
                      href={`/survey/${form.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold text-blue-600 hover:underline flex items-center space-x-0.5"
                    >
                      <span>열기</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <p className="text-xs font-mono text-slate-600 break-all bg-white p-2 rounded-lg border border-slate-200">
                  {webUrl}
                </p>
              </div>
            </div>
          </div>

          {/* Topic Binding Editor */}
          {!isViewOnly && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">텔레그램 그룹/토픽 알림 연동</h3>
                <p className="text-xs text-slate-500">답변 제출 시 실시간 수신할 텔레그램 그룹 Chat ID 및 Topic ID를 설정합니다.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Chat ID (그룹 채팅방 ID)</label>
                  <input
                    type="text"
                    placeholder="-1003721720880"
                    value={topicChatIdInput}
                    onChange={(e) => setTopicChatIdInput(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Topic ID (포럼 토픽 번호)</label>
                  <input
                    type="number"
                    placeholder="2"
                    value={topicIdInput}
                    onChange={(e) => setTopicIdInput(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {topicSaveSuccess ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>연동 설정이 성공적으로 저장되었습니다!</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">비워둘 경우 기본 청년회의 소리 그룹 토픽으로 자동 발송됩니다.</span>
                )}

                <button
                  onClick={handleSaveTopicSetting}
                  disabled={topicSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-50"
                >
                  {topicSaving ? '저장 중...' : '연동 설정 저장'}
                </button>
              </div>
            </div>
          )}

          {/* Form Questions Overview */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm">설문 질문 구성 ({questions.length}개)</h3>
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span>Q{idx + 1}. {q.title}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">{q.type}</span>
                  </div>
                  {q.description && <p className="text-xs text-slate-500">{q.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INDIVIDUAL RESPONSES FEED */}
      {activeTab === 'responses' && (() => {
        // Extract unique regions for filter
        const regionsSet = new Set<string>();
        responses.forEach((resp) => {
          resp.answers?.forEach((ans) => {
            if (ans.question_snapshot?.title === '지역' && ans.answer_value) {
              regionsSet.add(ans.answer_value);
            }
          });
        });
        const regionOptions = Array.from(regionsSet);

        // Filter responses by search query and region
        const filteredResponses = responses.filter((resp) => {
          const searchLower = responseSearchQuery.toLowerCase().trim();
          let matchesSearch = true;
          if (searchLower) {
            const nameMatch = (resp.telegram_first_name || '').toLowerCase().includes(searchLower);
            const usernameMatch = (resp.telegram_username || '').toLowerCase().includes(searchLower);
            const answerMatch = resp.answers?.some((a) => (a.answer_value || '').toLowerCase().includes(searchLower));
            matchesSearch = nameMatch || usernameMatch || Boolean(answerMatch);
          }

          let matchesRegion = true;
          if (selectedRegionFilter !== 'ALL') {
            const regionAns = resp.answers?.find((a) => a.question_snapshot?.title === '지역');
            matchesRegion = regionAns ? regionAns.answer_value === selectedRegionFilter : false;
          }

          return matchesSearch && matchesRegion;
        });

        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">제출된 답변 목록</h3>
                <p className="text-xs text-slate-500">실시간으로 접수된 총 {responses.length}건 (필터링 {filteredResponses.length}건)의 개별 응답입니다.</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyAllResponses}
                  disabled={responses.length === 0}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center space-x-1 transition disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>{copiedType === 'all_responses' ? '복사 완료' : '전체 복사'}</span>
                </button>
                <button
                  onClick={handleDownloadCsv}
                  disabled={responses.length === 0}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1 shadow-sm transition disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CSV 내보내기</span>
                </button>
              </div>
            </div>

            {/* Filter Bar: Submitter Name Search & Region Select */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="응답자 이름, Username 또는 답변 검색..."
                  value={responseSearchQuery}
                  onChange={(e) => setResponseSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              {regionOptions.length > 0 && (
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">지역 필터:</span>
                  <select
                    value={selectedRegionFilter}
                    onChange={(e) => setSelectedRegionFilter(e.target.value)}
                    className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">전체 지역 ({responses.length}건)</option>
                    {regionOptions.map((reg) => {
                      const regCount = responses.filter((r) => r.answers?.some((a) => a.question_snapshot?.title === '지역' && a.answer_value === reg)).length;
                      return (
                        <option key={reg} value={reg}>
                          {reg} ({regCount}건)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {loadingResponses ? (
              <div className="p-8 text-center text-xs text-slate-500">응답 목록을 불러오는 중...</div>
            ) : filteredResponses.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs font-medium">
                {responses.length === 0 ? '아직 제출된 응답이 없습니다.' : '검색 조건에 일치하는 응답이 없습니다.'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredResponses.map((resp, rIdx) => (
                  <div key={resp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-extrabold text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                          #{responses.length - rIdx}
                        </span>
                        <span className="font-bold text-xs text-slate-900">
                          {resp.telegram_first_name || '이용자'}
                          {resp.telegram_username && ` (@${resp.telegram_username})`}
                        </span>

                        {resp.telegram_username ? (
                          <a
                            href={`https://t.me/${resp.telegram_username}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold border border-blue-200 transition"
                          >
                            <Send className="w-3 h-3" />
                            <span>Telegram 메시지 보내기 ↗</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg font-medium">
                            Telegram ID: {resp.telegram_user_id}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono self-end sm:self-auto">
                        {new Date(resp.submitted_at).toLocaleString('ko-KR')}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {resp.answers?.map((ans, aIdx) => (
                        <div key={aIdx} className="bg-slate-50 p-3 rounded-xl space-y-1">
                          <p className="text-xs font-bold text-slate-800">
                            • {ans.question_snapshot?.title || '질문'}
                          </p>
                          <p className="text-xs text-blue-900 bg-white p-2.5 rounded-lg border border-slate-200 font-medium">
                            {ans.answer_value || '(응답 없음)'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 3: STATISTICAL ANALYTICS & VISUALIZATIONS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">질문별 통계 시각화 및 집계 분석</h3>
              <p className="text-xs text-slate-500">객관식 비율, 만족도 평균 점수 및 세부 사유 분석 결과입니다.</p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownloadCsv}
                disabled={!analytics || analytics.summary.total_responses === 0}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm transition disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>CSV 엑셀 내보내기</span>
              </button>

              <button
                onClick={handleDownloadJson}
                disabled={!analytics || analytics.summary.total_responses === 0}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>JSON 데이터</span>
              </button>
            </div>
          </div>

          {loadingAnalytics ? (
            <div className="p-12 text-center text-xs text-slate-500">통계 데이터를 계산 중입니다...</div>
          ) : analyticsError || !analytics ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-rose-600 text-xs font-bold">
              {analyticsError || '통계 데이터를 불러오지 못했습니다.'}
            </div>
          ) : (
            <div className="space-y-6">
              {analytics.question_analytics.map((qa, qIdx) => (
                <div key={qa.question_id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-slate-900">
                          Q{qIdx + 1}. {qa.title}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {qa.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">총 {qa.answered_count}명 응답 완료</p>
                    </div>

                    {qa.average_score !== undefined && (
                      <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-indigo-700 block">평균 점수</span>
                        <span className="text-base font-extrabold text-indigo-900">{qa.average_score} / 5.0</span>
                      </div>
                    )}
                  </div>

                  {/* Render Option Breakdown Bars (SINGLE_CHOICE, MULTIPLE_CHOICE, DROPDOWN) */}
                  {qa.option_breakdown && (
                    <div className="space-y-3 pt-1">
                      {qa.type === 'MULTIPLE_CHOICE' && (
                        <p className="text-[11px] text-slate-400 italic font-medium">
                          * 복수 선택 문항은 전체 응답자 수({qa.answered_count}명) 대비 비율로 계산되어 비율 합계가 100%를 초과할 수 있습니다.
                        </p>
                      )}
                      {qa.option_breakdown.map((opt, oIdx) => (
                        <div key={oIdx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                            <span>{opt.option}</span>
                            <span className="font-mono text-blue-700 font-bold">
                              {opt.count}명 ({opt.percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-500"
                              style={{ width: `${opt.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Render Rating Score Distribution Bars (LINEAR_SCALE, SATISFACTION) */}
                  {qa.score_distribution && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-5 gap-2 pb-2">
                        {qa.score_distribution.map((sd) => (
                          <div key={sd.score} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center space-y-1">
                            <span className="text-xs font-bold text-slate-700 block">{sd.score}점</span>
                            <span className="text-sm font-extrabold text-indigo-900 block">{sd.count}명</span>
                            <span className="text-[10px] text-slate-500 font-mono block">{sd.percentage}%</span>
                          </div>
                        ))}
                      </div>

                      {/* Reason list for Satisfaction ratings */}
                      {qa.reasons && qa.reasons.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <h4 className="text-xs font-bold text-indigo-900">작성된 평가 사유 목록 ({qa.reasons.length}건)</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {qa.reasons.map((r, rIdx) => (
                              <div key={rIdx} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-indigo-950">{r.user_name} ({r.score}점)</span>
                                  <span className="text-slate-400 font-mono">{new Date(r.submitted_at).toLocaleDateString('ko-KR')}</span>
                                </div>
                                <p className="text-xs text-slate-800 leading-relaxed font-medium">{r.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Render Recent Text Feed (SHORT_TEXT, LONG_TEXT) */}
                  {qa.recent_text_answers && (
                    <div className="space-y-2 pt-1">
                      <h4 className="text-xs font-bold text-slate-800">최근 응답 피드 ({qa.recent_text_answers.length}건)</h4>
                      {qa.recent_text_answers.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">작성된 응답이 없습니다.</p>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {qa.recent_text_answers.map((ans, tIdx) => (
                            <div key={tIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-900">{ans.user_name}{ans.username && ` (@${ans.username})`}</span>
                                <span className="text-slate-400 font-mono">{new Date(ans.submitted_at).toLocaleDateString('ko-KR')}</span>
                              </div>
                              <p className="text-xs text-blue-900 bg-white p-2 rounded-lg border border-slate-200 font-medium">
                                {ans.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
