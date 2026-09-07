import { cn } from '@/lib/utils';

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Даты для 7 баров = последние n календарных дней ДО и ВКЛЮЧАЯ дату прогона
// (generatedAt) — то же окно, что installs7d считает на бэкенде (manage.gs).
function datesFor(n, generatedAt) {
  if (!generatedAt) return null;
  const end = new Date(generatedAt);
  end.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
}

/**
 * Столбчатый график инсталлов по дням — с подписанным числом под каждым
 * баром (не только у последнего). Важно для аналитика: значение должно
 * читаться без наведения, не только из тултипа.
 */
export function Sparkline({ values, generatedAt }) {
  const n = values.length;
  const max = Math.max(1, ...values);
  const dates = datesFor(n, generatedAt);

  return (
    // flex-none + фиксированная ширина колонки — иначе на широкой карточке
    // flex-1 растягивает бары в кирпичи (см. репорт с 2000px-скрина).
    // Гэп внутри колонки (bar уже колонки) — видимый зазор, не сам bar на всю ширину.
    <div className="flex items-end gap-2.5">
      {values.map((v, i) => {
        const isLast = i === n - 1;
        const heightPct = Math.max(v > 0 ? 8 : 3, (v / max) * 100);
        const d = dates?.[i];
        return (
          <div key={i} className="flex w-11 flex-none flex-col items-center gap-1.5">
            <div className="flex h-16 w-full items-end justify-center" title={d ? `${d.toLocaleDateString('ru-RU')}: ${v}` : String(v)}>
              <div
                className={cn('w-6 rounded-t-[3px] transition-colors', isLast ? 'bg-primary' : 'bg-primary/35')}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className={cn('text-[12px] font-semibold leading-none tabular-nums', isLast ? 'text-foreground' : 'text-muted-foreground')}>
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
