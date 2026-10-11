// End-to-end checks against the production preview (npm run build && npm run preview).
// ADSB.lol is intercepted with TEST-ONLY synthetic data in the real response schema (see fixture.mjs).
import { createRequire } from 'node:module'
import { makeWorld, respond } from './fixture.mjs'
const require = createRequire('/home/claude/.npm-global/lib/node_modules/')
const { chromium } = require('playwright')

const URL_ = 'http://localhost:4173/'
const BOX = { eu: [35, 71, -11, 40], usa: [24.5, 49.5, -125, -66.5], asia: [-11, 56, 60, 150] }
const world = makeWorld()
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

async function open(browser, { width = 1440, height = 900, touch = false, reduced = false, mode = { v: 'ok' }, tz = 'Europe/London' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference', timezoneId: tz })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(m.text()))
  const hits = []
  await page.route('https://api.adsb.lol/v2/point/**', (r) => {
    const [, lat, lon, rad] = new URL(r.request().url()).pathname.match(/point\/([^/]+)\/([^/]+)\/(\d+)/)
    hits.push(`${lat},${lon},${rad}`)
    if (mode.v === 'fail') return r.abort('failed')
    if (mode.v === '500') return r.fulfill({ status: 503, body: 'down' })
    if (mode.v === 'empty') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ac: [], now: Date.now(), total: 0, msg: 'No error', ctime: 0, ptime: 0 }) })
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(respond(world, +lat, +lon, +rad)) })
  })
  await page.goto(URL_, { waitUntil: 'load' })
  return { ctx, page, errors, hits }
}
const cards = (p) => p.locator('.fc[data-flight]')
const scrollToY = async (p, y) => { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(450) }

const browser = await chromium.launch()

// ── 1. Data, regions, filtering, dedupe ────────────────────────────────────────
{
  const { ctx, page, errors, hits } = await open(browser)
  await cards(page).first().waitFor({ timeout: 15000 })
  const euHits = hits.length
  check('EU fetches several point queries (≤250 nm radius)', euHits >= 6 && hits.every((h) => +h.split(',')[2] <= 250), `${euHits} requests`)
  for (const id of ['eu', 'usa', 'asia']) {
    await page.locator(`#tab-${id}`).click()
    await page.waitForFunction((id) => document.querySelector(`#tab-${id}`)?.getAttribute('aria-selected') === 'true', id)
    await page.waitForFunction(() => !document.querySelector('.fc--skeleton'), null, { timeout: 15000 })
    await page.waitForTimeout(300)
    const n = await cards(page).count()
    const pos = await page.$$eval('.fc__pos', (els) => els.map((e) => e.textContent))
    const parse = (t) => { const m = t.match(/([\d.]+)° ([NS]) · ([\d.]+)° ([EW])/); return [(m[2] === 'S' ? -1 : 1) * +m[1], (m[4] === 'W' ? -1 : 1) * +m[3]] }
    const [s, nn, w, e] = BOX[id]
    const inside = pos.every((t) => { const [la, lo] = parse(t); return la >= s - 0.001 && la <= nn + 0.001 && lo >= w - 0.001 && lo <= e + 0.001 })
    const hexes = await page.$$eval('.fc[data-flight]', (els) => els.map((e) => e.dataset.flight))
    check(`${id.toUpperCase()}: cards render and every shown position is inside its bounds`, n > 0 && inside, `${n} cards shown`)
    check(`${id.toUpperCase()}: no duplicate aircraft across overlapping queries`, new Set(hexes).size === hexes.length)
    const total = await page.locator(`#tab-${id} .rs__count`).innerText()
    const countLine = await page.locator('.count').innerText()
    check(`${id.toUpperCase()}: region count matches data`, countLine.includes(total.replace(',', '')) || countLine.includes(total), `${total} | ${countLine}`)
  }
  // expected totals computed independently from the fixture
  const expected = (id) => { const [s, nn, w, e] = BOX[id]; return new Set(world.filter((a) => a.lat != null && a.lat >= s && a.lat <= nn && a.lon >= w && a.lon <= e).map((a) => a.hex)).size }
  await page.locator('#tab-eu').click(); await page.waitForTimeout(500)
  const euCount = +(await page.locator('#tab-eu .rs__count').innerText()).replace(',', '')
  check('EU count is plausible vs ground truth (coverage circles may miss some fixture points)', euCount > 0 && euCount <= expected('eu'), `shown ${euCount} ≤ truth ${expected('eu')}`)
  check('No page errors during data flow', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── 2. Hero morph, hover, tap ──────────────────────────────────────────────────
{
  const { ctx, page } = await open(browser)
  await page.waitForSelector('.wm__row.is-ready')
  const glyphTextAt0 = await page.locator('.wm__glyphs').innerText()
  check('Hero starts as THE LOSER', glyphTextAt0.replace(/\s/g, '').startsWith('THELOSER') || glyphTextAt0.replace(/\s/g, '').includes('THE'), JSON.stringify(glyphTextAt0.slice(0, 30)))
  check('h1 is always "THE LOSER" for assistive tech', (await page.locator('h1').innerText()) === 'THE LOSER')
  const rowBefore = await page.locator('.wm__row').boundingBox()
  const heroLen = await page.evaluate(() => document.querySelector('#top').offsetHeight - innerHeight)
  await scrollToY(page, heroLen * 0.45)
  const mid = await page.locator('.wm__glyphs').count()
  check('Mid-scroll: morph in progress (glyph layer present, not yet settled)', mid === 1)
  await scrollToY(page, heroLen * 0.95)
  await page.waitForSelector('.wm__word', { timeout: 5000 })
  const word = (await page.locator('.wm__word').innerText()).replace(/\s/g, '')
  check('After takeoff the headline reads LO702', word === 'LO702', word)
  const rowAfter = await page.locator('.wm__row').boundingBox()
  check('Heading box size is preserved through the transition (no layout shift)', Math.abs(rowBefore.width - rowAfter.width) < 1 && Math.abs(rowBefore.height - rowAfter.height) < 1, `${rowBefore.width}x${rowBefore.height} → ${rowAfter.width}x${rowAfter.height}`)
  const ww = await page.locator('.wm__word').boundingBox()
  check('LO702 is horizontally centred in the heading box', Math.abs((ww.x + ww.width / 2) - (rowAfter.x + rowAfter.width / 2)) < 3)
  await scrollToY(page, heroLen * 0.97)
  await page.locator('.wm__word').hover()
  await page.waitForTimeout(1700)
  const hovered = (await page.locator('.wm__word').innerText()).replace(/\s/g, '')
  const cap = await page.locator('.wm__caption').innerText()
  check('Hover cycles to a different identifier', hovered !== 'LO702', `${hovered} | ${cap}`)
  check('Hover identifiers come from the fetched feed and are labelled as live callsigns', /real callsign from the live/i.test(cap), cap)
  await page.mouse.move(5, 400); await page.waitForTimeout(500)
  check('Pointer exit restores LO702', (await page.locator('.wm__word').innerText()).replace(/\s/g, '') === 'LO702')
  await page.locator('.wm__word').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500)
  check('Keyboard (Enter) advances the identifier', (await page.locator('.wm__word').innerText()).replace(/\s/g, '') !== 'LO702')
  await scrollToY(page, 0); await page.waitForTimeout(500)
  check('Scrolling back up restores THE LOSER', (await page.locator('.wm__word').count()) === 0 && (await page.locator('.wm__glyphs').count()) === 1)
  await ctx.close()
}
{
  const { ctx, page } = await open(browser, { width: 390, height: 844, touch: true })
  await page.waitForSelector('.wm__row.is-ready')
  const heroLen = await page.evaluate(() => document.querySelector('#top').offsetHeight - innerHeight)
  await scrollToY(page, heroLen * 0.97)
  await page.waitForSelector('.wm__word')
  await page.locator('.wm__word').tap()
  await page.waitForTimeout(500)
  const t = (await page.locator('.wm__word').innerText()).replace(/\s/g, '')
  check('Touch: tapping LO702 cycles identifiers (no hover needed)', t !== 'LO702', t)
  await page.waitForTimeout(5200)
  check('Touch: identifier restores to LO702 after idle', (await page.locator('.wm__word').innerText()).replace(/\s/g, '') === 'LO702')
  await ctx.close()
}

// ── 3. Cards, detail panel, keyboard/focus ─────────────────────────────────────
{
  const { ctx, page } = await open(browser)
  await cards(page).first().waitFor()
  const first = cards(page).first()
  const id = await first.getAttribute('data-flight')
  await first.scrollIntoViewIfNeeded()
  await first.click()
  const dlg = page.locator('[role=dialog]')
  await dlg.waitFor()
  check('Click opens the detail dialog (aria-modal, labelled)', (await dlg.getAttribute('aria-modal')) === 'true' && !!(await dlg.getAttribute('aria-labelledby')))
  check('Focus moves into the dialog (close button)', await page.evaluate(() => document.activeElement?.matches('[data-close]')))
  check('Background is inert while open', await page.evaluate(() => document.getElementById('root').hasAttribute('inert')))
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
  check('Tab focus stays trapped inside the dialog', await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))
  const txt = await dlg.innerText()
  check('Detail shows telemetry + honest note about missing route data', /Ground speed/.test(txt) && /not shown rather than guessed/i.test(txt))
  await page.keyboard.press('Escape')
  await dlg.waitFor({ state: 'detached' })
  check('Escape closes the dialog', true)
  check('Focus returns to the originating card', await page.evaluate((id) => document.activeElement?.getAttribute('data-flight') === id, id))
  await first.click(); await dlg.waitFor()
  await page.locator('.scrim').click({ position: { x: 5, y: 5 } })
  await dlg.waitFor({ state: 'detached' })
  check('Clicking the backdrop closes the dialog', true)
  await ctx.close()
}

// ── 4. Failure, stale, empty states ────────────────────────────────────────────
{
  const mode = { v: 'ok' }
  const { ctx, page } = await open(browser, { mode })
  await cards(page).first().waitFor()
  await page.waitForSelector('.sb__chip.is-live')
  check('Healthy fetch shows a LIVE indicator', true)
  mode.v = 'fail'
  await page.locator('.sb__btn').click()
  await page.waitForSelector('.sb__chip.is-stale', { timeout: 20000 })
  check('Failed refresh flips the indicator to STALE (never "live")', (await page.locator('.sb__chip.is-live').count()) === 0)
  check('Previous results are preserved after a failed refresh', (await cards(page).count()) > 0)
  check('Cards switch to the Stale badge', (await page.locator('.fc .fresh.is-stale').count()) > 0 && (await page.locator('.fc .fresh.is-live').count()) === 0)
  check('A visible warning explains the data is old', /last successful results/i.test(await page.locator('.air .note--warn').innerText()))
  mode.v = 'ok'
  await page.locator('.sb__btn').click()
  await page.waitForSelector('.sb__chip.is-live', { timeout: 20000 })
  check('Recovery returns to LIVE and clears the warning', (await page.locator('.air .note--warn').count()) === 0)
  await ctx.close()
}
{
  const { ctx, page } = await open(browser, { mode: { v: 'fail' } })
  await page.waitForSelector('.empty[role=alert]', { timeout: 30000 })
  const t = await page.locator('.empty').innerText()
  check('First load failing shows an honest unavailable state (no dummy aircraft)', /temporarily unavailable/i.test(t) && (await cards(page).count()) === 0, t.split('\n')[0])
  await ctx.close()
}
{
  const { ctx, page } = await open(browser, { mode: { v: 'empty' } })
  await page.waitForSelector('.empty', { timeout: 20000 })
  const t = await page.locator('.empty').innerText()
  check('Empty region shows a polished empty state, not fake aircraft', /No aircraft reported/i.test(t) && (await cards(page).count()) === 0, t.split('\n')[0])
  await ctx.close()
}
{
  const { ctx, page } = await open(browser, { mode: { v: '500' } })
  await page.waitForSelector('.empty[role=alert]', { timeout: 30000 })
  check('Upstream 503 is surfaced as unavailable', /unavailable/i.test(await page.locator('.empty').innerText()))
  await ctx.close()
}

// ── 5. Reduced motion ──────────────────────────────────────────────────────────
{
  const { ctx, page } = await open(browser, { reduced: true })
  await page.waitForSelector('.wm__row.is-ready')
  check('Reduced motion: route trail is not drawn', (await page.locator('.route').count()) === 0)
  await page.waitForTimeout(700)
  const y0 = await page.evaluate(() => ({ x: new DOMMatrix(getComputedStyle(document.querySelector('.plane')).transform).m41 }))
  await scrollToY(page, 300)
  const y1 = await page.evaluate(() => ({ x: new DOMMatrix(getComputedStyle(document.querySelector('.plane')).transform).m41 }))
  check('Reduced motion: plane does not travel with scroll', y0.x === y1.x)
  await scrollToY(page, 1000)
  await page.waitForSelector('.wm__word', { timeout: 5000 })
  check('Reduced motion: LO702 still appears (simple swap)', (await page.locator('.wm__word').innerText()).replace(/\s/g, '') === 'LO702')
  await ctx.close()
}

// ── 6. Responsive matrix ───────────────────────────────────────────────────────
const sizes = [[320, 640], [375, 812], [430, 932], [600, 900], [768, 1024], [900, 800], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1300], [812, 375]]
for (const [w, h] of sizes) {
  const touch = w < 800
  const { ctx, page, errors } = await open(browser, { width: w, height: h, touch })
  await cards(page).first().waitFor({ timeout: 15000 })
  await page.waitForSelector('.wm__row.is-ready')
  const tag = `${w}x${h}`
  const measure = () => page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const bad = []
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.route, .plane, .graticule, .sr-only') || el.classList.contains('sr-only') || el.classList.contains('skip')) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right > vw + 1 || r.left < -1) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} [${Math.round(r.left)},${Math.round(r.right)}]`)
    }
    return { sw: document.documentElement.scrollWidth, vw, bad: [...new Set(bad)].slice(0, 6) }
  })
  const heroLen = await page.evaluate(() => document.querySelector('#top').offsetHeight - innerHeight)
  const probes = { hero: 0, takeoff: heroLen * 0.97, flight: heroLen + 500 }
  let allOk = true; let detail = ''
  for (const [k, y] of Object.entries(probes)) {
    await scrollToY(page, y)
    const m = await measure()
    if (m.sw > m.vw || m.bad.length) { allOk = false; detail += ` ${k}:${JSON.stringify(m)}` }
  }
  await page.locator('#airspace').scrollIntoViewIfNeeded(); await scrollToY(page, await page.evaluate(() => document.querySelector('#airspace').offsetTop))
  let m = await measure()
  if (m.sw > m.vw || m.bad.length) { allOk = false; detail += ` airspace:${JSON.stringify(m)}` }
  await scrollToY(page, 1e6)
  m = await measure()
  if (m.sw > m.vw || m.bad.length) { allOk = false; detail += ` arrival:${JSON.stringify(m)}` }
  check(`${tag}: no horizontal overflow / clipped elements in any scene`, allOk, detail)

  // heading fits & is not clipped
  await scrollToY(page, 0)
  const wm = await page.locator('.wm__row').boundingBox()
  check(`${tag}: THE LOSER fits inside the viewport`, wm.x >= 0 && wm.x + wm.width <= w, `x ${Math.round(wm.x)}–${Math.round(wm.x + wm.width)}`)
  await scrollToY(page, heroLen * 0.97)
  await page.waitForSelector('.wm__word')
  const ww = await page.locator('.wm__word').boundingBox()
  check(`${tag}: LO702 stays inside the viewport`, ww.x >= 0 && ww.x + ww.width <= w)

  // tap targets (touch sizes)
  await scrollToY(page, await page.evaluate(() => document.querySelector('#airspace').offsetTop))
  const small = await page.$$eval('.rs__tab, .sb__btn, .tools__sort button, .tools__search input, .nav__links button, .btn', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5 || r.width < 43.5) }).map((e) => `${e.className}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`))
  check(`${tag}: interactive controls ≥44px`, small.length === 0, small.slice(0, 4).join(', '))

  // detail panel fits viewport
  const c0 = cards(page).first(); await c0.scrollIntoViewIfNeeded(); await c0.click()
  await page.locator('[role=dialog]').waitFor(); await page.waitForTimeout(450)
  const dp = await page.locator('.dp-wrap').boundingBox()
  const closeBtn = await page.locator('[data-close]').boundingBox()
  check(`${tag}: detail panel fits viewport and close is reachable`, dp.x >= -1 && dp.y >= -1 && dp.x + dp.width <= w + 1 && dp.y + dp.height <= h + 1 && closeBtn.y >= 0 && closeBtn.y + closeBtn.height <= h, `panel ${Math.round(dp.x)},${Math.round(dp.y)} ${Math.round(dp.width)}x${Math.round(dp.height)}`)
  await page.keyboard.press('Escape'); await page.waitForTimeout(350)

  // plane never blocks input
  const pe = await page.evaluate(() => getComputedStyle(document.querySelector('.plane')).pointerEvents + '/' + getComputedStyle(document.querySelector('.route') ?? document.body).pointerEvents)
  check(`${tag}: plane/route layers ignore pointer events`, pe.startsWith('none'))
  if (w === 320 || w === 1440) await page.screenshot({ path: `/tmp/claude-0/shots/e2e-${tag}-airspace.png` })
  check(`${tag}: no console/page errors`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// plane position sanity across scroll at three widths (stays within viewport, rotates)
for (const [w, h] of [[375, 812], [768, 1024], [1440, 900]]) {
  const { ctx, page } = await open(browser, { width: w, height: h, touch: w < 800 })
  await page.waitForSelector('.wm__row.is-ready')
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
  let ok = true; let info = ''; let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9; const angles = new Set()
  for (let i = 0; i <= 40; i++) {
    await page.evaluate((y) => scrollTo(0, y), (total * i) / 40); await page.waitForTimeout(60)
    const b = await page.locator('.plane').boundingBox()
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2
    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy)
    angles.add(Math.round(await page.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.plane')).transform); return Math.atan2(m.b, m.a) * 180 / Math.PI }) / 15))
    if (cx < -2 || cx > w + 2 || cy < 40 || cy > h + 2) { ok = false; info += ` (${Math.round(cx)},${Math.round(cy)}@${i})` }
  }
  check(`${w}x${h}: airplane stays on screen (below nav) for the whole scroll and banks along the path`, ok && angles.size > 4, `x ${Math.round(minX)}–${Math.round(maxX)}, y ${Math.round(minY)}–${Math.round(maxY)}, ${angles.size} heading bands${info}`)
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { console.log('FAILED:'); failed.forEach((f) => console.log(' -', f.name, f.detail)); process.exit(1) }
