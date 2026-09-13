import { NextRequest, NextResponse } from 'next/server';
import { requireViewerOrAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { session, response } = await requireViewerOrAdmin(req);
  if (response) return response;

  try {
    const supabase = getServiceSupabase();

    // 1. Fetch active forms count
    const { count: activeFormsCount } = await supabase
      .from('forms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    // 2. Fetch total responses count
    const { count: totalResponsesCount } = await supabase
      .from('responses')
      .select('*', { count: 'exact', head: true });

    // 3. Fetch active forms list
    const { data: activeForms } = await supabase
      .from('forms')
      .select('id, title, status, created_at, response_topic_id')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(5);

    // 4. Fetch recent responses
    const { data: recentResponses } = await supabase
      .from('responses')
      .select('id, form_id, telegram_first_name, telegram_username, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(5);

    // 5. Aggregate response count per active form
    const formStats = await Promise.all(
      (activeForms || []).map(async (form) => {
        const { count } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('form_id', form.id);
        return {
          ...form,
          responseCount: count || 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      stats: {
        activeFormsCount: activeFormsCount || 0,
        totalResponsesCount: totalResponsesCount || 0,
        activeForms: formStats,
        recentResponses: recentResponses || []
      }
    });
  } catch (error: any) {
    console.error('Admin dashboard API error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
