'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { Form, Question } from '@/types/database';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  X,
  History,
  Edit3
} from 'lucide-react';

export default function UserSurveyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const formId = params.id as string;
  const isEditQuery = searchParams.get('edit') === 'true';

  const { isAuthenticated, initData } = useTelegramAuth();

  // Data states
  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [satisfactionReasons, setSatisfactionReasons] = useState<Record<string, string>>({});
  const [isEditMode, setIsEditMode] = useState(false);

  // UI Flow states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submittedResponse, setSubmittedResponse] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    async function fetchPublicFormAndResponse() {
      try {
        // 1. Fetch Form & Questions
        const res = await fetch(`/api/admin/forms/${formId}`, {
          headers: { 'x-telegram-init-data': initData }
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setForm(json.form);
          setQuestions(json.questions || []);
        } else {
          setValidationError(json.error || '설문을 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        // 2. Fetch Existing Response for this user if available
        const respRes = await fetch(`/api/survey/${formId}/submit`, {
          headers: { 'x-telegram-init-data': initData }
        });
        const respJson = await respRes.json();
        if (respRes.ok && respJson.response?.response_answers) {
          const existingAnswersMap: Record<string, string> = {};
          const existingReasonsMap: Record<string, string> = {};

          respJson.response.response_answers.forEach((ans: any) => {
            existingAnswersMap[ans.question_id] = ans.answer_value;

            if (ans.answer_value.includes(' - 사유: ')) {
              const parts = ans.answer_value.split(' - 사유: ');
              if (parts[1]) {
                existingReasonsMap[ans.question_id] = parts[1];
              }
            }
          });

          setAnswers(existingAnswersMap);
          setSatisfactionReasons(existingReasonsMap);
          setIsEditMode(true);
        } else if (isEditQuery) {
          setIsEditMode(true);
        }
      } catch (err: any) {
        setValidationError(err.message || '네트워크 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    if (formId) {
      fetchPublicFormAndResponse();
    }
  }, [formId, initData, isEditQuery]);

  const handleSingleAnswerChange = (questionId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
    setValidationError(null);
  };

  const handleMultipleAnswerChange = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const currentRaw = prev[questionId] || '';
      const currentList = currentRaw ? currentRaw.split(', ') : [];
      let updated: string[];

      if (currentList.includes(option)) {
        updated = currentList.filter((o) => o !== option);
      } else {
        updated = [...currentList, option];
      }

      return { ...prev, [questionId]: updated.join(', ') };
    });
    setValidationError(null);
  };

  const handleSatisfactionRating = (questionId: string, score: number) => {
    const reason = satisfactionReasons[questionId] || '';
    const combinedVal = `${score}점${reason ? ` - 사유: ${reason}` : ''}`;
    setAnswers((prev) => ({ ...prev, [questionId]: combinedVal }));
  };

  const handleSatisfactionReasonChange = (questionId: string, reasonText: string) => {
    setSatisfactionReasons((prev) => ({ ...prev, [questionId]: reasonText }));
    const currentAns = answers[questionId] || '5점';
    const scoreMatch = currentAns.match(/^[1-5]점/);
    const scoreStr = scoreMatch ? scoreMatch[0] : '5점';
    const combinedVal = `${scoreStr}${reasonText ? ` - 사유: ${reasonText}` : ''}`;
    setAnswers((prev) => ({ ...prev, [questionId]: combinedVal }));
  };

  const handleValidationAndOpenModal = () => {
    setValidationError(null);

    const missing: string[] = [];
    for (const q of questions) {
      const val = answers[q.id];
      if (q.required && (!val || !val.trim())) {
        missing.push(q.title);
      }

      if (q.type === 'SATISFACTION' && q.required) {
        const reason = satisfactionReasons[q.id];
        if (!reason || !reason.trim()) {
          missing.push(`${q.title} (사유 서술 필수)`);
        }
      }
    }

    if (missing.length > 0) {
      setValidationError(`필수 입력 항목이 누락되었습니다: ${missing.join(', ')}`);
      window.scrollTo({ top: 100, behavior: 'smooth' });
      return;
    }

    setShowConfirmModal(true);
  };

  const handleSubmitFinal = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);

    try {
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch(`/api/survey/${formId}/submit`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData
        },
        body: JSON.stringify({ answers })
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSubmittedResponse({
          id: json.response_id,
          message: json.message || (isEditMode ? '응답이 성공적으로 수정되었습니다.' : '응답이 성공적으로 제출되었습니다.')
        });
      } else {
        setValidationError(json.error || '제출 실패');
      }
    } catch (err: any) {
      setValidationError(err.message || '네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm font-semibold text-slate-600">설문을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // Stitch Design 6 Complete Submission Success Screen
  if (submittedResponse) {
    return (
      <div className="min-h-screen bg-[#FAF8FF] p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-lg p-6 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">
              {isEditMode ? '수정이 완료되었습니다! 🎉' : '제출이 완료되었습니다! 🎉'}
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              {submittedResponse.message}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-400 font-mono">
            응답 ID: #{submittedResponse.id.slice(0, 8)}
          </div>

          <div className="space-y-2">
            <button
              onClick={() => router.push('/survey/my')}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow hover:bg-blue-700 transition flex items-center justify-center space-x-1.5"
            >
              <History className="w-4 h-4" />
              <span>내 참여 내역 보기</span>
            </button>

            <button
              onClick={() => window.Telegram?.WebApp?.close()}
              className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF] text-slate-900 pb-28">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-slate-900 text-base">FormGram</span>
        </div>
        <div className="flex items-center space-x-2">
          {isEditMode && (
            <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
              <Edit3 className="w-3 h-3" />
              <span>수정 모드</span>
            </span>
          )}
          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
            {form?.status}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* Form Title & Description Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h1 className="text-xl font-extrabold text-slate-900 leading-tight">{form?.title}</h1>
          {form?.description && (
            <p className="text-xs text-slate-600 leading-relaxed">{form.description}</p>
          )}

          {form?.deadline_at && (
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 pt-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>마감 기한: {new Date(form.deadline_at).toLocaleString('ko-KR')}</span>
            </div>
          )}
        </div>

        {/* Error Warning Banner */}
        {validationError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Question Cards Stream (Stitch Design 5) */}
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const opts: string[] = Array.isArray(q.options) ? (q.options as string[]) : [];

            return (
              <div key={q.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-900 text-sm flex items-center space-x-1">
                    <span>{idx + 1}. {q.title}</span>
                    {q.required && <span className="text-rose-500 font-extrabold">*</span>}
                  </label>
                  {q.description && <p className="text-xs text-slate-500">{q.description}</p>}
                </div>

                {/* Render Question Input By Type */}
                {q.type === 'SHORT_TEXT' && (
                  <input
                    type="text"
                    placeholder="답변을 입력해 주세요"
                    value={answers[q.id] || ''}
                    onChange={(e) => handleSingleAnswerChange(q.id, e.target.value)}
                    className="w-full text-sm sm:text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {q.type === 'LONG_TEXT' && (
                  <textarea
                    rows={3}
                    placeholder="상세 내용을 작성해 주세요"
                    value={answers[q.id] || ''}
                    onChange={(e) => handleSingleAnswerChange(q.id, e.target.value)}
                    className="w-full text-sm sm:text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {q.type === 'SINGLE_CHOICE' && (
                  <div className="space-y-2 pt-1">
                    {opts.map((opt, oIdx) => (
                      <label key={oIdx} className="flex items-center space-x-3 p-2.5 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200 cursor-pointer transition">
                        <input
                          type="radio"
                          name={`q_${q.id}`}
                          checked={answers[q.id] === opt}
                          onChange={() => handleSingleAnswerChange(q.id, opt)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-800">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === 'MULTIPLE_CHOICE' && (
                  <div className="space-y-2 pt-1">
                    {opts.map((opt, oIdx) => {
                      const selectedList = (answers[q.id] || '').split(', ');
                      const isChecked = selectedList.includes(opt);
                      return (
                        <label key={oIdx} className="flex items-center space-x-3 p-2.5 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200 cursor-pointer transition">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleMultipleAnswerChange(q.id, opt)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-xs font-semibold text-slate-800">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {q.type === 'DROPDOWN' && (
                  <select
                    value={answers[q.id] || ''}
                    onChange={(e) => handleSingleAnswerChange(q.id, e.target.value)}
                    className="w-full text-sm sm:text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">선택해 주세요</option>
                    {opts.map((opt, oIdx) => (
                      <option key={oIdx} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {q.type === 'LINEAR_SCALE' && (
                  <div className="flex items-center justify-between space-x-2 pt-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleSingleAnswerChange(q.id, `${score}점`)}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition border ${
                          answers[q.id] === `${score}점`
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50'
                        }`}
                      >
                        {score}점
                      </button>
                    ))}
                  </div>
                )}

                {q.type === 'SATISFACTION' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between space-x-2">
                      {[1, 2, 3, 4, 5].map((score) => {
                        const currentAns = answers[q.id] || '';
                        const isSelected = currentAns.startsWith(`${score}점`);
                        return (
                          <button
                            key={score}
                            type="button"
                            onClick={() => handleSatisfactionRating(q.id, score)}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
                            }`}
                          >
                            {score}점
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-indigo-900 flex items-center space-x-1">
                        <span>평가 사유 작성</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="만족도 점수에 대한 사유를 작성해 주세요 (필수)"
                        value={satisfactionReasons[q.id] || ''}
                        onChange={(e) => handleSatisfactionReasonChange(q.id, e.target.value)}
                        className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 z-30">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleValidationAndOpenModal}
            disabled={submitting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-extrabold text-sm shadow-lg active:scale-95 transition disabled:opacity-50"
          >
            {isEditMode ? '응답 수정 완료하기' : '응답 제출하기'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {isEditMode ? '응답 수정 확인' : '응답 제출 확인'}
              </h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isEditMode
                ? '수정된 답변으로 저장하시겠습니까?\n텔레그램 채팅방에도 수정 내역이 업데이트됩니다.'
                : '응답을 제출하시겠습니까?\n제출 후 나중에 내 응답 메뉴에서 수정할 수 있습니다.'}
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                취소
              </button>
              <button
                onClick={handleSubmitFinal}
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                {submitting ? '처리 중...' : isEditMode ? '수정 저장' : '제출하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
