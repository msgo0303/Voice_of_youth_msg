/**
 * Date and Time utilities for KST (Korea Standard Time, UTC+9)
 */

/**
 * Format date to Korean Standard Time (KST) string
 * Example: 2026. 10. 27. 오후 10:25:00
 */
export function formatToKst(date: Date | string | number = new Date()): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

/**
 * Format date to Korean standard YYYY. MM. DD HH:mm format
 * Example: 2026. 10. 27 22:25
 */
export function formatKstDateTime(date: Date | string | number = new Date()): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);

  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  return `${getPart('year')}. ${getPart('month')}. ${getPart('day')} ${getPart('hour')}:${getPart('minute')}`;
}
