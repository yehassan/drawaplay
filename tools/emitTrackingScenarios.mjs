import fs from 'node:fs'

/** Ramer-Douglas-Peucker, matching simplifyRDP in the app. */
function rdp(pts, eps) {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = 1
  keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let idx = -1
    let max = 0
    const pa0 = pts[a]
    const pb0 = pts[b]
    const ax = pa0.x
    const ay = pa0.y
    const bx = pb0.x
    const by = pb0.y
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    for (let i = a + 1; i < b; i++) {
      const px = pts[i].x
      const py = pts[i].y
      const d =
        len < 1e-9
          ? Math.hypot(px - ax, py - ay)
          : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len
      if (d > max) {
        max = d
        idx = i
      }
    }
    if (max > eps && idx > 0) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

const plays = JSON.parse(fs.readFileSync('/tmp/bdb/plays.json', 'utf8'))

const META = {
  '2018091606|1640': {
    title: 'TE post, catch and run 87yd to the end zone',
    week: 'week-2 feed',
    note: 'caught at roughly 17yd depth then runs 87yd after the catch — the longest catch-and-run in the set',
  },
  '2018091602|3122': {
    title: 'WR post, 59yd in the air, then keeps running',
    week: 'week-2 feed',
    note: '3.1s of air time, then a further 24yd. Also carries a pre-snap motion',
  },
  '2018092306|3553': {
    title: '1yd shovel into a jet sweep, 83yd run',
    week: 'week-3 feed',
    note: 'the shortest throw here (1.1yd, 200ms of air) then an 83yd sweep — the tightest catch-to-run seam in the set',
  },
  '2018092310|2760': {
    title: 'play-action screen to the RB, 55yd run',
    week: 'week-3 feed',
    note: 'play action, then a 7.2yd screen with 500ms of air and a long run behind it',
  },
}

const q = (n) => +n.toFixed(1)
const lit = (s) => `'${String(s).replace(/'/g, "\\'")}'`

let out = `/**
 * Plays lifted straight out of the BDB tracking feed (weeks 2 and 3), one
 * picked per shape worth checking.
 *
 * Every coordinate is a real tracked position at 10Hz, transformed so the
 * offense attacks up the screen, and every timing is the real frame time. All
 * seeds are userLocked, so the app replays the play as it happened instead of
 * re-deriving it. That is the point of these: the hand-drawn scenarios show
 * what the app thinks a play looks like — these show whether it agrees with
 * what actually happened.
 *
 * Each one has a catch followed by a run lane, which is the seam the chain
 * speed fix exists for, so they are also the regression corpus for it.
 *
 * GENERATED from bdbtrackingdata — edit the extractor, not this file.
 * Personnel labels come from the feed and do not correspond to real rosters,
 * so these are named by shape rather than by matchup.
 */
import { P, T, build, type Scenario } from './scenarioBuilders'

export const TRACKING_SCENARIOS: Scenario[] = [
`

let totalPts = 0
let totalRaw = 0
const rows = []

for (const p of plays) {
  const m = META[p.key]
  if (!m) throw new Error('no metadata for ' + p.key)
  const simplified = p.paths.map((pa) => {
    const s = rdp(
      pa.seg.map(([x, y]) => ({ x, y })),
      1.0,
    ).map((pt) => [q(pt.x), q(pt.y)])
    totalRaw += pa.seg.length
    totalPts += s.length
    return { ...pa, seg: s }
  })
  rows.push({ p, m, simplified })
}

for (const { p, m, simplified } of rows) {
  const slug = p.key.replace('|', '-')
  const seg = (a) => '[' + a.map(([x, y]) => `[${x}, ${y}]`).join(', ') + ']'
  out += '  {\n'
  out += `    name: 'BDB ${m.title}',\n`
  out += `    description: 'Tracking play ${slug} (${m.week}). ${m.note}. Real 10Hz positions, real frame timing.',\n`
  out += `    build: build('BDB ${slug}', [\n`
  for (const t of p.tokens)
    out += `      T(${lit(t.id)}, ${lit(t.side)}, ${lit(t.pos)}, ${t.x}, ${t.y}, ${lit(t.num)}),\n`
  out += '    ], [\n'
  for (const pa of simplified) {
    const end = pa.endTokenId ? lit(pa.endTokenId) : 'null'
    out += `      P(${lit(pa.tokenId)}, ${lit(pa.type)}, ${seg(pa.seg)}, ${end}, { delayMs: ${pa.timing.delayMs}, durationMs: ${pa.timing.durationMs} }),\n`
  }
  out += '    ]),\n'
  out += '  },\n'
}
out += ']\n'

fs.writeFileSync('/tmp/bdb/trackingScenarios.ts', out)
console.log(
  `points: ${totalRaw} raw -> ${totalPts} after RDP (${Math.round((totalPts / totalRaw) * 100)}%)`,
)
console.log(`generated ${(out.length / 1024).toFixed(1)} KB for ${rows.length} plays`)