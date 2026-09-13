import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/admin/requests - List all admin requests (SUPER_ADMIN only)
export async function GET(req: NextRequest) {
  const { response } = await requireSuperAdmin(req);
  if (response) return response;

  try {
    const supabase = getServiceSupabase();
    const { data: requests, error } = await supabase
      .from('admin_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      requests: requests || []
    });
  } catch (error: any) {
    console.error('Admin requests list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
