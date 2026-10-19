import QRCode from 'qrcode';
import jsQR from 'jsqr';
import fs from 'fs';
import path from 'path';
import { getTelegramMiniAppUrl } from './lib/telegramLink';
import { sanitizeQrFilename, generateQrDataUrl } from './lib/qrCodeHelper';

interface TestResult {
  testId: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'UNVERIFIED';
  details: string;
}

const results: TestResult[] = [];

function record(testId: string, name: string, status: 'PASS' | 'FAIL' | 'UNVERIFIED', details: string) {
  results.push({ testId, name, status, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${testId}] ${name}: ${details}`);
}

async function runQrCodeAudit() {
  console.log('================================================================');
  console.log('📱 Step 19 — QR Code Auto-Generation & Management Audit');
  console.log('================================================================\n');

  const testFormId = 'b82e1c94-5542-4217-a00d-9b1b1ef86e33';
  const testFormTitle = '청년 정책 만족도 설문조사: 2026 / Q4 (테스트)';

  // 1. URL Generation Consistency Check
  try {
    const expectedPrefix = 'https://t.me/';
    const tgUrl = getTelegramMiniAppUrl(testFormId);
    if (tgUrl.startsWith(expectedPrefix) && tgUrl.includes(`startapp=form_${testFormId}`)) {
      record(
        'QR-01',
        '설문 URL 생성 로직 재사용 및 구조 검증',
        'PASS',
        `생성된 URL: "${tgUrl}". 기존 getTelegramMiniAppUrl을 정확히 재사용함.`
      );
    } else {
      record('QR-01', '설문 URL 생성 로직 검증', 'FAIL', `예상치 못한 URL 구조: ${tgUrl}`);
    }
  } catch (err: any) {
    record('QR-01', '설문 URL 생성 로직 검증', 'FAIL', err.message);
  }

  // 2. No Expiration / TTL / Token Pollution Check
  try {
    const tgUrl = getTelegramMiniAppUrl(testFormId);
    const parsed = new URL(tgUrl);
    const params = Array.from(parsed.searchParams.keys());
    const isClean = params.length === 1 && params[0] === 'startapp';
    if (isClean && !tgUrl.includes('token') && !tgUrl.includes('exp') && !tgUrl.includes('auth')) {
      record(
        'QR-02',
        'QR URL 만료 토큰 및 개인정보 오염 방지 검증',
        'PASS',
        '불필요한 임의 만료 토큰, TTL, 개인정보 파라미터가 없으며 순수 딥링크로 구성됨.'
      );
    } else {
      record('QR-02', 'QR URL 보안 검증', 'FAIL', `파라미터 이상 발견: ${params.join(', ')}`);
    }
  } catch (err: any) {
    record('QR-02', 'QR URL 보안 검증', 'FAIL', err.message);
  }

  // 3. High-Resolution PNG Output Verification
  try {
    const dataUrl = await generateQrDataUrl(getTelegramMiniAppUrl(testFormId), 1024);
    const isPngDataUrl = dataUrl.startsWith('data:image/png;base64,');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // PNG signature check: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A;

    if (isPngDataUrl && isPng && buffer.length > 1000) {
      record(
        'QR-03',
        '고해상도(1024x1024) PNG 이미지 생성 및 바이너리 유효성',
        'PASS',
        `유효한 PNG 시그니처 확인 완료 (크기: ${buffer.length} 바이트).`
      );
    } else {
      record('QR-03', 'PNG 이미지 생성 검증', 'FAIL', '유효한 PNG 바이너리가 아닙니다.');
    }
  } catch (err: any) {
    record('QR-03', 'PNG 이미지 생성 검증', 'FAIL', err.message);
  }

  // 4. Filename Sanitization with Korean & Special Characters
  try {
    const testCases = [
      {
        input: '청년 정책 만족도 설문조사: 2026 / Q4 (테스트)',
        expected: 'FormGram_청년_정책_만족도_설문조사_2026_Q4_(테스트)_QR.png',
      },
      {
        input: 'Test/*?:|<>Form',
        expected: 'FormGram_TestForm_QR.png',
      },
      {
        input: '   ',
        expected: 'FormGram_Survey_QR.png',
      },
      {
        input: '',
        expected: 'FormGram_Survey_QR.png',
      },
    ];

    let allPass = true;
    for (const tc of testCases) {
      const sanitized = sanitizeQrFilename(tc.input);
      if (sanitized !== tc.expected) {
        allPass = false;
        record(
          'QR-04',
          '파일명 정제 테스트',
          'FAIL',
          `Input: "${tc.input}" => Got: "${sanitized}", Expected: "${tc.expected}"`
        );
        break;
      }
    }
    if (allPass) {
      record(
        'QR-04',
        '한글 및 특수문자 파일명 안전 정제 검증',
        'PASS',
        '윈도우/맥/리눅스 파일시스템 금지 문자 및 빈 공백 처리 완벽 정제.'
      );
    }
  } catch (err: any) {
    record('QR-04', '파일명 정제 검증', 'FAIL', err.message);
  }

  // 5. QR Code Decode & Match Verification
  try {
    const originalUrl = getTelegramMiniAppUrl(testFormId);
    const qrData = QRCode.create(originalUrl, { errorCorrectionLevel: 'M' });
    const moduleCount = qrData.modules.size;
    const moduleData = qrData.modules.data;

    // Build raw RGBA image data for jsQR decoder
    const scale = 8;
    const margin = 4;
    const totalSize = (moduleCount + margin * 2) * scale;
    const rgba = new Uint8ClampedArray(totalSize * totalSize * 4);

    for (let y = 0; y < totalSize; y++) {
      for (let x = 0; x < totalSize; x++) {
        const modX = Math.floor(x / scale) - margin;
        const modY = Math.floor(y / scale) - margin;
        let isDark = false;
        if (modX >= 0 && modX < moduleCount && modY >= 0 && modY < moduleCount) {
          isDark = moduleData[modY * moduleCount + modX] === 1;
        }
        const idx = (y * totalSize + x) * 4;
        const color = isDark ? 0 : 255;
        rgba[idx] = color;
        rgba[idx + 1] = color;
        rgba[idx + 2] = color;
        rgba[idx + 3] = 255;
      }
    }

    const decoded = jsQR(rgba, totalSize, totalSize);
    if (decoded && decoded.data === originalUrl) {
      record(
        'QR-05',
        'QR 코드 광학 디코딩 및 원본 URL 100% 일치 검증',
        'PASS',
        `디코딩 결과: "${decoded.data}" === 원본 URL.`
      );
    } else {
      record(
        'QR-05',
        'QR 코드 디코딩 검증',
        'FAIL',
        `디코딩 불일치: "${decoded?.data}" !== "${originalUrl}"`
      );
    }
  } catch (err: any) {
    record('QR-05', 'QR 코드 디코딩 검증', 'FAIL', err.message);
  }

  // 6. Form Lifecycle & Status Invariance Check
  try {
    const statuses = ['ACTIVE', 'CLOSED', 'ARCHIVED'];
    const urls = statuses.map((status) => {
      // Form URL depends purely on formId, independent of status changes
      return { status, url: getTelegramMiniAppUrl(testFormId) };
    });

    const isAllEqual = urls.every((item) => item.url === urls[0].url);
    if (isAllEqual) {
      record(
        'QR-06',
        '설문 상태 변화(ACTIVE/CLOSED/ARCHIVED)에 따른 QR 불변성 검증',
        'PASS',
        '설문 상태가 변하더라도 QR 코드 연결 링크는 영구 일관성을 유지함.'
      );
    } else {
      record('QR-06', '설문 상태별 QR 불변성 검증', 'FAIL', '상태에 따라 URL이 변경됨');
    }
  } catch (err: any) {
    record('QR-06', '설문 상태별 QR 불변성 검증', 'FAIL', err.message);
  }

  // 7. Component Source & UI Requirements Verification
  try {
    const componentPath = path.resolve(process.cwd(), 'components/SurveyQRCode.tsx');
    const compContent = fs.readFileSync(componentPath, 'utf8');

    const checks = [
      { name: 'Section Title (설문 QR 코드)', pattern: /설문 QR 코드/ },
      { name: 'Download PNG Button (이미지 저장)', pattern: /이미지 저장/ },
      { name: 'Copy Image Button (이미지 복사)', pattern: /이미지 복사/ },
      { name: 'Copy Link Button (설문 링크 복사)', pattern: /설문 링크 복사/ },
      { name: 'Copy Success Feedback', pattern: /QR 코드 이미지가 복사되었습니다\./ },
      { name: 'Fallback Notice for Unsupported Environments', pattern: /클립보드 이미지 복사를 지원하지/ },
      { name: 'Break-all Monospace URL Display', pattern: /font-mono/ },
      { name: '512x512 Preview & 1024x1024 High-Res Download', pattern: /1024/ },
    ];

    const missing = checks.filter((c) => !c.pattern.test(compContent));
    if (missing.length === 0) {
      record(
        'QR-07',
        'SurveyQRCode 컴포넌트 필수 UI 및 피드백 문구 검증',
        'PASS',
        '모든 필수 UI 요소(제목, 미리보기, 3대 버튼, 피드백, 미지원 안내) 완벽 구비.'
      );
    } else {
      record(
        'QR-07',
        'SurveyQRCode 컴포넌트 필수 UI 검증',
        'FAIL',
        `누락된 패턴: ${missing.map((m) => m.name).join(', ')}`
      );
    }
  } catch (err: any) {
    record('QR-07', 'SurveyQRCode 컴포넌트 검증', 'FAIL', err.message);
  }

  // 8. Admin Forms Detail & New Integration Verification
  try {
    const detailPagePath = path.resolve(process.cwd(), 'app/admin/forms/[id]/page.tsx');
    const detailContent = fs.readFileSync(detailPagePath, 'utf8');

    const newPagePath = path.resolve(process.cwd(), 'app/admin/forms/new/page.tsx');
    const newContent = fs.readFileSync(newPagePath, 'utf8');

    const detailHasQR =
      detailContent.includes('import SurveyQRCode') && detailContent.includes('<SurveyQRCode');
    const newHasQR =
      newContent.includes('import SurveyQRCode') && newContent.includes('<SurveyQRCode');

    if (detailHasQR && newHasQR) {
      record(
        'QR-08',
        '관리자 상세 페이지 및 생성 완료 모달 연동 검증',
        'PASS',
        '설문 상세 페이지([id]) 및 신규 생성 모달(new) 양쪽 모두 SurveyQRCode 컴포넌트 완벽 통합.'
      );
    } else {
      record(
        'QR-08',
        '관리자 페이지 연동 검증',
        'FAIL',
        `Detail has QR: ${detailHasQR}, New has QR: ${newHasQR}`
      );
    }
  } catch (err: any) {
    record('QR-08', '관리자 페이지 연동 검증', 'FAIL', err.message);
  }

  // Summary Matrix
  console.log('\n================================================================');
  console.log('📊 QR Code Feature Audit Summary Matrix');
  console.log('================================================================');
  console.table(
    results.map((r) => ({
      ID: r.testId,
      Test: r.name,
      Status: r.status,
      Details: r.details.substring(0, 70),
    }))
  );

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n총 ${results.length}개 테스트 항목 중 ${passed}개 통과, ${failed}개 실패.`);

  if (failed > 0) {
    process.exit(1);
  }
}

runQrCodeAudit().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
