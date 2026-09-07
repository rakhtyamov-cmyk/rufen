import { useState } from 'react';
import { ChevronDown, ExternalLink, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Sparkline } from '@/components/Sparkline';
import { ACTIONS } from '@/lib/actions';
import { pct, daysAgo, campaignAdsUrl } from '@/lib/format';
import { describeCampaignName } from '@/lib/nameTokens';
import { getChangeHistory, formatHistoryDate, historyEntryMeta, resourceLabel } from '@/lib/changeHistory';
import { cn } from '@/lib/utils';

const STATUS_ACCENT = {
  good: 'bg-status-good',
  warning: 'bg-status-warning',
  serious: 'bg-status-serious',
  critical: 'bg-status-critical',
  neutral: 'bg-status-neutral',
};
// Полные имена классов ЛИТЕРАЛОМ в исходнике — Tailwind JIT сканирует файлы
// статически и не резолвит `text-status-${x}` шаблонные строки (класс просто
// не попадёт в билд). См. https://tailwindcss.com/docs/content-configuration#dynamic-class-names
const STATUS_TEXT = {
  good: 'text-status-good',
  warning: 'text-status-warning',
  serious: 'text-status-serious',
  critical: 'text-status-critical',
  neutral: 'text-status-neutral',
};

function NameTooltip({ name }) {
  const rows = describeCampaignName(name);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="min-w-0 cursor-help whitespace-normal break-all rounded font-mono text-[11.5px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0}>
          {name}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div key={i} className="flex items-baseline gap-2 text-[11.5px]">
              <code className="min-w-[70px] flex-none font-mono text-[10.5px] text-primary">{r.token}</code>
              <span className="flex-none whitespace-nowrap text-muted-foreground">{r.label}:</span>
              <span className="font-semibold text-popover-foreground">
                {r.value}
                {r.confidence === 'inferred' && <span className="ml-0.5 font-normal text-muted-foreground"> *</span>}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 border-t pt-2 text-[10px] leading-tight text-muted-foreground">
          * — вывод по паттерну имён, не задокументировано в коде. Остальное подтверждено кодом/данными.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function HistoryTimeline({ campaign, generatedAt }) {
  const items = getChangeHistory(campaign);
  if (!items.length) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">Нет данных об изменениях за последние 14 дней.</p>;
  }
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ul className="space-y-0">
      {sorted.map((item, i) => {
        const { display, time, ago } = formatHistoryDate(item.date, generatedAt);
        const meta = historyEntryMeta(item);
        const isCreate = item.operation === 'CREATE';
        const isLast = i === sorted.length - 1;
        return (
          <li key={i} className="grid grid-cols-[76px_20px_1fr] gap-x-2 pb-3 last:pb-0">
            <span className="pt-0.5 text-right text-[11px] text-muted-foreground tabular-nums">
              {ago}д назад
              <b className="block text-[11.5px] font-semibold text-foreground/80">{display}{time ? `, ${time}` : ''}</b>
            </span>
            <span className="flex flex-col items-center">
              <span className={cn('mt-1 h-2.5 w-2.5 rounded-full ring-2 ring-background', isCreate ? 'bg-status-good' : 'bg-primary')} />
              {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
            </span>
            <span className="pb-1">
              <span className="text-[12.5px] font-semibold text-foreground">{meta.icon} {meta.label}</span>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {resourceLabel(item.resource)} · <code className="rounded border bg-muted px-1 py-0.5 text-[10.5px] font-mono">{item.fields.split(',')[0]}{item.fields.split(',').length > 1 ? ' …' : ''}</code>
              </div>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function CampaignCard({ campaign: c, generatedAt }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const meta = ACTIONS[c.action];
  const Icon = meta.icon;
  const url = campaignAdsUrl(c);
  const ago = c._date ? daysAgo(c._date, generatedAt) : null;

  const metrics = [
    ['tROAS', pct(c.troas)],
    ['ROAS d3', pct(c.roasD3)],
    ['ROAS d7 (3д/14д)', `${pct(c.roasD7_3d)} / ${pct(c.roasD7_14d)}`],
    ['бюджет/д', `$${c.budgetUsd.toFixed(0)}`],
    ['запуск', c._date ? `${c._date} · ${ago}д назад` : '—'],
  ];

  return (
    <article className="relative flex overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
      <div className={cn('w-1 flex-none', STATUS_ACCENT[meta.status])} />
      <div className="flex w-8 flex-none items-center justify-center">
        <Icon className={cn('h-4 w-4', STATUS_TEXT[meta.status])} />
      </div>

      <div className="min-w-0 flex-1 py-2.5 pr-3">
        <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('flex-none text-[13px] font-semibold', STATUS_TEXT[meta.status])}>{meta.label}</span>
          <Badge variant="outline" className="flex-none font-bold tracking-wide">{c._geo}</Badge>
          <NameTooltip name={c.name} />
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none rounded px-1 py-0.5 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Открыть <ExternalLink className="inline h-3 w-3" />
            </a>
          )}
        </div>

        <p className="mb-2 text-[12.5px] text-muted-foreground">{c.reason}</p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(78px,1fr))] gap-x-4 gap-y-1 text-xs">
          {metrics.map(([label, value]) => (
            <span key={label} className="text-muted-foreground">
              {label}
              <b className="block text-[12.5px] font-semibold text-foreground tabular-nums">{value}</b>
            </span>
          ))}
        </div>

        <div className="mt-3 rounded-md border bg-muted/30 p-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Инсталлы по дням</p>
          <Sparkline values={c.installs7d} generatedAt={generatedAt} />
        </div>

        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className="mt-2">
          <CollapsibleTrigger className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary data-[state=open]:text-primary">
            <History className="h-3 w-3" /> История
            <ChevronDown className={cn('h-3 w-3 transition-transform', historyOpen && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
            <div className="mt-2.5 rounded-md border bg-muted/40 p-3">
              <HistoryTimeline campaign={c} generatedAt={generatedAt} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </article>
  );
}
