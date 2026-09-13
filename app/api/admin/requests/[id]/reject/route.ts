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
    return NextResponse.json({ error: '신청 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    const { data: request, error: fetchErr } = await supabase
      .from('admin_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return NextResponse.json({ error: '관리자 신청 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (request.status === 'REJECTED') {
      return NextResponse.json({ error: '이미 거절 처리된 관리자 신청입니다.' }, { status: 400 });
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: `PENDING 상태의 신청만 거절할 수 있습니다. (현재 상태: ${request.status})` }, { status: 400 });
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
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
