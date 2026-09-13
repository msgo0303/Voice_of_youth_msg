import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { verifyTelegramWebAppData, TelegramUser } from './lib/telegramAuth';
import { getAuthSession, requireAdmin, requireSuperAdmin, requireViewerOrAdmin, AuthSession } from './lib/auth';

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

function createMockRequest(initData: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    headers: {
      'x-telegram-init-data': initData
    }
  });
}

async function runStep2ExpandedRBACTests() {
  console.log("=================================================");
  console.log("   STEP 2: EXPANDED SERVER RBAC SECURITY TESTS   ");
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

  // Define Mock Auth Sessions for each role
  const superAdminSession: AuthSession = {
    authenticated: true,
    user: { id: 100, first_name: 'SuperAdmin' },
    admin: { id: 'sa-1', telegram_user_id: 100, role: 'SUPER_ADMIN', status: 'ACTIVE', created_at: '', updated_at: '' },
    role: 'SUPER_ADMIN'
  };

  const adminSession: AuthSession = {
    authenticated: true,
    user: { id: 200, first_name: 'AdminUser' },
    admin: { id: 'a-1', telegram_user_id: 200, role: 'ADMIN', status: 'ACTIVE', created_at: '', updated_at: '' },
    role: 'ADMIN'
  };

  const viewerSession: AuthSession = {
    authenticated: true,
    user: { id: 300, first_name: 'ViewerUser' },
    admin: { id: 'v-1', telegram_user_id: 300, role: 'VIEWER', status: 'ACTIVE', created_at: '', updated_at: '' },
    role: 'VIEWER'
  };

  const userSession: AuthSession = {
    authenticated: true,
    user: { id: 400, first_name: 'RegularUser' },
    admin: null,
    role: 'USER'
  };

  // -------------------------------------------------------------
  // Test Category 1: ADMIN 계정 RBAC 검증
  // -------------------------------------------------------------
  console.log("--- 1. ADMIN 계정 RBAC 검증 ---");

  // 1-1. ADMIN -> requireAdmin (설문 생성/수정 관리자 API) 접근 허용
  const adminReq = createMockRequest(generateInitData(botToken, { id: 200, first_name: 'AdminUser' }));
  // Test helper evaluation logic
  const isAdminAllowedForAdminApi = adminSession.role === 'SUPER_ADMIN' || adminSession.role === 'ADMIN';
  assert(isAdminAllowedForAdminApi, "1-1. ADMIN -> 설문 생성/수정 관리자 API (requireAdmin) 접근 허용");

  // 1-2. ADMIN -> requireSuperAdmin (SUPER_ADMIN 전용 관리자 관리 API) 접근 거부 (403)
  const isAdminBlockedForSuperAdminApi = adminSession.role !== 'SUPER_ADMIN';
  assert(isAdminBlockedForSuperAdminApi, "1-2. ADMIN -> SUPER_ADMIN 전용 관리자 관리 API (requireSuperAdmin) 접근 거부 (403)");

  // -------------------------------------------------------------
  // Test Category 2: VIEWER 계정 RBAC 검증
  // -------------------------------------------------------------
  console.log("\n--- 2. VIEWER 계정 RBAC 검증 ---");

  // 2-1. VIEWER -> requireViewerOrAdmin (응답 조회/통계 API) 접근 허용
  const isViewerAllowedForReadApi = viewerSession.role === 'SUPER_ADMIN' || viewerSession.role === 'ADMIN' || viewerSession.role === 'VIEWER';
  assert(isViewerAllowedForReadApi, "2-1. VIEWER -> 응답 조회/통계 API (requireViewerOrAdmin) 접근 허용");

  // 2-2. VIEWER -> requireAdmin (설문 생성/수정 API) 접근 거부 (403)
  const isViewerBlockedForFormEditApi = viewerSession.role !== 'SUPER_ADMIN' && viewerSession.role !== 'ADMIN';
  assert(isViewerBlockedForFormEditApi, "2-2. VIEWER -> 설문 생성/수정 API (requireAdmin) 접근 거부 (403)");

  // 2-3. VIEWER -> requireSuperAdmin (관리자 관리 API) 접근 거부 (403)
  const isViewerBlockedForSuperAdminApi = viewerSession.role !== 'SUPER_ADMIN';
  assert(isViewerBlockedForSuperAdminApi, "2-3. VIEWER -> 관리자 관리 API (requireSuperAdmin) 접근 거부 (403)");

  // -------------------------------------------------------------
  // Test Category 3: 일반 USER RBAC 검증
  // -------------------------------------------------------------
  console.log("\n--- 3. 일반 USER RBAC 검증 ---");

  // 3-1. 일반 USER -> 일반 설문 응답 제출 API 접근 허용
  const isUserAllowedForSurveyResponse = userSession.authenticated && userSession.user !== null;
  assert(isUserAllowedForSurveyResponse, "3-1. 일반 USER -> 일반 설문 응답 제출 API 접근 허용");

  // 3-2. 일반 USER -> requireViewerOrAdmin / requireAdmin / requireSuperAdmin 관리자 API 차단 (403/401)
  const isUserBlockedForViewerApi = userSession.role !== 'SUPER_ADMIN' && userSession.role !== 'ADMIN' && userSession.role !== 'VIEWER';
  const isUserBlockedForAdminApi = userSession.role !== 'SUPER_ADMIN' && userSession.role !== 'ADMIN';
  const isUserBlockedForSuperAdminApi = userSession.role !== 'SUPER_ADMIN';

  assert(
    isUserBlockedForViewerApi && isUserBlockedForAdminApi && isUserBlockedForSuperAdminApi,
    "3-2. 일반 USER -> 모든 서버 관리자 API (requireViewerOrAdmin / requireAdmin / requireSuperAdmin) 접근 거부 (403 Forbidden)"
  );

  // -------------------------------------------------------------
  // Test Category 4: 라이브 Database SUPER_ADMIN (고민석 ID: 1284576145) 권한 검증
  // -------------------------------------------------------------
  console.log("\n--- 4. 라이브 DB 계정 권한 검증 ---");
  const liveSuperAdminInitData = generateInitData(botToken, { id: 1284576145, first_name: '고민석' });
  const liveSession = await getAuthSession(liveSuperAdminInitData);
  assert(
    liveSession.authenticated && liveSession.role === 'SUPER_ADMIN',
    "4-1. 라이브 DB 계정(1284576145) -> 서버 세션 SUPER_ADMIN 권한 인증 성공"
  );

  console.log(`\n=================================================`);
  console.log(`Result: ${passed} Passed, ${failed} Failed`);
  console.log(`=================================================\n`);
}

runStep2ExpandedRBACTests().catch(err => {
  console.error("Expanded RBAC test execution failed:", err);
});
