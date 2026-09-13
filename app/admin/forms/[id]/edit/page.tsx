'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { QuestionType, ForumTopic, FormStatus } from '@/types/database';
import {
  Sparkles,
  Calendar,
  MessageSquare,
  Send,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  CheckCircle2,
  List,
  Type,
  AlignLeft,
  CheckSquare,
  Sliders,
  Smile,
  ArrowLeft
} from 'lucide-react';

interface EditableQuestion {
  id: string;
  title: string;
  description: string;
  type: QuestionType;
  options: string[];
  required: boolean;
}

export default function EditFormBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const formId = params.id as string;
  const { role, initData, telegramUserId, isAuthenticated } = useTelegramAuth();

  // Form Meta State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<FormStatus>('ACTIVE');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState('');
  const [completionMessage, setCompletionMessage] = useState('본 설문에 응답해 주셔서 진심으로 감사드립니다.');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [customChatId, setCustomChatId] = useState<string>('');
  const [customTopicId, setCustomTopicId] = useState<string>('');

  // Forum Topics Cache
  const [topics, setTopics] = useState<ForumTopic[]>([]);

  // Questions State
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);

  // Loading & error
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (initData) headers['x-telegram-init-data'] = initData;

    const effectiveUserId =
      telegramUserId ||
      (typeof window !== 'undefined' ? localStorage.getItem('formgram_test_user_id') : null);

    if (effectiveUserId) {
      headers['x-telegram-user-id'] = effectiveUserId.toString();
    }
    return headers;
  };

  useEffect(() => {
    async function loadFormAndTopics() {
      try {
        const [formRes, topicsRes] = await Promise.all([
          fetch(`/api/admin/forms/${formId}`, { headers: getAuthHeaders() }),
          fetch('/api/admin/topics', { headers: getAuthHeaders() })
        ]);

        const formJson = await formRes.json();
        const topicsJson = await topicsRes.json();

        if (topicsRes.ok && topicsJson.success) {
          setTopics(topicsJson.topics || []);
        }

        if (formRes.ok && formJson.success) {
          const f = formJson.form;
          setTitle(f.title || '');
          setDescription(f.description || '');
          setStatus(f.status || 'ACTIVE');
          setCompletionMessage(f.completion_message || '본 설문에 응답해 주셔서 진심으로 감사드립니다.');
          if (f.response_chat_id) setCustomChatId(f.response_chat_id.toString());
          if (f.response_topic_id) {
            setSelectedTopicId(f.response_topic_id.toString());
            setCustomTopicId(f.response_topic_id.toString());
          }

          if (f.deadline_at) {
            setHasDeadline(true);
            const d = new Date(f.deadline_at);
            setDeadlineAt(d.toISOString().slice(0, 16));
          }

          const qList = (formJson.questions || []).map((q: any) => ({
            id: q.id,
            title: q.title,
            description: q.description || '',
            type: q.type,
            options: q.options || [],
            required: q.required !== undefined ? q.required : true
          }));

          setQuestions(qList);
        } else {
          setError(formJson.error || '설문 정보를 불러오지 못했습니다.');
        }
      } catch (err: any) {
        setError(err.message || '네트워크 오류');
      } finally {
        setLoading(false);
      }
    }

    if ((isAuthenticated || initData || telegramUserId) && formId) {
      loadFormAndTopics();
    }
  }, [initData, telegramUserId, isAuthenticated, formId]);

  // Question Manipulations
  const addQuestion = (type: QuestionType) => {
    const newId = `q-${Date.now()}`;
    let defaultOptions: string[] = [];
    if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE' || type === 'DROPDOWN') {
      defaultOptions = ['선택지 1', '선택지 2'];
    }

    const newQ: EditableQuestion = {
      id: newId,
      title: '',
      description: '',
      type,
      options: defaultOptions,
      required: true
    };

    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (id: string, fields: Partial<EditableQuestion>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...fields } : q));
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setQuestions(updated);
  };

  const handleAddOption = (qId: string) => {
    const q = questions.find(item => item.id === qId);
    if (!q) return;
    if (q.options.length >= 20) {
      alert('옵션은 최대 20개까지 추가 가능합니다.');
      return;
    }
    updateQuestion(qId, { options: [...q.options, `선택지 ${q.options.length + 1}`] });
  };

  const handleUpdateOption = (qId: string, optIdx: number, val: string) => {
    const q = questions.find(item => item.id === qId);
    if (!q) return;
    const updatedOpts = [...q.options];
    updatedOpts[optIdx] = val;
    updateQuestion(qId, { options: updatedOpts });
  };

  const handleDeleteOption = (qId: string, optIdx: number) => {
    const q = questions.find(item => item.id === qId);
    if (!q) return;
    if (q.options.length <= 2) {
      alert('최소 2개 이상의 선택지가 필요합니다.');
      return;
    }
    updateQuestion(qId, { options: q.options.filter((_, i) => i !== optIdx) });
  };

  const handleSaveUpdate = async () => {
    if (!title.trim()) {
      alert('설문 제목을 입력해 주세요.');
      return;
    }

    if (questions.length === 0) {
      alert('최소 1개 이상의 질문이 필요합니다.');
      return;
    }

    setSaving(true);
    setError(null);

    const selectedTopic = topics.find(t => t.topic_id.toString() === selectedTopicId);

    const payload = {
      title,
      description,
      status,
      deadline_at: hasDeadline && deadlineAt ? new Date(deadlineAt).toISOString() : null,
      completion_message: completionMessage,
      response_chat_id: selectedTopic ? selectedTopic.chat_id : (customChatId ? Number(customChatId) : null),
      response_topic_id: selectedTopic ? selectedTopic.topic_id : (customTopicId ? Number(customTopicId) : null),
      questions: questions.map((q, idx) => ({
        title: q.title,
        description: q.description,
        type: q.type,
        options: q.options,
        required: q.required,
        order_index: idx
      }))
    };

    try {
      const res = await fetch(`/api/admin/forms/${formId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (res.ok && json.success) {
        alert('설문 및 질문이 성공적으로 수정되었습니다.');
        router.push('/admin/forms');
      } else {
        setError(json.error || '설문 수정 실패');
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
    } finally {
      setSaving(false);
    }
  };

  const isViewOnly = role === 'VIEWER';

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">설문 정보 불러오는 중...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-16 z-20">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.back()}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
              <span>설문 편집 (FormGram Editor)</span>
              <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full uppercase">
                {status}
              </span>
            </h1>
            <p className="text-xs text-slate-500">제목, 설명, 마감일 및 질문 수정</p>
          </div>
        </div>

        {!isViewOnly && (
          <button
            onClick={handleSaveUpdate}
            disabled={saving}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md active:scale-95 transition disabled:opacity-50 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? '수정 저장 중...' : '수정 사항 저장'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-xl">
          {error}
        </div>
      )}

      {/* Section 1: Form Meta Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <span>1. 설문 기본 정보 수정</span>
        </h2>

        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
            <span>설문 제목</span>
            <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-base font-semibold px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Description Textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">설문 상세 설명</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Status Select & Deadline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Status Select */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="text-xs font-bold text-slate-800">설문 상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FormStatus)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ACTIVE">ACTIVE (진행 중)</option>
              <option value="CLOSED">CLOSED (종료됨)</option>
              <option value="ARCHIVED">ARCHIVED (보관됨)</option>
            </select>
          </div>

          {/* Deadline Toggle & Input */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>응답 마감 기한</span>
              </label>
              <input
                type="checkbox"
                checked={hasDeadline}
                onChange={(e) => setHasDeadline(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
            {hasDeadline && (
              <input
                type="datetime-local"
                value={deadlineAt}
                onChange={(e) => setDeadlineAt(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Telegram Topic Select & Manual Input */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <Send className="w-4 h-4 text-blue-600" />
              <span>텔레그램 전송 토픽</span>
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">토픽 선택 (등록된 목록에서 선택)</option>
              {topics.map((t) => (
                <option key={t.id} value={t.topic_id}>
                  📌 토픽 #{t.topic_id}: {t.topic_name}
                </option>
              ))}
              <option value="custom">✍️ 직접 수동 입력 (Chat ID & Topic ID)</option>
            </select>

            {(selectedTopicId === 'custom' || (!topics.some(t => t.topic_id.toString() === selectedTopicId) && (customChatId || customTopicId))) && (
              <div className="pt-2 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Chat ID (예: -100123456789)"
                  value={customChatId}
                  onChange={(e) => setCustomChatId(e.target.value)}
                  className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                />
                <input
                  type="text"
                  placeholder="Topic ID (예: 2)"
                  value={customTopicId}
                  onChange={(e) => setCustomTopicId(e.target.value)}
                  className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* Completion Message */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-bold text-slate-700">제출 완료 메시지</label>
          <input
            type="text"
            value={completionMessage}
            onChange={(e) => setCompletionMessage(e.target.value)}
            className="w-full text-xs px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Section 2: Questions Editor */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <List className="w-5 h-5 text-indigo-600" />
          <span>2. 질문 목록 수정 ({questions.length}개 질문)</span>
        </h2>

        <div className="space-y-4">
          {questions.map((q, index) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 relative group hover:border-blue-300 transition"
            >
              {/* Question Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 uppercase">
                    {q.type}
                  </span>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => moveQuestion(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveQuestion(index, 'down')}
                    disabled={index === questions.length - 1}
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Question Title & Description */}
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="질문 제목"
                  value={q.title}
                  onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                  className="w-full text-sm font-bold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="text"
                  placeholder="질문 설명 (선택 사항)"
                  value={q.description}
                  onChange={(e) => updateQuestion(q.id, { description: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Options Editor */}
              {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE' || q.type === 'DROPDOWN') && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700">선택지 목록 (최소 2개 ~ 최대 20개)</label>
                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400 font-bold w-4 text-center">{optIdx + 1}.</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleUpdateOption(q.id, optIdx, e.target.value)}
                          className="flex-1 text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                        />
                        <button
                          onClick={() => handleDeleteOption(q.id, optIdx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleAddOption(q.id)}
                    className="text-xs text-blue-600 font-bold hover:underline flex items-center space-x-1 pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>선택지 추가</span>
                  </button>
                </div>
              )}

              {/* Required Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-500 font-medium">질문 설정</span>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700">필수 항목</span>
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Add Question Buttons */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-md space-y-3">
          <p className="text-xs font-bold text-slate-700">새 질문 유형 추가하기</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => addQuestion('SHORT_TEXT')}
              className="p-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition"
            >
              <Type className="w-4 h-4" />
              <span>단답형</span>
            </button>
            <button
              onClick={() => addQuestion('LONG_TEXT')}
              className="p-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition"
            >
              <AlignLeft className="w-4 h-4" />
              <span>장문형</span>
            </button>
            <button
              onClick={() => addQuestion('SINGLE_CHOICE')}
              className="p-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition"
            >
              <CheckSquare className="w-4 h-4" />
              <span>객관식 (단일)</span>
            </button>
            <button
              onClick={() => addQuestion('MULTIPLE_CHOICE')}
              className="p-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition"
            >
              <CheckSquare className="w-4 h-4" />
              <span>객관식 (복수)</span>
            </button>
            <button
              onClick={() => addQuestion('DROPDOWN')}
              className="p-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition"
            >
              <List className="w-4 h-4" />
              <span>드롭다운</span>
            </button>
            <button
              onClick={() => addQuestion('LINEAR_SCALE')}
              className="p-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition"
            >
              <Sliders className="w-4 h-4" />
              <span>선형 배율 (1~5)</span>
            </button>
            <button
              onClick={() => addQuestion('SATISFACTION')}
              className="p-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition"
            >
              <Smile className="w-4 h-4" />
              <span>만족도 + 사유</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
