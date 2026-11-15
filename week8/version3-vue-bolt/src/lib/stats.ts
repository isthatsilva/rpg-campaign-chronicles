import type { Character } from './types'

// manual change: empty stats stay empty instead of showing as 0 (bolt showed "0/0 vitality" and "LVL 0").
// same rules as v1/v2: nothing when both are empty, just the health when there's no max, otherwise "health/max".
export function vitality(c: Pick<Character, 'health' | 'max_health'>): string | null {
  if (c.health === null && c.max_health === null) return null
  return c.max_health === null ? String(c.health) : `${c.health ?? '—'}/${c.max_health}`
}

// width of the health bar, or null when there's nothing meaningful to draw
export function vitalityPercent(c: Pick<Character, 'health' | 'max_health'>): number | null {
  if (c.health === null || !c.max_health) return null
  return Math.max(0, Math.min(100, (c.health / c.max_health) * 100))
}
