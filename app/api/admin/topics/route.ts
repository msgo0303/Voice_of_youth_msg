import { NextRequest, NextResponse } from 'next/server';
import { requireViewerOrAdmin, requireAdmin } from '@/lib/auth';
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

// POST /api/admin/topics - Manually register / update a forum topic
export async function POST(req: NextRequest) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  try {
    const body = await req.json();
    const { chat_id, topic_id, topic_name } = body;

    if (!chat_id || !topic_id || !topic_name || !topic_name.trim()) {
      return NextResponse.json(
        { error: 'chat_id, topic_id, topic_name은 필수 입력값입니다.' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data: topic, error } = await supabase
      .from('forum_topics')
      .upsert(
        {
          chat_id: Number(chat_id),
          topic_id: Number(topic_id),
          topic_name: topic_name.trim()
        },
        { onConflict: 'chat_id,topic_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '토픽이 성공적으로 수동 등록/업데이트되었습니다.',
      topic
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create topic error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/admin/topics - Remove a cached topic from DB
export async function DELETE(req: NextRequest) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const topicDbId = searchParams.get('id');

    if (!topicDbId) {
      return NextResponse.json({ error: 'Topic Database ID is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('forum_topics')
      .delete()
      .eq('id', topicDbId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '토픽 캐시가 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('Delete topic error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
