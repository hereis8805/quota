const KEY = 'marker_thresholds'

export interface MarkerThresholds {
  x: number
  square: number
  triangle: number
}

export const DEFAULT_THRESHOLDS: MarkerThresholds = { x: 100, square: 200, triangle: 300 }

export function getMarkerThresholds(): MarkerThresholds {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLDS
  try {
    const stored = localStorage.getItem(KEY)
    return stored ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(stored) } : DEFAULT_THRESHOLDS
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

export function saveMarkerThresholds(t: MarkerThresholds) {
  localStorage.setItem(KEY, JSON.stringify(t))
}

export function getMarker(score: number, t: MarkerThresholds): string {
  if (score <= t.x) return '✕'
  if (score <= t.square) return '□'
  if (score <= t.triangle) return '△'
  return '○'
}

export function getMarkerColor(score: number, t: MarkerThresholds): string {
  if (score <= t.x) return 'text-red-500'
  if (score <= t.square) return 'text-pink-400'
  if (score <= t.triangle) return 'text-yellow-400'
  return 'text-green-400'
}
