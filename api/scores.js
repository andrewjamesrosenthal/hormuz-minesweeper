import { put, list, head } from '@vercel/blob';

export const config = { runtime: 'edge' };

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

export default async function handler(req) {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method === 'GET') {
    const scores = await getScores();
    return new Response(JSON.stringify(scores), { headers });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { name, time, oil, diff } = body;

      // Validate
      if (!name || typeof name !== 'string' || name.length > 12) {
        return new Response(JSON.stringify({ error: 'Invalid name' }), { status: 400, headers });
      }
      if (typeof time !== 'number' || time < 0 || time > 9999) {
        return new Response(JSON.stringify({ error: 'Invalid time' }), { status: 400, headers });
      }
      if (typeof oil !== 'number' || oil < 0 || oil > 999) {
        return new Response(JSON.stringify({ error: 'Invalid oil' }), { status: 400, headers });
      }
      if (!['training', 'easy', 'medium', 'hard'].includes(diff)) {
        return new Response(JSON.stringify({ error: 'Invalid difficulty' }), { status: 400, headers });
      }

      const scores = await getScores();
      scores.push({
        name: name.slice(0, 12).toUpperCase(),
        time,
        oil,
        diff,
        date: Date.now(),
      });

      // Sort by oil price (lowest = best), keep top 20 per difficulty
      const grouped = {};
      for (const s of scores) {
        if (!grouped[s.diff]) grouped[s.diff] = [];
        grouped[s.diff].push(s);
      }
      const trimmed = [];
      for (const diff in grouped) {
        grouped[diff].sort((a, b) => a.oil - b.oil);
        trimmed.push(...grouped[diff].slice(0, MAX_PER_DIFF));
      }

      await saveScores(trimmed);
      return new Response(JSON.stringify({ ok: true }), { headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}
