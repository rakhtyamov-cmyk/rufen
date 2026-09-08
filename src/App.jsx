import { useEffect, useMemo, useRef, useState } from 'react';
import { ListChecks, TriangleAlert, CircleDollarSign, Flame, PartyPopper, History } from 'lucide-react';
import { StatTile } from '@/components/StatTile';
import { HealthBar } from '@/components/HealthBar';
import { Filters } from '@/components/Filters';
import { AccountTabs } from '@/components/AccountTabs';
import { AccountGroup } from '@/components/AccountGroup';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { DateSelector } from '@/components/DateSelector';
import { ACTIONS, URGENT_ACTIONS, needsAttention } from '@/lib/actions';
import { parseCampaignName, windowDates } from '@/lib/format';
import { useFilterState } from '@/lib/useFilterState';
import { useLocalStorageSet } from '@/lib/useLocalStorageSet';

function sortCampaigns(list, sortBy) {
  const byUrgency = (a, b) => ACTIONS[a.action].sortRank - ACTIONS[b.action].sortRank || a.roasD3 - b.roasD3;
  switch (sortBy) {
    case 'roasD3': return [...list].sort((a, b) => a.roasD3 - b.roasD3);
    case 'roasD3desc': return [...list].sort((a, b) => b.roasD3 - a.roasD3);
    case 'budget': return [...list].sort((a, b) => b.budgetUsd - a.budgetUsd);
    case 'geo': return [...list].sort((a, b) => a._geo.localeCompare(b._geo) || byUrgency(a, b));
    case 'name': return [...list].sort((a, b) => a.name.localeCompare(b.name));
    default: return [...list].sort(byUrgency);
  }
}

export default function App() {
  const [raw, setRaw] = useState(null);
  const [history, setHistory] = useState(null); // history.mock.json — необязателен, дашборд работает и без него
  const [error, setError] = useState(null);
  const { state: filters, update: updateFilters, reset: resetFilters } = useFilterState();
  const [closedAccounts, , toggleClosedAccount] = useLocalStorageSet('campaign-dashboard-closed-accounts');
  const searchInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then(setRaw)
      .catch((e) => setError(e.message));
    // История — по мягкому пути: если эндпоинта/файла нет, просто не будет
    // селектора дат, а не падение всего дашборда.
    fetch('/api/history')
      .then((r) => (r.ok ? r.json() : null))
      .then(setHistory)
      .catch(() => setHistory(null));
  }, []);

  // Клавиатурные шорткаты: "/" — фокус на поиск, Esc — сброс всех фильтров.
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        resetFilters();
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetFilters]);

  // Индекс кампании -> её массив истории (7 дней) из history.mock.json.
  // Сопоставление по ИМЕНИ, не по позиции — порядок кампаний в двух файлах
  // не обязан совпадать.
  const historyByName = useMemo(() => {
    if (!history?.campaigns) return null;
    const map = new Map();
    history.campaigns.forEach((c) => map.set(c.name, c.history));
    return map;
  }, [history]);

  const latestDayIndex = history?.days ? history.days.length - 1 : null;
  // filters.day — индекс в URL; null/некорректный/за пределами массива -> последний день.
  const selectedDayIndex =
    historyByName && filters.day !== null && Number.isInteger(filters.day) && filters.day >= 0 && filters.day <= latestDayIndex
      ? filters.day
      : latestDayIndex;
  const isHistoricalDay = selectedDayIndex !== null && selectedDayIndex !== latestDayIndex;

  const all = useMemo(() => {
    if (!raw) return [];
    const out = [];
    raw.accounts.forEach((acc) =>
      acc.campaigns.forEach((c, i) => {
        const parsed = parseCampaignName(c.name);
        let campaign = {
          ...c,
          _geo: parsed.geo,
          _date: parsed.date,
          _game: parsed.game,
          _accountId: acc.customerId,
          _accountName: acc.name,
          _ocid: acc.ocid || null,
          // Демо-данные не несут реального campaignId — синтетический, только для формы ссылки.
          _campaignId: acc.customerId.replace(/-/g, '') + i,
        };

        // Исторический день выбран -> подменяем ТОЛЬКО точечные метрики на
        // значения из мок-истории за этот день. action/reason/flags намеренно
        // НЕ трогаем — по прошлым дням decide_() не пересчитывался, это
        // всегда актуальная рекомендация из последнего прогона (см. DateSelector).
        if (isHistoricalDay && historyByName) {
          const hist = historyByName.get(c.name)?.[selectedDayIndex];
          if (hist) {
            campaign = {
              ...campaign,
              troas: hist.troas,
              roasD3: hist.roasD3,
              roasD7_3d: hist.roasD7_3d,
              roasD7_14d: hist.roasD7_14d,
              budgetUsd: hist.budgetUsd,
              _historicalInstalls: hist.installs,
            };
          }
        }

        out.push(campaign);
      })
    );
    return out;
  }, [raw, isHistoricalDay, historyByName, selectedDayIndex]);

  const geos = useMemo(() => [...new Set(all.map((c) => c._geo).filter((g) => g && g !== '—'))].sort(), [all]);

  const activeActionsSet = useMemo(() => new Set(filters.actions), [filters.actions]);

  function toggleAction(key) {
    updateFilters((prev) => ({
      actions: prev.actions.includes(key) ? prev.actions.filter((a) => a !== key) : [...prev.actions, key],
    }));
  }
  function toggleGeo(g) {
    updateFilters((prev) => ({
      geos: prev.geos.includes(g) ? prev.geos.filter((x) => x !== g) : [...prev.geos, g],
    }));
  }

  // Общий фильтр текстового/гео/action-поиска, БЕЗ учёта выбранной вкладки
  // аккаунта — используется и для карточек внутри активного аккаунта, и для
  // счётчиков на самих вкладках (см. campaignMatches ниже).
  function matchesCommonFilters(c) {
    if (filters.attn && !needsAttention(c)) return false;
    if (filters.actions.length && !filters.actions.includes(c.action)) return false;
    if (filters.geos.length && !filters.geos.includes(c._geo)) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const hay = `${c.name} ${c._geo} ${c._accountName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }
  function campaignMatches(c) {
    if (filters.account && c._accountId !== filters.account) return false;
    return matchesCommonFilters(c);
  }

  // Плашки сверху и health bar — скоуп по выбранной вкладке аккаунта (но НЕ по
  // остальным фильтрам поиска/гео/action — те применяются только к списку
  // карточек ниже, иначе плашки скакали бы при каждом клике по фильтру).
  const accountScoped = filters.account ? all.filter((c) => c._accountId === filters.account) : all;
  const totalBudget = accountScoped.reduce((s, c) => s + c.budgetUsd, 0);
  const actionable = accountScoped.filter(needsAttention).length;
  const urgent = accountScoped.filter((c) => URGENT_ACTIONS.has(c.action)).length;

  if (error) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Не удалось загрузить данные: {error}</p>;
  }
  if (!raw) {
    return <DashboardSkeleton />;
  }

  const groups = raw.accounts
    .map((acc) => ({ acc, matched: sortCampaigns(all.filter((c) => c._accountId === acc.customerId).filter(campaignMatches), filters.sort) }))
    .filter(({ matched }) => matched.length > 0);

  // Для вкладок аккаунтов: считаем БЕЗ учёта самой вкладки (иначе неактивные
  // вкладки всегда показывали бы 0) — остальные фильтры (поиск/гео/action/
  // "только внимание") учитываются, чтобы переключение вкладки не сбрасывало
  // текущий контекст фильтрации.
  const matchedExceptAccount = all.filter(matchesCommonFilters);
  const tabCounts = {};
  const tabAttentionCounts = {};
  raw.accounts.forEach((acc) => {
    const forAcc = matchedExceptAccount.filter((c) => c._accountId === acc.customerId);
    tabCounts[acc.customerId] = forAcc.length;
    tabAttentionCounts[acc.customerId] = forAcc.filter(needsAttention).length;
  });

  const hasOtherFilters = Boolean(filters.q || filters.actions.length || filters.account || filters.geos.length);
  const selectedDate = history?.days && selectedDayIndex !== null ? windowDates(history.days.length, history.generatedFrom)[selectedDayIndex] : null;

  return (
    <div className="container max-w-[1160px] py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Google Ads · Advisor</p>
          <h1 className="text-2xl font-bold tracking-tight">Campaign Advisor Dashboard</h1>
          <p className="text-sm text-muted-foreground">tROAS App Campaigns</p>
        </div>
        <span className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          Данные на {new Date(raw.generatedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </header>

      <div className="mb-4">
        <AccountTabs
          accounts={raw.accounts}
          active={filters.account}
          onChange={(account) => updateFilters({ account })}
          counts={tabCounts}
          attentionCounts={tabAttentionCounts}
          totalCount={matchedExceptAccount.length}
          totalAttention={matchedExceptAccount.filter(needsAttention).length}
        />
      </div>

      {historyByName && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Метрики за:
          </span>
          <DateSelector generatedAt={history.generatedFrom} selectedIndex={selectedDayIndex} onSelect={(day) => updateFilters({ day })} days={history.days.length} />
          {isHistoricalDay && selectedDate && (
            <span className="text-xs text-muted-foreground">
              Показаны tROAS/ROAS/бюджет за {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} (мок-история) ·
              статус и рекомендация — из прогона {new Date(raw.generatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </span>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Всего кампаний" value={accountScoped.length} icon={ListChecks} />
        <StatTile
          label="Требуют внимания"
          value={actionable}
          icon={TriangleAlert}
          active={filters.attn}
          onClick={() => updateFilters({ attn: !filters.attn })}
        />
        <StatTile label="Суммарный бюджет/д" value={`$${totalBudget.toLocaleString('en-US')}`} icon={CircleDollarSign} />
        <StatTile label="Стоп / поддержка / перезапуск" value={urgent} icon={Flame} critical={urgent > 0} />
      </div>

      <div className="mb-4">
        <HealthBar all={accountScoped} activeActions={activeActionsSet} onToggleAction={toggleAction} />
      </div>

      <div className="mb-2">
        <Filters
          geos={geos}
          search={filters.q}
          onSearch={(q) => updateFilters({ q })}
          searchInputRef={searchInputRef}
          selectedGeos={filters.geos}
          onToggleGeo={toggleGeo}
          onClearGeos={() => updateFilters({ geos: [] })}
          sortBy={filters.sort}
          onSortBy={(sort) => updateFilters({ sort })}
          onlyAttention={filters.attn}
          onToggleOnlyAttention={(attn) => updateFilters({ attn })}
          attentionCount={actionable}
        />
      </div>

      <main aria-live="polite">
        {groups.length === 0 && filters.attn && !hasOtherFilters && (
          <p className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <PartyPopper className="h-6 w-6 text-status-good" />
            Отлично, ничего не требует внимания — по остальным фильтрам всё чисто.
          </p>
        )}
        {groups.length === 0 && (!filters.attn || hasOtherFilters) && (
          <p className="py-12 text-center text-sm text-muted-foreground">Ничего не найдено — попробуйте изменить фильтры (Esc — сбросить всё).</p>
        )}
        {groups.map(({ acc, matched }) => (
          <AccountGroup
            key={acc.customerId}
            account={acc}
            matched={matched}
            open={!closedAccounts.has(acc.customerId)}
            onToggle={() => toggleClosedAccount(acc.customerId)}
            generatedAt={raw.generatedAt}
            sparkHighlightIndex={isHistoricalDay ? selectedDayIndex : null}
          />
        ))}
      </main>
    </div>
  );
}
