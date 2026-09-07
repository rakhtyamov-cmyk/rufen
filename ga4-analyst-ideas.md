# Идеи: что добавить для аналитика на базе Google Analytics (GA4)

Только идеи, ничего не реализовано. Каждый пункт привязан к **реальной** фиче GA4 Data API /
BigQuery-экспорта (источники внизу), не выдуман на глаз.

## ⚠️ Допущение, которое надо проверить первым

Всё ниже предполагает, что у игр есть **привязанное GA4-свойство** (обычно через Firebase SDK —
стандартный путь для мобильных игр). В репозитории я вижу косвенные признаки монетизации через
ad-mediation (`ad_mediation_revenue_2d`/`ad_mediation_roas_2d` в `ua-weekly-dashboard`), но **не
вижу подтверждения**, что именно GA4 (а не только SDK медиации типа AppLovin MAX/ironSource)
подключён и шлёт события. Первый шаг реально — не код, а вопрос команде: «есть ли GA4-свойство на
играх, и связано ли оно с Google Ads аккаунтами».

Если GA4 есть — все пункты ниже валидны. Если нет — это отдельная задача (завести GA4/Firebase),
не дашборд.

---

## Три уровня доступа к GA4 (сложность растёт)

| Уровень | Что это | Для чего годится | Лимиты |
|---|---|---|---|
| **A. UI/Exploration** | Отчёты прямо в интерфейсе GA4 (Retention, Cohort, Funnel exploration) | Разовый анализ, без кода | Ручной, не автоматизируется |
| **B. Data API** | Программный доступ к тем же отчётам (`analyticsdata.googleapis.com`) — тот же паттерн, что `manage.gs` уже делает для GAQL | Автоматизированный пайплайн, встраивается в существующие `.gs`/Python инструменты | До 9 dimensions + 9 metrics за запрос, квоты на конкурентные запросы/токены в день |
| **C. BigQuery export** | Полный **событийный** лог (`events_YYYYMMDD`, по строке на событие, без сэмплирования) | Настоящий SQL-анализ: кастомные воронки, LTV-кривые, мультитач-атрибуция | Нужен BigQuery-проект, платится по объёму запросов |

Для «дашборда для аналитика» уровня B достаточно почти везде; уровень C — когда нужна точность/
кастомная логика, которую канонические отчёты не считают.

---

## Идеи

### 1. 🎯 Retention-кривые по когорте (дата инсталла × гео × кампания)
GA4 отдаёт стандартный **Retention/Cohort report** — % активных пользователей на D1/D7/D28 от
даты первого запуска, разбито по любому измерению (включая `google_ads_campaign` при связке с
Ads — см. п.5). Сейчас весь репозиторий (`manage.gs`, `ua-weekly-dashboard`) судит кампанию
**только по ROAS** — а кампания может «хорошо продавать», но плохо удерживать (люди платят один
раз и уходят). Retention как второй сигнал — ранний предупреждающий индикатор, которого сейчас
нигде нет.

### 2. 🎯 Predicted Revenue / Purchase Probability → калибровка d3→d7 множителя
Это САМОЕ прямое попадание в существующую логику. Правило 2 регламента (`google-ads-management.md`)
использует **фиксированный** множитель `d7 = 1.06 × d3` для всех игр/гео сразу — это эмпирическая
константа «по ресёрчу», не пересчитываемая по факту. GA4 **Predictive metrics** даёт
`predictedRevenue` (доход за 28 дней вперёд от активных за последние 28 дней юзеров) и
`purchaseProbability` — построены ML на **ваших собственных данных**, а не общий коэффициент.
Потенциально: заменить/дополнить фиксированный 1.06 на predicted-revenue-based множитель, свой
для каждой игры/гео, если данные позволяют (см. лимит ниже).

**Лимит на подключение**: нужно ≥1000 returning-пользователей, триггернувших purchase/churn
условие за 7-дневное окно (и ≥1000 не триггернувших) в последние 28 дней — на маленьких
гео/играх просто не наберётся выборка, GA4 остановит обновление предиктивных метрик.

### 3. 🎯 GA4-Ads связка как независимая проверка ROAS (integrity-check)
Если GA4-свойство **привязано к Google Ads аккаунту**, GA4 Data API отдаёт `advertiserAdCost`,
`returnOnAdSpend`, `totalRevenue` и dimension `google_ads_campaign` — **второй, независимый от
Ads API источник** тех же метрик, которые `manage.gs` уже тянет через GAQL. Прямое применение в
`campaign-dashboard`: колонка/tooltip «ROAS по GA4: X%» рядом с уже показанным ROAS из Ads —
расхождение ловит проблемы трекинга (сломанный SDK, задвоенная атрибуция, конверсии не долетают)
**до** того, как испорченные данные попадут в decide_() и приведут к неверной рекомендации.

### 4. 🎯 Post-install воронка по конкретной рекламной кампании (через gclid)
GA4 при связке с Ads несёт `gclid` и dimension'ы `google_ads_ad_group_name`/`google_ads_creative_id`
на уровне пользователя. Это значит: можно построить воронку **после** инсталла (туториал → первый
уровень → первая покупка) **с разбивкой по конкретной кампании/креативу**. Сейчас `manage.gs`
видит только то, что знает сам Google Ads (спенд, конверсии, значение конверсии) — он не видит
**почему** ROAS плохой (может, юзеры с этой кампании массово отваливаются на туториале, а не
просто "не платят"). Это диагностический слой, которого в репозитории нет вообще.

### 5. 🎯 Predictive-аудитории → назад в Google Ads (Customer Match)
GA4 сам считает аудитории **Likely 7-day purchasers** и **Predicted top spenders** (готовые,
не требуют своей ML). Их можно экспортировать и загрузить в Google Ads как **Customer Match**
аудиторию — для look-alike таргетинга или, наоборот, exclusion (не тратить бюджет на тех, кого
модель считает "точно не заплатит"). Это единственный пункт из списка, который **не просто
отчёт**, а обратная связь в UA-контур — то, что реально может подвинуть tROAS-decision-логику
на уровень выше текущей.

### 6. 🟡 DAU/WAU/MAU и engagement stickiness по гео — портфельное здоровье вне ROAS
GA4 «Retention overview» также даёт **stickiness** (DAU/MAU) — метрику вовлечённости независимо
от денег. Полезно как отдельный stat-тайл в `campaign-dashboard`: кампания может держать ROAS, но
приводить "мёртвых душ" (инсталл есть, юзер почти не возвращается) — это видно по stickiness
раньше, чем по деньгам.

### 7. 🟡 GA4 ad-revenue events как сверка с `ad_mediation_revenue_2d`
`ua-weekly-dashboard` уже читает `ad_mediation_revenue_2d`/`ad_mediation_roas_2d` из сырого
экспорта (источник — вероятно, сама сеть медиации, не GA4). Если в GA4 тоже настроены ad-revenue
события (стандартная связка Firebase↔AdMob/mediation), можно сверить дневные цифры "медиация
сказала X" vs "GA4 сказал Y" — тот же integrity-check принцип, что в п.3, но для монетизации, а
не для закупки.

### 8. 🔴 BigQuery export → эмпирические LTV-кривые вместо константы
Уровень C. Полный event-level лог без сэмплирования. Даёт то, что канонические отчёты API в
принципе не могут: построить **настоящую** LTV-кривую (доход на юзера как функция дней с
инсталла) по каждой игре/гео отдельно и честно посчитать, чем на самом деле является
"d7 ≈ 1.06 × d3" для конкретной игры — вместо общего множителя на все игры сразу (см. п.2, но
точнее: Data API даёт **prediction**, BigQuery даёт **факт**, на котором можно валидировать сам
прогноз). Это самая тяжёлая по усилию идея из списка — отдельный BigQuery-проект, SQL, чья-то
роль аналитика, а не просто скрипт.

### 9. 🟡 Новый инструмент по конвенции репозитория: `ga4-export/`
Технически — паттерн, который уже есть у `manage.gs`/`ua-weekly-dashboard` (маленький скрипт,
дёргает API, пишет в Sheet/JSON), только источник — GA4 Data API вместо GAQL. Одно предостережение
по конвенции репозитория: **это Python/Node с OAuth service account**, а не Apps Script — Google
Ads Scripts может дёргать GAQL нативно через `AdsApp`, но у GA4 Data API нет такого нативного
Apps-Script biseline (нужен `UrlFetchApp` + OAuth2 библиотека, если делать на `.gs`, либо отдельный
Python-скрипт, как `urc2fs`/`tango-catalog-sync`). Решать по месту, когда дойдём до реализации.

---

## Приоритет (если бы делал по одному)

1. **Допущение** — подтвердить, что GA4 реально подключён к играм и связан с Ads-аккаунтами
   (без этого все остальные пункты не имеют смысла).
2. **№3 (integrity-check ROAS)** — самый дешёвый по внедрению, прямое попадание в уже готовый
   `campaign-dashboard`, ловит реальные баги трекинга.
3. **№2 (predicted revenue → калибровка множителя)** — самое ценное по влиянию на бизнес-логику,
   но упирается в лимит выборки (1000+ returning users) — надо сначала проверить, у каких игр/гео
   вообще наберётся.
4. Остальное — по мере появления роли аналитика/спроса на глубину, которую canonical-отчёты не
   дают (№8 BigQuery).

---

## Источники

- [GA4 Dimensions & Metrics: Complete Reference — Digital Applied](https://www.digitalapplied.com/blog/ga4-dimensions-metrics-complete-reference)
- [Predefined Reports — Google Analytics Data API (google for developers)](https://developers.google.com/analytics/devguides/reporting/data/v1/predefined-reports)
- [Advanced Use Cases — Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1/advanced)
- [[GA4] Predictive metrics — Google Analytics Help](https://support.google.com/analytics/answer/9846734?hl=en)
- [What are predictive metrics in GA4 — OptimizeSmart](https://optimizesmart.com/blog/what-are-predictive-metrics-in-google-analytics-4-ga4/)
- [[GA4] Retention overview report — Google Analytics Help](https://support.google.com/analytics/answer/11004084?hl=en)
- [GA4 BigQuery Export: The Complete Schema Reference](https://adriennevermorel.com/articles/ga4-bigquery-export-complete-schema-reference/)
- [GA4 to BigQuery export 2026: events table schema and dates — OWOX](https://www.owox.com/blog/articles/ga4-bigquery-export-event-table-schema-and-dates)
