import { NextRequest, NextResponse } from 'next/server';
import { requireViewerOrAdmin, requireAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { QuestionPayload } from '@/app/api/admin/forms/full/route';
import { encodeQuestionForDb, decodeQuestionFromDb } from '@/lib/questionTypeMapper';

// GET /api/admin/forms/[id] - Fetch form details and its questions (Publicly readable for active surveys)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const formId = params.id;
  if (!formId) {
    return NextResponse.json({ error: '설문 ID가 필요합니다.' }, { status: 400 });
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
      return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
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

    // Decode questions DB constraints to UI types
    const decodedQuestions = (questions || []).map((q: any) => decodeQuestionFromDb(q));

    // 3. Fetch response count
    const { count } = await supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', formId);

    return NextResponse.json({
      success: true,
      form: {
        ...(form as object),
        responseCount: count || 0
      },
      questions: decodedQuestions
    });
  } catch (error: any) {
    console.error('Fetch form detail error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
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
    return NextResponse.json({ error: '설문 ID가 필요합니다.' }, { status: 400 });
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
      return NextResponse.json({ error: updateFormErr?.message || '설문 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    // 2. Safely replace questions without touching response_answers table
    // Delete existing questions for this form
    await supabase.from('questions').delete().eq('form_id', formId);

    // Re-insert updated questions with DB constraint mapping
    const questionRows = questions.map((q: QuestionPayload, idx: number) => {
      const encoded = encodeQuestionForDb({
        ...q,
        order_index: idx
      });
      return {
        form_id: formId,
        title: encoded.title.trim(),
        description: encoded.description?.trim() || null,
        type: encoded.type,
        options: encoded.options || [],
        required: encoded.required !== undefined ? encoded.required : true,
        order_index: idx
      };
    });

    const { data: updatedQuestions, error: qInsertErr } = await supabase
      .from('questions')
      .insert(questionRows)
      .select();

    if (qInsertErr) {
      return NextResponse.json({ error: `질문 갱신 실패: ${qInsertErr.message}` }, { status: 500 });
    }

    const decodedQuestions = (updatedQuestions || []).map((q: any) => decodeQuestionFromDb(q));

    return NextResponse.json({
      success: true,
      message: '설문 및 질문 수정이 완료되었습니다.',
      form: updatedForm,
      questions: decodedQuestions
    });
  } catch (error: any) {
    console.error('Update form error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/admin/forms/[id] - Quick update form status or response topic
export async function PATCH(
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
    const body = await req.json();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (body.status && ['ACTIVE', 'CLOSED', 'ARCHIVED'].includes(body.status)) {
      updateData.status = body.status;
    }

    if (body.response_chat_id !== undefined) {
      updateData.response_chat_id = body.response_chat_id ? Number(body.response_chat_id) : null;
    }

    if (body.response_topic_id !== undefined) {
      updateData.response_topic_id = body.response_topic_id ? Number(body.response_topic_id) : null;
    }

    const supabase = getServiceSupabase();
    const { data: form, error } = await supabase
      .from('forms')
      .update(updateData)
      .eq('id', formId)
      .select()
      .single();

    if (error || !form) {
      return NextResponse.json({ error: error?.message || '설문 설정 업데이트 실패' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '설문 설정이 성공적으로 업데이트되었습니다.',
      form
    });
  } catch (error: any) {
    console.error('Patch form status error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/admin/forms/[id] - Permanently delete form if 0 responses, block if responses exist (Archive required)
export async function DELETE(
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

    // 1. Check response count for this form
    const { count, error: countErr } = await supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', formId);

    if (countErr) {
      return NextResponse.json({ error: `응답 수 확인 실패: ${countErr.message}` }, { status: 500 });
    }

    if (count && count > 0) {
      return NextResponse.json({
        error: `제출된 응답이 ${count}건 존재하므로 영구 삭제할 수 없습니다. 데이터 보존을 위해 보관(ARCHIVED) 상태로 변경해 주세요.`
      }, { status: 400 });
    }

    // 2. Delete form (questions cascade automatically or via explicit deletion)
    await supabase.from('questions').delete().eq('form_id', formId);
    const { error: deleteErr } = await supabase
      .from('forms')
      .delete()
      .eq('id', formId);

    if (deleteErr) {
      return NextResponse.json({ error: `설문 삭제 실패: ${deleteErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '설문이 성공적으로 영구 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('Delete form error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}


