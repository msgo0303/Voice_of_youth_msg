import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';

// GET /api/admin/telegram/set-webhook - Fetch current Webhook status from Telegram (SUPER_ADMIN ONLY)
export async function GET(req: NextRequest) {
  const { response } = await requireSuperAdmin(req);
  if (response) return response;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const json = await res.json();

    return NextResponse.json({
      success: true,
      webhook_info: json.result || null
    });
  } catch (err: any) {
    console.error('Fetch getWebhookInfo error:', err);
    return NextResponse.json({ error: 'Webhook 상태 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/admin/telegram/set-webhook - Register / Update Telegram Webhook URL & Secret (SUPER_ADMIN ONLY)
export async function POST(req: NextRequest) {
  const { response } = await requireSuperAdmin(req);
  if (response) return response;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://voice-of-youth-msg.vercel.app';

  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;

  try {
    const payload: Record<string, any> = {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query', 'forum_topic_created', 'forum_topic_edited']
    };

    if (webhookSecret) {
      payload.secret_token = webhookSecret;
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (!json.ok) {
      return NextResponse.json(
        { error: `Telegram setWebhook 실패: ${json.description}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Webhook이 성공적으로 연동되었습니다. (${webhookUrl})`,
      result: json.result
    });
  } catch (err: any) {
    console.error('setWebhook error:', err);
    return NextResponse.json({ error: 'setWebhook 실행 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
