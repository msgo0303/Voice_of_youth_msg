import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireSuperAdmin(req);
  if (response) return response;

  const requestId = params.id;
  if (!requestId) {
    return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    const { data: request, error: fetchErr } = await supabase
      .from('admin_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return NextResponse.json({ error: 'Admin request not found' }, { status: 404 });
    }

    const { data: updatedReq, error: updateErr } = await supabase
      .from('admin_requests')
      .update({
        status: 'REJECTED',
        processed_at: new Date().toISOString(),
        processed_by: session.admin?.id || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.admin?.id || null
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${request.telegram_first_name}님의 관리자 신청이 거절 처리되었습니다.`,
      request: updatedReq
    });
  } catch (error: any) {
    console.error('Reject admin request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
