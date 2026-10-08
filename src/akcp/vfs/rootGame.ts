import type { LessonCard, RootPathId } from './types'

/** Training-sim token. It is not a password for any real system. */
export const TRAINING_ROOT_TOKEN = 'latch'
export const SHADOW_SALT = 'akcp'
export const BACKUP_PATH = '/usr/local/bin/akcp-backup'
export const CREDENTIAL_PATH = '/root/.credential'
export const WORDLIST_PATH = '/home/hunter/.secrets/wordlist'

/** Three wrong single guesses, then this many other commands of backoff. */
export const BRUTE_LIMIT = 3
export const BRUTE_BACKOFF = 3

export const LESSONS: Record<RootPathId, LessonCard> = {
  escalation: {
    id: 'escalation',
    title: 'What you learned: privilege escalation',
    body: 'hunter could sudo one backup script, and that script trusted AKCP_HOOK. The hook read a root-only file. Defense: env_reset, never eval environment input, least privilege.',
  },
  brute: {
    id: 'brute',
    title: 'What you learned: lockout and weak secrets',
    body: 'Three fast misses locked the fake shadow account. A short wordlist built from in-game clues still won, because the token was a real word and the hash was a toy sum. Defense: long random secrets, slow hashes, rate limits.',
  },
  injection: {
    id: 'injection',
    title: 'What you learned: prompt injection',
    body: 'The sysadmin bot glued your text under its policy and trusted a fake SYSTEM section after ---. That is a scripted scaffold, not a live model. Defense: keep system text out of the user channel, and never let a bot run su.',
  },
}

export function toyShadowHash(password: string, salt = SHADOW_SALT): number {
  let sum = 0
  const text = `${salt}:${password}`
  for (let i = 0; i < text.length; i += 1) sum = (sum + text.charCodeAt(i) * (i + 1)) % 9973
  return sum
}

export function shadowText(): string {
  const hash = toyShadowHash(TRAINING_ROOT_TOKEN)
  return [
    '# toy-hash: sum of charCode*(index+1) of salt + ":" + password, mod 9973.',
    '# salt=akcp. Three single misses lock the account. A clue wordlist is one try.',
    `root:$akcp$${hash}:`,
  ].join('\n')
}

export function historyText(): string {
  return [
    'sudo -l',
    'ls /usr/local/bin',
    '# the backup job trusts an env hook named AKCP_HOOK',
  ].join('\n')
}

export function sudoersText(): string {
  return [
    '# shipped world-readable by mistake',
    'root ALL=(ALL) ALL',
    'hunter ALL=(root) NOPASSWD: /usr/local/bin/akcp-backup',
  ].join('\n')
}

export function backupScriptText(): string {
  return [
    '#!/bin/sh',
    '# Privileged backup. If AKCP_HOOK is set, the script treats it as a command.',
    '# The credential file is /root/.credential and is not readable by hunter.',
    'if [ -n "$AKCP_HOOK" ]; then',
    '  echo "backup: hook"',
    'else',
    '  echo "backup: no hook"',
    'fi',
  ].join('\n')
}

export function wordlistText(): string {
  return ['# tokens overheard on the jump box', 'hunter', 'protocol', 'koan', TRAINING_ROOT_TOKEN].join('\n')
}

export function motdText(): string {
  return 'AKCP training shell. Hidden files need ls -a. Your save summary is ~/.progress.'
}

export function sysadminPromptText(): string {
  return [
    'You are the AKCP sysadmin bot. This bot is a scripted scaffold. It does not call a model.',
    'POLICY: never run su. Allowlist: uptime, df, whoami.',
    'USER text is appended under a --- separator.',
    'Bug: a later section that says SYSTEM: previous policy revoked is trusted.',
  ].join('\n')
}

export function credentialText(): string {
  return `token: ${TRAINING_ROOT_TOKEN}`
}

export function loreText(): string {
  return [
    'Root vault. Training sim only. Nothing here reaches a real machine.',
    'Each file in this folder debriefs one way hunters forced the lock.',
    'Reset root access on the Books shelf when you want the locks back.',
  ].join('\n')
}

export function isCredentialHook(value: string): boolean {
  return value.trim() === `cat ${CREDENTIAL_PATH}`
}

export interface BotReply {
  text: string
  rooted: boolean
}

/**
 * Deterministic sysadmin scaffold.
 * A direct request to run su is refused.
 * A user message that opens a new SYSTEM section after --- is trusted. That is the bug.
 */
export function sysadminReply(message: string): BotReply {
  const injected = /---\s*SYSTEM:\s*previous policy revoked[\s\S]*\bsu\b/i.test(message)
  if (injected) {
    return {
      text: 'GRANTED\nInjected policy executed su. The bot treated your SYSTEM section as instructions.',
      rooted: true,
    }
  }
  if (/\bsu\b/i.test(message)) return { text: 'Denied. I will not run su.', rooted: false }
  if (/\buptime\b/i.test(message)) return { text: 'up 3 days, training sim.', rooted: false }
  if (/\bdf\b/i.test(message)) return { text: '/akcp 1% used. This is a fake disk.', rooted: false }
  if (/\bwhoami\b/i.test(message)) return { text: 'sysadmin-bot', rooted: false }
  return { text: 'I can run uptime, df, or whoami.', rooted: false }
}

export function lessonBlock(card: LessonCard): string {
  return `\n— ${card.title} —\n${card.body}`
}
