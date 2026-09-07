#!/usr/bin/env node
// Генерирует data/history.mock.json — недельную историю метрик по кампаниям
// для прототипирования "Истории по дням" (upgrade.md, п.1.3). ЭТО МОК, не
// реальные данные: единственное по-настоящему известное per-day значение —
// installs7d (7 реальных дней инсталлов на кампанию, уже в campaigns.json).
// tROAS/бюджет считаются стабильными за неделю (упрощение); ROAS d3/d7 —
// детерминированный псевдослучайный walk, СЕЯНЫЙ от имени кампании (одна и
// та же кампания всегда даёт один и тот же мок при перегенерации), идущий
// НАЗАД от сегодняшнего реального значения. Дни без инсталлов (кампания ещё
// не запущена) — ROAS = null, не 0 (кампании не было, а не "ROAS ноль").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'campaigns.json');
const OUT_PATH = path.join(__dirname, '..', 'data', 'history.mock.json');

// Небольшой детерминированный PRNG (mulberry32), сеяный хэшем строки —
// чтобы one campaign всегда давало одинаковый мок между запусками генератора.
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
// Считаем датами через UTC-полночь конкретно календарной даты из generatedAt
// (не new Date(raw.generatedAt) + setHours — тот путь зависит от локального
// часового пояса машины, где генератор запущен, и может съехать на день).
const generatedDate = new Date(`${raw.generatedAt.slice(0, 10)}T00:00:00Z`);

const DAYS = 7; // тот же охват, что у installs7d
const dates = Array.from({ length: DAYS }, (_, i) => {
  const d = new Date(generatedDate);
  d.setUTCDate(d.getUTCDate() - (DAYS - 1 - i));
  return d.toISOString().slice(0, 10);
});

function walkBackward(finalValue, n, rand, volatility = 0.1) {
  // Идём от последнего (реального) значения назад: на каждом шаге
  // ±volatility относительно текущего, клампим в разумные границы.
  const out = new Array(n);
  out[n - 1] = finalValue;
  for (let i = n - 2; i >= 0; i--) {
    const drift = (rand() - 0.5) * 2 * volatility;
    out[i] = Math.max(0, out[i + 1] * (1 + drift));
  }
  return out;
}

const campaigns = [];
raw.accounts.forEach((acc) => {
  acc.campaigns.forEach((c) => {
    const rand = hashSeed(c.name);
    const installs = c.installs7d; // реальные, как есть
    const roasD3Path = walkBackward(c.roasD3, DAYS, rand, 0.12);
    const roasD7_3dPath = walkBackward(c.roasD7_3d, DAYS, rand, 0.1);
    const roasD7_14dPath = walkBackward(c.roasD7_14d, DAYS, rand, 0.06); // 14д-окно двигается медленнее

    const history = dates.map((date, i) => {
      const hadTraffic = installs[i] > 0;
      return {
        date,
        installs: installs[i],
        troas: c.troas, // упрощение: бюджет/tROAS считаем стабильными за неделю (мок)
        budgetUsd: c.budgetUsd,
        roasD3: hadTraffic ? Number(roasD3Path[i].toFixed(4)) : null,
        roasD7_3d: hadTraffic ? Number(roasD7_3dPath[i].toFixed(4)) : null,
        roasD7_14d: hadTraffic ? Number(roasD7_14dPath[i].toFixed(4)) : null,
      };
    });

    campaigns.push({ name: c.name, accountId: acc.customerId, history });
  });
});

const out = {
  _mock: true,
  _note:
    'Синтетические данные для прототипирования "Истории по дням" (upgrade.md п.1.3). ' +
    'Реальны только даты и installs (из campaigns.json installs7d). ROAS d3/d7 — ' +
    'детерминированный псевдослучайный walk назад от сегодняшнего реального значения, ' +
    'НЕ фактические исторические показания. tROAS/бюджет считаются неизменными за неделю. ' +
    'Заменить на реальный лог, когда manage.gs начнёт писать по записи на кампанию на прогон.',
  generatedFrom: raw.generatedAt,
  days: dates,
  campaigns,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
console.log(`Записано ${campaigns.length} кампаний × ${DAYS} дней -> ${OUT_PATH}`);
