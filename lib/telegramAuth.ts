import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

/**
 * 텔레그램 미니앱 initData 검증 함수
 */
export function verifyTelegramWebAppData(telegramInitData: string): TelegramUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is missing');
    return null;
  }

  const urlParams = new URLSearchParams(telegramInitData);
  const hash = urlParams.get('hash');
  if (!hash) return null;

  urlParams.delete('hash');

  // 알파벳 순 정렬 후 key=value\n 포맷 구성
  const params: string[] = [];
  Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      params.push(`${key}=${value}`);
    });
  const dataCheckString = params.join('\n');

  // HMAC-SHA256 시크릿 생성
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // 최종 해시 계산
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    return null; // 데이터 위조됨
  }

  const userStr = urlParams.get('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}
