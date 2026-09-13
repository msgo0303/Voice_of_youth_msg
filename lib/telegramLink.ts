/**
 * Telegram Deep Link & Share URL Helpers
 */

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || 'Voymsg_bot';

export function getTelegramMiniAppUrl(formId: string): string {
  return `https://t.me/${BOT_USERNAME}?startapp=form_${formId}`;
}

export function getTelegramBotStartUrl(formId: string): string {
  return `https://t.me/${BOT_USERNAME}?start=form_${formId}`;
}

export function getTelegramShareUrl(formId: string, formTitle: string): string {
  const miniAppUrl = getTelegramMiniAppUrl(formId);
  const text = `📋 [설문 참여] ${formTitle}\n아래 링크를 눌러 텔레그램에서 설문에 참여해 주세요!`;
  return `https://t.me/share/url?url=${encodeURIComponent(miniAppUrl)}&text=${encodeURIComponent(text)}`;
}

