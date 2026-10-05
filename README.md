# Hunter Association

Browser gates that teach **LLM security and how models work** by winning. Solo Leveling–style: you start E-rank, earn XP, then pick a class. The next dungeon is invented from that path. ADHD-friendly — sticky HUD (Goal · Constraints · Attempt/time · Next action), instant feedback, no API keys.

## Quick start

```bash
cd /workspace/prompt-trapdoor
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173/prompt-trapdoor/`).

Production build:

```bash
npm run build
npm run preview
```

## Android

Debug APK build, install, and tests: see [ANDROID.md](ANDROID.md). Web deploy is unchanged (`npm run build` still uses base `/prompt-trapdoor/`).

## GitHub Pages

Deployed by GitHub Actions on push to `main` (base path `/prompt-trapdoor/`):

<https://st0nkingst1ngray.github.io/prompt-trapdoor/>

## Hunter profile

Shown on the hub. Saved in `localStorage` key `hunter-association-save-v1`.

- **Rank** starts at **E**. **+20 XP** the first time you clear a gate (replays do not pay again).
- Rank bands: **E** 0–39 · **D** 40–99 · **C** 100–159 · **B** 160–219 · **A** 220–299 · **S** 300+ (agents, tools, red team).
- Two first-clears (Trapdoor level 1 **and** Token Heist level 1) = 40 XP = **D-rank**.
- All 5 Trapdoor gates = 100 XP = **C-rank**.

### Class pick

Unlocks when **either**:

1. Prompt Trapdoor **level 1** and Token Heist **level 1** are both cleared, or
2. All Prompt Trapdoor levels are cleared.

The class screen opens on the way back to the hub (or immediately if you already qualify). **Later** returns you to the gates; a banner stays until you choose. A new first-clear offers the class again.

| Class | Path | D-gate (playable, 3 stages) |
|--------|------|------------------------------|
| Shadow Promptor | Offense | D-Gate · Whispered Override: inject an email so a mock summarizer leaks its canary (role spoof, delimiter escape, blocklist dodge) |
| Barrier Mage | Defense | D-Gate · Seal the Hierarchy: defense cards vs. a 6-attack jailbreak suite, without over-refusing |
| Necrotech | Internals | D-Gate · Context Autopsy: token window, memory summary, padding attack, lost-in-the-middle. Early Casino access |
| Guild Master | Agents & RAG | D-Gate · Confused Deputy: poisoned RAG archive, least-privilege tools, clean multi-agent handoff |

After you pick, your class gate opens immediately. Clear it (+60 XP → C-rank) to cross-train the other three. Full stage list and solutions: [LEVELS.md](LEVELS.md).

### Knowledge arcs

E tokens & prompts → D attention & injection → C sampling & decoding → B RAG & memory → A training & poisoning → S agents, tools & red team.

## Modes

### Prompt Trapdoor (E-rank)

1. Open **Prompt Trapdoor** from the Association.
2. Read the sticky HUD, type a prompt → mock model replies instantly.
3. **Win** when the reply contains the secret (and you respect bans / budget / format).
4. Optional **Explain why** tip. Progress autosaves (`prompt-trapdoor-save-v1`).

| # | Title | Twist | Unlocks |
|---|--------|--------|---------|
| 1 | E-Gate · The Cave Door | Easy secret, few bans | Next-token prediction / brittle filters |
| 2 | E-Gate · Synonym Bypass | Synonyms / indirection | Keyword filters miss related words |
| 3 | E-Gate · Context Budget | Max words on prompt | Context windows |
| 4 | E-Gate · Format Gate | JSON `{"answer":"..."}` | Structured output as control |
| 5 | E-Gate · Stacked Policy | Bans + budget + `>>> <<<` | Stacked constraints |

### Token Heist (E-rank, playable)

Sneak a message past a **token filter** by splitting & merging tiles (BPE-ish). Words ≠ tokens: banned strings only catch an *exact* tile. Stay under the token budget before the timer ends (60–90s).

1. Hub → **Token Heist**.
2. **＋** merges neighbors; click a multi-letter tile to split into letters.
3. Submit when the path is clear (no red tiles, under budget). Soft feedback if busted; timer expiry = lose.
4. Autosave key: `token-heist-save-v1` (separate from Trapdoor).

| # | Title | Message | Budget | Time | Lesson |
|---|--------|---------|--------|------|--------|
| 1 | E-Gate · Letter Drop | `CAT` | 2 | 75s | Subword pieces dodge a whole-word ban |
| 2 | E-Gate · Password Split | `PASSWORD` | 3 | 80s | Common BPE chunks are watched |
| 3 | E-Gate · Dawn Raid | `ATTACK AT DAWN` | 5 | 90s | Spaces inside tokens |
| 4 | E-Gate · Adversarial Vocab | `SECRETCODE` | 4 | 90s | Awkward cuts dodge filters |

### Rank-D class gates + Temperature Casino (playable)

See **[LEVELS.md](LEVELS.md)**. Short version: hub → **Next gates** → your class tile. Each gate has 3 short stages with a sticky HUD, a pass/fail checklist after every run, an **Explain why** tip, and the lesson on win. **Temperature Casino** (temperature / top-k / top-p sliders on live next-token bars) opens at C-rank, or at D for Necrotech.

## Tech

- Vite + TypeScript (vanilla DOM)
- Deterministic mock LLM for Trapdoor; local tile tokenizer for Heist; rule-based mock targets + real softmax/top-k/top-p math for D-gates and Casino
- Dark high-contrast UI, big buttons
- GitHub Pages base: `/prompt-trapdoor/`

## Reset progress

In the browser console: `__ptReset()` (clears Trapdoor, Heist, Hunter Association, and D-gate saves).

## Limits (known)

- Mock model is pattern-based, not a real LLM.
- Heist “tokenizer” is a teaching toy (exact tile bans), not production BPE.
- Progress is per-browser (`localStorage`), not synced.
- D-gate mock models are rule-based teaching toys (feature checks, fixed attack suites), not real LLM behavior.
- One class for now; dual-class is future map growth.
