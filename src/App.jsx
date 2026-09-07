import { useEffect, useMemo, useRef, useState } from 'react';
import { ListChecks, TriangleAlert, CircleDollarSign, Flame, PartyPopper } from 'lucide-react';
import { StatTile } from '@/components/StatTile';
import { HealthBar } from '@/components/HealthBar';
import { Filters } from '@/components/Filters';
import { AccountGroup } from '@/components/AccountGroup';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { ACTIONS, URGENT_ACTIONS, needsAttention } from '@/lib/actions';
import { parseCampaignName } from '@/lib/format';
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
  const [error, setError] = useState(null);
  const { state: filters, update: updateFilters, reset: resetFilters } = useFilterState();
  const [closedAccounts, , toggleClosedAccount] = useLocalStorageSet('campaign-dashboard-closed-accounts');
  const searchInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then(setRaw)
      .catch((e) => setError(e.message));
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

  const all = useMemo(() => {
    if (!raw) return [];
    const out = [];
    raw.accounts.forEach((acc) =>
      acc.campaigns.forEach((c, i) => {
        const parsed = parseCampaignName(c.name);
        out.push({
          ...c,
          _geo: parsed.geo,
          _date: parsed.date,
          _game: parsed.game,
          _accountId: acc.customerId,
          _accountName: acc.name,
          _ocid: acc.ocid || null,
          // Демо-данные не несут реального campaignId — синтетический, только для формы ссылки.
          _campaignId: acc.customerId.replace(/-/g, '') + i,
        });
      })
    );
    return out;
  }, [raw]);

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

  function campaignMatches(c) {
    if (filters.attn && !needsAttention(c)) return false;
    if (filters.actions.length && !filters.actions.includes(c.action)) return false;
    if (filters.account && c._accountId !== filters.account) return false;
    if (filters.geos.length && !filters.geos.includes(c._geo)) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const hay = `${c.name} ${c._geo} ${c._accountName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  const totalBudget = all.reduce((s, c) => s + c.budgetUsd, 0);
  const actionable = all.filter(needsAttention).length;
  const urgent = all.filter((c) => URGENT_ACTIONS.has(c.action)).length;

  if (error) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Не удалось загрузить данные: {error}</p>;
  }
  if (!raw) {
    return <DashboardSkeleton />;
  }

  const groups = raw.accounts
    .map((acc) => ({ acc, matched: sortCampaigns(all.filter((c) => c._accountId === acc.customerId).filter(campaignMatches), filters.sort) }))
    .filter(({ matched }) => matched.length > 0);

  const hasOtherFilters = Boolean(filters.q || filters.actions.length || filters.account || filters.geos.length);

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

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Всего кампаний" value={all.length} icon={ListChecks} />
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
        <HealthBar all={all} activeActions={activeActionsSet} onToggleAction={toggleAction} />
      </div>

      <div className="mb-2">
        <Filters
          accounts={raw.accounts}
          geos={geos}
          search={filters.q}
          onSearch={(q) => updateFilters({ q })}
          searchInputRef={searchInputRef}
          account={filters.account}
          onAccount={(account) => updateFilters({ account })}
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
          />
        ))}
      </main>
    </div>
  );
}
