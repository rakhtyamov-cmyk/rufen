// Расшифровка токенов имени кампании — не задокументировано в репозитории,
// реконструкция по паттерну ~54 имён кампаний. confidence: 'confirmed' —
// подтверждено кодом manage.gs/реальными данными; 'inferred' — вывод по паттерну (помечается *).
const GEO_NAMES = {
  AR: 'Аргентина', BR: 'Бразилия', CA: 'Канада', CL: 'Чили', CO: 'Колумбия', DK: 'Дания',
  EG: 'Египет', ES: 'Испания', FI: 'Финляндия', ID: 'Индонезия', IN: 'Индия', MX: 'Мексика',
  PE: 'Перу', PH: 'Филиппины', PL: 'Польша', TH: 'Таиланд', TR: 'Турция', UK: 'Великобритания',
  US: 'США', WW: 'Worldwide (все страны)',
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const TOKEN_RULES = [
  { re: /^ap_(.+)$/, label: 'Игра / продукт', value: (m) => cap(m[1]), confidence: 'inferred' },
  { re: /^p_(.+)$/, label: 'Закупка', value: (m) => (m[1] === 'inhouse' ? 'In-house' : cap(m[1])), confidence: 'inferred' },
  { re: /^g_([A-Za-z]{2,3})$/, label: 'Гео', value: (m) => `${GEO_NAMES[m[1]] || m[1]} (${m[1]})`, confidence: 'confirmed' },
  { re: /^s_(.+)$/, label: 'Источник трафика', value: (m) => cap(m[1]), confidence: 'inferred' },
  { re: /^acc_(.+)$/, label: 'Доп. аккаунт', value: (m) => m[1], confidence: 'inferred' },
  { re: /^at_(.+)$/, label: 'Платформа / ОС', value: (m) => ({ aos: 'Android', ios: 'iOS' }[m[1]] || m[1]), confidence: 'confirmed' },
  { re: /^u_(.+)$/, label: 'Юнит', value: (m) => ({ ua: 'User Acquisition' }[m[1]] || m[1]), confidence: 'inferred' },
  { re: /^o_(.+)$/, label: 'Стратегия ставок', value: (m) => ({ roas: 'Target ROAS', uac: 'UAC (Max. Conv. Value)' }[m[1]] || m[1]), confidence: 'confirmed' },
  { re: /^t_(.+)$/, label: 'Тир', value: (m) => ({ main: 'Основная' }[m[1]] || m[1]), confidence: 'inferred' },
  { re: /^a_(.+)$/, label: 'Аудитория', value: (m) => ({ broad: 'Широкая' }[m[1]] || m[1]), confidence: 'inferred' },
  { re: /^f_(.+)$/, label: 'Креативы', value: (m) => ({ full: 'Полный набор' }[m[1]] || m[1]), confidence: 'inferred' },
  { re: /^\d{2}\.\d{2}\.\d{4}$/, label: 'Дата запуска/правки', value: (m) => m[0], confidence: 'confirmed' },
];

export function describeSegment(seg) {
  for (const rule of TOKEN_RULES) {
    const m = seg.match(rule.re);
    if (m) return { token: seg, label: rule.label, value: rule.value(m), confidence: rule.confidence };
  }
  return { token: seg, label: 'Вариант / лейбл', value: seg, confidence: 'confirmed' };
}

export function describeCampaignName(name) {
  return name.split('|').map(describeSegment);
}
