// change_event: Google Ads API поле -> человекочитаемая метка + иконка.
// См. tools/google-ads-management/manage.gs (applyChangeHistory_/processChangeEvents_) —
// та же семантика полей change_event, что и в проде.
//
// ВАЖНО про типы ресурсов: manage.gs реально запрашивает 7 типов change_event
// (строки 625/629 файла) — но с разной глубиной:
//   CAMPAIGN, CAMPAIGN_BUDGET       — разбирает конкретное поле (targetRoas.targetRoas,
//                                      amountMicros, status, name) — отсюда FIELD_META ниже.
//   AD, AD_GROUP, AD_GROUP_AD,
//   AD_GROUP_CRITERION,
//   CAMPAIGN_CRITERION              — видит ТОЛЬКО факт+тип+операцию (нужно ему
//                                      лишь для daysSinceCreativeChange/AnyChange),
//                                      конкретное изменённое поле не разбирает.
//                                      Не выдумываем детализацию, которой в
//                                      системе нет — TYPE_OP_META ниже даёт
//                                      честный resource-level лейбл.
// Статус модерации (Д1, "объявление отклонено") в change_event НЕ приходит —
// это отдельный API-срез (policy_summary), не пользовательское действие.
// В таймлайне поэтому не может быть строки "отклонено", только "добавлено/
// изменено" — сам факт отклонения показывает отдельный флаг на карточке.
const FIELD_META = {
  'targetRoas.targetRoas': { label: 'Изменён tROAS', icon: '🎯' },
  amountMicros: { label: 'Изменён бюджет', icon: '💰' },
  status: { label: 'Изменён статус', icon: '⏯️' },
  name: { label: 'Переименована', icon: '🏷️' },
};

const RESOURCE_LABEL = {
  CAMPAIGN: 'Кампания',
  CAMPAIGN_BUDGET: 'Бюджет',
  AD: 'Креатив',
  AD_GROUP: 'Группа объявлений',
  AD_GROUP_AD: 'Объявление',
  AD_GROUP_CRITERION: 'Таргетинг (группа)',
  CAMPAIGN_CRITERION: 'Таргетинг (кампания)',
};

// Resource-level фолбэк для типов, где manage.gs не разбирает конкретное
// поле (см. комментарий выше) — честно показываем "что" + "какая операция",
// не "что именно изменилось внутри".
const TYPE_OP_META = {
  AD: {
    CREATE: { label: 'Креатив добавлен', icon: '🆕' },
    UPDATE: { label: 'Креатив изменён', icon: '🎨' },
    REMOVE: { label: 'Креатив удалён', icon: '🗑️' },
  },
  AD_GROUP_AD: {
    CREATE: { label: 'Объявление создано', icon: '🆕' },
    UPDATE: { label: 'Объявление изменено', icon: '✏️' },
    REMOVE: { label: 'Объявление удалено', icon: '🗑️' },
  },
  AD_GROUP: {
    CREATE: { label: 'Группа объявлений создана', icon: '🆕' },
    UPDATE: { label: 'Группа объявлений изменена', icon: '✏️' },
    REMOVE: { label: 'Группа объявлений удалена', icon: '🗑️' },
  },
  AD_GROUP_CRITERION: {
    CREATE: { label: 'Добавлен таргетинг (группа)', icon: '🎯' },
    UPDATE: { label: 'Изменён таргетинг (группа)', icon: '🎯' },
    REMOVE: { label: 'Убран таргетинг (группа)', icon: '🎯' },
  },
  CAMPAIGN_CRITERION: {
    CREATE: { label: 'Добавлен таргетинг (кампания)', icon: '🌍' },
    UPDATE: { label: 'Изменён таргетинг (кампания)', icon: '🌍' },
    REMOVE: { label: 'Убран таргетинг (кампания)', icon: '🌍' },
  },
};

/* c.changeHistory — реальные/реалистично-моковые строки change_event, когда
 * есть. Иначе — честная минимальная история: кампания и бюджет были СОЗДАНЫ
 * в дату, зашитую в имя кампании (c._date) — единственное реально известное
 * по остальным кампаниям, без выдумывания несуществующих правок. */
export function getChangeHistory(c) {
  if (Array.isArray(c.changeHistory) && c.changeHistory.length) return c.changeHistory;
  if (!c._date) return [];
  const [d, m, y] = c._date.split('.');
  const iso = `${y}-${m}-${d} 00:00:00`;
  return [
    { date: iso, resource: 'CAMPAIGN', operation: 'CREATE', fields: 'status,targetRoas.targetRoas,campaignBudget' },
    { date: iso, resource: 'CAMPAIGN_BUDGET', operation: 'CREATE', fields: 'amountMicros' },
  ];
}

export function formatHistoryDate(dateStr, referenceIso) {
  const [datePart, timePart] = dateStr.split(' ');
  const [y, m, d] = datePart.split('-');
  const hm = timePart ? timePart.slice(0, 5) : null;
  const then = new Date(+y, +m - 1, +d);
  const now = new Date(referenceIso);
  const ago = Math.round((now - then) / 86400000);
  return { display: `${d}.${m}.${y}`, time: hm, ago };
}

export function historyEntryMeta(item) {
  if (item.operation === 'CREATE' && (item.resource === 'CAMPAIGN' || item.resource === 'CAMPAIGN_BUDGET')) {
    const label = item.resource === 'CAMPAIGN_BUDGET' ? 'Бюджет создан' : 'Кампания создана';
    return { label, icon: '🆕' };
  }
  const fields = item.fields.split(',').map((f) => f.trim());
  const known = fields.map((f) => FIELD_META[f]).find(Boolean);
  if (known) return known;

  const typeOp = TYPE_OP_META[item.resource]?.[item.operation];
  if (typeOp) return typeOp;

  return { label: `Изменено: ${fields[0]}${fields.length > 1 ? ` +${fields.length - 1}` : ''}`, icon: '✏️' };
}

export function resourceLabel(resource) {
  return RESOURCE_LABEL[resource] || resource;
}
