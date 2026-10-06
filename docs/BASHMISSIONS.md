# BashMissions inside AKCP

BashMissions is a selectable book on the Hunter Association **AKCP** tile: hub → AKCP → **Books** → **BashMissions**. The Osmani workflow book is unchanged and stays the first screen inside AKCP.

The campaign is the full upstream curriculum: **26 modules, 500 levels**. Each level is playable (briefing, `solution.sh` editor, real test run, hints 1–3, guide, reference answer, debrief, common mistakes). Clearing a level awards that level’s XP once, unlocks the next level, and a finished module shows a certificate. Progress is stored in `bash-missions-save-v1`. It does not write `akcp-save-v1` or `hunter-association-save-v1`.

On a phone the goal banner is open at the top of a level. Once the briefing scrolls up under that card, the card swipes closed so the mission, checks, and editor get the screen. It stays closed while you move around the level, and it opens again at the top of the page. Desktop keeps the same banner, in two columns from 640px up.

## Grading

Checks run in the browser with [just-bash](https://github.com/vercel-labs/just-bash), a Bash interpreter with an in-memory filesystem. For each `test_cases` entry the game writes `solution.sh` plus the level fixtures, runs `bash ./solution.sh` with the test arguments, and compares stdout and exit status. Comparison modes match the upstream validator: `exact`, `contains`, `ignore_whitespace`, and `regex`. The published curriculum uses `exact`.

just-bash is not the operating system’s Bash. Network commands and Python are left disabled, so nothing in a learner script is sent to the Cloudflare Worker or to the network. A few blocked substrings from the upstream safety list are rejected before execution. The reference `answer.sh` for every vendored level passes this harness.

The just-bash browser build still imports Node’s `zlib`. This app replaces that import with a small shim: `gzip` / `gunzip` inside a learner script fail closed in the page. Passing a level does not require them. The vendored reference answers do not call them.

## Attribution

Curriculum copyright 2026 Jalil Abdollahi, MIT License. See `NOTICE`, `THIRD_PARTY.md`, and `third_party/bashmissions/LICENSE`. The in-game footer credits BashMissions. The upstream Python Rich engine (`engine/*.py`, `play.sh`) is not part of this repo.

## Refresh from upstream

```bash
git clone --depth 1 --branch master https://github.com/devopshobbies/bashmissions.git /tmp/bashmissions
node scripts/refresh-bashmissions.mjs /tmp/bashmissions
```

That rewrites `public/bashmissions/curriculum.json` and refreshes `third_party/bashmissions/LICENSE`. Re-run `npm test`. If upstream is no longer exactly 500 levels and 26 modules, update `BASH_MISSIONS_LEVELS` and `BASH_MISSIONS_MODULES` in `src/akcp/bashmissions/types.ts` on purpose.

The generator reads `levels.json`, `BASH_GUIDE.md`, `CURRICULUM.md`, and each level’s lesson files and `fixtures/`. It does not copy `engine/` or `play.sh`. Levels that ship without `solution.sh` open on the same starter the upstream scaffold uses (`#!/usr/bin/env bash` and `set -euo pipefail`).
