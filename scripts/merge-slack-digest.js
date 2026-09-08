#!/usr/bin/env node
// Мёрджит текстовый Slack-дайджест manage.gs (формат postSlackMessage_/sendDigest_)
// в data/campaigns.json ПО ИМЕНИ кампании. Обновляет только то, что реально
// есть в тексте (action/reason/метрики/бюджет/флаги); поля, которых в этом
// формате нет (primaryStatus вне флагов, daysSinceLaunch/AnyChange/MajorChange,
// changeHistory), сохраняются как были. Кампании, которых нет в новом тексте,
// остаются нетронутыми (просто более старые, не удаляются).
//
// Использование:
//   node scripts/merge-slack-digest.js path/to/digest.txt [--date 2026-09-07T11:47:00+04:00]
//
// Без --date подставляется текущее время запуска. digest.txt — обычный
// текстовый файл с копипастой сообщения из Slack (эмодзи-шорткоды :like_this:
// и метки времени "[11:47 AM]" от разбитых сообщений — то и другое парсер
// сам вырезает/понимает).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'campaigns.json');

const args = process.argv.slice(2);
const txtPath = args.find((a) => !a.startsWith('--'));
const dateFlagIdx = args.indexOf('--date');
const generatedAt = dateFlagIdx !== -1 ? args[dateFlagIdx + 1] : new Date().toISOString();

if (!txtPath) {
  console.error('Использование: node scripts/merge-slack-digest.js path/to/digest.txt [--date ISO]');
  process.exit(1);
}

const LABEL_TO_ACTION = {
  'Остановить кампанию': 'STOP',
  'Не показывается - в поддержку': 'NOT_ELIGIBLE',
  'Запустить копию': 'LAUNCH_COPY',
  'Снизить tROAS (шаг -20%)': 'LOWER_STEP',
  'Снизить tROAS или наблюдать': 'REVIEW',
  'Поднять tROAS': 'RAISE_TROAS',
  'Ничего не делать / бюджет': 'HOLD',
  'Ждать (обучение)': 'WAIT_LEARNING',
  'Ждать (окно конверсии)': 'WAIT_CONV_WINDOW',
};

const HEADER_RE = /^  └— :(\S+): (.+?) — (.+)$/;
const SUMMARY_RE = /^\s+tROAS (\d+)% · ROAS d3 (\d+)% · ROAS d7 (\d+)% \(3д\) \/ (\d+)% \(14д\) · инсталлы ([\d/]+) · бюджет \$(\d+)$/;
const FLAG_RE = /^\s+(:exclamation:|·) (.+)$/;

// Известные варианты текста флага -> внутренний код. Список растёт по мере
// того, как в реальных дайджестах появляются новые формулировки — если
// парсер встретит незнакомую, она попадёт в code:'OTHER' (не потеряется,
// просто не получит структурного разбора).
function flagCode(text) {
  if (text.startsWith('Показ ограничен модерацией')) return 'LIMITED_POLICY';
  if (text.startsWith('Показ ограничен')) return 'LIMITED';
  if (text.startsWith('Объявления на модерации')) return 'REVIEW_PENDING';
  if (text.startsWith('Low креативов')) return 'Д3';
  if (text.startsWith('Отклонённых объявлений')) return 'Д1';
  if (text.startsWith('In-app действий')) return 'п14';
  if (text.startsWith('Набрано инсталлов')) return 'TRAINING_PROGRESS';
  return 'OTHER';
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const byName = new Map();
// ВАЖНО: если одно и то же имя кампании встречается в двух разных аккаунтах
// (реальная порча данных, уже ловили — см. GA3/GA5 07.09.2026), Map.set()
// молча перезапишет первую копию второй, и апдейт уйдёт только в ОДНУ из
// двух — вторая (обычно "домашняя") останется незаметно устаревшей. Громко
// предупреждаем, а не тихо перезаписываем, чтобы это не повторилось молча.
const duplicateNames = [];
data.accounts.forEach((acc) =>
  acc.campaigns.forEach((c) => {
    if (byName.has(c.name)) duplicateNames.push(c.name);
    byName.set(c.name, c);
  })
);
if (duplicateNames.length) {
  console.warn(`⚠️  ${duplicateNames.length} кампани(я/й) встречаются в data/campaigns.json под НЕСКОЛЬКИМИ аккаунтами:`);
  [...new Set(duplicateNames)].forEach((n) => console.warn('   ' + n));
  console.warn('   Обновится только последняя по порядку копия — остальные молча устареют. Дедуплицируйте вручную перед мёрджем.\n');
}

const raw = fs.readFileSync(txtPath, 'utf8');
// Убираем Slack-таймстемпы вида "[11:47 AM]", вклеенные перед "└—" при копипасте.
const lines = raw.replace(/\[\d{1,2}:\d{2} [AP]M\]/g, '').split('\n');

let cur = null;
let expectReason = true;
let updated = 0;
const notFound = [];

for (const line of lines) {
  const h = line.match(HEADER_RE);
  if (h) {
    const [, , label, name] = h;
    const match = byName.get(name);
    if (!match) {
      notFound.push(name);
      cur = null;
      continue;
    }
    cur = match;
    cur.action = LABEL_TO_ACTION[label] || cur.action;
    cur.flags = [];
    // Сброс перед перепарсингом — иначе счётчик "залипает", если проблема
    // с прошлого прогона уже устранена (флаг просто не появится в новом тексте).
    cur.disapprovedAds = 0;
    cur.lowAssets = 0;
    cur.daysSinceCreativeChange = null;
    expectReason = true;
    continue;
  }
  if (!cur) continue;

  const s = line.match(SUMMARY_RE);
  if (s) {
    const [, troas, roasD3, roasD7_3d, roasD7_14d, installsCsv, budget] = s;
    cur.troas = parseInt(troas, 10) / 100;
    cur.roasD3 = parseInt(roasD3, 10) / 100;
    cur.roasD7_3d = parseInt(roasD7_3d, 10) / 100;
    cur.roasD7_14d = parseInt(roasD7_14d, 10) / 100;
    cur.installs7d = installsCsv.split('/').map(Number);
    cur.budgetUsd = parseInt(budget, 10);
    updated++;
    cur = null;
    continue;
  }

  const f = line.match(FLAG_RE);
  if (f) {
    const act = f[1] === ':exclamation:';
    const text = f[2];
    const code = flagCode(text);
    cur.flags.push({ code, act, text });

    if (code === 'Д1') {
      const m = text.match(/Отклонённых объявлений: (\d+)/);
      if (m) cur.disapprovedAds = parseInt(m[1], 10);
    }
    if (code === 'Д3') {
      const m = text.match(/Low креативов: (\d+)/);
      if (m) cur.lowAssets = parseInt(m[1], 10);
      const upd = text.match(/обновляли (\d+)д назад/);
      if (upd) cur.daysSinceCreativeChange = parseInt(upd[1], 10);
    }
    if (code === 'п14') {
      const m = text.match(/In-app действий: (\d+)\/день/);
      if (m) cur.avgInAppPerDay = parseInt(m[1], 10);
    }
    if (code === 'TRAINING_PROGRESS') {
      const m = text.match(/Набрано инсталлов: (\d+) из (\d+) за 7д, посл\. 3 дня (\d+)\/(\d+)\/(\d+)/);
      if (m) {
        cur.trainedInstalls = parseInt(m[1], 10);
        cur.trainedTarget = parseInt(m[2], 10);
        cur.trainedLast3Days = [parseInt(m[3], 10), parseInt(m[4], 10), parseInt(m[5], 10)];
      }
    }
    if (code === 'LIMITED') {
      cur.primaryStatus = 'LIMITED';
      const rm = text.match(/LIMITED \(([^)]+)\)/);
      cur.primaryStatusReasons = rm ? rm[1].split(', ') : ['BIDDING_STRATEGY_CONSTRAINED'];
    }
    if (code === 'LIMITED_POLICY') {
      cur.primaryStatus = 'LIMITED';
      cur.primaryStatusReasons = ['HAS_ADS_LIMITED_BY_POLICY'];
    }
    if (code === 'REVIEW_PENDING') {
      cur.primaryStatus = 'PENDING';
      const rm = text.match(/\(([^)]+)\)/);
      if (rm) cur.primaryStatusReasons = rm[1].split(', ');
    }
    expectReason = false;
    continue;
  }

  if (expectReason && line.trim()) {
    cur.reason = line.trim();
    if (cur.reason.includes('статус NOT_ELIGIBLE')) cur.primaryStatus = 'NOT_ELIGIBLE';
    expectReason = false;
  }
}

console.log(`Обновлено кампаний: ${updated}`);
if (notFound.length) {
  console.log(`НЕ НАЙДЕНЫ по имени (не обновлены — новые кампании, добавьте вручную если нужно):`);
  notFound.forEach((n) => console.log('  ' + n));
}

data.generatedAt = generatedAt;

const backupPath = DATA_PATH + '.bak-' + Date.now();
fs.copyFileSync(DATA_PATH, backupPath);
console.log('Бэкап предыдущей версии:', backupPath);

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
console.log('Записано в', DATA_PATH);
