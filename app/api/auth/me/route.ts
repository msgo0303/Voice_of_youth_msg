import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, getAuthSessionByUserId, getAuthSessionFromRequest, AuthSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const initData = body.initData || req.headers.get('x-telegram-init-data');
    const telegramUserId = body.telegram_user_id || req.headers.get('x-telegram-user-id');

    let session: AuthSession | null = null;

    if (initData) {
      session = await getAuthSession(initData);
    }

    if ((!session || !session.authenticated || session.role === 'USER') && telegramUserId) {
      session = await getAuthSessionByUserId(Number(telegramUserId));
    }

    if (!session || !session.authenticated) {
      return NextResponse.json({ error: session?.error || '텔레그램 계정 인증에 실패했습니다.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: session.user,
      admin: session.admin,
      role: session.role
    });
  } catch (error: any) {
    console.error('Auth verification endpoint error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getAuthSessionFromRequest(req);

  if (!session.authenticated) {
    return NextResponse.json({ error: session.error || '텔레그램 계정 인증에 실패했습니다.' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: session.user,
    admin: session.admin,
    role: session.role
  });
}
