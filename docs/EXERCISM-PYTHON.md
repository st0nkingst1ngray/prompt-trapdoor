# Exercism Python inside AKCP

Exercism Python is a selectable book on the Hunter Association **AKCP** tile: hub → AKCP → **Books** → **Exercism Python**.

The campaign is the open track’s non-deprecated exercises: **10 modules, 149 levels**. Module 1 is the concept track in upstream order (20 exercises). The other modules are practice exercises grouped by Exercism difficulty 1 through 9. You write the solution file, press Check, and the included tests run. Hints come from the exercise’s `hints.md` when it has any, then the guide and the exemplar. Clearing a level awards its XP once and unlocks the next level. A finished module shows a certificate.

Progress is stored in `exercism-python-save-v1`. It does not write `akcp-save-v1`, `bash-missions-save-v1`, `python-koans-save-v1`, `pyithon-save-v1`, or `hunter-association-save-v1`.

## Grading

Check writes your solution plus the exercise’s test files (and any `*_data.py` helpers) into a workspace and runs them with Python’s `unittest`. Concept exercises import `pytest` only to mark tasks. Those marker lines are removed when the curriculum is built, so the browser does not need pytest. In the browser the interpreter is Pyodide 0.29.3 from jsDelivr, cached after the first Check. Unit tests use the same harness on CPython. Learner code has no network and cannot read or write outside the mission workspace.

## What is not included

Deprecated exercises are omitted: the concept `electric-bill`, and the practice exercises `accumulate`, `beer-song`, `binary`, `diffie-hellman`, `error-handling`, `hexadecimal`, `minesweeper`, `nucleotide-count`, `octal`, `parallel-letter-frequency`, `point-mutations`, `strain`, and `trinary`. `.meta` design notes, `.articles`, and `.approaches` are not copied. The exemplar is kept only as the reference answer revealed after the guide.

`scripts/refresh-exercism-python.mjs` rebuilds the full non-deprecated track. This book is not a partial slice.

## Attribution

Copyright (c) 2021 Exercism, MIT License. See `NOTICE`, `THIRD_PARTY.md`, and `third_party/exercism-python/LICENSE`. The in-game footer credits the Exercism Python track. Exercise text and tests stay under that license.

## Refresh from upstream

```bash
git clone --depth 1 --branch main https://github.com/exercism/python.git /tmp/exercism-python
node scripts/refresh-exercism-python.mjs /tmp/exercism-python
```

That rewrites `public/exercism-python/curriculum.json`. Re-run `npm test`. If the non-deprecated count changes, update `EXERCISM_PYTHON_LEVELS` and `EXERCISM_PYTHON_MODULES` in `src/akcp/exercism-python/types.ts` on purpose.
