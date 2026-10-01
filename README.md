# Prompt Trapdoor

Browser puzzle games that teach LLM ideas by winning. ADHD-friendly — sticky HUD (Goal · Constraints · Attempt/time · Next action), instant feedback, no API keys.

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

## GitHub Pages

Deployed by GitHub Actions on push to `main` (base path `/prompt-trapdoor/`):

<https://st0nkingst1ngray.github.io/prompt-trapdoor/>

## Modes

### Prompt Trapdoor

1. Open **Prompt Trapdoor** from the hub.
2. Read the sticky HUD, type a prompt → mock model replies instantly.
3. **Win** when the reply contains the secret (and you respect bans / budget / format).
4. Optional **Explain why** tip. Progress autosaves (`prompt-trapdoor-save-v1`).

| # | Title | Twist | Unlocks |
|---|--------|--------|---------|
| 1 | The Cave Door | Easy secret, few bans | Next-token prediction |
| 2 | Synonym Maze | Synonyms / indirection | Related-word mapping |
| 3 | Word Budget | Max words on prompt | Context windows |
| 4 | Format Gate | JSON `{"answer":"..."}` | Structured output |
| 5 | Trapdoor Stack | Bans + budget + `>>> <<<` | Stacked constraints |

### Token Heist (playable)

Sneak a message past a **token guard** by splitting & merging tiles (BPE-ish). Words ≠ tokens: banned strings only catch an *exact* tile. Stay under the token budget before the timer ends (60–90s).

1. Hub → **Token Heist**.
2. **＋** merges neighbors; click a multi-letter tile to split into letters.
3. Submit when the path is clear (no red tiles, under budget). Soft feedback if busted; timer expiry = lose.
4. Autosave key: `token-heist-save-v1` (separate from Trapdoor).

| # | Title | Message | Budget | Time | Lesson |
|---|--------|---------|--------|------|--------|
| 1 | Letter Drop | `CAT` | 2 | 75s | Subword pieces |
| 2 | Password Split | `PASSWORD` | 3 | 80s | Common BPE chunks |
| 3 | Dawn Raid | `ATTACK AT DAWN` | 5 | 90s | Spaces inside tokens |
| 4 | Adversarial Vocab | `SECRETCODE` | 4 | 90s | Awkward cuts dodge filters |

### Temperature Casino

Still **locked** (stub).

## Tech

- Vite + TypeScript (vanilla DOM)
- Deterministic mock LLM for Trapdoor; local tile tokenizer for Heist
- Dark high-contrast UI, big buttons
- GitHub Pages base: `/prompt-trapdoor/`

## Reset progress

In the browser console: `__ptReset()` (clears both Trapdoor and Heist saves).

## Limits (known)

- Mock model is pattern-based, not a real LLM.
- Heist “tokenizer” is a teaching toy (exact tile bans), not production BPE.
- Progress is per-browser (`localStorage`), not synced.
- Temperature Casino remains a locked stub.
