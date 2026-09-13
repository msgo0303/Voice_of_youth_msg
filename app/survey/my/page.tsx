'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Lock,
  X,
  AlertCircle,
  FileText,
  History,
  PlusCircle
} from 'lucide-react';

interface ResponseItem {
  id: string;
  form_id: string;
  submitted_at: string;
  updated_at: string;
  is_edited: boolean;
  forms: {
    id: string;
    title: string;
    description: string | null;
    status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
    deadline_at: string | null;
    completion_message: string | null;
  };
}

interface AnswerDetail {
  id: string;
  question_id: string;
  answer_value: string;
  question_snapshot: {
    title: string;
    type: string;
    required: boolean;
  };
}

export default function UserMyResponsesPage() {
  const router = useRouter();
  const { isAuthenticated, initData, user } = useTelegramAuth();

  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Response Detail Modal state
  const [selectedResponse, setSelectedResponse] = useState<ResponseItem | null>(null);
  const [answerDetails, setAnswerDetails] = useState<AnswerDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    async function fetchMyResponses() {
      try {
        const res = await fetch('/api/user/my-responses', {
          headers: { 'x-telegram-init-data': initData }
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setResponses(json.responses || []);
        } else {
          setError(json.error || '응답 내역을 불러올 수 없습니다.');
        }
      } catch (err: any) {
        setError(err.message || '네트워크 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchMyResponses();
  }, [initData]);

  const handleOpenDetailModal = async (resp: ResponseItem) => {
    setSelectedResponse(resp);
    setLoadingDetails(true);
    setAnswerDetails([]);

    try {
      const res = await fetch(`/api/survey/response/${resp.id}`, {
        headers: { 'x-telegram-init-data': initData }
      });
      const json = await res.json();
      if (res.ok && json.response?.response_answers) {
        setAnswerDetails(json.response.response_answers);
      }
    } catch (err) {
      console.error('Failed to fetch details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8FF]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-600">내 응답 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF] text-slate-900 pb-12">
      {/* Top Bar Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-slate-900 text-base">FormGram</span>
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
          <History className="w-3.5 h-3.5 text-blue-600" />
          <span>내 참여 내역</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">내가 참여한 설문</h1>
            <p className="text-xs text-slate-500">본인 텔레그램 계정으로 제출한 모든 응답 이력입니다.</p>
          </div>
          <span className="text-xs font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
            총 {responses.length}건
          </span>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty state */}
        {responses.length === 0 && !error && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">제출한 설문 내역이 없습니다.</h3>
            <p className="text-xs text-slate-500">새로운 설문에 참여하시면 이곳에서 응답 내역을 확인하실 수 있습니다.</p>
          </div>
        )}

        {/* Responses Cards Stream */}
        <div className="space-y-4">
          {responses.map((resp) => {
            const form = resp.forms;
            const isActive = form?.status === 'ACTIVE';

            return (
              <div
                key={resp.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3.5 transition hover:shadow-md"
              >
                {/* Form Title & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 text-base leading-snug">
                      {form?.title || '제목 없음'}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      응답 ID: #{resp.id.slice(0, 8)}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isActive ? '진행중' : '마감'}
                  </span>
                </div>

                {/* Submitted Badges & Timestamp */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>제출: {new Date(resp.submitted_at).toLocaleString('ko-KR')}</span>
                  </span>

                  {resp.is_edited && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200/60">
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>수정됨 ({new Date(resp.updated_at).toLocaleString('ko-KR')})</span>
                    </span>
                  )}
                </div>

                {/* Deadline & Edit Policy */}
                <div className="bg-slate-50 rounded-xl p-2.5 px-3 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {form?.deadline_at
                        ? `마감 기한: ${new Date(form.deadline_at).toLocaleDateString('ko-KR')}`
                        : '상시 진행'}
                    </span>
                  </span>
                  <span className={isActive ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'}>
                    {isActive ? '수정 가능' : '수정 불가'}
                  </span>
                </div>

                {/* Closed Info Notice */}
                {!isActive && (
                  <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 px-3 flex items-center space-x-2 text-xs text-amber-800">
                    <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>설문이 공식 마감되어 응답 수정 및 새로 제출이 불가능합니다.</span>
                  </div>
                )}

                {/* Action Buttons Grid (Requirement 2) */}
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Action A: 응답 상세 보기 */}
                    <button
                      onClick={() => handleOpenDetailModal(resp)}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition"
                    >
                      <Eye className="w-4 h-4 text-slate-500" />
                      <span>응답 상세 보기</span>
                    </button>

                    {/* Action B: 응답 수정 */}
                    {isActive ? (
                      <button
                        onClick={() => router.push(`/survey/${form.id}?response_id=${resp.id}`)}
                        className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>응답 수정</span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="py-2.5 px-3 bg-slate-100 text-slate-400 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 cursor-not-allowed opacity-60"
                      >
                        <Lock className="w-4 h-4" />
                        <span>수정 불가</span>
                      </button>
                    )}
                  </div>

                  {/* Action C: 새로 제출 (Form 이 활성 상태일 때만) */}
                  {isActive && (
                    <button
                      onClick={() => router.push(`/survey/${form.id}`)}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-blue-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition"
                    >
                      <PlusCircle className="w-4 h-4 text-blue-600" />
                      <span>새로운 응답 추가 제출하기</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Response Details BottomSheet / Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Modal Header */}
            <div className="p-4 px-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">내 응답 상세 보기</h3>
                <p className="text-xs text-slate-500">{selectedResponse.forms?.title}</p>
              </div>
              <button
                onClick={() => setSelectedResponse(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>제출일: {new Date(selectedResponse.submitted_at).toLocaleString('ko-KR')}</span>
                {selectedResponse.is_edited && (
                  <span className="text-blue-600 font-bold font-sans">수정됨 ({new Date(selectedResponse.updated_at).toLocaleTimeString('ko-KR')})</span>
                )}
              </div>

              {loadingDetails ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-500">답변 상세 내역 불러오는 중...</p>
                </div>
              ) : answerDetails.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">답변 내역이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {answerDetails.map((ans, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 space-y-1.5">
                      <p className="font-bold text-xs text-slate-900">
                        Q{idx + 1}. {ans.question_snapshot?.title || '질문'}
                      </p>
                      <p className="text-xs text-blue-900 bg-white p-2.5 rounded-lg border border-slate-200 font-medium leading-relaxed">
                        {ans.answer_value || '(응답 없음)'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 sm:rounded-b-3xl flex justify-end">
              <button
                onClick={() => setSelectedResponse(null)}
                className="py-2.5 px-5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
