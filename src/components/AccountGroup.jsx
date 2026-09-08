import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { CampaignCard } from '@/components/CampaignCard';
import { ACTIONS } from '@/lib/actions';
import { cn } from '@/lib/utils';

const STATUS_BG = {
  good: 'bg-status-good',
  warning: 'bg-status-warning',
  serious: 'bg-status-serious',
  critical: 'bg-status-critical',
  neutral: 'bg-status-neutral',
};

function MiniDistribution({ campaigns }) {
  const counts = {};
  campaigns.forEach((c) => {
    counts[c.action] = (counts[c.action] || 0) + 1;
  });
  const total = campaigns.length;
  const order = Object.entries(ACTIONS)
    .filter(([key]) => counts[key])
    .sort((a, b) => a[1].sortRank - b[1].sortRank);

  return (
    <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-muted" title="Распределение по статусу">
      {order.map(([key, meta]) => (
        <span
          key={key}
          className={STATUS_BG[meta.status]}
          style={{ width: `${((counts[key] / total) * 100).toFixed(1)}%` }}
          title={`${meta.label}: ${counts[key]}`}
        />
      ))}
    </div>
  );
}

export function AccountGroup({ account, matched, open, onToggle, generatedAt, sparkHighlightIndex }) {
  const totalBudget = account.campaigns.reduce((s, c) => s + c.budgetUsd, 0);

  return (
    <Collapsible open={open} onOpenChange={onToggle} className="mb-5">
      <CollapsibleTrigger className="flex w-full items-center gap-2 border-b py-1.5 text-left">
        <ChevronDown className={cn('h-3.5 w-3.5 flex-none text-muted-foreground transition-transform', !open && '-rotate-90')} />
        <h2 className="flex-none text-sm font-semibold">{account.name}</h2>
        <span className="flex-none text-xs text-muted-foreground tabular-nums">
          ({account.customerId}) · {matched.length}
          {matched.length !== account.campaigns.length ? ` / ${account.campaigns.length}` : ''}
        </span>
        <MiniDistribution campaigns={account.campaigns} />
        <span className="ml-auto flex-none text-xs text-muted-foreground tabular-nums">${totalBudget.toLocaleString('en-US')}/д</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="flex flex-col gap-1.5 pt-2">
          {matched.map((c) => (
            <CampaignCard key={c.name} campaign={c} generatedAt={generatedAt} sparkHighlightIndex={sparkHighlightIndex} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
