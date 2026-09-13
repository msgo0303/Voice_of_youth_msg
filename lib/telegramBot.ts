import https from 'https';

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramBotMessage(params: {
  chat_id: number | string;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: any;
  message_thread_id?: number;
}): Promise<{ ok: boolean; result?: any; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8639864400:AAGiBD8Uz9iTmvVmnDd1rKysVXNn1yznHsQ';
  if (!botToken) {
    console.warn('TELEGRAM_BOT_TOKEN is not configured in .env.local');
    return { ok: false, error: 'Bot token missing' };
  }

  const payload: Record<string, any> = {
    chat_id: params.chat_id,
    text: params.text
  };

  if (params.parse_mode) payload.parse_mode = params.parse_mode;
  if (params.reply_markup) payload.reply_markup = params.reply_markup;
  if (params.message_thread_id) payload.message_thread_id = params.message_thread_id;

  const data = JSON.stringify(payload);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ ok: json.ok, result: json.result, error: json.description });
        } catch (e: any) {
          resolve({ ok: false, error: e.message });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(data);
    req.end();
  });
}

/**
 * Notify SUPER_ADMIN of a new admin request via Telegram
 */
export async function notifySuperAdminNewRequest(params: {
  superAdminChatId: number | string;
  requestId: string;
  applicantName: string;
  applicantUsername?: string | null;
  applicantUserId: number;
  requestedRole: string;
}) {
  const text = `🔔 *[새로운 관리자 신청]*\n\n` +
    `👤 *이름*: ${params.applicantName}\n` +
    `🏷️ *Username*: ${params.applicantUsername ? '@' + params.applicantUsername : '없음'}\n` +
    `🆔 *Telegram User ID*: \`${params.applicantUserId}\`\n` +
    `🛡️ *요청 역할*: ${params.requestedRole}`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '✅ 승인 (Approve)', callback_data: `approve_req_${params.requestId}` },
        { text: '❌ 거절 (Reject)', callback_data: `reject_req_${params.requestId}` }
      ]
    ]
  };

  return sendTelegramBotMessage({
    chat_id: params.superAdminChatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}
