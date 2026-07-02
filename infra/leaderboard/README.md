# Clipper Town — cloud leaderboard (two free backends, pick one)

The game already syncs the moment a URL is configured — the code ships dark.
Both backends speak the same protocol; the client doesn't care which one answers:

```
GET  <url>?town=nbpt&course=southend                  -> { rows: [{ n, t }, ...] }
POST <url>   {"town","course","n","t"}  (text/plain)  -> { rows, place }
```

Names are re-validated server-side with the same kid-safe filter as the client,
times sanity-checked (5s–2h). No accounts, no cookies — a name and a time is
the whole schema.

## Path A — Google Apps Script (recommended: NO new account)

Runs under the Google account you already have. Free, no card. The board lives
in a Google Sheet in your Drive — **open the Sheet and delete a row to remove a
name**; that's the whole moderation story.

1. Go to **script.google.com** → **New project** (sign in with your normal Gmail).
2. Delete the starter code, paste in all of **`apps-script.gs`** (this folder), save.
3. **Deploy → New deployment → Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Click Deploy, authorize when asked (it wants Sheets access — that's the storage).
4. Copy the **Web app URL** (ends in `/exec`).
5. **Test-drive without a rebuild:** on clippertown.io open the browser console and run
   `localStorage.setItem('nbpt-board-url', '<your /exec url>')`, reload, race, and
   watch your time land on the board (and a "Clipper Town Leaderboards" spreadsheet
   appear in your Drive).
6. Make it live for everyone: paste the URL into `LEADERBOARD_URL` at the top of
   `src/game/race.ts`, commit, push — CI deploys it worldwide.

To update the script later: edit at script.google.com, then **Deploy → Manage
deployments → ✏️ → New version** (the URL stays the same).

Quota notes: consumer Apps Script allows tens of thousands of executions/day —
years of headroom. Latency is ~0.5–2s per call; the game treats the cloud as a
background merge over the instant local board, so nobody waits on it.

## Path B — Cloudflare Worker (lower latency, needs a Cloudflare account)

1. Create a free account at dash.cloudflare.com (Workers free tier = 100k req/day).
2. In this folder (`infra/leaderboard/`):
   ```sh
   npx wrangler login                       # opens the browser to authorize
   npx wrangler kv namespace create BOARDS  # prints an id
   ```
3. Paste the printed id into `wrangler.toml` (replacing `PASTE_NAMESPACE_ID_HERE`), then:
   ```sh
   npx wrangler deploy                      # prints your worker URL
   ```
4. Same as A5/A6: test-drive via `nbpt-board-url`, then hardcode `LEADERBOARD_URL`.

## Smoke test (either backend)

```sh
curl -L "<url>?town=nbpt&course=southend"
curl -L -X POST "<url>" -H 'Content-Type: text/plain' \
  -d '{"town":"nbpt","course":"southend","n":"DEVIN","t":42.5}'
```
(`-L` matters for Apps Script — it answers through a redirect.)

## Keep the filter lists in sync

The kid-safe name filter lives in THREE places: `src/game/race.ts`,
`worker.js`, and `apps-script.gs`. A word added to one goes in all three.
