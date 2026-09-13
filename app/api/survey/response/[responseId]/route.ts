import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { sendTelegramBotMessage } from '@/lib/telegramBot';
import { QuestionSnapshot } from '@/types/database';
import { decodeQuestionFromDb } from '@/lib/questionTypeMapper';

// GET /api/survey/response/[responseId] - Fetch specific response details with strict ownership verification
export async function GET(
  req: NextRequest,
  { params }: { params: { responseId: string } }
) {
  const responseId = params.responseId;
  if (!responseId) {
    return NextResponse.json({ error: '응답 ID가 필요합니다.' }, { status: 400 });
  }

  const session = await getAuthSessionFromRequest(req);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const authenticatedUserId = session.user.id;

  try {
    const supabase = getServiceSupabase();

    // Fetch response with answers
    const { data: response, error } = await supabase
      .from('responses')
      .select(`
        *,
        forms:form_id (
          id,
          title,
          description,
          status,
          deadline_at,
          completion_message
        ),
        response_answers (
          id,
          question_id,
          answer_value,
          question_snapshot
        )
      `)
      .eq('id', responseId)
      .single();

    if (error || !response) {
      return NextResponse.json({ error: '응답을 찾을 수 없습니다.' }, { status: 404 });
    }

    // REQUIREMENT 5: Strict Ownership Check on Server Side
    if (Number(response.telegram_user_id) !== Number(authenticatedUserId)) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다. 본인의 응답만 조회할 수 있습니다.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      response
    });
  } catch (err: any) {
    console.error('Fetch response detail error:', err);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/survey/response/[responseId] - Update specific response with strict ownership & ACTIVE status check
export async function PUT(
  req: NextRequest,
  { params }: { params: { responseId: string } }
) {
  const responseId = params.responseId;
  if (!responseId) {
    return NextResponse.json({ error: '응답 ID가 필요합니다.' }, { status: 400 });
  }

  const session = await getAuthSessionFromRequest(req);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const authenticatedUserId = session.user.id;

  try {
    const body = await req.json();
    const { answers } = body;

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: '유효하지 않은 응답 데이터 형식입니다.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Fetch response & associated form
    const { data: response, error: respErr } = await supabase
      .from('responses')
      .select(`
        *,
        forms:form_id (
          id,
          title,
          status,
          response_chat_id,
          response_topic_id
        )
      `)
      .eq('id', responseId)
      .single();

    if (respErr || !response) {
      return NextResponse.json({ error: '수정할 기존 응답 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    // REQUIREMENT 5: Strict Ownership Check on Server Side
    if (Number(response.telegram_user_id) !== Number(authenticatedUserId)) {
      return NextResponse.json(
        { error: '권한 오류: 본인의 응답만 수정할 수 있습니다.' },
        { status: 403 }
      );
    }

    // REQUIREMENT 2 & 4: CLOSED form edit blocking
    const form = response.forms;
    if (!form || form.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: '마감되었거나 종료된 설문의 응답은 수정할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 2. Fetch Questions for validation
    const { data: rawQuestions, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .eq('form_id', form.id)
      .order('order_index', { ascending: true });

    if (qErr || !rawQuestions || rawQuestions.length === 0) {
      return NextResponse.json({ error: '질문 목록을 불러올 수 없습니다.' }, { status: 400 });
    }

    const questions = rawQuestions.map((q: any) => decodeQuestionFromDb(q));

    // 3. Validate required answers
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

    // REQUIREMENT 4: Update target response row ONLY (is_edited = true, updated_at = NOW())
    const { error: respUpdateErr } = await supabase
      .from('responses')
      .update({
        updated_at: new Date().toISOString(),
        is_edited: true
      })
      .eq('id', responseId);

    if (respUpdateErr) {
      return NextResponse.json({ error: `응답 수정 실패: ${respUpdateErr.message}` }, { status: 500 });
    }

    // 4. Delete old response_answers for this response_id & insert updated answers
    await supabase.from('response_answers').delete().eq('response_id', responseId);

    const answerRows = questions.map((q: any) => {
      const snapshot: QuestionSnapshot = {
        title: q.title,
        description: q.description || null,
        type: q.type,
        options: q.options || [],
        required: q.required
      };

      return {
        response_id: responseId,
        question_id: q.id,
        question_snapshot: snapshot,
        answer_value: answers[q.id] || ''
      };
    });

    const { error: ansInsertErr } = await supabase
      .from('response_answers')
      .insert(answerRows);

    if (ansInsertErr) {
      return NextResponse.json({ error: `수정된 답변 저장 실패: ${ansInsertErr.message}` }, { status: 500 });
    }

    // 5. Send Telegram Notification about Response Edit
    try {
      const escapeHtml = (str: string) =>
        String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

      let targetChatId = form.response_chat_id || process.env.TELEGRAM_CHAT_ID || -1003721720880;
      let targetTopicId = form.response_topic_id;

      let messageText = `✏️ <b>[설문 응답 수정 알림]</b>\n`;
      messageText += `📌 <b>설문 제목</b>: ${escapeHtml(form.title)}\n`;
      messageText += `👤 <b>응답자</b>: ${escapeHtml(session.user.first_name || '이용자')}${session.user.username ? ` (@${escapeHtml(session.user.username)})` : ''}\n`;
      messageText += `🕒 <b>수정 일시</b>: ${new Date().toLocaleString('ko-KR')}\n\n`;

      questions.forEach((q: any, idx: number) => {
        const ansVal = answers[q.id] || '(응답 없음)';
        messageText += `<b>Q${idx + 1}. ${escapeHtml(q.title)}</b>\n↳ ${escapeHtml(ansVal)}\n\n`;
      });

      await sendTelegramBotMessage({
        chat_id: targetChatId,
        message_thread_id: targetTopicId ? Number(targetTopicId) : undefined,
        text: messageText,
        parse_mode: 'HTML'
      });
    } catch (tgErr) {
      console.warn('Failed to send Telegram response update notification:', tgErr);
    }

    return NextResponse.json({
      success: true,
      message: '응답이 성공적으로 수정되었습니다.',
      response_id: responseId
    });
  } catch (error: any) {
    console.error('Survey response update error:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
