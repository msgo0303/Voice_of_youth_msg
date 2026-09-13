import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { decodeQuestionFromDb } from '@/lib/questionTypeMapper';

// GET /api/admin/forms/[id]/export - Generate downloadable UTF-8 CSV of all survey responses
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const formId = params.id;
  if (!formId) {
    return NextResponse.json({ error: '설문 ID가 필요합니다.' }, { status: 400 });
  }

  // 1. RBAC Auth Check (SUPER_ADMIN, ADMIN, VIEWER allowed)
  const session = await getAuthSessionFromRequest(req);
  if (!session.authenticated || !['SUPER_ADMIN', 'ADMIN', 'VIEWER'].includes(session.role)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const supabase = getServiceSupabase();

    // 2. Fetch Form metadata
    const { data: form } = await supabase
      .from('forms')
      .select('id, title')
      .eq('id', formId)
      .single();

    if (!form) {
      return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 3. Fetch Questions
    const { data: rawQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    const questions = (rawQuestions || []).map((q: any) => decodeQuestionFromDb(q));

    // 4. Fetch all Responses with Answer rows
    const { data: responses } = await supabase
      .from('responses')
      .select(`
        id,
        telegram_user_id,
        telegram_first_name,
        telegram_username,
        submitted_at,
        updated_at,
        is_edited,
        response_answers (
          question_id,
          answer_value
        )
      `)
      .eq('form_id', formId)
      .order('submitted_at', { ascending: true });

    // 5. Build CSV Rows with UTF-8 BOM (\uFEFF) for Excel compatibility
    const escapeCsv = (str: string) => {
      const clean = String(str || '').replace(/"/g, '""');
      return `"${clean}"`;
    };

    const headers = [
      '응답 ID',
      '제출 일시',
      '수정 일시',
      '수정 여부',
      '텔레그램 User ID',
      '응답자 이름',
      '텔레그램 Username',
      ...questions.map((q: any, idx: number) => `Q${idx + 1}. ${q.title}`)
    ];

    const csvLines: string[] = [headers.map(escapeCsv).join(',')];

    responses?.forEach((resp: any) => {
      const answerMap: Record<string, string> = {};
      resp.response_answers?.forEach((ans: any) => {
        answerMap[ans.question_id] = ans.answer_value || '';
      });

      const row = [
        resp.id,
        new Date(resp.submitted_at).toLocaleString('ko-KR'),
        new Date(resp.updated_at).toLocaleString('ko-KR'),
        resp.is_edited ? '수정됨' : '최초 제출',
        resp.telegram_user_id,
        resp.telegram_first_name || '이용자',
        resp.telegram_username ? `@${resp.telegram_username}` : '',
        ...questions.map((q: any) => answerMap[q.id] || '')
      ];

      csvLines.push(row.map(escapeCsv).join(','));
    });

    const csvContent = '\uFEFF' + csvLines.join('\n');
    const safeTitle = form.title.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const filename = `FormGram_${safeTitle}_responses.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
      }
    });
  } catch (err: any) {
    console.error('Export CSV error:', err);
    return NextResponse.json({ error: 'CSV 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
