const { put, list } = require('@vercel/blob');

const SCORES_KEY = 'leaderboard.json';
const MAX_PER_DIFF = 20;

async function getScores() {
  try {
    const { blobs } = await list({ prefix: SCORES_KEY });
    if (blobs.length === 0) return [];
    const resp = await fetch(blobs[0].url);
    return await resp.json();
  } catch {
    return [];
  }
}

async function saveScores(scores) {
  await put(SCORES_KEY, JSON.stringify(scores), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const scores = await getScores();
    return res.json(scores);
  }

  if (req.method === 'POST') {
    try {
      const { name, time, oil, diff } = req.body;

      if (!name || typeof name !== 'string' || name.length > 12) {
        return res.status(400).json({ error: 'Invalid name' });
      }
      if (typeof time !== 'number' || time < 0 || time > 9999) {
        return res.status(400).json({ error: 'Invalid time' });
      }
      if (typeof oil !== 'number' || oil < 0 || oil > 999) {
        return res.status(400).json({ error: 'Invalid oil' });
      }
      if (!['training', 'easy', 'medium', 'hard'].includes(diff)) {
        return res.status(400).json({ error: 'Invalid difficulty' });
      }

      const scores = await getScores();
      scores.push({
        name: name.slice(0, 12).toUpperCase(),
        time,
        oil,
        diff,
        date: Date.now(),
      });

      // Keep top 20 per difficulty, sorted by oil price
      const grouped = {};
      for (const s of scores) {
        if (!grouped[s.diff]) grouped[s.diff] = [];
        grouped[s.diff].push(s);
      }
      const trimmed = [];
      for (const d in grouped) {
        grouped[d].sort((a, b) => a.oil - b.oil);
        trimmed.push(...grouped[d].slice(0, MAX_PER_DIFF));
      }

      await saveScores(trimmed);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
