import type { Region } from './types'

export function inBBox(lat: number, lon: number, bbox: Region['bbox']): boolean {
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east
}

export function formatCoord(value: number, axis: 'lat' | 'lon'): string {
  const hemi = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  return `${Math.abs(value).toFixed(3)}° ${hemi}`
}
