import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { sendTelegramBotMessage } from '@/lib/telegramBot';
import { QuestionSnapshot } from '@/types/database';
import { decodeQuestionFromDb } from '@/lib/questionTypeMapper';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const formId = params.id;
  if (!formId) {
    return NextResponse.json({ error: '설문 ID가 필요합니다.' }, { status: 400 });
  }

  // 1. Authenticate Telegram User or fallback to Web Guest
  const session = await getAuthSessionFromRequest(req);
  const user = (session.authenticated && session.user)
    ? session.user
    : {
        id: Math.floor(100000000 + Math.random() * 900000000),
        first_name: '웹 응답자',
        last_name: '',
        username: undefined
      };

  try {
    const body = await req.json();
    const { answers } = body; // Map of question_id -> answer_value string

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: '유효하지 않은 응답 데이터 형식입니다.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 2. Fetch Form metadata & verify ACTIVE status
    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (form.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: '현재 종료되었거나 보관된 설문에는 응답을 제출할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 3. Fetch Questions for this form
    const { data: rawQuestions, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    if (qErr || !rawQuestions || rawQuestions.length === 0) {
      return NextResponse.json({ error: '질문 목록을 불러올 수 없습니다.' }, { status: 400 });
    }

    const questions = rawQuestions.map((q: any) => decodeQuestionFromDb(q));

    // 4. Validate required answers
    const missingQuestions: string[] = [];
    for (const q of questions) {
      const val = answers[q.id];
      if (q.required && (!val || !val.trim())) {
        missingQuestions.push(q.title);
      }
    }

    if (missingQuestions.length > 0) {
      return NextResponse.json(
        { error: `필수 질문 [${missingQuestions.join(', ')}]의 응답이 누락되었습니다.` },
        { status: 400 }
      );
    }

    // 5. Create Response row in responses table
    const { data: newResponse, error: respInsertErr } = await supabase
      .from('responses')
      .insert({
        form_id: formId,
        telegram_user_id: user.id,
        telegram_username: user.username || null,
        telegram_first_name: user.first_name || '응답자',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_edited: false
      })
      .select()
      .single();

    if (respInsertErr || !newResponse) {
      return NextResponse.json({ error: `응답 저장 실패: ${respInsertErr?.message}` }, { status: 500 });
    }

    // 6. Create Answer rows in response_answers with question_snapshot (Immutability guaranteed)
    const answerRows = questions.map((q: any) => {
      const snapshot: QuestionSnapshot = {
        title: q.title,
        description: q.description || null,
        type: q.type,
        options: q.options || [],
        required: q.required
      };

      return {
        response_id: newResponse.id,
        question_id: q.id,
        question_snapshot: snapshot,
        answer_value: answers[q.id] || ''
      };
    });


    const { error: ansInsertErr } = await supabase
      .from('response_answers')
      .insert(answerRows);

    if (ansInsertErr) {
      // Rollback response if answers fail
      await supabase.from('responses').delete().eq('id', newResponse.id);
      return NextResponse.json({ error: `답변 상세 저장 실패: ${ansInsertErr.message}` }, { status: 500 });
    }

    // 7. Send Telegram Notification to target chat & topic
    let telegramMessageId: number | null = null;
    try {
      const escapeHtml = (str: string) =>
        String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

      let targetChatId = form.response_chat_id;
      let targetTopicId = form.response_topic_id;

      // Fallback: If form does not have response_chat_id set, lookup forum_topics table or use default
      if (!targetChatId) {
        const { data: cachedTopic } = await supabase
          .from('forum_topics')
          .select('chat_id, topic_id')
          .limit(1)
          .maybeSingle();

        if (cachedTopic) {
          targetChatId = cachedTopic.chat_id;
          if (!targetTopicId) targetTopicId = cachedTopic.topic_id;
        } else {
          targetChatId = process.env.TELEGRAM_CHAT_ID || -1003721720880;
        }
      }

      let messageText = `📋 <b>[설문 응답 제출 알림]</b>\n`;
      messageText += `📌 <b>설문 제목</b>: ${escapeHtml(form.title)}\n`;
      messageText += `👤 <b>응답자</b>: ${escapeHtml(user.first_name || '이용자')}${user.username ? ` (@${escapeHtml(user.username)})` : ''}\n`;
      messageText += `🕒 <b>일시</b>: ${new Date().toLocaleString('ko-KR')}\n\n`;

      questions.forEach((q: any, idx: number) => {
        const ansVal = answers[q.id] || '(응답 없음)';
        messageText += `<b>Q${idx + 1}. ${escapeHtml(q.title)}</b>\n↳ ${escapeHtml(ansVal)}\n\n`;
      });

      let telegramRes = await sendTelegramBotMessage({
        chat_id: targetChatId,
        message_thread_id: targetTopicId ? Number(targetTopicId) : undefined,
        text: messageText,
        parse_mode: 'HTML'
      });

      // If dispatch to specific topic thread failed, retry sending directly to group chat
      if (!telegramRes.ok && targetTopicId) {
        console.warn(`Telegram topic send failed (${telegramRes.error}), retrying without topic thread...`);
        telegramRes = await sendTelegramBotMessage({
          chat_id: targetChatId,
          text: messageText,
          parse_mode: 'HTML'
        });
      }

      if (telegramRes.ok && telegramRes.result?.message_id) {
        telegramMessageId = telegramRes.result.message_id;

        // Save Telegram Message ID to response row
        await supabase
          .from('responses')
          .update({ telegram_message_id: telegramMessageId })
          .eq('id', newResponse.id);
      } else {
        console.warn('Telegram bot sendMessage failed:', telegramRes.error);
      }
    } catch (tgErr) {
      console.warn('Failed to dispatch Telegram response notification:', tgErr);
    }

    return NextResponse.json({
      success: true,
      message: form.completion_message || '설문에 응답해 주셔서 감사합니다.',
      response_id: newResponse.id,
      telegram_message_id: telegramMessageId
    }, { status: 201 });
  } catch (error: any) {
    console.error('Survey submission error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
