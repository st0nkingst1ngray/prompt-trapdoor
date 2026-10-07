# Python Koans inside AKCP

Python Koans is a selectable book on the Hunter Association **AKCP** tile: hub → AKCP → **Books** → **Python Koans**.

The campaign is **37 modules, 278 missions**. Each mission is one upstream test. You edit the koan file (or, for the four projects, the file the tests call), press Check, and the in-browser Python runner runs that test. Hints go 1 → 2 → 3 → guide → reference answer. Clearing a mission awards its XP once and unlocks the next mission. A finished module shows a certificate.

Progress is stored in `python-koans-save-v1`. It does not write `akcp-save-v1`, `bash-missions-save-v1`, `exercism-python-save-v1`, `pyithon-save-v1`, or `hunter-association-save-v1`.

## How a mission plays

Fill-in missions start from the upstream test with the other tests in that class removed, so the editor stays on the one idea. `__` is a value, `___` is an exception type, and `____` is `True` or `False`. Project missions (triangle, greed score, dice, proxy) keep the upstream tests and ask you to write the function.

## Grading

Check writes the vendored koan tree into a workspace, replaces the mission file with your editor, and runs that test with Python’s `unittest`. In this browser the interpreter is [Pyodide](https://pyodide.org/) 0.29.3, loaded from jsDelivr on the first Check and then cached. The same harness runs under CPython in unit tests. Learner code cannot import network or process modules, cannot open files outside the mission workspace, and cannot call `os.system`. Nothing is sent to a Cloudflare Worker.

## What is not included

Upstream `AboutExtraCredit` and `TelevisionTest` are not missions. The extra-credit file is empty, and the television tests are a fixture that already passes. The upstream sensei, mountain, and `colorama` runner are not vendored. `runner/koan.py` includes the Python 3.12 unittest aliases (`assertEquals` and friends) the koans still call.

The dice project answer in the curriculum is deterministic. Upstream’s random roll can flake; the vendored reference rolls a fixed sequence so Check is stable.

## Attribution

Copyright 2021 Greg Malcolm and The Status Is Not Quo, MIT License. See `NOTICE`, `THIRD_PARTY.md`, and `third_party/python-koans/LICENSE`. The in-game footer credits Python Koans.

## Refresh from upstream

```bash
git clone --depth 1 --branch master https://github.com/gregmalcolm/python_koans.git /tmp/python_koans
node scripts/refresh-python-koans.mjs /tmp/python_koans
```

That rewrites `public/python-koans/curriculum.json` and refreshes the MIT license. Re-run `npm test`. The generator is `scripts/build-python-koans.py`. If the mission count changes, update `PYTHON_KOANS_LEVELS` and `PYTHON_KOANS_MODULES` in `src/akcp/python-koans/types.ts` on purpose.
