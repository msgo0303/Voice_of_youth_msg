'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { QuestionType, ForumTopic } from '@/types/database';
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
  HelpCircle,
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

const DEFAULT_QUESTIONS: EditableQuestion[] = [
  {
    id: 'default-1',
    title: '지역',
    description: '소속된 지역구를 선택해 주세요.',
    type: 'DROPDOWN',
    options: ['사당', '안양', '신림', '신사', '군포', '서울역', '새신자', '대학'],
    required: true
  },
  {
    id: 'default-2',
    title: '직분',
    description: '교회 직분을 입력해 주세요 (예: 청년, 성도, 집사 등)',
    type: 'SHORT_TEXT',
    options: [],
    required: true
  },
  {
    id: 'default-3',
    title: '이름',
    description: '성함을 입력해 주세요.',
    type: 'SHORT_TEXT',
    options: [],
    required: true
  }
];

export default function NewFormBuilderPage() {
  const router = useRouter();
  const { role, initData } = useTelegramAuth();

  // Form Meta State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState('');
  const [completionMessage, setCompletionMessage] = useState('본 설문에 응답해 주셔서 진심으로 감사드립니다.');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  // Forum Topics Cache
  const [topics, setTopics] = useState<ForumTopic[]>([]);

  // Questions State (Pre-filled with Step 7 Default Template)
  const [questions, setQuestions] = useState<EditableQuestion[]>(DEFAULT_QUESTIONS);

  // UI loading states
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopics() {
      try {
        const res = await fetch('/api/admin/topics', {
          headers: { 'x-telegram-init-data': initData }
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setTopics(json.topics || []);
          if (json.topics?.length > 0) {
            setSelectedTopicId(json.topics[0].topic_id.toString());
          }
        }
      } catch (err) {
        console.error('Failed to fetch topics:', err);
      }
    }

    if (initData) fetchTopics();
  }, [initData]);

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

  const handleSaveAndActivate = async () => {
    if (!title.trim()) {
      alert('설문 제목을 입력해 주세요.');
      return;
    }

    if (questions.length === 0) {
      alert('최소 1개 이상의 질문이 필요합니다.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].title.trim()) {
        alert(`질문 #${i + 1}의 제목을 입력해 주세요.`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    const selectedTopic = topics.find(t => t.topic_id.toString() === selectedTopicId);

    const payload = {
      title,
      description,
      deadline_at: hasDeadline && deadlineAt ? new Date(deadlineAt).toISOString() : null,
      completion_message: completionMessage,
      response_chat_id: selectedTopic ? selectedTopic.chat_id : null,
      response_topic_id: selectedTopic ? selectedTopic.topic_id : null,
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
      const res = await fetch('/api/admin/forms/full', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (res.ok && json.success) {
        alert('설문이 성공적으로 생성되고 즉시 활성화(ACTIVE) 되었습니다!');
        router.push('/admin/forms');
      } else {
        setError(json.error || '설문 저장 실패');
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
    } finally {
      setSaving(false);
    }
  };

  const isViewOnly = role === 'VIEWER';

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
              <span>FormGram (폼그램) 설문 빌더</span>
              <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full uppercase">
                ACTIVE MODE
              </span>
            </h1>
            <p className="text-xs text-slate-500">Google Forms 형태의 설문 제작 및 질문 편집기</p>
          </div>
        </div>

        {!isViewOnly && (
          <button
            onClick={handleSaveAndActivate}
            disabled={saving}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md active:scale-95 transition disabled:opacity-50 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? '저장 중...' : '저장 & 활성화'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-xl">
          {error}
        </div>
      )}

      {/* Preset Banner (Step 7 Default Template) */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-start space-x-3">
        <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-blue-900 text-sm">기본 필수 질문 자동 바인딩 완료</h3>
          <p className="text-xs text-blue-700 mt-0.5">
            신원 확인용 기본 질문 (<strong>지역, 직분, 이름</strong>) 3건이 자동으로 구성되었습니다. 필요 시 순서 변경 및 수정이 가능합니다.
          </p>
        </div>
      </div>

      {/* Section 1: Form Meta Settings (Step 5) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <span>1. 설문 기본 정보</span>
        </h2>

        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
            <span>설문 제목</span>
            <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="참여자에게 표시될 설문 제목을 입력하세요 (예: 2025 상반기 청소년부 교육 만족도 조사)"
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
            placeholder="설문의 목적 및 안내사항을 작성해 주세요."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Deadline & Topic Settings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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

          {/* Telegram Topic Select */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <Send className="w-4 h-4 text-blue-600" />
              <span>텔레그램 응답 전송 토픽</span>
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">토픽 지정 안 함 (전체/기본 채팅방 전송)</option>
              {topics.map((t) => (
                <option key={t.id} value={t.topic_id}>
                  📌 토픽 #{t.topic_id}: {t.topic_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Completion Message */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-bold text-slate-700">제출 완료 메시지 (참여자 안내용)</label>
          <input
            type="text"
            value={completionMessage}
            onChange={(e) => setCompletionMessage(e.target.value)}
            className="w-full text-xs px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Section 2: Question Editor (Step 6) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <List className="w-5 h-5 text-indigo-600" />
            <span>2. 질문 편집기 ({questions.length}개 질문)</span>
          </h2>
        </div>

        {/* Question Cards List */}
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
                  placeholder="질문 제목을 입력하세요"
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

              {/* Options Editor for Choice/Dropdown */}
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

              {/* Special Type Indicators */}
              {q.type === 'LINEAR_SCALE' && (
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 font-medium">
                  선형 배율: 고정 1 ~ 5점 평가 척도 제공
                </div>
              )}

              {q.type === 'SATISFACTION' && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-800 font-medium">
                  만족도 평가: 고정 1 ~ 5점 만족도 + 사유 필수 입력 필드 결합
                </div>
              )}

              {/* Required Toggle Footer */}
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

        {/* Add Question Floating Trigger Bar */}
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
