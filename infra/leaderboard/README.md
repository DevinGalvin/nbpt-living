# Clipper Town — cloud leaderboard (5-minute setup)

The game already syncs to this worker the moment a URL is configured — the code
ships dark. These steps are the only part that needs a human (account + auth):

1. **Create a free Cloudflare account** at dash.cloudflare.com (the Workers free
   tier is 100k requests/day — years of headroom for this).
2. In this folder (`infra/leaderboard/`):
   ```sh
   npx wrangler login                       # opens the browser to authorize
   npx wrangler kv namespace create BOARDS  # prints an id
   ```
3. Paste the printed id into `wrangler.toml` (replacing `PASTE_NAMESPACE_ID_HERE`), then:
   ```sh
   npx wrangler deploy                      # prints your worker URL
   ```
4. Put the printed URL into `LEADERBOARD_URL` at the top of `src/game/race.ts`
   (e.g. `https://clippertown-leaderboard.<you>.workers.dev`), commit, push —
   CI deploys and every town board goes live worldwide.

## What it stores
One KV value per town+course: a JSON array of at most 50 `{ n, t }` rows —
a kid-safe-filtered name (re-validated server-side) and a time in seconds.
No accounts, no cookies, nothing else.

## Smoke test
```sh
curl "https://<worker-url>/board?town=nbpt&course=southend"
curl -X POST "https://<worker-url>/board" -H 'Content-Type: application/json' \
  -d '{"town":"nbpt","course":"southend","n":"DEVIN","t":42.5}'
```
