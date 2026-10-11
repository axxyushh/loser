import type { Region, RegionId } from './types'

/** Max radius accepted by `/v2/point/{lat}/{lon}/{radius}` (verified from the OpenAPI schema). */
export const MAX_RADIUS_NM = 250

/**
 * ADSB.lol has no bounding-box endpoint, only point + radius. Each region is
 * therefore covered by several overlapping 250 nm circles, then trimmed to the
 * rectangle below. Rectangles do not overlap, so an aircraft belongs to at
 * most one region; dedupe by ICAO hex handles circle overlap inside a region.
 *
 * Coverage depends on where volunteer receivers exist, so some areas
 * (e.g. much of China) will look sparse. That is a data limit, not a bug.
 */
export const REGIONS: Record<RegionId, Region> = {
  eu: {
    id: 'eu',
    label: 'Europe',
    short: 'EU',
    bbox: { south: 35, north: 71, west: -11, east: 40 },
    blurb: 'Atlantic coast to the Black Sea, Mediterranean to the Arctic.',
    seeds: [
      { name: 'London', lat: 51.5, lon: -0.5 },
      { name: 'Frankfurt', lat: 49.5, lon: 8.5 },
      { name: 'Warsaw', lat: 52.2, lon: 17 },
      { name: 'Madrid', lat: 40.4, lon: -3.7 },
      { name: 'Rome', lat: 41.9, lon: 12.5 },
      { name: 'Oslo–Stockholm', lat: 59.6, lon: 14 },
      { name: 'Belgrade', lat: 45, lon: 21 },
      { name: 'Istanbul', lat: 41, lon: 28.8 },
    ],
  },
  usa: {
    id: 'usa',
    label: 'USA',
    short: 'US',
    bbox: { south: 24.5, north: 49.5, west: -125, east: -66.5 },
    blurb: 'Contiguous United States, coast to coast.',
    seeds: [
      { name: 'New York', lat: 40.7, lon: -74 },
      { name: 'Atlanta', lat: 33.6, lon: -84.4 },
      { name: 'Orlando', lat: 28.4, lon: -81.3 },
      { name: 'Chicago', lat: 41.9, lon: -87.6 },
      { name: 'Dallas', lat: 32.9, lon: -97 },
      { name: 'Denver', lat: 39.8, lon: -104.9 },
      { name: 'Phoenix', lat: 34, lon: -112 },
      { name: 'Los Angeles', lat: 34, lon: -118.2 },
      { name: 'Seattle', lat: 46.5, lon: -122.3 },
    ],
  },
  asia: {
    id: 'asia',
    label: 'Asia',
    short: 'AS',
    bbox: { south: -11, north: 56, west: 60, east: 150 },
    blurb: 'South, East and Southeast Asia, from Pakistan to Japan.',
    seeds: [
      { name: 'Tokyo', lat: 35.5, lon: 139.7 },
      { name: 'Seoul', lat: 37.5, lon: 127 },
      { name: 'Beijing', lat: 40, lon: 116.4 },
      { name: 'Shanghai', lat: 31.2, lon: 121.5 },
      { name: 'Hong Kong', lat: 22.8, lon: 113.8 },
      { name: 'Bangkok', lat: 13.7, lon: 100.7 },
      { name: 'Singapore', lat: 1.3, lon: 103.9 },
      { name: 'Delhi', lat: 28.6, lon: 77.2 },
      { name: 'Mumbai', lat: 19.1, lon: 72.9 },
    ],
  },
}

export const REGION_ORDER: RegionId[] = ['eu', 'usa', 'asia']
