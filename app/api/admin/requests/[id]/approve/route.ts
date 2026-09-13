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

    // 1. Fetch the request
    const { data: request, error: fetchErr } = await supabase
      .from('admin_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return NextResponse.json({ error: 'Admin request not found' }, { status: 404 });
    }

    if (request.status === 'APPROVED') {
      return NextResponse.json({ error: '이미 승인된 관리자 신청입니다.' }, { status: 400 });
    }

    const assignedRole = request.requested_role === 'VIEWER' ? 'VIEWER' : 'ADMIN';

    // 2. Update request status to APPROVED
    await supabase
      .from('admin_requests')
      .update({
        status: 'APPROVED',
        processed_at: new Date().toISOString(),
        processed_by: session.admin?.id || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.admin?.id || null
      })
      .eq('id', requestId);

    // 3. Upsert into admins table as ACTIVE
    const { data: updatedAdmin, error: adminErr } = await supabase
      .from('admins')
      .upsert(
        {
          telegram_user_id: request.telegram_user_id,
          telegram_username: request.telegram_username,
          telegram_first_name: request.telegram_first_name,
          role: assignedRole,
          status: 'ACTIVE',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'telegram_user_id' }
      )
      .select()
      .single();

    if (adminErr) {
      return NextResponse.json({ error: adminErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${request.telegram_first_name}님의 관리자 권한(${assignedRole}) 승인이 완료되었습니다.`,
      admin: updatedAdmin
    });
  } catch (error: any) {
    console.error('Approve admin request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
