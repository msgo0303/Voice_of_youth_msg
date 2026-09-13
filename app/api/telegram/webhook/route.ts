import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendTelegramBotMessage } from '@/lib/telegramBot';

const SUPER_ADMIN_TELEGRAM_ID = 1284576145;

// POST /api/telegram/webhook - Telegram Bot Webhook endpoint
export async function POST(req: NextRequest) {
  try {
    // Optional secret token verification
    const secretTokenHeader = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && secretTokenHeader !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
    }

    const update = await req.json();
    console.log('Received Telegram Webhook Update:', JSON.stringify(update));

    const supabase = getServiceSupabase();

    // 1. Handle forum_topic_created event
    if (update.message?.forum_topic_created) {
      const chatId = update.message.chat.id;
      const topicId = update.message.message_thread_id || update.message.message_id;
      const topicName = update.message.forum_topic_created.name;

      if (chatId && topicId && topicName) {
        // Upsert into forum_topics table
        await supabase
          .from('forum_topics')
          .upsert(
            {
              chat_id: chatId,
              topic_id: topicId,
              topic_name: topicName
            },
            { onConflict: 'chat_id,topic_id' }
          );
        console.log(`Successfully cached forum topic: ${topicName} (chat: ${chatId}, topic: ${topicId})`);
      }
    }

    // 2. Handle callback_query (SUPER_ADMIN Inline Keyboard actions for Admin Requests)
    if (update.callback_query) {
      const callback = update.callback_query;
      const callbackId = callback.id;
      const fromId = callback.from?.id;
      const data = callback.data; // e.g. "approve_admin_req:<id>" or "reject_admin_req:<id>"
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (data && fromId === SUPER_ADMIN_TELEGRAM_ID) {
        if (data.startsWith('approve_admin_req:')) {
          const requestId = data.split(':')[1];

          // Fetch request detail
          const { data: requestRow } = await supabase
            .from('admin_requests')
            .select('*')
            .eq('id', requestId)
            .single();

          if (requestRow && requestRow.status === 'PENDING') {
            // Approve request
            await supabase
              .from('admin_requests')
              .update({
                status: 'APPROVED',
                processed_by: 'SUPER_ADMIN',
                processed_at: new Date().toISOString()
              })
              .eq('id', requestId);

            // Upsert ACTIVE admin
            await supabase.from('admins').upsert(
              {
                telegram_user_id: requestRow.telegram_user_id,
                telegram_username: requestRow.telegram_username,
                telegram_first_name: requestRow.telegram_first_name,
                role: requestRow.requested_role || 'ADMIN',
                status: 'ACTIVE',
                updated_at: new Date().toISOString()
              },
              { onConflict: 'telegram_user_id' }
            );

            // Notify bot callback answer
            if (botToken) {
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: callbackId,
                  text: '✅ 관리자 신청이 승인되었습니다.'
                })
              });

              // Edit original message text
              if (callback.message?.chat?.id && callback.message?.message_id) {
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: callback.message.chat.id,
                    message_id: callback.message.message_id,
                    text: `${callback.message.text}\n\n✅ [승인 완료] ${requestRow.telegram_first_name}님의 관리자 권한이 활성화되었습니다.`
                  })
                });
              }
            }
          }
        } else if (data.startsWith('reject_admin_req:')) {
          const requestId = data.split(':')[1];

          const { data: requestRow } = await supabase
            .from('admin_requests')
            .select('*')
            .eq('id', requestId)
            .single();

          if (requestRow && requestRow.status === 'PENDING') {
            // Reject request
            await supabase
              .from('admin_requests')
              .update({
                status: 'REJECTED',
                processed_by: 'SUPER_ADMIN',
                processed_at: new Date().toISOString()
              })
              .eq('id', requestId);

            if (botToken) {
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  callback_query_id: callbackId,
                  text: '❌ 관리자 신청이 거절되었습니다.'
                })
              });

              if (callback.message?.chat?.id && callback.message?.message_id) {
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: callback.message.chat.id,
                    message_id: callback.message.message_id,
                    text: `${callback.message.text}\n\n❌ [거절 완료] 신청이 거절되었습니다.`
                  })
                });
              }
            }
          }
        }
      } else if (fromId !== SUPER_ADMIN_TELEGRAM_ID) {
        // Non-super admin attempted callback
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackId,
              text: '⚠️ SUPER_ADMIN 권한만 승인/거절할 수 있습니다.',
              show_alert: true
            })
          });
        }
      }
    }

    // 3. Handle incoming text messages (e.g. /start or /start form_xxx)
    if (update.message?.text) {
      const text = update.message.text.trim();
      const chatId = update.message.chat.id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (text.startsWith('/start') && botToken) {
        const parts = text.split(' ');
        const param = parts[1] || ''; // e.g. "form_xxx" or "xxx"
        const formId = param.replace('form_', '');

        if (formId) {
          // Fetch form title
          const { data: form } = await supabase
            .from('forms')
            .select('title')
            .eq('id', formId)
            .maybeSingle();

          const formTitle = form?.title || '설문조사';
          const surveyWebUrl = `https://voice-of-youth-msg.vercel.app/survey/${formId}`;

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `📋 *[${formTitle}]*\n\n아래 버튼을 눌러 텔레그램에서 바로 설문에 참여해 주세요!`,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '📋 설문 응답하기',
                      web_app: { url: surveyWebUrl }
                    }
                  ]
                ]
              }
            })
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram Webhook error:', error);
    return NextResponse.json({ error: 'Webhook Handler Failed' }, { status: 500 });
  }
}
