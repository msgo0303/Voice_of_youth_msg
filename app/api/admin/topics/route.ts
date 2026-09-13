import { NextRequest, NextResponse } from 'next/server';
import { requireViewerOrAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/admin/topics - Fetch cached Telegram forum topics
export async function GET(req: NextRequest) {
  const { response } = await requireViewerOrAdmin(req);
  if (response) return response;

  try {
    const supabase = getServiceSupabase();
    const { data: topics, error } = await supabase
      .from('forum_topics')
      .select('*')
      .order('topic_name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      topics: topics || []
    });
  } catch (error: any) {
    console.error('Fetch topics error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
