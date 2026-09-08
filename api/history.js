// Vercel serverless function: GET /api/history
// Отдаёт data/history.mock.json — см. предупреждение "_mock" внутри самого
// файла: реальны только даты/installs, ROAS/tROAS — синтетический walk.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const history = require('../data/history.mock.json');

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.status(200).json(history);
}
