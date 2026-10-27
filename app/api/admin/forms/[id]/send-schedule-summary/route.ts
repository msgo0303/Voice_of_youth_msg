import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { sendTelegramBotMessage } from '@/lib/telegramBot';

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// POST /api/admin/forms/[id]/send-schedule-summary
// 요일별(수요일/일요일) 시간대별 신청자 명단을 집계하여 텔레그램 방으로 발송
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
    const supabase = getServiceSupabase();

    // 2. Fetch Form metadata
    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('id, title, response_chat_id, response_topic_id')
      .eq('id', formId)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 3. Fetch Questions to find the schedule question and name question
    const { data: rawQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    const questions = rawQuestions || [];

    // Find schedule question: Title includes '일시' or '시간' or options contain '수'/'일'
    const scheduleQuestion = questions.find((q: any) => {
      const titleMatches = /일시|시간|일정/.test(q.title);
      const optionsMatch = Array.isArray(q.options) && q.options.some((opt: string) => /수\s*\d|일\s*\d/.test(opt));
      return (q.type === 'MULTIPLE_CHOICE' || q.type === 'CHECKBOX') && (titleMatches || optionsMatch);
    }) || questions.find((q: any) => q.type === 'MULTIPLE_CHOICE');

    // Find name/identity question (e.g., '지역/구역/이름' or '이름')
    const nameQuestion = questions.find((q: any) => /이름|성함|성명|인적/.test(q.title));

    if (!scheduleQuestion) {
      return NextResponse.json({ error: '시간대/일정 선택 문항을 찾을 수 없습니다.' }, { status: 400 });
    }

    // 4. Fetch all Responses with their answers (including question_snapshot)
    const { data: responses, error: respErr } = await supabase
      .from('responses')
      .select(`
        id,
        telegram_user_id,
        telegram_first_name,
        telegram_username,
        submitted_at,
        response_answers (
          question_id,
          answer_value,
          question_snapshot
        )
      `)
      .eq('form_id', formId)
      .order('submitted_at', { ascending: true });

    if (respErr) {
      return NextResponse.json({ error: '응답 데이터를 불러오지 못했습니다.' }, { status: 500 });
    }

    // Slots Definition (수요일 4개, 일요일 기본 5개)
    // If the form has explicit options in scheduleQuestion, honor all of them
    const rawOptions = (Array.isArray(scheduleQuestion?.options) ? scheduleQuestion.options : [])
      .filter((opt: any) => typeof opt === 'string' && !opt.startsWith('__type:'));

    const defaultWedSlots = ['수 07:00', '수 12:00', '수 19:30', '수 22:00'];
    const defaultSunSlots = ['일 08:00', '일 12:00', '일 15:30', '일 19:30', '일 22:00'];

    const wednesdaySlots = rawOptions.filter((opt: string) => opt.startsWith('수')).length > 0
      ? rawOptions.filter((opt: string) => opt.startsWith('수'))
      : defaultWedSlots;

    const sundaySlots = rawOptions.filter((opt: string) => opt.startsWith('일')).length > 0
      ? rawOptions.filter((opt: string) => opt.startsWith('일'))
      : defaultSunSlots;

    // Map: slotName -> Set of respondent display names
    const slotMap: Record<string, string[]> = {};
    [...wednesdaySlots, ...sundaySlots].forEach((slot) => {
      slotMap[slot] = [];
    });

    // Unique participants per day
    const wednesdayParticipants = new Set<string>();
    const sundayParticipants = new Set<string>();

    (responses || []).forEach((resp: any) => {
      const answerRows = resp.response_answers || [];

      // Determine respondent display name: check snapshot title or question_id
      let displayName = '';
      const nameAns = answerRows.find((a: any) => {
        const title = a.question_snapshot?.title || '';
        return /이름|성함|성명|인적|구역|지역/.test(title) || (nameQuestion && a.question_id === nameQuestion.id);
      });

      if (nameAns && nameAns.answer_value && nameAns.answer_value.trim()) {
        displayName = nameAns.answer_value.trim();
      }

      if (!displayName) {
        displayName = resp.telegram_first_name || '이용자';
        if (resp.telegram_username) {
          displayName += `(@${resp.telegram_username})`;
        }
      }

      // Check chosen schedule options: check snapshot title/type or question_id
      const schedAns = answerRows.find((a: any) => {
        const title = a.question_snapshot?.title || '';
        const type = a.question_snapshot?.type || '';
        return /일시|시간|일정/.test(title) || type === 'MULTIPLE_CHOICE' || (scheduleQuestion && a.question_id === scheduleQuestion.id);
      });

      if (!schedAns || !schedAns.answer_value) return;

      const rawVal = schedAns.answer_value.trim();
      let chosenOptions: string[] = [];

      try {
        if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
          chosenOptions = JSON.parse(rawVal);
        } else {
          chosenOptions = rawVal.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      } catch {
        chosenOptions = rawVal.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

      let hasWed = false;
      let hasSun = false;

      chosenOptions.forEach((chosenOpt) => {
        // Match against known slots (allowing flexible whitespace, e.g. "수 07:00" or "수07:00")
        const matchedSlot = Object.keys(slotMap).find((slot) => {
          const normA = slot.replace(/\s+/g, '');
          const normB = chosenOpt.replace(/\s+/g, '');
          return normA === normB;
        });

        if (matchedSlot) {
          if (!slotMap[matchedSlot].includes(displayName)) {
            slotMap[matchedSlot].push(displayName);
          }
          if (matchedSlot.startsWith('수')) hasWed = true;
          if (matchedSlot.startsWith('일')) hasSun = true;
        } else {
          // If option is custom or dynamic
          if (!slotMap[chosenOpt]) {
            slotMap[chosenOpt] = [];
          }
          if (!slotMap[chosenOpt].includes(displayName)) {
            slotMap[chosenOpt].push(displayName);
          }
          if (chosenOpt.startsWith('수')) hasWed = true;
          if (chosenOpt.startsWith('일')) hasSun = true;
        }
      });

      const participantIdentifier = resp.telegram_user_id || displayName;
      if (hasWed) wednesdayParticipants.add(participantIdentifier);
      if (hasSun) sundayParticipants.add(participantIdentifier);
    });

    // 5. Construct Telegram HTML Message
    const now = new Date();
    const formattedNow = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, '0')}. ${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let msg = `📋 <b>[줌 사전 신청 현황 명단]</b>\n`;
    msg += `📌 <b>설문</b>: ${escapeHtml(form.title)}\n`;
    msg += `🕒 <b>집계 기준</b>: ${formattedNow}\n\n`;

    // Wednesday Section
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🗓️ <b>[수요일] 총 참여: ${wednesdayParticipants.size}명</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

    wednesdaySlots.forEach((slot: string) => {
      const timeOnly = slot.replace(/^수\s*/, '');
      const members = slotMap[slot] || [];
      const count = members.length;
      const listText = count > 0 ? members.map(escapeHtml).join(', ') : '-';
      msg += `• <b>${timeOnly}</b> (${count}명): ${listText}\n`;
    });

    msg += `\n`;

    // Sunday Section
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🗓️ <b>[일요일] 총 참여: ${sundayParticipants.size}명</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

    sundaySlots.forEach((slot: string) => {
      const timeOnly = slot.replace(/^일\s*/, '');
      const members = slotMap[slot] || [];
      const count = members.length;
      const listText = count > 0 ? members.map(escapeHtml).join(', ') : '-';
      msg += `• <b>${timeOnly}</b> (${count}명): ${listText}\n`;
    });

    // Target chat and topic resolution
    let targetChatId = form.response_chat_id;
    let targetTopicId = form.response_topic_id;

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
        targetChatId = process.env.TELEGRAM_CHAT_ID || -1003716985254;
      }
    }

    // 6. Send Telegram Bot Message
    let telegramRes = await sendTelegramBotMessage({
      chat_id: targetChatId,
      message_thread_id: targetTopicId ? Number(targetTopicId) : undefined,
      text: msg,
      parse_mode: 'HTML'
    });

    // Fallback if topic send fails
    if (!telegramRes.ok && targetTopicId) {
      telegramRes = await sendTelegramBotMessage({
        chat_id: targetChatId,
        text: msg,
        parse_mode: 'HTML'
      });
    }

    if (!telegramRes.ok) {
      return NextResponse.json({
        error: `텔레그램 전송 실패: ${telegramRes.error || '알 수 없는 오류'}`
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: '시간대별 명단이 텔레그램으로 성공적으로 발송되었습니다.',
      stats: {
        wednesdayCount: wednesdayParticipants.size,
        sundayCount: sundayParticipants.size,
        totalResponses: responses?.length || 0
      },
      previewText: msg
    });

  } catch (err: any) {
    console.error('Schedule summary dispatch failed:', err);
    return NextResponse.json({ error: err.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
