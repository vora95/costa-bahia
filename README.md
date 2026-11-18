# costa-bahia

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/vora95/costa-bahia/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/vora95/costa-bahia/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Costa Bahia is an open-world crime game set in a dense coastal city at sunset.
On foot or behind the wheel of five stealable cars, run six chained story
missions for Rico, Carmen, Lucía and Mama Luz — while the CBPD closes in with
pursuit cars, roadblocks and a searchlight helicopter. Fists and four firearms,
a 0–5 star wanted level, a named police-response panel, a live minimap, radio,
and a full HUD. Everything is original IP; the game runs fully offline.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network.

## Controls

- WASD — drive / walk (Shift to run / boost, Space for handbrake)
- E — enter / steal a car, F — punch, G — shoot, Q — switch weapon
- P — pause, R — radio station, M — mute

## How it works

- `main.ts` (root) — the kit entry point; deterministic dossier builder.
- `game/index.html` — canvas + full HUD (wanted, money, health/armor, REP,
  mission tracker, police response panel, speed, weapons, clock, district,
  radio, dialog, minimap).
- `game/src/` — the game: seeded city (`world.js`), Three.js chase-cam
  renderer (`render.js`), input, WebAudio synth (`audio.js`), procedural
  character portraits (`portraits.js`), screenshot staging (`shots.js`).
- `game/vendor/three.min.js` — Three.js r149, vendored for offline play.
- `screenshots/` — four real gameplay captures (1280×800).

Progress autosaves to localStorage; the best score is kept across sessions.

<sub>Entered on [make.fun](https://make.fun/?ref=05axmjqh&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
