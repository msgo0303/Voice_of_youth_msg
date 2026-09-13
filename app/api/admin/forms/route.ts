import { NextRequest, NextResponse } from 'next/server';
import { requireViewerOrAdmin, requireAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/admin/forms - List forms with search and status filter
export async function GET(req: NextRequest) {
  const { response } = await requireViewerOrAdmin(req);
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ACTIVE';
    const query = searchParams.get('query') || '';

    const supabase = getServiceSupabase();
    let dbQuery = supabase
      .from('forms')
      .select('*')
      .order('created_at', { ascending: false });

    if (status !== 'ALL') {
      dbQuery = dbQuery.eq('status', status);
    }

    if (query) {
      dbQuery = dbQuery.ilike('title', `%${query}%`);
    }

    const [{ data: forms, error }, { data: responsesData }] = await Promise.all([
      dbQuery,
      supabase.from('responses').select('form_id')
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build response count map in memory (O(1) lookup per form)
    const countsMap: Record<string, number> = {};
    ((responsesData as Array<{ form_id: string }>) || []).forEach((r) => {
      if (r && r.form_id) {
        countsMap[r.form_id] = (countsMap[r.form_id] || 0) + 1;
      }
    });

    const formsWithCounts = (forms || []).map((form) => ({
      ...form,
      responseCount: countsMap[form.id] || 0
    }));

    return NextResponse.json({
      success: true,
      forms: formsWithCounts
    });
  } catch (error: any) {
    console.error('Admin forms GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/admin/forms - Create new form (Requires ADMIN or SUPER_ADMIN)
export async function POST(req: NextRequest) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  try {
    const body = await req.json();
    const { title, description, deadline_at, completion_message, response_chat_id, response_topic_id } = body;

    if (!title) {
      return NextResponse.json({ error: 'Form title is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: newForm, error } = await supabase
      .from('forms')
      .insert({
        title,
        description: description || null,
        status: 'ACTIVE', // Saved immediately as ACTIVE per spec
        deadline_at: deadline_at || null,
        completion_message: completion_message || '설문에 응답해 주셔서 감사합니다.',
        response_chat_id: response_chat_id || null,
        response_topic_id: response_topic_id || null
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      form: newForm
    }, { status: 201 });
  } catch (error: any) {
    console.error('Admin forms POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
