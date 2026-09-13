import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramWebAppData, TelegramUser } from './telegramAuth';
import { getServiceSupabase } from './supabase';
import { Admin, AdminRole } from '@/types/database';

export interface AuthSession {
  authenticated: boolean;
  user: TelegramUser | null;
  admin: Admin | null;
  role: AdminRole | 'USER';
  error?: string;
}

/**
 * Extract initData from request header or body and verify it
 */
export async function getAuthSessionFromRequest(req: NextRequest): Promise<AuthSession> {
  const initData = req.headers.get('x-telegram-init-data') || req.headers.get('authorization')?.replace('Bearer ', '');
  const telegramUserIdHeader = req.headers.get('x-telegram-user-id');

  if (!initData) {
    if (telegramUserIdHeader) {
      return getAuthSessionByUserId(Number(telegramUserIdHeader));
    }

    return {
      authenticated: false,
      user: null,
      admin: null,
      role: 'USER',
      error: 'Missing initData or x-telegram-user-id header'
    };
  }

  return getAuthSession(initData);
}

/**
 * Direct lookup by Telegram User ID (used for external browser fallback verification against Supabase DB)
 */
export async function getAuthSessionByUserId(userId: number): Promise<AuthSession> {
  if (!userId || isNaN(userId)) {
    return {
      authenticated: false,
      user: null,
      admin: null,
      role: 'USER',
      error: 'Invalid Telegram User ID'
    };
  }

  try {
    const supabase = getServiceSupabase();
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('telegram_user_id', userId)
      .eq('status', 'ACTIVE')
      .single();

    const mockUser: TelegramUser = {
      id: userId,
      first_name: admin?.telegram_first_name || '관리자',
      last_name: '',
      username: admin?.telegram_username || undefined
    };

    if (error || !admin) {
      return {
        authenticated: true,
        user: mockUser,
        admin: null,
        role: 'USER'
      };
    }

    return {
      authenticated: true,
      user: mockUser,
      admin: admin as Admin,
      role: (admin as Admin).role
    };
  } catch (err: any) {
    console.error('Failed to lookup admin by User ID in Supabase:', err);
    return {
      authenticated: false,
      user: null,
      admin: null,
      role: 'USER',
      error: err.message
    };
  }
}

/**
 * Verify initData and lookup Admin role from Supabase DB
 */
export async function getAuthSession(initData: string): Promise<AuthSession> {
  const user = verifyTelegramWebAppData(initData);

  if (!user) {
    return {
      authenticated: false,
      user: null,
      admin: null,
      role: 'USER',
      error: 'Invalid or expired Telegram initData'
    };
  }

  // Lookup admin record from Supabase DB using verified user.id
  try {
    const supabase = getServiceSupabase();
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('telegram_user_id', user.id)
      .eq('status', 'ACTIVE')
      .single();

    if (error || !admin) {
      return {
        authenticated: true,
        user,
        admin: null,
        role: 'USER'
      };
    }

    return {
      authenticated: true,
      user,
      admin: admin as Admin,
      role: (admin as Admin).role
    };
  } catch (err: any) {
    console.error('Failed to lookup admin in Supabase:', err);
    return {
      authenticated: true,
      user,
      admin: null,
      role: 'USER'
    };
  }
}

/**
 * RBAC Helper: Require minimum ADMIN role
 */
export async function requireAdmin(req: NextRequest): Promise<{ session: AuthSession; response?: NextResponse }> {
  const session = await getAuthSessionFromRequest(req);

  if (!session.authenticated || !session.user) {
    return {
      session,
      response: NextResponse.json({ error: '인증 오류: 텔레그램 계정 인증에 실패했습니다.' }, { status: 401 })
    };
  }

  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return {
      session,
      response: NextResponse.json({ error: '접근 권한 없음: 관리자 권한(ADMIN)이 필요합니다.' }, { status: 403 })
    };
  }

  return { session };
}

/**
 * RBAC Helper: Require SUPER_ADMIN role
 */
export async function requireSuperAdmin(req: NextRequest): Promise<{ session: AuthSession; response?: NextResponse }> {
  const session = await getAuthSessionFromRequest(req);

  if (!session.authenticated || !session.user) {
    return {
      session,
      response: NextResponse.json({ error: '인증 오류: 텔레그램 계정 인증에 실패했습니다.' }, { status: 401 })
    };
  }

  if (session.role !== 'SUPER_ADMIN') {
    return {
      session,
      response: NextResponse.json({ error: '접근 권한 없음: 최고 관리자 권한(SUPER_ADMIN)이 필요합니다.' }, { status: 403 })
    };
  }

  return { session };
}

/**
 * RBAC Helper: Require VIEWER, ADMIN, or SUPER_ADMIN role
 */
export async function requireViewerOrAdmin(req: NextRequest): Promise<{ session: AuthSession; response?: NextResponse }> {
  const session = await getAuthSessionFromRequest(req);

  if (!session.authenticated || !session.user) {
    return {
      session,
      response: NextResponse.json({ error: '인증 오류: 텔레그램 계정 인증에 실패했습니다.' }, { status: 401 })
    };
  }

  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN' && session.role !== 'VIEWER') {
    return {
      session,
      response: NextResponse.json({ error: '접근 권한 없음: 열람 권한이 필요합니다.' }, { status: 403 })
    };
  }

  return { session };
}

