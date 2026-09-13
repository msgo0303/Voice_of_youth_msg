import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// PATCH /api/admin/members/[id]/role - Change admin role (SUPER_ADMIN only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { response } = await requireSuperAdmin(req);
  if (response) return response;

  const adminId = params.id;
  if (!adminId) {
    return NextResponse.json({ error: '관리자 ID가 필요합니다.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { role } = body;

    if (role !== 'ADMIN' && role !== 'VIEWER' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '유효하지 않은 역할 구분입니다.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: updatedAdmin, error } = await supabase
      .from('admins')
      .update({
        role,
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
      message: `역할이 ${role}(으)로 성공적으로 변경되었습니다.`,
      admin: updatedAdmin
    });
  } catch (error: any) {
    console.error('Role change error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
