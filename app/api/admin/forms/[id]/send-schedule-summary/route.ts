import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { sendZoomScheduleSummaryToTelegram } from '@/lib/scheduleSummary';

// POST /api/admin/forms/[id]/send-schedule-summary
// 관리자 페이지에서 수동으로 요일별/시간대별 신청자 명단을 집계하여 텔레그램 방으로 발송
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const formId = params.id;
  if (!formId) {
    return NextResponse.json({ error: '설문 ID가 필요합니다.' }, { status: 400 });
  }

  // 1. RBAC Auth Check
  const session = await getAuthSessionFromRequest(req);
  if (!session.authenticated || !['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const result = await sendZoomScheduleSummaryToTelegram(formId);

    if (!result.ok) {
      return NextResponse.json({
        error: result.error || '명단 발송에 실패했습니다.'
      }, { status: result.status || 500 });
    }

    return NextResponse.json({
      success: true,
      message: '시간대별 명단이 텔레그램으로 성공적으로 발송되었습니다.',
      stats: result.stats,
      previewText: result.previewText
    });
  } catch (err: any) {
    console.error('Schedule summary dispatch failed:', err);
    return NextResponse.json({ error: err.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
