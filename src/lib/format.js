export function pct(x) {
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
