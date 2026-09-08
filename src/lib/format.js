export function pct(x) {
  // null/undefined — не "0%", а "кампании ещё не было в этот день"
  // (актуально для исторических дней из history.mock.json).
  if (x === null || x === undefined) return '—';
  return Math.round(x * 100) + '%';
}

export function parseCampaignName(name) {
  const geoMatch = name.match(/\|g_([A-Za-z]+)\|/);
  const dateMatch = name.match(/\|(\d{2}\.\d{2}\.\d{4})\|/);
  const gameMatch = name.match(/^ap_([a-z0-9]+)/i);
  return {
    geo: geoMatch ? geoMatch[1] : '—',
    date: dateMatch ? dateMatch[1] : null,
    game: gameMatch ? gameMatch[1] : null,
  };
}

export function daysAgo(dateStr, referenceIso) {
  if (!dateStr) return null;
  const [d, m, y] = dateStr.split('.').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date(referenceIso);
  return Math.round((now - then) / 86400000);
}

export function campaignAdsUrl(c) {
  if (!c._ocid) return null;
  return `https://ads.google.com/aw/campaigns?campaignId=${encodeURIComponent(c._campaignId)}&ocid=${encodeURIComponent(c._ocid)}`;
}

// Общий расчёт дат для окна installs7d/history — используется и Sparkline
// (подписи под барами), и DateSelector (пункты выбора). Единая функция —
// чтобы оба места сходились на одном и том же дне при одном и том же индексе,
// а не считали дату каждый по-своему (риск разъехаться на день в другом
// часовом поясе браузера).
export function windowDates(n, generatedAt) {
  if (!generatedAt) return null;
  const end = new Date(generatedAt);
  end.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
}

export const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
