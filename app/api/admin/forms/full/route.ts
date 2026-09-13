import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { QuestionType } from '@/types/database';
import { encodeQuestionForDb, decodeQuestionFromDb } from '@/lib/questionTypeMapper';

export interface QuestionPayload {
  title: string;
  description?: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  order_index: number;
}

// POST /api/admin/forms/full - Create form with questions atomically
export async function POST(req: NextRequest) {
  const { session, response } = await requireAdmin(req);
  if (response) return response;

  try {
    const body = await req.json();
    const {
      title,
      description,
      deadline_at,
      completion_message,
      response_chat_id,
      response_topic_id,
      questions
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: '설문 제목을 입력해 주세요.' }, { status: 400 });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: '최소 1개 이상의 질문을 추가해 주세요.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Insert form row (saved immediately as ACTIVE per spec)
    const { data: newForm, error: formError } = await supabase
      .from('forms')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        status: 'ACTIVE',
        deadline_at: deadline_at || null,
        completion_message: completion_message?.trim() || '설문에 응답해 주셔서 감사합니다.',
        response_chat_id: response_chat_id ? Number(response_chat_id) : null,
        response_topic_id: response_topic_id ? Number(response_topic_id) : null
      })
      .select()
      .single();

    if (formError || !newForm) {
      return NextResponse.json({ error: formError?.message || '설문 생성 실패' }, { status: 500 });
    }

    // 2. Format questions for insertion with DB constraint mapping
    const questionRows = questions.map((q: QuestionPayload, idx: number) => {
      const encoded = encodeQuestionForDb({
        ...q,
        order_index: idx
      });
      return {
        form_id: newForm.id,
        title: encoded.title.trim(),
        description: encoded.description?.trim() || null,
        type: encoded.type,
        options: encoded.options || [],
        required: encoded.required !== undefined ? encoded.required : true,
        order_index: idx
      };
    });

    const { data: createdQuestions, error: qError } = await supabase
      .from('questions')
      .insert(questionRows)
      .select();

    if (qError) {
      // Rollback form creation if question insertion fails
      await supabase.from('forms').delete().eq('id', newForm.id);
      return NextResponse.json({ error: `질문 저장 중 오류: ${qError.message}` }, { status: 500 });
    }

    const decodedQuestions = (createdQuestions || []).map(q => decodeQuestionFromDb(q));

    return NextResponse.json({
      success: true,
      message: '설문이 성공적으로 생성되고 즉시 활성화(ACTIVE)되었습니다.',
      form: newForm,
      questions: decodedQuestions
    }, { status: 201 });
  } catch (error: any) {
    console.error('Full form creation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

