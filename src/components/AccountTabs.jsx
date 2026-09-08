import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

function CountBadge({ children, attention }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 text-xs tabular-nums',
        attention ? 'bg-status-serious/15 text-status-serious' : 'bg-black/5 text-muted-foreground dark:bg-white/10'
      )}
    >
      {children}
    </span>
  );
}

/**
 * Явное переключение между "Все аккаунты" и отдельным аккаунтом — заменяет
 * прежний Select в общем ряду фильтров (был легко теряется среди других
 * контролов). Счётчики на бейджах учитывают все ОСТАЛЬНЫЕ активные фильтры
 * (поиск/гео/действие/"только внимание"), поэтому переключение вкладки не
 * "теряет" контекст текущего фильтра.
 */
export function AccountTabs({ accounts, active, onChange, counts, attentionCounts, totalCount, totalAttention }) {
  return (
    <Tabs value={active || '__all__'} onValueChange={(v) => onChange(v === '__all__' ? '' : v)}>
      <TabsList className="w-full justify-start md:w-auto">
        <TabsTrigger value="__all__">
          Все аккаунты
          <CountBadge attention={totalAttention > 0}>{totalCount}</CountBadge>
        </TabsTrigger>
        {accounts.map((a) => (
          <TabsTrigger key={a.customerId} value={a.customerId}>
            {a.name}
            <CountBadge attention={(attentionCounts[a.customerId] || 0) > 0}>{counts[a.customerId] || 0}</CountBadge>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
