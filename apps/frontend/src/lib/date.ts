const MALAYSIA_TIMEZONE = 'Asia/Kuala_Lumpur';
const MALAYSIA_LOCALE = 'ms-MY';
const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;

function toIsoLike(value: string) {
  return value.replace(' ', 'T') + (value.includes('+') || value.endsWith('Z') ? '' : 'Z');
}

export function parseAppDateTime(value: string) {
  return new Date(toIsoLike(value));
}

export function formatMalaysiaTime(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '–';
  return parseAppDateTime(value).toLocaleTimeString(MALAYSIA_LOCALE, {
    timeZone: MALAYSIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatMalaysiaDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return parseAppDateTime(value).toLocaleDateString(MALAYSIA_LOCALE, {
    timeZone: MALAYSIA_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  });
}

export function formatMalaysiaDateLabel(value: string) {
  return parseAppDateTime(value).toLocaleDateString(MALAYSIA_LOCALE, {
    timeZone: MALAYSIA_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getMalaysiaToday() {
  return new Date(Date.now() + MALAYSIA_OFFSET_MS).toISOString().split('T')[0];
}

export function getCurrentMalaysiaMonthPeriod() {
  const now = new Date(Date.now() + MALAYSIA_OFFSET_MS);
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();

  return {
    start: `${year}-${monthLabel}-01`,
    end: `${year}-${monthLabel}-${lastDay}`,
  };
}
