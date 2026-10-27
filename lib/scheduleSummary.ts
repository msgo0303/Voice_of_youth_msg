import { getServiceSupabase } from '@/lib/supabase';
import { sendTelegramBotMessage } from '@/lib/telegramBot';
import { formatKstDateTime } from '@/lib/dateUtils';

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface ScheduleSummaryResult {
  ok: boolean;
  error?: string;
  status?: number;
  stats?: {
    wednesdayCount: number;
    sundayCount: number;
    totalResponses: number;
    uniqueParticipantsCount: number;
  };
  previewText?: string;
}

/**
 * 설문이 '줌 사전 신청서' (또는 요일/시간대별 일정 설문)인지 판별
 */
export function isZoomScheduleSurvey(formTitle?: string | null, questions?: any[]): boolean {
  if (formTitle && formTitle.includes('줌')) {
    return true;
  }
  if (Array.isArray(questions)) {
    return questions.some((q: any) => {
      const titleMatches = /일시|시간|일정/.test(q.title || '');
      const optionsMatch =
        Array.isArray(q.options) && q.options.some((opt: string) => /수\s*\d|일\s*\d/.test(opt));
      return (q.type === 'MULTIPLE_CHOICE' || q.type === 'CHECKBOX') && (titleMatches || optionsMatch);
    });
  }
  return false;
}

/**
 * 응답의 답변 목록에서 (지역, 구역, 이름) 기반 고유 식별 키를 추출
 * - 지역, 구역, 이름이 모두 존재할 때만 유효한 키 반환
 */
export function extractApplicantKeyFromAnswers(answerRows: any[]): string | null {
  if (!Array.isArray(answerRows) || answerRows.length === 0) return null;

  const regionAns = answerRows.find((a: any) => {
    const title = (a.question_snapshot?.title || '').trim();
    return title === '지역' || title.endsWith('지역');
  });

  const sectionAns = answerRows.find((a: any) => {
    const title = (a.question_snapshot?.title || '').trim();
    return title === '구역' || title.endsWith('구역');
  });

  const nameAns = answerRows.find((a: any) => {
    const title = (a.question_snapshot?.title || '').trim();
    return title === '이름' || title.endsWith('이름') || /성함|성명/.test(title);
  });

  if (regionAns && sectionAns && nameAns) {
    const rRaw = String(regionAns.answer_value || '').trim();
    const sRaw = String(sectionAns.answer_value || '').trim();
    const nRaw = String(nameAns.answer_value || '').replace(/\s+/g, '');

    if (!rRaw || !sRaw || !nRaw) return null;

    const rNum = parseInt(rRaw.replace(/[^0-9]/g, ''), 10);
    const sNum = parseInt(sRaw.replace(/[^0-9]/g, ''), 10);
    const rNorm = !isNaN(rNum) ? String(rNum) : rRaw;
    const sNorm = !isNaN(sNum) ? String(sNum) : sRaw;
    const nNorm = nRaw;

    return `${rNorm}-${sNorm}-${nNorm}`;
  }

  const combinedAns = answerRows.find((a: any) => {
    const title = (a.question_snapshot?.title || '').trim();
    return /지역.*구역.*이름/.test(title);
  });

  if (combinedAns && combinedAns.answer_value) {
    const raw = String(combinedAns.answer_value).trim();
    const m = raw.match(/^(\d+)[\/\-\s]+(\d+)[\/\-\s]+(.+)$/);
    if (m) {
      const rNorm = String(parseInt(m[1], 10));
      const sNorm = String(parseInt(m[2], 10));
      const nNorm = m[3].replace(/\s+/g, '');
      return `${rNorm}-${sNorm}-${nNorm}`;
    }
  }

  return null;
}

/**
 * 동일한 설문 내에서 '지역', '구역', '이름'이 같은 이전 중복 응답들을 정리하여
 * 가장 마지막에 제출(또는 수정)된 응답 1건만 DB에 남김
 */
export async function deduplicateFormResponsesByApplicant(formId: string): Promise<number> {
  try {
    const supabase = getServiceSupabase();

    const { data: responses, error } = await supabase
      .from('responses')
      .select(`
        id,
        submitted_at,
        updated_at,
        response_answers (
          question_id,
          answer_value,
          question_snapshot
        )
      `)
      .eq('form_id', formId)
      .order('submitted_at', { ascending: true });

    if (error || !responses || responses.length <= 1) {
      return 0;
    }

    // Sort oldest -> newest by updated_at || submitted_at
    const sorted = [...responses].sort((a: any, b: any) => {
      const timeA = new Date(a.updated_at || a.submitted_at).getTime();
      const timeB = new Date(b.updated_at || b.submitted_at).getTime();
      return timeA - timeB;
    });

    const latestResponseIdByKey = new Map<string, string>();
    const duplicateIdsToDelete: string[] = [];

    sorted.forEach((resp: any) => {
      const key = extractApplicantKeyFromAnswers(resp.response_answers || []);
      if (!key) return;

      const prevId = latestResponseIdByKey.get(key);
      if (prevId && prevId !== resp.id) {
        duplicateIdsToDelete.push(prevId);
      }
      latestResponseIdByKey.set(key, resp.id);
    });

    if (duplicateIdsToDelete.length > 0) {
      await supabase
        .from('responses')
        .delete()
        .in('id', duplicateIdsToDelete);
    }

    return duplicateIdsToDelete.length;
  } catch (err) {
    console.warn('Failed to deduplicate responses by applicant:', err);
    return 0;
  }
}

/**
 * 요일별(수요일/일요일) 시간대별 신청자 명단을 집계하여 텔레그램 방으로 발송
 * - '지역', '구역', '이름'이 동일한 신청자의 경우 가장 마지막에 제출(또는 수정)된 건만 반영
 */
export async function sendZoomScheduleSummaryToTelegram(formId: string): Promise<ScheduleSummaryResult> {
  const supabase = getServiceSupabase();

  // 1. Fetch Form metadata
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('id, title, response_chat_id, response_topic_id')
    .eq('id', formId)
    .single();

  if (formErr || !form) {
    return { ok: false, error: '설문을 찾을 수 없습니다.', status: 404 };
  }

  // 2. Fetch Questions to find the schedule question
  const { data: rawQuestions } = await supabase
    .from('questions')
    .select('*')
    .eq('form_id', formId)
    .order('order_index', { ascending: true });

  const questions = rawQuestions || [];

  // Find schedule question: Title includes '일시' or '시간' or options contain '수'/'일'
  const scheduleQuestion =
    questions.find((q: any) => {
      const titleMatches = /일시|시간|일정/.test(q.title);
      const optionsMatch =
        Array.isArray(q.options) && q.options.some((opt: string) => /수\s*\d|일\s*\d/.test(opt));
      return (q.type === 'MULTIPLE_CHOICE' || q.type === 'CHECKBOX') && (titleMatches || optionsMatch);
    }) || questions.find((q: any) => q.type === 'MULTIPLE_CHOICE');

  if (!scheduleQuestion) {
    return { ok: false, error: '시간대/일정 선택 문항을 찾을 수 없습니다.', status: 400 };
  }

  // 2.5. Clean up any older duplicate submissions with the same (지역, 구역, 이름)
  await deduplicateFormResponsesByApplicant(formId);

  // 3. Fetch all Responses with their answers (including question_snapshot)
  const { data: responses, error: respErr } = await supabase
    .from('responses')
    .select(`
      id,
      telegram_user_id,
      telegram_first_name,
      telegram_username,
      submitted_at,
      updated_at,
      response_answers (
        question_id,
        answer_value,
        question_snapshot
      )
    `)
    .eq('form_id', formId)
    .order('submitted_at', { ascending: true });

  if (respErr) {
    return { ok: false, error: '응답 데이터를 불러오지 못했습니다.', status: 500 };
  }

  // Sort chronologically by updated_at (or submitted_at) ascending so the last submitted/edited record wins
  const sortedResponses = [...(responses || [])].sort((a: any, b: any) => {
    const timeA = new Date(a.updated_at || a.submitted_at).getTime();
    const timeB = new Date(b.updated_at || b.submitted_at).getTime();
    return timeA - timeB;
  });

  // Slots Definition (수요일 4개, 일요일 기본 5개)
  const rawOptions = (Array.isArray(scheduleQuestion?.options) ? scheduleQuestion.options : []).filter(
    (opt: any) => typeof opt === 'string' && !opt.startsWith('__type:')
  );

  const defaultWedSlots = ['수 07:00', '수 12:00', '수 19:30', '수 22:00'];
  const defaultSunSlots = ['일 08:00', '일 12:00', '일 15:30', '일 19:30', '일 22:00'];

  const wednesdaySlots =
    rawOptions.filter((opt: string) => opt.startsWith('수')).length > 0
      ? rawOptions.filter((opt: string) => opt.startsWith('수'))
      : defaultWedSlots;

  const sundaySlots =
    rawOptions.filter((opt: string) => opt.startsWith('일')).length > 0
      ? rawOptions.filter((opt: string) => opt.startsWith('일'))
      : defaultSunSlots;

  interface ParticipantInfo {
    regionNum: number;
    sectionNum: number;
    name: string;
    displayName: string;
  }

  interface DedupedEntry {
    personKey: string;
    participant: ParticipantInfo;
    chosenOptions: string[];
  }

  // Deduplicate by (지역, 구역, 이름): later submissions overwrite earlier ones
  const latestByParticipant = new Map<string, DedupedEntry>();

  sortedResponses.forEach((resp: any) => {
    const answerRows = resp.response_answers || [];

    // 1. Separate questions: '지역', '구역', '이름'
    const regionAns = answerRows.find((a: any) => {
      const title = (a.question_snapshot?.title || '').trim();
      return title === '지역' || title.endsWith('지역');
    });

    const sectionAns = answerRows.find((a: any) => {
      const title = (a.question_snapshot?.title || '').trim();
      return title === '구역' || title.endsWith('구역');
    });

    const nameAns = answerRows.find((a: any) => {
      const title = (a.question_snapshot?.title || '').trim();
      return title === '이름' || title.endsWith('이름') || /성함|성명/.test(title);
    });

    // Fallback: previous combined question '지역/구역/이름'
    const combinedAns = answerRows.find((a: any) => {
      const title = (a.question_snapshot?.title || '').trim();
      return /지역.*구역.*이름/.test(title);
    });

    let regionNum = 999;
    let sectionNum = 999;
    let nameStr = '';
    let displayName = '';
    let personKey = '';

    if (regionAns && sectionAns && nameAns) {
      regionNum = parseInt(String(regionAns.answer_value).replace(/[^0-9]/g, ''), 10) || 999;
      sectionNum = parseInt(String(sectionAns.answer_value).replace(/[^0-9]/g, ''), 10) || 999;
      nameStr = (nameAns.answer_value || '').trim();
      const rDisplay = regionNum !== 999 ? regionNum : (regionAns.answer_value || '?').trim();
      const sDisplay = sectionNum !== 999 ? sectionNum : (sectionAns.answer_value || '?').trim();
      displayName = `${rDisplay}-${sDisplay} ${nameStr}`;
      personKey = `${rDisplay}-${sDisplay}-${nameStr.replace(/\s+/g, '')}`;
    } else if (combinedAns && combinedAns.answer_value) {
      const raw = combinedAns.answer_value.trim();
      const m = raw.match(/^(\d+)[\/\-\s]+(\d+)[\/\-\s]+(.+)$/);
      if (m) {
        regionNum = parseInt(m[1], 10) || 999;
        sectionNum = parseInt(m[2], 10) || 999;
        nameStr = m[3].trim();
        displayName = `${regionNum}-${sectionNum} ${nameStr}`;
        personKey = `${regionNum}-${sectionNum}-${nameStr.replace(/\s+/g, '')}`;
      } else {
        displayName = raw;
        nameStr = raw;
        personKey = raw.replace(/\s+/g, '');
      }
    } else if (nameAns && nameAns.answer_value) {
      nameStr = nameAns.answer_value.trim();
      displayName = nameStr;
      personKey = nameStr.replace(/\s+/g, '');
    }

    if (!displayName) {
      displayName = resp.telegram_first_name || '이용자';
      if (resp.telegram_username) {
        displayName += `(@${resp.telegram_username})`;
      }
      nameStr = displayName;
      personKey = String(resp.telegram_user_id || resp.id);
    }

    const participant: ParticipantInfo = {
      regionNum,
      sectionNum,
      name: nameStr,
      displayName
    };

    // Check chosen schedule options: check snapshot title/type or question_id
    const schedAns = answerRows.find((a: any) => {
      const title = a.question_snapshot?.title || '';
      const type = a.question_snapshot?.type || '';
      return (
        /일시|시간|일정/.test(title) ||
        type === 'MULTIPLE_CHOICE' ||
        (scheduleQuestion && a.question_id === scheduleQuestion.id)
      );
    });

    if (!schedAns || !schedAns.answer_value) return;

    const rawVal = schedAns.answer_value.trim();
    let chosenOptions: string[] = [];

    try {
      if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
        chosenOptions = JSON.parse(rawVal);
      } else {
        chosenOptions = rawVal
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    } catch {
      chosenOptions = rawVal
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    // Overwrite previous submission if the same (지역, 구역, 이름) submitted again
    latestByParticipant.set(personKey, {
      personKey,
      participant,
      chosenOptions
    });
  });

  // Map: slotName -> List of ParticipantInfo
  const slotMap: Record<string, ParticipantInfo[]> = {};
  [...wednesdaySlots, ...sundaySlots].forEach((slot: string) => {
    slotMap[slot] = [];
  });

  // Unique participants per day
  const wednesdayParticipants = new Set<string>();
  const sundayParticipants = new Set<string>();

  latestByParticipant.forEach(({ personKey, participant, chosenOptions }) => {
    let hasWed = false;
    let hasSun = false;

    chosenOptions.forEach((chosenOpt) => {
      const matchedSlot = Object.keys(slotMap).find((slot) => {
        const normA = slot.replace(/\s+/g, '');
        const normB = chosenOpt.replace(/\s+/g, '');
        return normA === normB;
      });

      if (matchedSlot) {
        if (!slotMap[matchedSlot].some((p) => p.displayName === participant.displayName)) {
          slotMap[matchedSlot].push(participant);
        }
        if (matchedSlot.startsWith('수')) hasWed = true;
        if (matchedSlot.startsWith('일')) hasSun = true;
      } else {
        if (!slotMap[chosenOpt]) {
          slotMap[chosenOpt] = [];
        }
        if (!slotMap[chosenOpt].some((p) => p.displayName === participant.displayName)) {
          slotMap[chosenOpt].push(participant);
        }
        if (chosenOpt.startsWith('수')) hasWed = true;
        if (chosenOpt.startsWith('일')) hasSun = true;
      }
    });

    if (hasWed) wednesdayParticipants.add(personKey);
    if (hasSun) sundayParticipants.add(personKey);
  });

  // Sort participants by: 1st Region (asc) -> 2nd Section (asc) -> 3rd Name (Korean asc)
  const sortParticipants = (list: ParticipantInfo[]) => {
    return [...list].sort((a, b) => {
      if (a.regionNum !== b.regionNum) return a.regionNum - b.regionNum;
      if (a.sectionNum !== b.sectionNum) return a.sectionNum - b.sectionNum;
      return a.name.localeCompare(b.name, 'ko-KR');
    });
  };

  // 4. Construct Telegram HTML Message
  const formattedNow = formatKstDateTime();

  let msg = `📋 <b>[줌 사전 신청 현황 명단]</b>\n`;
  msg += `📌 <b>설문</b>: ${escapeHtml(form.title)}\n`;
  msg += `🕒 <b>집계 기준</b>: ${formattedNow}\n\n`;

  // Wednesday Section
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🗓️ <b>[수요일] 총 참여: ${wednesdayParticipants.size}명</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  wednesdaySlots.forEach((slot: string) => {
    const timeOnly = slot.replace(/^수\s*/, '');
    const members = sortParticipants(slotMap[slot] || []);
    const count = members.length;
    const listText = count > 0 ? members.map((m) => escapeHtml(m.displayName)).join(', ') : '-';
    msg += `• <b>${timeOnly}</b> (${count}명): ${listText}\n`;
  });

  msg += `\n`;

  // Sunday Section
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🗓️ <b>[일요일] 총 참여: ${sundayParticipants.size}명</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  sundaySlots.forEach((slot: string) => {
    const timeOnly = slot.replace(/^일\s*/, '');
    const members = sortParticipants(slotMap[slot] || []);
    const count = members.length;
    const listText = count > 0 ? members.map((m) => escapeHtml(m.displayName)).join(', ') : '-';
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
      targetChatId = process.env.TELEGRAM_CHAT_ID || -1003721720880;
    }
  }

  // 5. Send Telegram Bot Message
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
    return {
      ok: false,
      error: `텔레그램 전송 실패: ${telegramRes.error || '알 수 없는 오류'}`,
      status: 502
    };
  }

  return {
    ok: true,
    stats: {
      wednesdayCount: wednesdayParticipants.size,
      sundayCount: sundayParticipants.size,
      totalResponses: responses?.length || 0,
      uniqueParticipantsCount: latestByParticipant.size
    },
    previewText: msg
  };
}
