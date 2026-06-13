# NEVERMORE — mobile arcade game

A one-thumb gothic arcade game: guide a raven through an endless abyss. Built to
run as a PWA on iPhone, later packageable with Capacitor.

## Stack

Phaser 3 + TypeScript + Vite. PWA via `vite-plugin-pwa`. Procedural audio via
Tone.js (no audio files). Supabase for the optional online leaderboard.

## Dev rules (non-negotiable)

- **60 fps**: all movement is delta-time based; object pooling everywhere; never
  instantiate/destroy obstacles, souls or particle emitters mid-run.
- **All gameplay tuning lives in `src/config/balance.ts`.** Never hardcode a
  gameplay number anywhere else. Visual theme lives in `src/config/theme.ts`.
- The **core loop (control + feel) comes first**. If it isn't fun to replay,
  tune it before adding features.
- **Instant restart**: no menu/loading between two runs — a tap on the death
  screen restarts immediately.
- Handle **iOS audio unlock** (first tap, in BootScene) and **safe areas**
  (notch) — `viewport-fit=cover` + CSS env() in `index.html`.
- Scenes never reach into each other — they communicate via `EventBus`.
- Procedural everything: visuals are generated in `TextureFactory` at boot and
  reused (no per-frame redraws); audio is synthesised in `AudioManager`.

## Architecture

```
src/
  main.ts                 Phaser config (FIT scale, refresh-rate aware), boots services
  config/    balance.ts   ALL tuning   theme.ts   colours + fonts
  gfx/       TextureFactory.ts   generates crow/obstacle/soul/particle textures at boot
  systems/   EventBus, SaveManager, Services (container), AudioManager, HapticsManager,
             ComboSystem, DifficultySystem, EconomySystem, ProgressionSystem,
             Leaderboard, ObjectPool
  data/      skins, upgrades, achievements, dailyChallenges  (pure data)
  scenes/    Boot, Menu, Game, UI (parallel HUD), Death, Shop, Leaderboard
  ui/        small reusable UI widgets
```

`Services` is created once in `main.ts` and stored on the Phaser registry as
`"services"`; every scene reads it via `this.registry.get("services")`.

## Commands

- `npm run dev` — dev server (test on iPhone via your LAN IP, e.g.
  `http://192.168.x.x:5173`). The server already binds to `0.0.0.0`.
- `npm run build` — typecheck + production build into `dist/`.
- `npm run preview` — serve the production build.
- `npm run icons` — regenerate the PWA icons (dependency-free PNG generator).
- `npx cap sync` — sync to the native iOS project (phase 6, once Capacitor added).

## Online leaderboard (optional)

Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`. Without them the game uses the local leaderboard only
and stays fully playable offline. SQL for the `scores` table is in
`src/systems/Leaderboard.ts`.
