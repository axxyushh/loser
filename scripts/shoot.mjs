import { createRequire } from 'node:module'
import { makeWorld, respond } from './fixture.mjs'
const require = createRequire('/home/claude/.npm-global/lib/node_modules/')
const { chromium } = require('playwright')
const [w, h, ...scrolls] = process.argv.slice(2).map(Number)
const world = makeWorld()
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, timezoneId: 'Europe/London' })
const p = await ctx.newPage()
p.on('pageerror', (e) => console.log('PAGEERROR', e.message))
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
await p.route('https://api.adsb.lol/v2/point/**', (r) => {
  const [, lat, lon, rad] = new URL(r.request().url()).pathname.match(/point\/([^/]+)\/([^/]+)\/(\d+)/)
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(respond(world, +lat, +lon, +rad)) })
})
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
for (const s of scrolls) {
  const y = s <= 5 ? Math.round(s * (await p.evaluate(() => document.documentElement.scrollHeight - innerHeight))) : s
  await p.evaluate((y) => scrollTo(0, y), y)
  await p.waitForTimeout(700)
  await p.screenshot({ path: `/tmp/claude-0/shots/${w}x${h}-${String(s).replace('.', '_')}.png` })
}
console.log('docH', await p.evaluate(() => document.documentElement.scrollHeight), 'scrollW', await p.evaluate(() => document.documentElement.scrollWidth))
await b.close()
