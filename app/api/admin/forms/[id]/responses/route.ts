import { NextRequest, NextResponse } from 'next/server';
import { requireViewerOrAdmin } from '@/lib/auth';
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
        formTitle: form.title,
        responses: []
      });
    }

    // 3. Fetch all answer rows for these responses
    const responseIds = responses.map(r => r.id);
    const { data: answers, error: ansErr } = await supabase
      .from('response_answers')
      .select('*')
      .in('response_id', responseIds);

    if (ansErr) {
      return NextResponse.json({ error: ansErr.message }, { status: 500 });
    }

    // 4. Map answers back to each response
    const answersByResponseId: Record<string, any[]> = {};
    (answers || []).forEach(ans => {
      if (!answersByResponseId[ans.response_id]) {
        answersByResponseId[ans.response_id] = [];
      }
      answersByResponseId[ans.response_id].push(ans);
    });

    const fullResponses = responses.map(r => ({
      ...r,
      answers: answersByResponseId[r.id] || []
    }));

    return NextResponse.json({
      success: true,
      formTitle: form.title,
      responses: fullResponses
    });
  } catch (error: any) {
    console.error('Fetch form responses error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
