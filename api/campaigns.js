// Vercel serverless function: GET /api/campaigns
// На Vercel постоянного Express-процесса нет — любой файл под api/ становится
// отдельной функцией (файловая конвенция, ничего не нужно регистрировать).
// Логика намеренно продублирована с server.js (не шарим модуль между Express-
// и Vercel-путями деплоя) — тот же принцип самодостаточности, что у остальных
// инструментов в репозитории (см. tools/CLAUDE.md).
//
// JSON читается статическим import (через createRequire, а не fs.readFileSync)
// — так бандлер Vercel гарантированно трассирует файл как зависимость и
// включает его в сборку функции. Динамический fs.readFileSync(path) может
// быть не увиден трассировщиком и пропущен при деплое (ENOENT в проде при
// том, что локально всё работало) — известная особенность Vercel.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const campaigns = require('../data/campaigns.json');

export default function handler(req, res) {
  // Данные статические (перечитываются только при новом деплое) — тот же
  // контракт, что и раньше у Express-маршрута, просто без чтения с диска
  // на каждый запрос.
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.status(200).json(campaigns);
}
