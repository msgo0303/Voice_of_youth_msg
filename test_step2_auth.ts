import crypto from 'crypto';
import path from 'path';
import { verifyTelegramWebAppData, TelegramUser } from './lib/telegramAuth';
import { getAuthSession } from './lib/auth';

function generateInitData(botToken: string, userObj: TelegramUser, authDateSecondsAgo = 0): string {
  const authDate = Math.floor(Date.now() / 1000) - authDateSecondsAgo;
  const userStr = JSON.stringify(userObj);

  const paramsMap: Record<string, string> = {
    auth_date: authDate.toString(),
    user: userStr,
    query_id: 'AAH12345'
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

async function runStep2Tests() {
  console.log("=========================================");
  console.log("   STEP 2: TELEGRAM AUTH & RBAC TESTS    ");
  console.log("=========================================\n");

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

  // 1. 정상 initData -> 인증 성공
  const normalUser: TelegramUser = { id: 999000111, first_name: '일반유저', username: 'normal_user' };
  const validInitData = generateInitData(botToken, normalUser);
  const verifiedUser = verifyTelegramWebAppData(validInitData);
  assert(verifiedUser !== null && verifiedUser.id === 999000111, "1. 정상 initData -> 인증 성공");

  // 2. 변조 initData -> 거부
  const tamperedInitData = validInitData.replace('999000111', '888000222');
  const tamperedUser = verifyTelegramWebAppData(tamperedInitData);
  assert(tamperedUser === null, "2. 변조 initData -> 거부");

  // 3. 만료 initData (25시간 전) -> 거부
  const expiredInitData = generateInitData(botToken, normalUser, 90000); // 90,000 seconds > 24 hours
  const expiredUser = verifyTelegramWebAppData(expiredInitData);
  assert(expiredUser === null, "3. 만료 initData -> 거부");

  // 4. 임의 Telegram User ID 주입 -> 관리자 권한 획득 불가
  const spoofedInitData = validInitData.replace('999000111', '1284576145'); // Super Admin ID
  const spoofedSession = await getAuthSession(spoofedInitData);
  assert(!spoofedSession.authenticated && spoofedSession.role === 'USER', "4. 임의 Telegram User ID 주입 -> 거부 및 관리자 권한 획득 불가");

  // 5. 일반 사용자 (미등록 ID) -> role: 'USER'
  const normalSession = await getAuthSession(validInitData);
  assert(normalSession.authenticated && normalSession.role === 'USER', "5. 일반 사용자 -> 설문 접근 가능 (role: USER)");

  // 6. SUPER_ADMIN 사용자 (1284576145 - DB 등록된 고민석 계정)
  const superAdminUser: TelegramUser = { id: 1284576145, first_name: '고민석', username: 'Go_Min' };
  const superAdminInitData = generateInitData(botToken, superAdminUser);
  const superAdminSession = await getAuthSession(superAdminInitData);
  assert(
    superAdminSession.authenticated && superAdminSession.role === 'SUPER_ADMIN' && superAdminSession.admin?.telegram_user_id === 1284576145,
    "6. SUPER_ADMIN 사용자 -> SUPER_ADMIN 권한 판정 성공"
  );

  console.log(`\n-----------------------------------------`);
  console.log(`Result: ${passed} Passed, ${failed} Failed`);
  console.log(`-----------------------------------------\n`);
}

runStep2Tests().catch(err => {
  console.error("Test execution failed:", err);
});
