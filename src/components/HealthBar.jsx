import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ACTIONS } from '@/lib/actions';
import { cn } from '@/lib/utils';

const STATUS_BG = {
  good: 'bg-status-good',
  warning: 'bg-status-warning',
  serious: 'bg-status-serious',
  critical: 'bg-status-critical',
  neutral: 'bg-status-neutral',
};
const STATUS_DOT = STATUS_BG;

// Part-to-whole stacked bar (см. dataviz-skill: "part-to-whole rides on the
// stacked bar chart"). Легенда обязательна для >=2 сегментов — идентичность
// никогда не держится на одном только цвете.
export function HealthBar({ all, activeActions, onToggleAction }) {
  const counts = {};
  all.forEach((c) => {
    counts[c.action] = (counts[c.action] || 0) + 1;
  });
  const total = all.length;
  const order = Object.entries(ACTIONS)
    .filter(([key]) => counts[key])
    .sort((a, b) => a[1].sortRank - b[1].sortRank);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
        <CardTitle className="text-sm font-semibold text-foreground">Портфель по статусу</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">{total} кампаний</span>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Распределение кампаний по статусу">
          {order.map(([key, meta]) => {
            const n = counts[key];
            const w = (n / total) * 100;
            const dimmed = activeActions.size > 0 && !activeActions.has(key);
            return (
              <button
                key={key}
                type="button"
                title={`${meta.label}: ${n} (${Math.round(w)}%)`}
                onClick={() => onToggleAction(key)}
                className={cn(STATUS_BG[meta.status], 'h-full transition-opacity first:rounded-l-full last:rounded-r-full', dimmed && 'opacity-30')}
                style={{ width: `${w.toFixed(2)}%` }}
              />
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {order.map(([key, meta]) => {
            const Icon = meta.icon;
            const dimmed = activeActions.size > 0 && !activeActions.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleAction(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-accent',
                  dimmed ? 'text-muted-foreground/60' : 'text-foreground'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[meta.status])} />
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
                <b className="tabular-nums">{counts[key]}</b>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
