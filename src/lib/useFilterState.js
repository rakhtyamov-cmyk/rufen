import { useCallback, useEffect, useState } from 'react';

// Все фильтры синхронизируются с URL query params одним объектом (не по
// отдельным хукам на поле) — иначе параллельные setState в одном рендере
// могут затирать друг друга через history.replaceState.
export const FILTER_DEFAULTS = {
  q: '',
  actions: [],   // ключи ACTIONS
  account: '',
  geos: [],      // multi-select гео
  sort: 'urgency',
  attn: false,   // "только требуют внимания"
  day: null,     // индекс дня в окне истории (0..6); null = последний/сегодня
};

function parseSearch(search) {
  const params = new URLSearchParams(search);
  return {
    q: params.get('q') || FILTER_DEFAULTS.q,
    actions: params.get('actions') ? params.get('actions').split(',').filter(Boolean) : FILTER_DEFAULTS.actions,
    account: params.get('account') || FILTER_DEFAULTS.account,
    geos: params.get('geos') ? params.get('geos').split(',').filter(Boolean) : FILTER_DEFAULTS.geos,
    sort: params.get('sort') || FILTER_DEFAULTS.sort,
    attn: params.get('attn') === '1',
    day: params.has('day') ? Number(params.get('day')) : FILTER_DEFAULTS.day,
  };
}

function serialize(state) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.actions.length) params.set('actions', state.actions.join(','));
  if (state.account) params.set('account', state.account);
  if (state.geos.length) params.set('geos', state.geos.join(','));
  if (state.sort && state.sort !== FILTER_DEFAULTS.sort) params.set('sort', state.sort);
  if (state.attn) params.set('attn', '1');
  if (state.day !== null && state.day !== undefined) params.set('day', String(state.day));
  return params.toString();
}

/** Состояние фильтров, персистентное в URL (шарится ссылкой, переживает reload). */
export function useFilterState() {
  const [state, setState] = useState(() => parseSearch(window.location.search));

  useEffect(() => {
    const qs = serialize(state);
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    // replaceState, не pushState — иначе каждая буква в поиске плодит запись
    // в истории браузера и ломает "назад".
    window.history.replaceState(null, '', url);
  }, [state]);

  const update = useCallback((patch) => {
    setState((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  const reset = useCallback(() => setState(FILTER_DEFAULTS), []);

  return { state, update, reset };
}
