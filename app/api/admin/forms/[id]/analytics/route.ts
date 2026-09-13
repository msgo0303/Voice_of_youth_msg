import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { decodeQuestionFromDb } from '@/lib/questionTypeMapper';

// GET /api/admin/forms/[id]/analytics - Calculate statistical analytics for a form
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const formId = params.id;
  if (!formId) {
    return NextResponse.json({ error: '설문 ID가 필요합니다.' }, { status: 400 });
  }

  // 1. RBAC Auth Check
  const session = await getAuthSessionFromRequest(req);
  if (!session.authenticated || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const supabase = getServiceSupabase();

    // 2. Fetch Form metadata
    const { data: form, error: formErr } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ error: '설문을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 3. Fetch Questions
    const { data: rawQuestions, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    if (qErr || !rawQuestions) {
      return NextResponse.json({ error: '질문 목록을 불러오지 못했습니다.' }, { status: 400 });
    }

    const questions = rawQuestions.map((q: any) => decodeQuestionFromDb(q));

    // 4. Fetch all Responses with Answer rows
    const { data: responses, error: respErr } = await supabase
      .from('responses')
      .select(`
        id,
        telegram_user_id,
        telegram_first_name,
        telegram_username,
        submitted_at,
        updated_at,
        is_edited,
        response_answers (
          question_id,
          answer_value,
          question_snapshot
        )
      `)
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false });

    if (respErr) {
      return NextResponse.json({ error: '응답 데이터를 불러오지 못했습니다.' }, { status: 500 });
    }

    const totalResponses = responses?.length || 0;

    // 5. Aggregate Analytics Per Question
    const questionAnalytics = questions.map((q: any) => {
      const optionsList: string[] = Array.isArray(q.options) ? q.options : [];
      const answersForQuestion: Array<{
        response_id: string;
        user_name: string;
        username?: string | null;
        answer_value: string;
        submitted_at: string;
      }> = [];

      responses?.forEach((resp: any) => {
        const foundAns = resp.response_answers?.find((a: any) => a.question_id === q.id);
        if (foundAns && foundAns.answer_value) {
          answersForQuestion.push({
            response_id: resp.id,
            user_name: resp.telegram_first_name || '이용자',
            username: resp.telegram_username || null,
            answer_value: foundAns.answer_value,
            submitted_at: resp.submitted_at
          });
        }
      });

      const answeredCount = answersForQuestion.length;

      // Handle Option-based Questions (SINGLE_CHOICE, MULTIPLE_CHOICE, DROPDOWN)
      if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(q.type)) {
        const optionCounts: Record<string, number> = {};
        optionsList.forEach((opt: string) => { optionCounts[opt] = 0; });

        answersForQuestion.forEach((ans) => {
          if (q.type === 'MULTIPLE_CHOICE') {
            const selected = ans.answer_value.split(', ');
            selected.forEach((opt) => {
              if (optionCounts[opt] !== undefined) {
                optionCounts[opt] += 1;
              } else {
                optionCounts[opt] = 1;
              }
            });
          } else {
            const opt = ans.answer_value;
            if (optionCounts[opt] !== undefined) {
              optionCounts[opt] += 1;
            } else {
              optionCounts[opt] = 1;
            }
          }
        });

        const optionBreakdown = Object.entries(optionCounts).map(([option, count]) => ({
          option,
          count,
          percentage: answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0
        }));

        return {
          question_id: q.id,
          title: q.title,
          type: q.type,
          answered_count: answeredCount,
          option_breakdown: optionBreakdown
        };
      }

      // Handle Score-based Questions (LINEAR_SCALE, SATISFACTION)
      if (['LINEAR_SCALE', 'SATISFACTION'].includes(q.type)) {
        const scoreCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let scoreSum = 0;
        let validScoreCount = 0;
        const reasonsList: Array<{ user_name: string; score: number; reason: string; submitted_at: string }> = [];

        answersForQuestion.forEach((ans) => {
          const match = ans.answer_value.match(/^([1-5])점/);
          if (match) {
            const score = parseInt(match[1], 10);
            scoreCounts[score] = (scoreCounts[score] || 0) + 1;
            scoreSum += score;
            validScoreCount++;

            if (ans.answer_value.includes(' - 사유: ')) {
              const reasonText = ans.answer_value.split(' - 사유: ')[1];
              if (reasonText && reasonText.trim()) {
                reasonsList.push({
                  user_name: ans.user_name,
                  score,
                  reason: reasonText.trim(),
                  submitted_at: ans.submitted_at
                });
              }
            }
          }
        });

        const averageScore = validScoreCount > 0 ? Number((scoreSum / validScoreCount).toFixed(1)) : 0;
        const scoreDistribution = [1, 2, 3, 4, 5].map((score) => ({
          score,
          count: scoreCounts[score] || 0,
          percentage: validScoreCount > 0 ? Math.round(((scoreCounts[score] || 0) / validScoreCount) * 100) : 0
        }));

        return {
          question_id: q.id,
          title: q.title,
          type: q.type,
          answered_count: answeredCount,
          average_score: averageScore,
          score_distribution: scoreDistribution,
          reasons: reasonsList
        };
      }

      // Handle Text-based Questions (SHORT_TEXT, LONG_TEXT)
      return {
        question_id: q.id,
        title: q.title,
        type: q.type,
        answered_count: answeredCount,
        recent_text_answers: answersForQuestion.map((ans) => ({
          user_name: ans.user_name,
          username: ans.username,
          text: ans.answer_value,
          submitted_at: ans.submitted_at
        }))
      };
    });

    // Overall Average Satisfaction Calculation across all SATISFACTION questions
    const satisfactionSummaries = questionAnalytics.filter((qa: any) => qa.type === 'SATISFACTION');
    const overallAvgSatisfaction =
      satisfactionSummaries.length > 0
        ? Number(
            (
              satisfactionSummaries.reduce((acc: number, item: any) => acc + (item.average_score || 0), 0) /
              satisfactionSummaries.length
            ).toFixed(1)
          )
        : null;

    return NextResponse.json({
      success: true,
      form: {
        id: form.id,
        title: form.title,
        status: form.status,
        created_at: form.created_at
      },
      summary: {
        total_responses: totalResponses,
        overall_avg_satisfaction: overallAvgSatisfaction
      },
      question_analytics: questionAnalytics
    });
  } catch (err: any) {
    console.error('Form analytics calculation error:', err);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
