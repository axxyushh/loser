// TEST-ONLY synthetic ADSB.lol responses (same schema as V2Response_Model).
// Never imported by the app. Used to exercise the UI while api.adsb.lol is unreachable from CI.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) }

const BOXES = [
  [36, 70, -10, 39, 140], [25, 49, -124, -67, 160], [-9, 55, 62, 148, 120], // inside regions
  [-30, -10, 120, 150, 10], [0, 20, -60, -30, 10], // outside every region (must be filtered out of results)
]
export function makeWorld(seed = 7) {
  const r = rng(seed)
  const ac = []
  let n = 0
  for (const [s, nn, w, e, count] of BOXES) {
    for (let i = 0; i < count; i++) {
      const hex = (0xa00000 + n++ * 977).toString(16)
      const ground = r() < 0.08
      const noPos = r() < 0.03
      const pfx = ['BAW', 'DLH', 'AIC', 'UAL', 'SIA', 'JAL', 'RYR', 'AAL'][Math.floor(r() * 8)]
      ac.push({
        hex, type: r() < 0.9 ? 'adsb_icao' : 'mlat',
        flight: r() < 0.12 ? undefined : `${pfx}${Math.floor(100 + r() * 899)}${r() < 0.2 ? 'A' : ''} `,
        r: r() < 0.2 ? undefined : `${['G-', 'D-', 'N', 'VT-'][Math.floor(r() * 4)]}${Math.floor(1000 + r() * 8999)}`,
        t: r() < 0.15 ? undefined : ['A320', 'B738', 'A359', 'B77W', 'E190', 'A21N'][Math.floor(r() * 6)],
        alt_baro: ground ? 'ground' : r() < 0.05 ? null : Math.floor(1000 + r() * 40000),
        alt_geom: r() < 0.3 ? null : Math.floor(1000 + r() * 40000),
        gs: r() < 0.05 ? null : Math.round((ground ? r() * 20 : 200 + r() * 350) * 10) / 10,
        track: r() < 0.05 ? null : Math.round(r() * 3590) / 10,
        baro_rate: r() < 0.5 ? null : Math.floor(-2000 + r() * 4000),
        squawk: r() < 0.5 ? null : String(1000 + Math.floor(r() * 6000)),
        category: r() < 0.5 ? null : 'A3',
        lat: noPos ? null : Math.round((s + r() * (nn - s)) * 1e4) / 1e4,
        lon: noPos ? null : Math.round((w + r() * (e - w)) * 1e4) / 1e4,
        seen: Math.round(r() * 30) / 10, seen_pos: r() < 0.1 ? 90 : Math.round(r() * 50) / 10,
        messages: 1000, rssi: -20, mlat: [], tisb: [],
      })
    }
  }
  return ac
}
const R = 3440.065
function dist(a, b, c, d) {
  const t = Math.PI / 180
  const x = Math.sin(((c - a) * t) / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(((d - b) * t) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
export function respond(world, lat, lon, radius) {
  const ac = world.filter((a) => a.lat != null && dist(lat, lon, a.lat, a.lon) <= radius || a.lat == null && (a.hex.charCodeAt(0) + Math.round(lat)) % 7 === 0)
  return { ac, msg: 'No error', now: Date.now(), total: ac.length, ctime: Date.now(), ptime: 1 }
}
