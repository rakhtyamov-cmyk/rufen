import { cn } from '@/lib/utils';
import { windowDates, WEEKDAY_SHORT } from '@/lib/format';

/**
 * Столбчатый график инсталлов по дням — с подписанным числом под каждым
 * баром (не только у последнего). Важно для аналитика: значение должно
 * читаться без наведения, не только из тултипа.
 *
 * highlightIndex — какой бар подсветить акцентным цветом (по умолчанию
 * последний/сегодня); используется DateSelector'ом для подсветки выбранного дня.
 */
export function Sparkline({ values, generatedAt, highlightIndex }) {
  const n = values.length;
  const max = Math.max(1, ...values);
  const dates = windowDates(n, generatedAt);
  const accentIndex = highlightIndex ?? n - 1;

  return (
    <div className="flex items-end gap-2.5">
      {values.map((v, i) => {
        const isAccent = i === accentIndex;
        const heightPct = Math.max(v > 0 ? 8 : 3, (v / max) * 100);
        const d = dates?.[i];
        return (
          <div key={i} className="flex w-11 flex-none flex-col items-center gap-1.5">
            <div className="flex h-16 w-full items-end justify-center" title={d ? `${d.toLocaleDateString('ru-RU')}: ${v}` : String(v)}>
              <div
                className={cn('w-6 rounded-t-[3px] transition-colors', isAccent ? 'bg-primary' : 'bg-primary/35')}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className={cn('text-[12px] font-semibold leading-none tabular-nums', isAccent ? 'text-foreground' : 'text-muted-foreground')}>
              {v}
            </span>
            {d && (
              <span className="text-[9.5px] leading-none text-muted-foreground/70">
                {WEEKDAY_SHORT[d.getDay()]} {d.getDate()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
