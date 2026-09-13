import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// POST /api/admin/members/[id]/deactivate - Soft-delete/deactivate admin (SUPER_ADMIN only)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireSuperAdmin(req);
  if (response) return response;

  const adminId = params.id;
  if (!adminId) {
    return NextResponse.json({ error: '관리자 ID가 필요합니다.' }, { status: 400 });
  }

  // Prevent self-deactivation of current SUPER_ADMIN
  if (session.admin?.id === adminId) {
    return NextResponse.json({ error: '자신의 SUPER_ADMIN 계정은 비활성화할 수 없습니다.' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data: updatedAdmin, error } = await supabase
      .from('admins')
      .update({
        status: 'INACTIVE',
        updated_at: new Date().toISOString()
      })
      .eq('id', adminId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '관리자가 성공적으로 비활성화(INACTIVE) 처리되었습니다.',
      admin: updatedAdmin
    });
  } catch (error: any) {
    console.error('Deactivate admin error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
