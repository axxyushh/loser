# THE LOSER

A cinematic, fully responsive flight tracker. A small airplane flies the page as you scroll; the headline
**THE LOSER** morphs into **LO702** as it crosses; below, real aircraft from **ADSB.lol** appear in three
regions (Europe, USA, Asia) as refined data cards with a full detail panel.

Stack: Vite · React 19 · TypeScript · Motion (`motion/react`) · structured CSS (no UI framework).

## Run

```bash
npm install
npm run dev          # http://localhost:5173 — /api/adsb is proxied to api.adsb.lol in dev
npm run build        # typecheck + production build into dist/
npm run preview      # serve dist/ locally (same dev proxy)
npm start            # self-host: node server.mjs serves dist/ + cached /api/adsb proxy (PORT=8080)
npm run lint && npm run typecheck && npm test
```

Needs Node 20+. No API key, database or auth.