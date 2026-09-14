import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// POST /api/admin/forms/[id]/duplicate - Duplicate form metadata & questions as CLOSED status (no responses copied)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  const formId = params.id;
  if (!formId) {
    return NextResponse.json({ error: '설문 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    // 1. Fetch original form
    const { data: originalForm, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formErr || !originalForm) {
      return NextResponse.json({ error: '복사할 설문을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. Fetch original questions
    const { data: originalQuestions, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    if (qErr) {
      return NextResponse.json({ error: `질문 정보를 불러올 수 없습니다: ${qErr.message}` }, { status: 500 });
    }

    // 3. Create duplicated form (status = CLOSED per spec, title allows duplicate)
    const { data: newForm, error: createFormErr } = await supabase
      .from('forms')
      .insert({
        title: `${originalForm.title} (복사본)`,
        description: originalForm.description || null,
        status: 'CLOSED', // Duplicated form starts as CLOSED
        deadline_at: originalForm.deadline_at || null,
        completion_message: originalForm.completion_message || '설문에 응답해 주셔서 감사합니다.',
        response_chat_id: originalForm.response_chat_id || null,
        response_topic_id: originalForm.response_topic_id || null
      })
      .select()
      .single();

    if (createFormErr || !newForm) {
      return NextResponse.json({ error: `설문 복사 실패: ${createFormErr?.message}` }, { status: 500 });
    }

    // 4. Duplicate questions if any
    if (originalQuestions && originalQuestions.length > 0) {
      const questionRows = originalQuestions.map((q: any) => ({
        form_id: newForm.id,
        title: q.title,
        description: q.description || null,
        type: q.type,
        options: q.options || [],
        required: q.required !== undefined ? q.required : true,
        order_index: q.order_index
      }));

      const { error: insertQErr } = await supabase
        .from('questions')
        .insert(questionRows);

      if (insertQErr) {
        // Rollback created form
        await supabase.from('forms').delete().eq('id', newForm.id);
        return NextResponse.json({ error: `질문 복사 실패: ${insertQErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: '설문 설정 및 질문이 종료(CLOSED) 상태로 복사되었습니다. (기존 응답은 복사되지 않음)',
      form: newForm
    }, { status: 201 });
  } catch (error: any) {
    console.error('Duplicate form error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
