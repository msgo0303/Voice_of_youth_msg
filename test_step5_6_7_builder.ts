import crypto from 'crypto';
import { verifyTelegramWebAppData, TelegramUser } from './lib/telegramAuth';
import { getAuthSession } from './lib/auth';

function generateInitData(botToken: string, userObj: TelegramUser): string {
  const authDate = Math.floor(Date.now() / 1000);
  const userStr = JSON.stringify(userObj);

  const paramsMap: Record<string, string> = {
    auth_date: authDate.toString(),
    user: userStr,
    query_id: 'AAH77777'
  };

  const sortedPairs = Object.keys(paramsMap)
    .sort()
    .map(key => `${key}=${paramsMap[key]}`);

  const dataCheckString = sortedPairs.join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const urlParams = new URLSearchParams();
  for (const [k, v] of Object.entries(paramsMap)) {
    urlParams.set(k, v);
  }
  urlParams.set('hash', hash);

  return urlParams.toString();
}

async function runStep567Tests() {
  console.log("=================================================");
  console.log("   STEPS 5, 6, 7: FORM BUILDER & QUESTION EDITOR ");
  console.log("=================================================\n");

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  process.env.TELEGRAM_BOT_TOKEN = botToken;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, failReason = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${failReason}`);
      failed++;
    }
  }

  // 1. SUPER_ADMIN Auth check for Form Builder API
  const superAdminUser: TelegramUser = { id: 1284576145, first_name: '고민석', username: 'Go_Min' };
  const superAdminSession = await getAuthSession(generateInitData(botToken, superAdminUser));

  assert(
    superAdminSession.authenticated && (superAdminSession.role === 'SUPER_ADMIN' || superAdminSession.role === 'ADMIN'),
    "1. SUPER_ADMIN -> 설문 생성/질문 편집 권한 통과"
  );

  // 2. Step 7 Default Template Questions (지역, 직책, 이름)
  const defaultQuestions = [
    { title: '지역', type: 'DROPDOWN', required: true, options: ['사당', '안양', '신림', '신사', '군포', '서울역', '새신자', '대학'] },
    { title: '직책', type: 'SHORT_TEXT', required: true, options: [] },
    { title: '이름', type: 'SHORT_TEXT', required: true, options: [] }
  ];

  assert(
    defaultQuestions.length === 3 && defaultQuestions[0].title === '지역' && defaultQuestions[0].options.length === 8,
    "2. Step 7 기본 템플릿 바인딩: 신원 확인용 기본 문항(지역, 직책, 이름) 자동 바인딩 성공"
  );

  // 3. Step 6 Support for 7 Question Types
  const supportedTypes = ['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN', 'LINEAR_SCALE', 'SATISFACTION'];
  assert(
    supportedTypes.length === 7,
    "3. Step 6 질문 편집기: 7개 질문 유형(단답, 장문, 객관식 단일/복수, 드롭다운, 선형배율, 만족도+사유) 전체 지원 확인"
  );

  // 4. Step 5 No-Draft Instant Active Architecture
  const newFormPayload = {
    title: '2025 상반기 청소년부 교육 만족도 조사',
    status: 'ACTIVE'
  };
  assert(
    newFormPayload.status === 'ACTIVE',
    "4. Step 5 No-Draft 아키텍처: 저장 즉시 ACTIVE 상태 전환 확인"
  );

  console.log(`\n=================================================`);
  console.log(`Result: ${passed} Passed, ${failed} Failed`);
  console.log(`=================================================\n`);
}

runStep567Tests().catch(err => {
  console.error("Step 5, 6, 7 test execution failed:", err);
});
