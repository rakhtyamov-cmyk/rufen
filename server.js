import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 4173;
const DATA_PATH = path.join(__dirname, 'data', 'campaigns.json');
const HISTORY_PATH = path.join(__dirname, 'data', 'history.mock.json');
const DIST_DIR = path.join(__dirname, 'dist'); // сборка Vite (`npm run build`)

app.use(express.static(DIST_DIR));

// Отдаём тот же JSON, что писал бы manage.gs, если бы дублировал дайджест
// в файл вместо (или в дополнение к) Slack. См. README "Путь к продакшену".
app.get('/api/campaigns', (req, res) => {
  fs.readFile(DATA_PATH, 'utf8', (err, raw) => {
    if (err) {
      res.status(500).json({ error: 'Не удалось прочитать data/campaigns.json: ' + err.message });
      return;
    }
    try {
      res.json(JSON.parse(raw));
    } catch (e) {
      res.status(500).json({ error: 'campaigns.json повреждён: ' + e.message });
    }
  });
});

// Мок-история за 7 дней (см. "_mock" внутри файла — реальны только даты/installs).
app.get('/api/history', (req, res) => {
  fs.readFile(HISTORY_PATH, 'utf8', (err, raw) => {
    if (err) {
      res.status(500).json({ error: 'Не удалось прочитать data/history.mock.json: ' + err.message });
      return;
    }
    try {
      res.json(JSON.parse(raw));
    } catch (e) {
      res.status(500).json({ error: 'history.mock.json повреждён: ' + e.message });
    }
  });
});

// SPA fallback — любой не-/api путь отдаёт index.html (React Router здесь не
// используется, но это стандартный паттерн для Vite SPA за Express).
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    res.status(503).send('dist/ не найден — сначала выполните `npm run build`.');
    return;
  }
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`Campaign dashboard: http://localhost:${PORT}`);
});
