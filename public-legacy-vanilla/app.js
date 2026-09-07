// Прототип дашборда поверх дайджеста google-ads-management.
// Зеркалит ACTIONS/sortRank из tools/google-ads-management/manage.gs — держите в синхроне,
// если решите превратить прототип в постоянный инструмент (см. README).

// `act` скопирован 1:1 из ACTIONS в manage.gs — HOLD/WAIT_* информационные,
// остальные требуют реального вмешательства менеджера.
const ACTIONS = {
  STOP:              { sortRank: 0, label: 'Остановить кампанию',           emoji: '🛑', status: 'critical', act: true },
  NOT_ELIGIBLE:      { sortRank: 1, label: 'Не показывается - в поддержку', emoji: '🚫', status: 'critical', act: true },
  LAUNCH_COPY:       { sortRank: 2, label: 'Запустить копию',               emoji: '🔁', status: 'serious',  act: true },
  LOWER_STEP:        { sortRank: 3, label: 'Снизить tROAS (шаг -20%)',      emoji: '⬇️', status: 'warning',  act: true },
  REVIEW:            { sortRank: 4, label: 'Снизить tROAS или наблюдать',  emoji: '🤔', status: 'warning',  act: true },
  RAISE_TROAS:       { sortRank: 5, label: 'Поднять tROAS',                 emoji: '⬆️', status: 'good',     act: true },
  HOLD:              { sortRank: 6, label: 'Ничего не делать / бюджет',     emoji: '✅', status: 'good',     act: false },
  WAIT_LEARNING:     { sortRank: 7, label: 'Ждать (обучение)',              emoji: '⏳', status: 'neutral',  act: false },
  WAIT_CONV_WINDOW:  { sortRank: 8, label: 'Ждать (окно конверсии)',        emoji: '⏳', status: 'neutral',  act: false },
};

// Самые severe исходы — драйвят отдельный "критический" stat-тайл (не путать с
// URGENT_ACTIONS.act в manage.gs, которое шире — почти все не-WAIT действия).
// NOT_ELIGIBLE (Д2) добавлен: кампания вообще не показывается, это не менее
// срочно, чем Stop/Launch Copy.
const URGENT_ACTIONS = new Set(['STOP', 'NOT_ELIGIBLE', 'LAUNCH_COPY']);

const ICONS = {
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-linecap="round"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke-linecap="round"/></svg>',
  budget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.5-1.5-2-3-2s-3 .8-3 2 1.5 2 3 2 3 .5 3 2-1.5 2-3 2-3-.5-3-2" stroke-linecap="round"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2c1 3-2 4-2 7a2 2 0 0 0 4 0c1.5 1.5 2 3.5 2 5a6 6 0 1 1-12 0c0-3 2-4 3-7 0 2 1 3 2 3s1-2 1-2c1-2 1.5-4 2-6Z" stroke-linejoin="round"/></svg>',
};

const state = {
  raw: null,
  search: '',
  activeActions: new Set(),   // empty = all
  account: '',
  geo: '',
  sortBy: 'urgency',
  collapsed: new Set(),
  expandedHistory: new Set(),   // campaign name -> история раскрыта
};

// change_event: Google Ads API поле -> человекочитаемая метка + иконка.
// См. tools/google-ads-management/manage.gs (applyChangeHistory_/processChangeEvents_) —
// та же семантика полей change_event, что и в проде.
const FIELD_META = {
  'targetRoas.targetRoas': { label: 'Изменён tROAS', icon: '🎯' },
  'amountMicros':          { label: 'Изменён бюджет', icon: '💰' },
  'status':                { label: 'Изменён статус', icon: '⏯️' },
  'name':                  { label: 'Переименована', icon: '🏷️' },
};
const OPERATION_META = {
  CREATE: { label: 'создан(а)', dotClass: 'history-item__dot--create' },
  UPDATE: { label: 'изменение', dotClass: '' },
  REMOVE: { label: 'удалён(а)', dotClass: '' },
};
const RESOURCE_LABEL = { CAMPAIGN: 'Кампания', CAMPAIGN_BUDGET: 'Бюджет' };

// flags_() коды из manage.gs -> иконка для чипа на карточке.
const FLAG_ICON = {
  Д1: '🚫', Д3: '🎨', п14: '📉', LIMITED: 'ℹ️', REVIEW_PENDING: '⏳',
};

/* ---------- Campaign-name token breakdown (не задокументировано в репо —
 * реконструкция по паттерну ~54 имён кампаний; помечено ниже per-токен). ---------- */
const GEO_NAMES = {
  AR: 'Аргентина', BR: 'Бразилия', CA: 'Канада', CL: 'Чили', CO: 'Колумбия', DK: 'Дания',
  EG: 'Египет', ES: 'Испания', FI: 'Финляндия', ID: 'Индонезия', IN: 'Индия', MX: 'Мексика',
  PE: 'Перу', PH: 'Филиппины', PL: 'Польша', TH: 'Таиланд', TR: 'Турция', UK: 'Великобритания',
  US: 'США', WW: 'Worldwide (все страны)',
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// confidence: 'confirmed' — подтверждено кодом/данными; 'inferred' — вывод по паттерну (помечается *)
const TOKEN_RULES = [
  { re: /^ap_(.+)$/,   label: 'Игра / продукт',    value: m => cap(m[1]), confidence: 'inferred' },
  { re: /^p_(.+)$/,    label: 'Закупка',            value: m => m[1] === 'inhouse' ? 'In-house' : cap(m[1]), confidence: 'inferred' },
  { re: /^g_([A-Za-z]{2,3})$/, label: 'Гео',        value: m => `${GEO_NAMES[m[1]] || m[1]} (${m[1]})`, confidence: 'confirmed' },
  { re: /^s_(.+)$/,    label: 'Источник трафика',   value: m => cap(m[1]), confidence: 'inferred' },
  { re: /^acc_(.+)$/,  label: 'Доп. аккаунт',       value: m => m[1], confidence: 'inferred' },
  { re: /^at_(.+)$/,   label: 'Платформа / ОС',     value: m => ({ aos: 'Android', ios: 'iOS' }[m[1]] || m[1]), confidence: 'confirmed' },
  { re: /^u_(.+)$/,    label: 'Юнит',               value: m => ({ ua: 'User Acquisition' }[m[1]] || m[1]), confidence: 'inferred' },
  { re: /^o_(.+)$/,    label: 'Стратегия ставок',   value: m => ({ roas: 'Target ROAS', uac: 'UAC (Max. Conv. Value)' }[m[1]] || m[1]), confidence: 'confirmed' },
  { re: /^t_(.+)$/,    label: 'Тир',                value: m => ({ main: 'Основная' }[m[1]] || m[1]), confidence: 'inferred' },
  { re: /^a_(.+)$/,    label: 'Аудитория',          value: m => ({ broad: 'Широкая' }[m[1]] || m[1]), confidence: 'inferred' },
  { re: /^f_(.+)$/,    label: 'Креативы',           value: m => ({ full: 'Полный набор' }[m[1]] || m[1]), confidence: 'inferred' },
  { re: /^\d{2}\.\d{2}\.\d{4}$/, label: 'Дата запуска/правки', value: m => m[0], confidence: 'confirmed' },
];

function describeSegment(seg) {
  for (const rule of TOKEN_RULES) {
    const m = seg.match(rule.re);
    if (m) return { token: seg, label: rule.label, value: rule.value(m), confidence: rule.confidence };
  }
  return { token: seg, label: 'Вариант / лейбл', value: seg, confidence: 'confirmed' };
}

function buildNameTooltipContent(name) {
  const frag = document.createDocumentFragment();
  name.split('|').forEach(seg => {
    const d = describeSegment(seg);
    const row = document.createElement('div');
    row.className = 'name-tooltip__row';

    const tokenEl = document.createElement('code');
    tokenEl.className = 'name-tooltip__token';
    tokenEl.textContent = seg;

    const labelEl = document.createElement('span');
    labelEl.className = 'name-tooltip__label';
    labelEl.textContent = d.label + ':';

    const valueEl = document.createElement('span');
    valueEl.className = 'name-tooltip__value' + (d.confidence === 'inferred' ? ' name-tooltip__value--inferred' : '');
    valueEl.textContent = String(d.value);

    row.append(tokenEl, labelEl, valueEl);
    frag.appendChild(row);
  });

  const footnote = document.createElement('div');
  footnote.className = 'name-tooltip__footnote';
  footnote.textContent = '* — вывод по паттерну имён, не задокументировано в коде. Остальное подтверждено кодом/данными.';
  frag.appendChild(footnote);
  return frag;
}

function initNameTooltip() {
  const tip = document.getElementById('nameTooltip');
  let current = null;

  function position(target) {
    const r = target.getBoundingClientRect();
    tip.style.left = '0px'; tip.style.top = '0px'; // сброс перед измерением
    const tipRect = tip.getBoundingClientRect();
    let left = Math.min(r.left, window.innerWidth - tipRect.width - 8);
    left = Math.max(8, left);
    let top = r.bottom + 6;
    if (top + tipRect.height > window.innerHeight - 8) top = r.top - tipRect.height - 6;
    tip.style.left = left + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  }

  function show(target) {
    current = target;
    tip.innerHTML = '';
    tip.appendChild(buildNameTooltipContent(target.textContent));
    tip.hidden = false;
    position(target);
  }
  function hide() { current = null; tip.hidden = true; }

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('.campaign__name');
    if (el) show(el);
  });
  document.addEventListener('mouseout', e => {
    const el = e.target.closest('.campaign__name');
    if (el && !el.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('focusin', e => {
    const el = e.target.closest('.campaign__name');
    if (el) show(el);
  });
  document.addEventListener('focusout', e => {
    if (e.target.closest('.campaign__name')) hide();
  });
  window.addEventListener('scroll', () => { if (current) position(current); }, true);
}

function pct(x) { return Math.round(x * 100) + '%'; }

function parseCampaignName(name) {
  const geoMatch = name.match(/\|g_([A-Za-z]+)\|/);
  const dateMatch = name.match(/\|(\d{2}\.\d{2}\.\d{4})\|/);
  const gameMatch = name.match(/^ap_([a-z0-9]+)/i);
  return {
    geo: geoMatch ? geoMatch[1] : '—',
    date: dateMatch ? dateMatch[1] : null,
    game: gameMatch ? gameMatch[1] : null,
  };
}

function daysAgo(dateStr, referenceIso) {
  if (!dateStr) return null;
  const [d, m, y] = dateStr.split('.').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date(referenceIso);
  return Math.round((now - then) / 86400000);
}

function campaignAdsUrl(c) {
  if (!c._ocid) return null;
  return `https://ads.google.com/aw/campaigns?campaignId=${encodeURIComponent(c._campaignId)}&ocid=${encodeURIComponent(c._ocid)}`;
}

/* ---------- Change history (change_event) ----------
 * c.changeHistory — реальные строки change_event, когда есть (см. data/campaigns.json).
 * Иначе — честная минимальная история: кампания и бюджет были СОЗДАНЫ в дату,
 * зашитую в имя кампании (c._date) — это единственное, что реально известно
 * по остальным демо-кампаниям, без выдумывания несуществующих правок. */
function getChangeHistory(c) {
  if (Array.isArray(c.changeHistory) && c.changeHistory.length) return c.changeHistory;
  if (!c._date) return [];
  const [d, m, y] = c._date.split('.');
  const iso = `${y}-${m}-${d} 00:00:00`;
  return [
    { date: iso, resource: 'CAMPAIGN', operation: 'CREATE', fields: 'status,targetRoas.targetRoas,campaignBudget' },
    { date: iso, resource: 'CAMPAIGN_BUDGET', operation: 'CREATE', fields: 'amountMicros' },
  ];
}

function formatHistoryDate(dateStr, referenceIso) {
  const [datePart, timePart] = dateStr.split(' ');
  const [y, m, d] = datePart.split('-');
  const hm = timePart ? timePart.slice(0, 5) : null;
  const then = new Date(+y, +m - 1, +d);
  const now = new Date(referenceIso);
  const ago = Math.round((now - then) / 86400000);
  return { display: `${d}.${m}.${y}`, time: hm, ago };
}

function historyEntryMeta(item) {
  if (item.operation === 'CREATE') {
    const label = item.resource === 'CAMPAIGN_BUDGET' ? 'Бюджет создан' : 'Кампания создана';
    return { label, icon: '🆕' };
  }
  const fields = item.fields.split(',').map(f => f.trim());
  const known = fields.map(f => FIELD_META[f]).find(Boolean);
  if (known) return known;
  return { label: `Изменено: ${fields[0]}${fields.length > 1 ? ` +${fields.length - 1}` : ''}`, icon: '✏️' };
}

function renderHistoryPanel(c) {
  const items = getChangeHistory(c);
  if (!items.length) {
    return '<p class="campaign__history-empty">Нет данных об изменениях за последние 14 дней.</p>';
  }
  // Свежие сверху — как в change_event query у manage.gs (ORDER BY change_date_time DESC).
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const rows = sorted.map((item, i) => {
    const { display, time, ago } = formatHistoryDate(item.date, state.raw.generatedAt);
    const meta = historyEntryMeta(item);
    const opMeta = OPERATION_META[item.operation] || OPERATION_META.UPDATE;
    const isLast = i === sorted.length - 1;
    return `<li class="history-item">
      <span class="history-item__date">${ago}д назад<b>${display}${time ? ', ' + time : ''}</b></span>
      <span class="history-item__rail">
        <span class="history-item__dot ${opMeta.dotClass}"></span>
        ${isLast ? '' : '<span class="history-item__line"></span>'}
      </span>
      <span class="history-item__body">
        <span class="history-item__label">${meta.icon} ${meta.label}</span>
        <div class="history-item__meta">${RESOURCE_LABEL[item.resource] || item.resource} · <code>${item.fields.split(',')[0]}${item.fields.split(',').length > 1 ? ' …' : ''}</code></div>
      </span>
    </li>`;
  }).join('');
  return `<ul class="history-timeline">${rows}</ul>`;
}

/* ---------- Sparkline (thin bar, rounded data-end, last bar = accent) ---------- */
function renderSparkline(values) {
  const w = 84, h = 26, gap = 2, n = values.length;
  const barW = (w - gap * (n - 1)) / n;
  const max = Math.max(1, ...values);
  const bars = values.map((v, i) => {
    const barH = Math.max(v > 0 ? 2 : 0, (v / max) * (h - 2));
    const x = i * (barW + gap);
    const y = h - barH;
    const isLast = i === n - 1;
    const r = Math.min(4, barW / 2, barH);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="${r.toFixed(1)}" fill="${isLast ? 'var(--series-1)' : 'var(--series-1-soft)'}" />`;
  }).join('');
  const title = `Инсталлы за 7д: ${values.join(' / ')}`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" tabindex="0" aria-label="${title}"><title>${title}</title>${bars}</svg>`;
}

/* ---------- Health bar (part-to-whole stacked bar + legend) ---------- */
function renderHealthBar(all) {
  const counts = {};
  all.forEach(c => { counts[c.action] = (counts[c.action] || 0) + 1; });
  const total = all.length;

  const order = Object.entries(ACTIONS)
    .filter(([key]) => counts[key])
    .sort((a, b) => a[1].sortRank - b[1].sortRank);

  const bar = document.getElementById('healthBar');
  bar.innerHTML = order.map(([key, meta]) => {
    const n = counts[key];
    const w = (n / total) * 100;
    const dimmed = state.activeActions.size && !state.activeActions.has(key);
    return `<div class="health-bar__seg" data-action="${key}" style="width:${w.toFixed(2)}%;background:var(--status-${meta.status});opacity:${dimmed ? 0.3 : 1}" title="${meta.label}: ${n} (${Math.round(w)}%)"></div>`;
  }).join('');
  bar.querySelectorAll('.health-bar__seg').forEach(seg => {
    seg.addEventListener('click', () => toggleAction(seg.dataset.action));
  });

  const legend = document.getElementById('healthLegend');
  legend.innerHTML = order.map(([key, meta]) => {
    const dimmed = state.activeActions.size && !state.activeActions.has(key);
    return `<button type="button" class="health-legend__item" data-action="${key}" data-dim="${dimmed}">
      <span class="dot" style="background:var(--status-${meta.status})"></span>
      ${meta.emoji} ${meta.label} <b>${counts[key]}</b>
    </button>`;
  }).join('');
  legend.querySelectorAll('.health-legend__item').forEach(item => {
    item.addEventListener('click', () => toggleAction(item.dataset.action));
  });

  document.getElementById('healthTotal').textContent = `${total} кампаний`;
}

function toggleAction(key) {
  state.activeActions.has(key) ? state.activeActions.delete(key) : state.activeActions.add(key);
  renderAll();
}

/* ---------- Filtering / sorting ---------- */
function campaignMatches(c) {
  if (state.activeActions.size && !state.activeActions.has(c.action)) return false;
  if (state.account && c._accountId !== state.account) return false;
  if (state.geo && c._geo !== state.geo) return false;
  if (state.search) {
    const q = state.search.toLowerCase();
    const hay = (c.name + ' ' + c._geo + ' ' + c._accountName).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function sortCampaigns(list) {
  const byUrgency = (a, b) => ACTIONS[a.action].sortRank - ACTIONS[b.action].sortRank || a.roasD3 - b.roasD3;
  switch (state.sortBy) {
    case 'roasD3': return [...list].sort((a, b) => a.roasD3 - b.roasD3);
    case 'roasD3desc': return [...list].sort((a, b) => b.roasD3 - a.roasD3);
    case 'budget': return [...list].sort((a, b) => b.budgetUsd - a.budgetUsd);
    case 'geo': return [...list].sort((a, b) => a._geo.localeCompare(b._geo) || byUrgency(a, b));
    case 'name': return [...list].sort((a, b) => a.name.localeCompare(b.name));
    default: return [...list].sort(byUrgency);
  }
}

/* ---------- Campaign card ---------- */
const tpl = document.getElementById('campaignRowTemplate');

function buildCampaignEl(c) {
  const node = tpl.content.cloneNode(true);
  const meta = ACTIONS[c.action];
  const article = node.querySelector('.campaign');
  article.dataset.action = c.action;

  node.querySelector('.campaign__accent').style.background = `var(--status-${meta.status})`;

  const badge = node.querySelector('.campaign__badge');
  badge.textContent = meta.emoji;
  badge.style.background = `var(--status-${meta.status}-bg)`;

  const titleRow = node.querySelector('.campaign__title-row');
  const actionLabel = document.createElement('span');
  actionLabel.className = 'campaign__action-label';
  actionLabel.style.color = `var(--status-${meta.status})`;
  actionLabel.textContent = meta.label;
  titleRow.prepend(actionLabel);

  node.querySelector('.campaign__geo').textContent = c._geo;

  const nameEl = node.querySelector('.campaign__name');
  nameEl.textContent = c.name;

  const linkEl = node.querySelector('.campaign__link');
  const url = campaignAdsUrl(c);
  if (url) {
    linkEl.href = url;
    linkEl.hidden = false;
  }

  node.querySelector('.campaign__reason').textContent = c.reason;

  const metrics = node.querySelector('.campaign__metrics');
  const ago = c._date ? daysAgo(c._date, state.raw.generatedAt) : null;
  const rows = [
    ['tROAS', pct(c.troas)],
    ['ROAS d3', pct(c.roasD3)],
    ['ROAS d7 (3д/14д)', pct(c.roasD7_3d) + ' / ' + pct(c.roasD7_14d)],
    ['бюджет/д', '$' + c.budgetUsd.toFixed(0)],
    ['запуск', c._date ? `${c._date} · ${ago}д назад` : '—'],
  ];
  metrics.innerHTML = rows.map(([label, value]) =>
    `<span class="metric">${label}<b>${value}</b></span>`).join('');

  const flagsWrap = node.querySelector('.campaign__flags');
  (c.flags || []).forEach(f => {
    const chip = document.createElement('span');
    chip.className = 'flag-chip ' + (f.act ? 'flag-chip--act' : 'flag-chip--info');
    chip.textContent = (FLAG_ICON[f.code] || 'ℹ️') + ' ' + f.text;
    flagsWrap.appendChild(chip);
  });

  const sparkChart = node.querySelector('.campaign__spark-chart');
  sparkChart.innerHTML = renderSparkline(c.installs7d) +
    `<span class="campaign__spark-value">${c.installs7d[c.installs7d.length - 1]}</span>` +
    `<span class="campaign__spark-caption">инсталлы/д</span>`;

  article.dataset.campaignKey = c.name;
  const isOpen = state.expandedHistory.has(c.name);
  const toggle = node.querySelector('.campaign__history-toggle');
  const historyPanel = node.querySelector('.campaign__history');
  toggle.classList.toggle('is-open', isOpen);
  historyPanel.hidden = !isOpen;
  if (isOpen) historyPanel.innerHTML = renderHistoryPanel(c);

  toggle.addEventListener('click', () => {
    const nowOpen = !state.expandedHistory.has(c.name);
    nowOpen ? state.expandedHistory.add(c.name) : state.expandedHistory.delete(c.name);
    toggle.classList.toggle('is-open', nowOpen);
    historyPanel.hidden = !nowOpen;
    if (nowOpen && !historyPanel.innerHTML) historyPanel.innerHTML = renderHistoryPanel(c);
  });

  return node;
}

/* ---------- Account groups + campaign list ---------- */
function accountDistribution(campaigns) {
  const counts = {};
  campaigns.forEach(c => { counts[c.action] = (counts[c.action] || 0) + 1; });
  const total = campaigns.length;
  return Object.entries(ACTIONS)
    .filter(([key]) => counts[key])
    .sort((a, b) => a[1].sortRank - b[1].sortRank)
    .map(([key, meta]) => `<span style="width:${(counts[key] / total * 100).toFixed(1)}%;background:var(--status-${meta.status})" title="${meta.label}: ${counts[key]}"></span>`)
    .join('');
}

function render() {
  const root = document.getElementById('accounts');
  root.innerHTML = '';
  let shownCount = 0;

  state.raw.accounts.forEach(acc => {
    const matched = sortCampaigns(acc.campaigns.filter(campaignMatches));
    if (matched.length === 0) return;
    shownCount += matched.length;

    const totalBudget = acc.campaigns.reduce((s, c) => s + c.budgetUsd, 0);

    const group = document.createElement('section');
    group.className = 'account-group' + (state.collapsed.has(acc.customerId) ? ' collapsed' : '');

    const header = document.createElement('div');
    header.className = 'account-group__header';
    header.innerHTML = `<span class="account-group__chevron">▾</span>
      <h2>${acc.name}</h2>
      <span class="muted">(${acc.customerId}) · ${matched.length}${matched.length !== acc.campaigns.length ? ' / ' + acc.campaigns.length : ''}</span>
      <span class="account-group__spark">${accountDistribution(acc.campaigns)}</span>
      <span class="account-group__budget">$${totalBudget.toLocaleString('en-US')}/д</span>`;
    header.addEventListener('click', () => {
      state.collapsed.has(acc.customerId) ? state.collapsed.delete(acc.customerId) : state.collapsed.add(acc.customerId);
      render();
    });

    const list = document.createElement('div');
    list.className = 'campaign-list';
    matched.forEach(c => list.appendChild(buildCampaignEl(c)));

    group.appendChild(header);
    group.appendChild(list);
    root.appendChild(group);
  });

  document.getElementById('emptyState').hidden = shownCount > 0;
}

/* ---------- Stats ---------- */
function computeAllCampaigns() {
  const out = [];
  state.raw.accounts.forEach(acc => acc.campaigns.forEach((c, i) => {
    const parsed = parseCampaignName(c.name);
    c._geo = parsed.geo;
    c._date = parsed.date;
    c._game = parsed.game;
    c._accountId = acc.customerId;
    c._accountName = acc.name;
    c._ocid = acc.ocid || null;
    c._campaignId = acc.customerId.replace(/-/g, '') + '' + i; // synthetic id (демо-данные не несут реального campaignId)
    out.push(c);
  }));
  return out;
}

function renderStats(all) {
  const total = all.length;
  // Зеркалит needsAttention_() из manage.gs: ACTIONS[action].act ИЛИ есть
  // actionable-флаг (Д1/Д3) — WAIT/HOLD-кампания с непройденной модерацией
  // всё равно требует внимания, а HOLD сам по себе — нет (act:false).
  const needsAttention = c => ACTIONS[c.action].act || (c.flags || []).some(f => f.act);
  const actionable = all.filter(needsAttention).length;
  const urgent = all.filter(c => URGENT_ACTIONS.has(c.action)).length;
  const totalBudget = all.reduce((s, c) => s + c.budgetUsd, 0);

  const tiles = [
    { label: 'Всего кампаний', value: total, icon: 'list' },
    { label: 'Требуют внимания', value: actionable, icon: 'alert' },
    { label: 'Суммарный бюджет/д', value: '$' + totalBudget.toLocaleString('en-US'), icon: 'budget' },
    { label: 'Стоп / поддержка / перезапуск', value: urgent, icon: 'fire', critical: urgent > 0 },
  ];

  document.getElementById('stats').innerHTML = tiles.map(t => `
    <div class="stat-tile${t.critical ? ' stat-tile--critical' : ''}">
      <span class="stat-tile__icon">${ICONS[t.icon]}</span>
      <p class="stat-tile__label">${t.label}</p>
      <p class="stat-tile__value">${t.value}</p>
    </div>`).join('');
}

function renderAll() {
  const all = computeAllCampaigns();
  renderStats(all);
  renderHealthBar(all);
  render();
}

// Уникальные гео поперёк ВСЕХ аккаунтов — для проверки правила Д4 (кампании на
// одну страну должны отличаться сигналами/объявлениями/tROAS): выбрал гео —
// видишь все кампании на эту страну сразу по всем играм/аккаунтам.
function populateGeoFilter(all) {
  const geos = [...new Set(all.map(c => c._geo).filter(g => g && g !== '—'))].sort();
  const select = document.getElementById('geoFilter');
  geos.forEach(geo => {
    const opt = document.createElement('option');
    opt.value = geo;
    opt.textContent = geo;
    select.appendChild(opt);
  });
  select.addEventListener('change', e => { state.geo = e.target.value; render(); });
}

/* ---------- Boot ---------- */
async function boot() {
  const res = await fetch('/api/campaigns');
  const data = await res.json();
  state.raw = data;

  document.getElementById('generatedAt').textContent =
    'Данные на ' + new Date(data.generatedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

  const accountSelect = document.getElementById('accountFilter');
  data.accounts.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc.customerId;
    opt.textContent = acc.name;
    accountSelect.appendChild(opt);
  });
  accountSelect.addEventListener('change', e => { state.account = e.target.value; render(); });

  populateGeoFilter(computeAllCampaigns());

  document.getElementById('sortBy').addEventListener('change', e => { state.sortBy = e.target.value; render(); });

  let searchTimer;
  document.getElementById('search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 120);
  });

  initNameTooltip();
  renderAll();
}

boot().catch(err => {
  document.getElementById('accounts').innerHTML =
    `<p class="empty-state">Не удалось загрузить данные: ${err.message}</p>`;
});
