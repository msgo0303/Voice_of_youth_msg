import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, getAuthSessionByUserId, getAuthSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const initData = body.initData || req.headers.get('x-telegram-init-data');
    const telegramUserId = body.telegram_user_id || req.headers.get('x-telegram-user-id');

    if (!initData && !telegramUserId) {
      return NextResponse.json({ error: 'Missing initData or telegram_user_id' }, { status: 400 });
    }

    const session = initData
      ? await getAuthSession(initData)
      : await getAuthSessionByUserId(Number(telegramUserId));

    if (!session.authenticated) {
      return NextResponse.json({ error: session.error || 'Authentication failed' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: session.user,
      admin: session.admin,
      role: session.role
    });
  } catch (error: any) {
    console.error('Auth verification endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getAuthSessionFromRequest(req);

  if (!session.authenticated) {
    return NextResponse.json({ error: session.error || 'Authentication failed' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: session.user,
    admin: session.admin,
    role: session.role
  });
}
