import { NextRequest, NextResponse } from 'next/server';
import { requireViewerOrAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { session, response } = await requireViewerOrAdmin(req);
  if (response) return response;

  try {
    const supabase = getServiceSupabase();

    // Run all dashboard queries concurrently (1 network roundtrip instead of sequential roundtrips)
    const [
      { count: activeFormsCount },
      { count: totalResponsesCount },
      { data: activeForms },
      { data: recentResponses },
      { data: responsesData }
    ] = await Promise.all([
      supabase.from('forms').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('responses').select('*', { count: 'exact', head: true }),
      supabase.from('forms').select('id, title, status, created_at, response_topic_id').eq('status', 'ACTIVE').order('created_at', { ascending: false }).limit(5),
      supabase.from('responses').select('id, form_id, telegram_first_name, telegram_username, submitted_at').order('submitted_at', { ascending: false }).limit(5),
      supabase.from('responses').select('form_id')
    ]);

    const countsMap: Record<string, number> = {};
    (responsesData || []).forEach((r) => {
      if (r.form_id) {
        countsMap[r.form_id] = (countsMap[r.form_id] || 0) + 1;
      }
    });

    const formStats = (activeForms || []).map((form) => ({
      ...form,
      responseCount: countsMap[form.id] || 0
    }));

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
