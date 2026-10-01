export interface SaveData {
  levelIndex: number
  attempt: number
  cleared: number[]
  lastMessage?: string
}

const KEY = 'prompt-trapdoor-save-v1'

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as SaveData
  } catch {
    return null
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function clearSave(): void {
  localStorage.removeItem(KEY)
}
