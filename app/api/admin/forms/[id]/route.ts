import { NextRequest, NextResponse } from 'next/server';
import { requireViewerOrAdmin, requireAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { QuestionPayload } from '@/app/api/admin/forms/full/route';

// GET /api/admin/forms/[id] - Fetch form details and its questions
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireViewerOrAdmin(req);
  if (response) return response;

  const formId = params.id;
  if (!formId) {
    return NextResponse.json({ error: 'Form ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    // 1. Fetch form metadata
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // 2. Fetch questions ordered by order_index
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('*')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    if (qError) {
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }

    // 3. Fetch response count
    const { count } = await supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', formId);

    return NextResponse.json({
      success: true,
      form: {
        ...form,
        responseCount: count || 0
      },
      questions: questions || []
    });
  } catch (error: any) {
    console.error('Fetch form detail error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/admin/forms/[id] - Update existing form metadata & questions safely
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  const formId = params.id;
  if (!formId) {
    return NextResponse.json({ error: 'Form ID is required' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      status,
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
      return NextResponse.json({ error: '최소 1개 이상의 질문이 필요합니다.' }, { status: 400 });
    }

    // Server-side validation: Check max 1 '지역' (Region) question per form
    const regionQuestions = questions.filter(
      (q: QuestionPayload) => q.title.trim() === '지역'
    );
    if (regionQuestions.length > 1) {
      return NextResponse.json({ error: '하나의 설문에서 \'지역\' 질문은 최대 1개만 포함할 수 있습니다.' }, { status: 400 });
    }

    // Server-side validation: Options count 2~20 for choice/dropdown types
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.title || !q.title.trim()) {
        return NextResponse.json({ error: `질문 #${i + 1}의 제목을 입력해 주세요.` }, { status: 400 });
      }

      if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE' || q.type === 'DROPDOWN') {
        const opts = q.options || [];
        if (opts.length < 2 || opts.length > 20) {
          return NextResponse.json(
            { error: `질문 "${q.title}"의 선택지는 최소 2개 이상, 최대 20개 이하이어야 합니다.` },
            { status: 400 }
          );
        }
      }
    }

    const supabase = getServiceSupabase();

    // 1. Update form metadata
    const { data: updatedForm, error: updateFormErr } = await supabase
      .from('forms')
      .update({
        title: title.trim(),
        description: description?.trim() || null,
        status: status && ['ACTIVE', 'CLOSED', 'ARCHIVED'].includes(status) ? status : 'ACTIVE',
        deadline_at: deadline_at || null,
        completion_message: completion_message?.trim() || '설문에 응답해 주셔서 감사합니다.',
        response_chat_id: response_chat_id ? Number(response_chat_id) : null,
        response_topic_id: response_topic_id ? Number(response_topic_id) : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', formId)
      .select()
      .single();

    if (updateFormErr || !updatedForm) {
      return NextResponse.json({ error: updateFormErr?.message || 'Form update failed' }, { status: 500 });
    }

    // 2. Safely replace questions without touching response_answers table
    // Delete existing questions for this form
    await supabase.from('questions').delete().eq('form_id', formId);

    // Re-insert updated questions
    const questionRows = questions.map((q: QuestionPayload, idx: number) => ({
      form_id: formId,
      title: q.title.trim(),
      description: q.description?.trim() || null,
      type: q.type,
      options: q.options || [],
      required: q.required !== undefined ? q.required : true,
      order_index: idx
    }));

    const { data: updatedQuestions, error: qInsertErr } = await supabase
      .from('questions')
      .insert(questionRows)
      .select();

    if (qInsertErr) {
      return NextResponse.json({ error: `질문 갱신 실패: ${qInsertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '설문 및 질문 수정이 완료되었습니다.',
      form: updatedForm,
      questions: updatedQuestions
    });
  } catch (error: any) {
    console.error('Update form error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
