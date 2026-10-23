# TFT Lab

A single-screen, browser-based TFT practice tool for **Set 18, patch 18.5**. Runs simulation and positioning search in a Web Worker so the interface stays responsive.

## Run

```bash
npm install
npm run dev
```

`npm run build` builds for static hosting. No database, authentication or Riot API key required.

## Available

- Search Set 18 champions, place on either half of a 7×8 board, drag/swap, change stars and equip item-stat modifiers.
- Run individual seeded fights with a combat log, estimate outcomes over 128 fights, or position-search ~65 / 160 / 360 candidate boards.
- Lock champions to their hex during optimization. Board state persists locally; JSON copy and import support sharing.
- Version-pinned CommunityDragon `16.21` data loader corresponding to TFT 18.5. Cached compact roster once loaded; uses `latest` only with an explicit unverified label. If neither can be fetched, the **built-in sample roster and sample statistics** allow offline practice, labeled as unverified.
- Position optimization uses common seeds across candidates and validates against the original placement. It is a heuristic **not a proof of optimal positioning**.

## Accuracy limitations (important)

**Not a faithful simulation of real TFT patch 18.5 games.** Real TFT has bespoke champion spell logic, trait effects, item passives, targeting rules, augments, anomalies and economy/matchmaking mechanics. This engine simulates six-neighbor hex movement, attacks, armor/MR mitigation, mana, generic spell casts, star scaling and additive item stats. Champion ability descriptions are reference text only, **not executed**. Synergies are displayed but **not applied in combat**. All displayed simulated odds are estimates for the supplied opposing board, not empirical match win rates.

Patch 18.5 shipped October 21, 2026 and received an October 22 B-patch. The version-pinned 16.21 data files may not encode the mid-patch hotfix. Since external static sources can lag, the UI communicates data provenance; it never silently presents built-in estimates as official stats. Data loading requires external CDN access on first load.

## Architecture

- `src/data.ts` — patch-aware static data parsing, cache, fallback and board presets
- `src/engine.ts` — deterministic combat, batch estimates, positional optimization, validation
- `src/worker.ts` — background computations and cancellation through Worker termination
- `src/main.tsx` — board editor, roster, simulation controls and results
- `src/style.css` — responsive single-screen UI

## Development standards

Test the simulator against known cases before using recommendations competitively. Real champion-specific ability scripts and effects need independent implementation and game-replay validation. Benchmark worker runtime on target hardware before increasing search depth. Do not remove data-provenance warnings.

Data provided by [CommunityDragon](https://communitydragon.org/). TFT Lab isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.
