import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { notifySuperAdminNewRequest } from '@/lib/telegramBot';

// POST /api/user/admin-request - Apply for Admin role
export async function POST(req: NextRequest) {
  const session = await getAuthSessionFromRequest(req);

  if (!session.authenticated || !session.user) {
    return NextResponse.json({ error: '인증 오류: 텔레그램 계정 인증이 필요합니다.' }, { status: 401 });
  }

  const { id: telegramUserId, first_name, username } = session.user;

  try {
    const supabase = getServiceSupabase();

    // 1. Check if user is already an ACTIVE admin
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('id, status, role')
      .eq('telegram_user_id', telegramUserId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (existingAdmin) {
      return NextResponse.json(
        { error: '이미 ACTIVE 관리자로 등록되어 있어 신청할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 2. Check for PENDING request in admin_requests
    const { data: pendingReq } = await supabase
      .from('admin_requests')
      .select('id, status')
      .eq('telegram_user_id', telegramUserId)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (pendingReq) {
      return NextResponse.json(
        { error: '이미 대기 중인 관리자 신청이 존재합니다. 승인을 기다려주세요.' },
        { status: 400 }
      );
    }

    // Parse body for requested role (default to ADMIN)
    const body = await req.json().catch(() => ({}));
    const requestedRole = body.requested_role === 'VIEWER' ? 'VIEWER' : 'ADMIN';

    // 3. Create new admin_requests entry
    const { data: newRequest, error: insertError } = await supabase
      .from('admin_requests')
      .insert({
        telegram_user_id: telegramUserId,
        telegram_first_name: first_name || '이용자',
        telegram_username: username || null,
        requested_role: requestedRole,
        status: 'PENDING'
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 4. Send Telegram Notification to SUPER_ADMIN (Default Chat ID 1284576145 - 고민석)
    try {
      await notifySuperAdminNewRequest({
        superAdminChatId: 1284576145,
        requestId: newRequest.id,
        applicantName: first_name || '이용자',
        applicantUsername: username || null,
        applicantUserId: telegramUserId,
        requestedRole
      });
    } catch (notifyErr) {
      console.warn('Failed to send Telegram notification to SUPER_ADMIN:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: '관리자 신청이 완료되었습니다. SUPER_ADMIN의 승인을 기다려주세요.',
      request: newRequest
    }, { status: 201 });
  } catch (error: any) {
    console.error('Admin request submission error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
