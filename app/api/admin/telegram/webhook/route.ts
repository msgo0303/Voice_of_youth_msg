import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// GET /api/admin/telegram/webhook - Check current Telegram Webhook Status
export async function GET(req: NextRequest) {
  const { response } = await requireSuperAdmin(req);
  if (response) return response;

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/telegram/webhook - Register Telegram Webhook URL
export async function POST(req: NextRequest) {
  const { response } = await requireSuperAdmin(req);
  if (response) return response;

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { webhook_url, secret_token } = body;

    if (!webhook_url) {
      return NextResponse.json({ error: 'webhook_url is required' }, { status: 400 });
    }

    const payload: Record<string, any> = {
      url: webhook_url,
      allowed_updates: ['message', 'callback_query', 'forum_topic_created', 'forum_topic_edited']
    };

    if (secret_token || process.env.TELEGRAM_WEBHOOK_SECRET) {
      payload.secret_token = secret_token || process.env.TELEGRAM_WEBHOOK_SECRET;
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/telegram/webhook - Remove Telegram Webhook
export async function DELETE(req: NextRequest) {
  const { response } = await requireSuperAdmin(req);
  if (response) return response;

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
