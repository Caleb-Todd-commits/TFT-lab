# TFT Lab

A fast, browser-based **experimental** TFT positioning sandbox. This is an initial prototype, not a fully accurate patch 18.5 simulator.

## Run locally

```bash
npm install
npm run dev
```

## Implemented

- 7×8 interactive board with ally and enemy units
- Seeded, simplified auto-attack and movement simulator
- Monte Carlo win-rate estimate
- Candidate-search positioning optimizer
- Responsive React interface

## Accuracy limitations

This version **does not** implement patch 18.5 champion data, spells, items, traits, augments, or true TFT combat rules. Results are exploratory only. Real match simulation and authoritative patch verification are pending. No performance benchmark has been conducted.

## Roadmap

1. Import validated Riot Data Dragon / CommunityDragon patch snapshots with checksums and patch provenance.
2. Model hex targeting, collision, cast timing, mana, damage types, shields, CC, traits, items and champion abilities.
3. Add replay-based regression fixtures and deterministic simulation tests.
4. Move heavy simulation into Web Workers; benchmark and consider WASM if necessary.
5. Add economy, shop odds, leveling, matchmaking and full match scenarios.
6. Calibrate optimization against representative opponent distributions rather than one board.

Not affiliated with Riot Games.
