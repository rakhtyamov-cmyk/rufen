// change_event: Google Ads API поле -> человекочитаемая метка + иконка.
// См. tools/google-ads-management/manage.gs (applyChangeHistory_/processChangeEvents_) —
// та же семантика полей change_event, что и в проде.
const FIELD_META = {
  'targetRoas.targetRoas': { label: 'Изменён tROAS', icon: '🎯' },
  amountMicros: { label: 'Изменён бюджет', icon: '💰' },
  status: { label: 'Изменён статус', icon: '⏯️' },
  name: { label: 'Переименована', icon: '🏷️' },
};
const RESOURCE_LABEL = { CAMPAIGN: 'Кампания', CAMPAIGN_BUDGET: 'Бюджет' };

/* c.changeHistory — реальные строки change_event, когда есть.
 * Иначе — честная минимальная история: кампания и бюджет были СОЗДАНЫ в дату,
 * зашитую в имя кампании (c._date) — единственное реально известное по
 * остальным кампаниям, без выдумывания несуществующих правок. */
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
  if (item.operation === 'CREATE') {
    const label = item.resource === 'CAMPAIGN_BUDGET' ? 'Бюджет создан' : 'Кампания создана';
    return { label, icon: '🆕' };
  }
  const fields = item.fields.split(',').map((f) => f.trim());
  const known = fields.map((f) => FIELD_META[f]).find(Boolean);
  if (known) return known;
  return { label: `Изменено: ${fields[0]}${fields.length > 1 ? ` +${fields.length - 1}` : ''}`, icon: '✏️' };
}

export function resourceLabel(resource) {
  return RESOURCE_LABEL[resource] || resource;
}
