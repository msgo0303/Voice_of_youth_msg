import { NextRequest, NextResponse } from 'next/server';
import { requireViewerOrAdmin, requireAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/admin/forms/[id]/responses - Fetch all submitted responses for a form
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireViewerOrAdmin(req);
  if (response) return response;

  const formId = params.id;
  if (!formId) {
    return NextResponse.json({ error: '설문 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    // 1. Fetch form metadata
    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('id, title, status')
      .eq('id', formId)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. Fetch responses for this form ordered by submitted_at DESC
    const { data: responses, error: respErr } = await supabase
      .from('responses')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false });

    if (respErr) {
      return NextResponse.json({ error: respErr.message }, { status: 500 });
    }

    if (!responses || responses.length === 0) {
      return NextResponse.json({
        success: true,
        formTitle: (form as any).title,
        responses: []
      });
    }

    // 3. Fetch all answer rows for these responses
    const responseIds = ((responses as any[]) || []).map(r => r.id);
    const { data: answers, error: ansErr } = await supabase
      .from('response_answers')
      .select('*')
      .in('response_id', responseIds);

    if (ansErr) {
      return NextResponse.json({ error: ansErr.message }, { status: 500 });
    }

    // 4. Map answers back to each response
    const answersByResponseId: Record<string, any[]> = {};
    ((answers as any[]) || []).forEach(ans => {
      if (!answersByResponseId[ans.response_id]) {
        answersByResponseId[ans.response_id] = [];
      }
      answersByResponseId[ans.response_id].push(ans);
    });

    const fullResponses = ((responses as any[]) || []).map(r => ({
      ...r,
      answers: answersByResponseId[r.id] || []
    }));

    return NextResponse.json({
      success: true,
      formTitle: (form as any).title,
      responses: fullResponses
    });
  } catch (error: any) {
    console.error('Fetch form responses error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/admin/forms/[id]/responses?responseId=UUID
// 관리자가 특정 응답을 DB에서 영구 삭제 (CASCADE로 하위 답변도 함께 삭제)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  const formId = params.id;
  const searchParams = req.nextUrl?.searchParams;
  let responseId = searchParams?.get('responseId');

  if (!responseId) {
    try {
      const body = await req.json();
      responseId = body.responseId;
    } catch {}
  }

  if (!formId || !responseId) {
    return NextResponse.json({ error: '설문 ID와 삭제할 응답 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    // Verify response exists and belongs to this form
    const { data: existingResp, error: fetchErr } = await supabase
      .from('responses')
      .select('id, form_id')
      .eq('id', responseId)
      .eq('form_id', formId)
      .maybeSingle();

    if (fetchErr || !existingResp) {
      return NextResponse.json({ error: '해당 응답을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Delete response from Supabase DB (Foreign key cascade will delete response_answers automatically)
    const { error: delErr } = await supabase
      .from('responses')
      .delete()
      .eq('id', responseId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '응답이 DB에서 영구 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('Delete form response error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
