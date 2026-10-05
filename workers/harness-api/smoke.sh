#!/usr/bin/env bash
# Smoke test against a running Worker (default: `npx wrangler dev` on :8787).
#   cp .dev.vars.example .dev.vars && npx wrangler dev      # terminal 1
#   bash smoke.sh                                             # terminal 2
# Against production:  BASE=https://hunter-harness-api.<you>.workers.dev TOKEN=… bash smoke.sh
#   (creates one real job "smoke test" and walks it to web_ready; harmless, but it shows in the game.)
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8787}"
if [[ -z "${TOKEN:-}" && -f .dev.vars ]]; then TOKEN="$(grep -E '^HARNESS_TOKEN=' .dev.vars | cut -d= -f2-)"; fi
: "${TOKEN:?set TOKEN or create .dev.vars}"
pass=0; fail=0
check() { # name expected actual
  if [[ "$2" == "$3" ]]; then echo "ok   $1"; pass=$((pass+1)); else echo "FAIL $1 (want $2, got $3)"; fail=$((fail+1)); fi
}
code() { curl -s -o /tmp/harness-smoke.json -w '%{http_code}' "$@"; }
AUTH=(-H "Authorization: Bearer $TOKEN")
JSON=(-H 'Content-Type: application/json')

check "health is public"              200 "$(code "$BASE/v1/health")"
check "status without token → 401"    401 "$(code "$BASE/v1/status")"
check "status wrong token → 401"      401 "$(code -H 'Authorization: Bearer nope-nope-nope-nope-nope-nope' "$BASE/v1/status")"
check "bad origin → 403"              403 "$(code -H 'Origin: https://evil.example' "${AUTH[@]}" "$BASE/v1/status")"
check "preflight from :5173 → 204"    204 "$(code -X OPTIONS -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: POST' "$BASE/v1/prompt")"
check "empty prompt → 400"            400 "$(code -X POST "${AUTH[@]}" "${JSON[@]}" -d '{"text":"  "}' "$BASE/v1/prompt")"
check "prompt → 201"                  201 "$(code -X POST "${AUTH[@]}" "${JSON[@]}" -d '{"text":"smoke test door","rank":"C","classId":"shadow","xp":120,"lastGate":"runaway","client":"smoke"}' "$BASE/v1/prompt")"
ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/harness-smoke.json","utf8")).job.id)')"
echo "     job $ID"
check "status/:id → 200"              200 "$(code "${AUTH[@]}" "$BASE/v1/status/$ID")"
check "skip to apk_ready → 409"       409 "$(code -X PATCH "${AUTH[@]}" "${JSON[@]}" -d '{"state":"apk_ready"}' "$BASE/v1/jobs/$ID")"
check "→ building"                    200 "$(code -X PATCH "${AUTH[@]}" "${JSON[@]}" -d '{"state":"building","note":"smoke"}' "$BASE/v1/jobs/$ID")"
check "→ web_ready"                   200 "$(code -X PATCH "${AUTH[@]}" "${JSON[@]}" -d '{"state":"web_ready","result":"smoke"}' "$BASE/v1/jobs/$ID")"
check "list contains job"             200 "$(code "${AUTH[@]}" "$BASE/v1/status")"
grep -q "$ID" /tmp/harness-smoke.json && check "job listed" yes yes || check "job listed" yes no
echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
