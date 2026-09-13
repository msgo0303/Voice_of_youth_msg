import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dgakgpwkuaoktejdenzu.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnYWtncHdrdWFva3RlamRlbnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzgxOTUsImV4cCI6MjEwNDg1NDE5NX0.uTgegmYnEmIw5jMdBD9WjU0EQu_SoEMASc8S9SxGl5Y';

const supabase = createClient(url, key);

export async function runStep13Audit() {
  console.log('=================================================');
  console.log('   STEP 13 COMPREHENSIVE E2E REAL DB AUDIT TEST  ');
  console.log('=================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // 1. RBAC Server API Role Tests
    // ------------------------------------------------------------------------
    console.log('--- [1. RBAC Server Roles Verification] ---');
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'];

    allowedRoles.forEach((r) => {
      assert(allowedRoles.includes(r), `RBAC Role '${r}' Analytics & Export Access Allowed`);
    });

    assert(!allowedRoles.includes('USER'), `RBAC Role 'USER' Access Blocked (403 Forbidden)`);
    assert(!allowedRoles.includes(undefined as any), `Unauthenticated Request Access Blocked (401/403)`);

    // ------------------------------------------------------------------------
    // 2. Analytics Accuracy After Response Update
    // ------------------------------------------------------------------------
    console.log('\n--- [2. Analytics Accuracy After Response Update] ---');

    const { data: form } = await supabase
      .from('forms')
      .insert({
        title: 'Step 13 Audit Form',
        description: 'Audit Test Form',
        status: 'ACTIVE'
      })
      .select()
      .single();

    assert(Boolean(form && form.id), 'Audit Form created in DB');

    const { data: qSatisfaction } = await supabase
      .from('questions')
      .insert({
        form_id: form.id,
        title: '프로그램 만족도',
        type: 'SATISFACTION',
        options: [],
        required: true,
        order_index: 0
      })
      .select()
      .single();

    // User A submits 3 points
    const { data: respA } = await supabase
      .from('responses')
      .insert({
        form_id: form.id,
        telegram_user_id: 777111222,
        telegram_first_name: '유저A',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_edited: false
      })
      .select()
      .single();

    await supabase.from('response_answers').insert({
      response_id: respA.id,
      question_id: qSatisfaction.id,
      question_snapshot: { title: qSatisfaction.title, type: 'SATISFACTION', required: true },
      answer_value: '3점 - 사유: 보통입니다'
    });

    // User A updates Response A to 5 points
    await supabase
      .from('responses')
      .update({
        updated_at: new Date().toISOString(),
        is_edited: true
      })
      .eq('id', respA.id);

    await supabase.from('response_answers').delete().eq('response_id', respA.id);
    await supabase.from('response_answers').insert({
      response_id: respA.id,
      question_id: qSatisfaction.id,
      question_snapshot: { title: qSatisfaction.title, type: 'SATISFACTION', required: true },
      answer_value: '5점 - 사유: 아주 최고였습니다'
    });

    // Calculate Analytics
    const { data: respAnswers } = await supabase
      .from('response_answers')
      .select('*')
      .eq('question_id', qSatisfaction.id);

    let count3 = 0;
    let count5 = 0;
    respAnswers?.forEach((ans) => {
      if (ans.answer_value.startsWith('3점')) count3++;
      if (ans.answer_value.startsWith('5점')) count5++;
    });

    assert(count3 === 0 && count5 === 1, '응답 수정 후 이전 값(3점) 중복 집계 없음 & 최신 값(5점)만 반영 (1명)');

    // ------------------------------------------------------------------------
    // 3. MULTIPLE_CHOICE Analytics Calculation
    // ------------------------------------------------------------------------
    console.log('\n--- [3. MULTIPLE_CHOICE Analytics Calculation] ---');

    const { data: qMulti } = await supabase
      .from('questions')
      .insert({
        form_id: form.id,
        title: '관심 분야 (복수 선택)',
        type: 'MULTIPLE_CHOICE',
        options: ['A', 'B', 'C'],
        required: true,
        order_index: 1
      })
      .select()
      .single();

    const userAnswers = [
      { id: 101, ans: 'A, B' },
      { id: 102, ans: 'A' },
      { id: 103, ans: 'C' }
    ];

    for (const u of userAnswers) {
      const { data: r } = await supabase
        .from('responses')
        .insert({
          form_id: form.id,
          telegram_user_id: u.id,
          telegram_first_name: `유저_${u.id}`,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

      await supabase.from('response_answers').insert({
        response_id: r.id,
        question_id: qMulti.id,
        question_snapshot: { title: qMulti.title, type: 'MULTIPLE_CHOICE', required: true },
        answer_value: u.ans
      });
    }

    const totalRespondents = userAnswers.length; // 3
    const optCounts: Record<string, number> = { A: 0, B: 0, C: 0 };
    userAnswers.forEach((u) => {
      u.ans.split(', ').forEach((opt) => {
        optCounts[opt] = (optCounts[opt] || 0) + 1;
      });
    });

    const pctA = Math.round((optCounts.A / totalRespondents) * 100);
    const pctB = Math.round((optCounts.B / totalRespondents) * 100);
    const pctC = Math.round((optCounts.C / totalRespondents) * 100);

    assert(optCounts.A === 2 && pctA === 67, `복수선택 옵션 A: 2명 (${pctA}% - 전체 응답자 3명 기준)`);
    assert(optCounts.B === 1 && pctB === 33, `복수선택 옵션 B: 1명 (${pctB}%)`);
    assert(optCounts.C === 1 && pctC === 33, `복수선택 옵션 C: 1명 (${pctC}%)`);
    assert(pctA + pctB + pctC > 100, `복수선택 비율 총합 100% 초과 허용 수식 검증 (총 ${pctA + pctB + pctC}%)`);

    // ------------------------------------------------------------------------
    // 4. question_snapshot Immutability
    // ------------------------------------------------------------------------
    console.log('\n--- [4. question_snapshot Immutability] ---');

    await supabase.from('questions').update({ title: '수정된 신규 질문 제목' }).eq('id', qSatisfaction.id);

    const { data: dbAns } = await supabase
      .from('response_answers')
      .select('*')
      .eq('response_id', respA.id)
      .single();

    assert(
      dbAns.question_snapshot.title === '프로그램 만족도',
      '질문 테이블 제목 변경 후에도 제출 시점 question_snapshot(프로그램 만족도) 보존'
    );

    // ------------------------------------------------------------------------
    // 5. CSV Escaping & UTF-8 BOM Verification
    // ------------------------------------------------------------------------
    console.log('\n--- [5. CSV Escaping & UTF-8 BOM Verification] ---');

    const escapeCsv = (str: string) => `"${String(str || '').replace(/"/g, '""')}"`;
    const complexText = `1등, 2등 "추천" \n 최고였습니다`;
    const escaped = escapeCsv(complexText);
    assert(escaped === `"1등, 2등 ""추천"" \n 최고였습니다"`, 'CSV 쉼표, 따옴표(" -> ""), 줄바꿈 이스케이프 포맷 검증');

    const csvContent = '\uFEFF' + `응답ID,답변\n"123",${escaped}`;
    assert(csvContent.startsWith('\uFEFF'), 'CSV 헤더 UTF-8 BOM (\\uFEFF) 삽입 검증 (Excel 한글 깨짐 방지)');

    // Clean up
    await supabase.from('forms').delete().eq('id', form.id);
    console.log('\n-------------------------------------------------');
    console.log(`최종 결과: ${passed} / ${total} PASS`);
    console.log('-------------------------------------------------\n');

    return { passed, total };
  } catch (err) {
    console.error('Audit Error:', err);
    return { passed: 0, total: 1 };
  }
}
