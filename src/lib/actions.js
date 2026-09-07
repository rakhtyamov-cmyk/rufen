import {
  OctagonAlert,
  Ban,
  RotateCcw,
  ArrowDown,
  MessageCircleQuestion,
  ArrowUp,
  CircleCheckBig,
  Hourglass,
  TimerReset,
} from 'lucide-react';

// `act` скопирован 1:1 из ACTIONS в tools/google-ads-management/manage.gs —
// HOLD/WAIT_* информационные, остальные требуют реального вмешательства менеджера.
// Держите в синхроне, если manage.gs изменится.
export const ACTIONS = {
  STOP: { sortRank: 0, label: 'Остановить кампанию', icon: OctagonAlert, status: 'critical', act: true },
  NOT_ELIGIBLE: { sortRank: 1, label: 'Не показывается - в поддержку', icon: Ban, status: 'critical', act: true },
  LAUNCH_COPY: { sortRank: 2, label: 'Запустить копию', icon: RotateCcw, status: 'serious', act: true },
  LOWER_STEP: { sortRank: 3, label: 'Снизить tROAS (шаг -20%)', icon: ArrowDown, status: 'warning', act: true },
  REVIEW: { sortRank: 4, label: 'Снизить tROAS или наблюдать', icon: MessageCircleQuestion, status: 'warning', act: true },
  RAISE_TROAS: { sortRank: 5, label: 'Поднять tROAS', icon: ArrowUp, status: 'good', act: true },
  HOLD: { sortRank: 6, label: 'Ничего не делать / бюджет', icon: CircleCheckBig, status: 'good', act: false },
  WAIT_LEARNING: { sortRank: 7, label: 'Ждать (обучение)', icon: TimerReset, status: 'neutral', act: false },
  WAIT_CONV_WINDOW: { sortRank: 8, label: 'Ждать (окно конверсии)', icon: Hourglass, status: 'neutral', act: false },
};

// Самые severe исходы — драйвят отдельный "критический" stat-тайл.
export const URGENT_ACTIONS = new Set(['STOP', 'NOT_ELIGIBLE', 'LAUNCH_COPY']);

// Зеркалит needsAttention_() из manage.gs: ACTIONS[action].act ИЛИ есть
// actionable-флаг (Д1/Д3) — WAIT/HOLD-кампания с непройденной модерацией
// всё равно требует внимания, а HOLD сам по себе — нет (act:false).
export function needsAttention(c) {
  return ACTIONS[c.action].act || (c.flags || []).some((f) => f.act);
}
