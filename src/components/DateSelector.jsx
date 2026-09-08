import { Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { windowDates, WEEKDAY_SHORT } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Выбор дня для просмотра метрик (см. upgrade.md п.1.3 / history.mock.json).
 * ЧЕСТНО ограничено: реальны только даты и инсталлы (installs7d), ROAS/tROAS
 * за прошлые дни — синтетический мок. Действие/флаги/причина рекомендации не
 * пересчитываются по дням (decide_() по истории нет) — остаются из последнего
 * прогона всегда, вне зависимости от выбранного дня.
 */
export function DateSelector({ generatedAt, selectedIndex, onSelect, days = 7 }) {
  const dates = windowDates(days, generatedAt);
  if (!dates) return null;
  const latestIndex = days - 1;
  const activeIndex = selectedIndex ?? latestIndex;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5 rounded-md border bg-card p-0.5">
        {dates.map((d, i) => {
          const isActive = i === activeIndex;
          const isLatest = i === latestIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(isLatest ? null : i)}
              aria-pressed={isActive}
              title={d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              className={cn(
                'flex flex-col items-center rounded px-2 py-1 text-center transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <span className="text-[9px] uppercase leading-none opacity-80">{isLatest ? 'Сегодня' : WEEKDAY_SHORT[d.getDay()]}</span>
              <span className="text-[12px] font-semibold leading-tight tabular-nums">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Пояснение по выбору даты">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-[11.5px] leading-snug">
          Метрики (tROAS/ROAS/бюджет) за выбранный день — из мок-истории: реальны только дата и
          инсталлы, ROAS/tROAS прошлых дней — синтетика для прототипа. Статус, рекомендация и
          флаги кампании <b>не</b> пересчитываются по дням — всегда из последнего прогона.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
