import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, getAuthSessionFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const initData = body.initData || req.headers.get('x-telegram-init-data');

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    const session = await getAuthSession(initData);

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
