# pyi-thon inside AKCP

pyi-thon is a selectable book on the Hunter Association **AKCP** tile: hub → AKCP → **Books** → **pyi-thon**.

The campaign is the English set: **3 phases, 30 levels**. Foundations, then Building, then Pythonic. Each level shows the task, the expected output, and a starter. Check runs your program and compares printed output. Missions that read input call `input()`; the game feeds the sample lines and does not echo the prompt. Most levels also require the concept in the source (a `while`, `input()`, `json.dumps` before `json.loads`, and so on), so a single hardcoded `print` of the sample does not pass. Hints start with the idea. The reference program stays behind the last hint.

Clearing a level awards its XP once and unlocks the next level. A finished phase shows a certificate.

Progress is stored in `pyithon-save-v1`. It does not write `akcp-save-v1`, `bash-missions-save-v1`, `python-koans-save-v1`, `exercism-python-save-v1`, or `hunter-association-save-v1`.

## Grading

Output is compared after trimming, the same way the upstream offline grader does. In the browser the interpreter is Pyodide 0.29.3 from jsDelivr, cached after the first Check. Unit tests run the same harness on CPython. Learner code has no network and cannot read or write outside the mission workspace.

## What is not included

The Korean `LEVELS_KO` overlay is not a separate book. The upstream React app is not copied. The reference answers in the curriculum are programs that satisfy the upstream checks; several upstream hints are templates (`print("text goes here")`) and are not used as the answer.

## Attribution

Copyright (c) 2026 Edward Yi, MIT License. See `NOTICE`, `THIRD_PARTY.md`, and `third_party/pyithon/LICENSE`. The in-game footer credits pyi-thon.

## Refresh from upstream

```bash
git clone --depth 1 --branch main https://github.com/aiedwardyi/pyi-thon.git /tmp/pyi-thon
node scripts/refresh-pyithon.mjs /tmp/pyi-thon
```

That rewrites `public/pyithon/curriculum.json`. Re-run `npm test`. If the level count changes, update `PYITHON_LEVELS` and `PYITHON_MODULES` in `src/akcp/pyithon/types.ts` on purpose.
