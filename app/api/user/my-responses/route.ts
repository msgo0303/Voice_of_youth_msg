import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/user/my-responses - Fetch all survey responses submitted by the current Telegram user
export async function GET(req: NextRequest) {
  const session = await getAuthSessionFromRequest(req);

  if (!session.authenticated || !session.user) {
    return NextResponse.json(
      { error: '인증 오류: 텔레그램 계정 인증이 필요합니다.' },
      { status: 401 }
    );
  }

  const telegramUserId = session.user.id;

  try {
    const supabase = getServiceSupabase();

    // Query user responses joined with form metadata
    const { data: responses, error } = await supabase
      .from('responses')
      .select(`
        id,
        form_id,
        submitted_at,
        updated_at,
        is_edited,
        telegram_message_id,
        forms:form_id (
          id,
          title,
          description,
          status,
          deadline_at,
          completion_message
        )
      `)
      .eq('telegram_user_id', telegramUserId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Fetch my-responses error:', error);
      return NextResponse.json({ error: '응답 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      responses: responses || []
    });
  } catch (err: any) {
    console.error('My responses route error:', err);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
