import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/admin/members - List all admins (SUPER_ADMIN only)
export async function GET(req: NextRequest) {
  const { response } = await requireSuperAdmin(req);
  if (response) return response;

  try {
    const supabase = getServiceSupabase();
    const { data: admins, error } = await supabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      admins: admins || []
    });
  } catch (error: any) {
    console.error('Admin members list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
