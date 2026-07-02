// Clipper Town — town leaderboard worker (Cloudflare Workers + KV)
//
// One tiny endpoint pair per town+course board (PATH-LESS — routed on method, so
// the same client protocol also fits Google Apps Script exec URLs; the legacy
// /board path still works):
//   GET  ?town=nbpt&course=southend              -> { rows: [{ n, t }, ...] }   (top 50, fastest first)
//   POST { town, course, n, t }  as text/plain   -> { rows, place }             (merge, keep each name's best)
//   (the client sends text/plain to dodge CORS preflights for Apps Script;
//    req.json() here parses the body regardless of the header)
//
// Names are re-validated SERVER-side with the same kid-safe filter as the client
// (never trust the client), times sanity-checked, boards capped. No accounts, no
// cookies, no tracking — a name and a time, that's the whole schema.
//
// Deploy: see README.md next to this file (one KV namespace + `wrangler deploy`).

const ALLOW_ORIGINS = ['https://clippertown.io', 'http://localhost:5173', 'http://localhost:5199'];
const MAX_ROWS = 50;
const KEY_RE = /^[a-z0-9-]{2,24}$/;          // town + course ids
const NAME_RE = /^[A-Z0-9 ]{1,12}$/;         // uppercase arcade names, as the client saves them

// same kid-safe filter as src/game/race.ts (leet-normalized substring + whole-word tiers)
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '+': 't' };
const BAD_SUB = [
  'fuck', 'fuk', 'fck', 'fuq', 'phuck', 'shit', 'shyt', 'bitch', 'btch', 'cunt', 'cock', 'kock',
  'dick', 'penis', 'vagin', 'pussy', 'pusy', 'boob', 'tits', 'titty', 'porn', 'whore', 'slut',
  'anus', 'jizz', 'milf', 'dildo', 'rape', 'blowjob', 'handjob', 'boner',
  'nigg', 'nigr', 'fag', 'kike', 'wetback', 'retard', 'rtard', 'nazi', 'hitler', 'kkk', 'xxx',
  // compounds that dodge the whole-word tier (which exists so CASSIE/PASSED stay legal)
  'asshat', 'asshole', 'arsehole', 'arse', 'dumbass', 'jackass', 'butthole', 'buttcrack',
];
const BAD_WORD = ['ass', 'sex', 'cum', 'tit', 'hoe', 'anal', 'spic', 'meth'];
function nameIsClean(raw) {
  let s = raw.toLowerCase().replace(/[0134578@$!+]/g, (c) => LEET[c] || c);
  s = s.replace(/[^a-z ]/g, '');
  const stripped = s.replace(/ /g, '');
  const collapsed = stripped.replace(/(.)\1+/g, '$1');
  for (const w of BAD_SUB) if (stripped.includes(w) || collapsed.includes(w)) return false;
  for (const w of BAD_WORD) if (new RegExp(`\\b${w}\\b`).test(s)) return false;
  return true;
}

function cors(origin) {
  const ok = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const headers = cors(origin);
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(req.url);
    if (url.pathname !== '/' && url.pathname !== '/board') return new Response('{"error":"not found"}', { status: 404, headers });

    if (req.method === 'GET') {
      const town = url.searchParams.get('town') || '';
      const course = url.searchParams.get('course') || '';
      if (!KEY_RE.test(town) || !KEY_RE.test(course)) return new Response('{"error":"bad ids"}', { status: 400, headers });
      const rows = JSON.parse((await env.BOARDS.get(`board:${town}:${course}`)) || '[]');
      return new Response(JSON.stringify({ rows }), { headers });
    }

    if (req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch { return new Response('{"error":"bad json"}', { status: 400, headers }); }
      const { town, course, n, t } = body || {};
      if (!KEY_RE.test(town || '') || !KEY_RE.test(course || '')) return new Response('{"error":"bad ids"}', { status: 400, headers });
      if (typeof n !== 'string' || !NAME_RE.test(n) || !nameIsClean(n)) return new Response('{"error":"bad name"}', { status: 400, headers });
      const time = Number(t);
      if (!isFinite(time) || time < 5 || time > 7200) return new Response('{"error":"bad time"}', { status: 400, headers });

      const key = `board:${town}:${course}`;
      const rows = JSON.parse((await env.BOARDS.get(key)) || '[]');
      const i = rows.findIndex((r) => r.n === n);
      if (i >= 0) { if (time < rows[i].t) rows[i].t = +time.toFixed(2); }
      else rows.push({ n, t: +time.toFixed(2) });
      rows.sort((a, b) => a.t - b.t);
      if (rows.length > MAX_ROWS) rows.length = MAX_ROWS;
      await env.BOARDS.put(key, JSON.stringify(rows));
      const place = Math.max(1, rows.findIndex((r) => r.n === n) + 1);
      return new Response(JSON.stringify({ rows, place }), { headers });
    }

    return new Response('{"error":"method"}', { status: 405, headers });
  },
};
