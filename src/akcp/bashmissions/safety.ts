/** Same blocked substrings as BashMissions `engine/safety.py`. Checked before the in-browser run. */

const BLOCKED_PATTERNS = [
  'rm -rf /',
  'rm -rf ~',
  ':(){ :|:& };:',
  'sudo',
  'chmod 777 /',
  '/etc/passwd',
  'dd if=/dev/zero',
  '/proc/sysrq-trigger',
]

export function validateScript(script: string): { ok: true } | { ok: false; message: string } {
  if (script.length > 100_000) return { ok: false, message: 'Script is too large to run in the training sandbox.' }
  const text = script.toLowerCase()
  for (const pattern of BLOCKED_PATTERNS) {
    if (text.includes(pattern.toLowerCase())) return { ok: false, message: `Blocked pattern detected: ${pattern}` }
  }
  return { ok: true }
}
