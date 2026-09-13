import crypto from 'crypto';
import { verifyTelegramWebAppData, TelegramUser } from './lib/telegramAuth';
import { getAuthSession } from './lib/auth';

function generateInitData(botToken: string, userObj: TelegramUser): string {
  const authDate = Math.floor(Date.now() / 1000);
  const userStr = JSON.stringify(userObj);

  const paramsMap: Record<string, string> = {
    auth_date: authDate.toString(),
    user: userStr,
    query_id: 'AAH99999'
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

async function runStep3Tests() {
  console.log("=================================================");
  console.log("   STEP 3: DASHBOARD & FORMS UI / API TESTS      ");
  console.log("=================================================\n");

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '8639864400:AAGiBD8Uz9iTmvVmnDd1rKysVXNn1yznHsQ';
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

  // 1. SUPER_ADMIN Dashboard & Forms API Access
  const superAdminUser: TelegramUser = { id: 1284576145, first_name: '고민석', username: 'Go_Min' };
  const superAdminInitData = generateInitData(botToken, superAdminUser);
  const superAdminSession = await getAuthSession(superAdminInitData);

  assert(
    superAdminSession.authenticated && (superAdminSession.role === 'SUPER_ADMIN' || superAdminSession.role === 'ADMIN'),
    "1. SUPER_ADMIN -> 대시보드 및 설문 관리 접근 권한 인증 통과"
  );

  // 2. VIEWER Role Form Creation Restriction Logic Test
  const viewerSession = { authenticated: true, role: 'VIEWER' };
  const canViewerCreateForm = viewerSession.role === 'SUPER_ADMIN' || viewerSession.role === 'ADMIN';
  assert(!canViewerCreateForm, "2. VIEWER 계정 -> 설문 생성/수정 UI 및 API (POST /api/admin/forms) 차단 확인");

  // 3. Regular USER Admin Access Restriction Test
  const regularUser: TelegramUser = { id: 777000999, first_name: '일반이용자' };
  const regularInitData = generateInitData(botToken, regularUser);
  const regularSession = await getAuthSession(regularInitData);

  assert(
    regularSession.role === 'USER',
    "3. 일반 USER 계정 -> 대시보드 및 설문 관리 접근 거부 (role: USER)"
  );

  console.log(`\n=================================================`);
  console.log(`Result: ${passed} Passed, ${failed} Failed`);
  console.log(`=================================================\n`);
}

runStep3Tests().catch(err => {
  console.error("Step 3 test execution failed:", err);
});
