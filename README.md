# campaign-dashboard (прототип)

Прототип веб-дашборда поверх дайджеста [`google-ads-management`](../google-ads-management/) —
вместо простыни текста в Slack-треде: карточки по кампаниям, сгруппированные по аккаунту,
с фильтрами по действию/аккаунту/гео, поиском, сортировкой, sparkline-графиком инсталлов,
разбором имени кампании по наведению и таймлайном истории изменений.

**Это прототип, не продакшен-инструмент.** Данные сейчас — статичный `data/campaigns.json`,
собранный из реальных прогонов `manage.gs`/`preview-full.gs` (не мок). Ничего не пишет и не
мутирует Google Ads — чистая визуализация.

## Стек

**React + Vite + Tailwind CSS + [shadcn/ui](https://ui.shadcn.com)** (Radix-примитивы поверх
Tailwind). Раньше был ванильный HTML/CSS/JS без сборки — см. `public-legacy-vanilla/` (не
деплоится, оставлено как референс той же логики без React).

shadcn/ui — это не npm-пакет: компоненты в `src/components/ui/` — код, который **вы владеете
и редактируете напрямую** (сгенерирован вручную по стандартным паттернам `npx shadcn add`, без
интерактивного CLI). `components.json` описывает конфигурацию на случай, если позже понадобится
настоящий `npx shadcn add <component>`.

Радикс-примитивы задействованы там, где реально нужна логика (позиционирование, focus-trap):
**Tooltip** (разбор имени кампании), **Collapsible** (группы аккаунтов, история изменений),
**Separator**. Выпадающие списки — нативный `<select>`, стилизованный под Input (Radix Select
избыточен для простого фильтра).

## Запуск

```bash
cd tools/campaign-dashboard
npm install
npm run build   # vite build -> dist/
npm start       # node server.js — отдаёт dist/ + /api/campaigns на :4173
```

Откроется на [http://localhost:4173](http://localhost:4173).

Для разработки с hot-reload — два процесса в разных терминалах:

```bash
npm start   # Express: только /api/campaigns, порт 4173
npm run dev # Vite dev-сервер с HMR, проксирует /api на :4173 (см. vite.config.js)
```

## Что внутри

```
server.js                 Express: отдаёт dist/ (после build) + GET /api/campaigns
data/
  campaigns.json           снимок реального прогона (5 аккаунтов, 54 кампании)
  history.mock.json         МОК: недельная история метрик для прототипа "Истории по дням"
                             (upgrade.md п.1.3) — см. предупреждение в самом файле (`_mock: true`)
scripts/
  generate-mock-history.js  генератор history.mock.json (детерминированный, сеяный по имени кампании)
src/
  main.jsx                 точка входа, ThemeProvider + TooltipProvider
  App.jsx                  fetch данных, фильтры/сортировка/состояние, шорткаты
  index.css                тема shadcn (CSS-переменные) + статус-палитра, .dark для тёмной темы
  lib/
    actions.js              ACTIONS (зеркалит ACTIONS из manage.gs — act/status/label/icon)
    format.js                pct/daysAgo/parseCampaignName/campaignAdsUrl
    nameTokens.js             словарь токенов имени кампании (для тултипа)
    changeHistory.js          перевод change_event полей в читаемые лейблы
    theme.jsx                 ThemeProvider/useTheme (light/dark/system, localStorage)
    useFilterState.js         фильтры <-> URL query params (history.replaceState)
    useLocalStorageSet.js     общий хук для персистентных Set (свёрнутые аккаунты)
  components/
    ui/                       shadcn-примитивы (button, card, badge, select, dropdown-menu,
                               tooltip, collapsible, separator, input, skeleton)
    StatTile.jsx, HealthBar.jsx, Filters.jsx, ThemeToggle.jsx, DashboardSkeleton.jsx,
    AccountGroup.jsx, CampaignCard.jsx, Sparkline.jsx
public-legacy-vanilla/    старая vanilla-версия (референс, не деплоится)
```

## Дизайн

Тема — стандартная shadcn `neutral` (CSS-переменные в `src/index.css`), light/dark/system —
`ThemeProvider` (`src/lib/theme.jsx`) ставит класс `.dark` на `<html>`, по умолчанию от
`prefers-color-scheme`, с ручным переключателем (иконка в панели фильтров) и persist в
localStorage. Поверх темы — статус-палитра действий
(good/warning/serious/critical/neutral), не входящая в стандартную тему shadcn: провалидирована
внутренним data-viz гайдом (CVD Delta E, контраст), подключена как `text-status-*`/`bg-status-*`
в `tailwind.config.js`. `ACTIONS` в `src/lib/actions.js` зеркалит одноимённый объект в
[`manage.gs`](../google-ads-management/manage.gs) (`sortRank`/`label`/`act`/`status`) — держите
в синхроне, если правки туда попадут.

**Грабли Tailwind, на которые уже наступили и обошли:** классы вида `` `text-status-${x}` ``,
собранные шаблонной строкой в рантайме, JIT-сканер не находит (он статически парсит исходники) —
такой класс просто не попадёт в билд. Везде, где нужен цвет по ключу статуса, используется
готовая карта `{ good: 'text-status-good', ... }` с полными именами классов литералом в коде.

## Деплой на Vercel

Репозиторий подготовлен под Vercel: `api/campaigns.js` — serverless-функция (файловая конвенция
Vercel — любой файл под `api/` становится отдельной функцией, постоянного Express-процесса на
Vercel нет и не будет; `server.js` остаётся только для локального запуска/другого хостинга,
Vercel его не использует). Статику (`dist/`) Vercel собирает и раздаёт сам через `vite build`.

**Как задеплоить:**

1. Импортировать репозиторий в Vercel (Dashboard → Add New → Project, или `vercel` CLI из этой
   папки).
2. **Root Directory — обязательно `campaign-dashboard`.** Это монорепо: git-корень выше
   (`tools/`), а не сам `campaign-dashboard/`. Без этой настройки Vercel будет искать
   `package.json` не там и билд не соберётся. В UI: Project Settings → General → Root Directory.
3. Framework/Build/Output — автодетект должен справиться сам (Vite), но `vercel.json` в папке
   фиксирует то же явно (`buildCommand: npm run build`, `outputDirectory: dist`) на случай, если
   автодетект в контексте монорепо ошибётся.
4. Переменные окружения не нужны — данные статичные (`data/campaigns.json`), секретов нет.
5. Деплой. `GET /api/campaigns` и статика заработают на одном домене без доп. настройки CORS.

**⚠️ Прежде чем реально жать Deploy — осознанное решение, не техническая деталь.** Дашборд
показывает настоящие бизнес-цифры (бюджеты, ROAS по реальным кампаниям) — как только это не
`localhost`, у него по умолчанию **публичный URL без какой-либо авторизации**. Это ровно тот
пункт, что уже был отмечен в `upgrade.md` (раздел 5, «Аутентификация») как отдельный, ещё не
закрытый риск. Варианты:
- **Vercel Deployment Protection** (пароль на деплой/окружение) — быстрее всего, встроено в
  Vercel (доступность зависит от тарифного плана организации — проверьте в Project Settings →
  Deployment Protection).
- Оставить деплой **Preview**-окружением (не Production) и не расшаривать URL дальше команды —
  минимальная защита "через неизвестность", не настоящий access control.
- Отложить публичный URL до реального решения по доступу (Google SSO и т.п.), задеплоить пока
  только себе для проверки, что сборка вообще работает на Vercel.

Технической проблемы в самом деплое нет — вопрос именно в том, кто должен увидеть эти цифры.

## Путь к продакшену (если приживётся дальше Vercel-прототипа)

Сейчас `manage.gs` ничего не сохраняет — считает в памяти и постит в Slack. Чтобы дашборд ожил:

1. **Данные.** `manage.gs` в конце `main()` пишет посчитанные объекты кампаний (те же, что уходят
   в `decide_()`) в файл/таблицу вместо (или в дополнение к) статичного JSON здесь —
   проще всего в Google Sheet (см. паттерн [`ua-weekly-dashboard`](../ua-weekly-dashboard/)) или
   POST-ом, обновляющим `data/campaigns.json` перед редеплоем на Vercel.
2. **CI.** Автоматический редеплой на Vercel при обновлении `data/campaigns.json` (Vercel Git
   Integration уже это умеет при пуше в репозиторий — вопрос только в том, кто/что коммитит
   свежий JSON).
3. **История.** Текущий прототип — снимок одного прогона (с ручным мёрджем следующих). Для
   трендов по дням нужен растущий лог (таблица/БД), не перезапись одного файла — см.
   `data/history.mock.json` как черновой формат под это.
4. **`campaignId`.** Ссылки "Открыть" используют синтетический id (демо-данные не несут
   реального `campaignId` по большинству кампаний) — в проде брать настоящий из GAQL.

Если этот шаг не нужен — более лёгкие альтернативы (Slack Canvas, Google Sheet + Looker Studio)
обсуждались отдельно и не требуют новой инфраструктуры вовсе.
