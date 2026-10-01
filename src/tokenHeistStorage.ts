export interface HeistSaveData {
  levelIndex: number
  cleared: number[]
  lastMessage?: string
}

const KEY = 'token-heist-save-v1'

export function loadHeistSave(): HeistSaveData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as HeistSaveData
  } catch {
    return null
  }
}

export function writeHeistSave(data: HeistSaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function clearHeistSave(): void {
  localStorage.removeItem(KEY)
}
