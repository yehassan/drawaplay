/**
 * Extract plays from the BDB tracking feed in bdbtrackingdata/ into
 * src/lib/trackingScenarios.ts. GENERATED FILE — edit this, not the output.
 *
 *   node tools/extractTrackingScenarios.mjs <gameId|playId> [...] > /tmp/bdb/plays.json
 *
 * Then run tools/emitTrackingScenarios.mjs to write the TypeScript.
 *
 * Two things about these files are not what you expect, and both are handled
 * here rather than being rediscovered later:
 *
 *  - The axes are TRANSPOSED relative to week 1: x is the length axis
 *    (0..120) and y the width (0..53.3). Nothing downstream cares, because the
 *    transform below is derived from the play itself, not from the axes.
 *  - The ball's `team` column is the literal string 'football', so it can
 *    never identify the offense. Matching the quarterback to it silently fails
 *    and flipping to `qbs[0]` picks a backup on plays that have one, which
 *    turns offense into defense. The QB is chosen by proximity to the ball at
 *    the snap instead.
 *
 * The attacking axis comes from the offset between the two teams' centroids at
 * the snap, NOT from the throw vector: on a jet sweep the throw points
 * sideways, and using it rotates the whole field 90 degrees.
 */
import fs from 'node:fs'
import readline from 'node:readline'

const C={x:1,y:2,s:3,event:8,nflId:9,name:10,num:11,pos:12,frame:13,team:14,game:15,play:16,pdir:17,route:18}
const WANT=new Set(process.argv.slice(2))
const raw=new Map()
for (const file of ['bdbtrackingdata/week2.csv','bdbtrackingdata/week3.csv']) {
  const rl=readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})
  let h=null
  for await (const line of rl) {
    if(!h){h=line.split(',');continue}
    const c=line.split(','); if(c.length<19) continue
    const key=c[C.game]+'|'+c[C.play]; if(!WANT.has(key)) continue
    let p=raw.get(key)
    if(!p){p={key,pdir:c[C.pdir],ev:new Map(),players:new Map()};raw.set(key,p)}
    if(c[C.event]!=='None'&&!p.ev.has(c[C.event]))p.ev.set(c[C.event],+c[C.frame])
    let pl=p.players.get(c[C.nflId])
    if(!pl){pl={id:c[C.nflId],name:c[C.name],num:c[C.num],pos:c[C.pos],team:c[C.team],route:c[C.route],ball:c[C.name]==='Football',rows:[]};p.players.set(pl.id,pl)}
    pl.rows.push([+c[C.frame],+c[C.x],+c[C.y],+c[C.s]])
  }
}

const D=(ax,ay,bx,by)=>Math.hypot(bx-ax,by-ay)
const near=(pl,f)=>{let b=null,bd=1e9;for(const r of pl.rows){const d=Math.abs(r[0]-f);if(d<bd){bd=d;b=r}}return b}
const PMAP={QB:'QB',RB:'RB',FB:'FB',WR:'WR',TE:'TE',T:'T',G:'G',C:'C',S:'S',CB:'CB',DB:'CB',LB:'LB',OLB:'LB',ILB:'LB',MLB:'LB',NT:'DL',DL:'DL',DE:'DL'}
const LOS_Y=92
const STOP=1.6          // yd/s below which a player counts as stopped
const STOP_FRAMES=3     // ...sustained this long

/**
 * Last frame on which a player was still moving meaningfully.
 *
 * Scans BACKWARD from the end of their track. Scanning forward from the snap
 * does not work: everyone accelerates from ~0 yd/s, so a forward scan reads the
 * acceleration phase as "stopped" and drops the path entirely.
 */
function stopFrame(pl, cap) {
  for (let i = pl.rows.length - 1; i >= 0; i--) {
    const r = pl.rows[i]
    if (r[0] > cap) continue
    if (r[3] >= STOP) return r[0]
  }
  return cap
}

const out=[]
for (const p of raw.values()) {
  const snap=p.ev.get('ball_snap')??p.ev.get('snap_direct')??p.ev.get('line_set')
  if(!snap) continue
  const ball=[...p.players.values()].find(q=>q.ball)
  if(!ball) continue
  // The ball's `team` column is literally 'football', so it can never identify
  // the offense. Pick the quarterback nearest the ball at the snap instead —
  // matching on team, or taking whichever QB appears first, silently flips
  // offense and defense on plays with a backup QB.
  const qbs=[...p.players.values()].filter(q=>q.pos==='QB')
  let qb=null, qbd=1e9
  for(const q of qbs){ const r=near(q,snap); const d=D(ball.rows[0][1],ball.rows[0][2],r[1],r[2]); if(d<qbd){qbd=d;qb=q} }
  if(!qb) continue
  const fwd=p.ev.get('pass_forward')??p.ev.get('pass_shovel')??snap
  const arr=p.ev.get('pass_arrived')??fwd
  const outF=p.ev.get('pass_outcome_caught')??p.ev.get('pass_outcome_touchdown')??p.ev.get('first_contact')??arr

  // Attacking axis. The throw vector is WRONG for a lateral play (a jet sweep's
  // throw points sideways, which rotates the whole field 90 degrees). The LOS
  // normal is the real answer: at the snap the defense is downfield of the
  // offense, so the offset between their centroids points the right way.
  const at = f => [...p.players.values()].filter(q=>!q.ball).map(q=>({q,r:near(q,f)}))
  const grab = f => at(f).filter(o=>o.r[0]>=f-1)
  const centroid = (arr, sel) => {
    const s = arr.filter(sel)
    if (!s.length) return null
    return { x: s.reduce((a,o)=>a+o.r[1],0)/s.length, y: s.reduce((a,o)=>a+o.r[2],0)/s.length }
  }
  const offC = centroid(grab(snap), o=>o.q.team===qb.team)
  const defC = centroid(grab(snap), o=>o.q.team!==qb.team)
  let dx = defC.x-offC.x, dy = defC.y-offC.y, dl = Math.hypot(dx,dy)
  if (dl < 1) {
    // fallback: the release-to-catch vector
    const qbRel=near(qb,fwd), ballArr=near(ball,arr)
    dx=ballArr[1]-qbRel[1]; dy=ballArr[2]-qbRel[2]; dl=Math.hypot(dx,dy)
  }
  const fx=dx/dl, fy=dy/dl, lx=-fy, ly=fx
  const T0 = ball.rows[0][0]
  const ms = f => (f - T0) * 100
  const org=near(ball,snap)
  const X=(px,py)=>+(26.65+((px-org[1])*lx+(py-org[2])*ly)).toFixed(2)
  const Y=(px,py)=>+(LOS_Y-((px-org[1])*fx+(py-org[2])*fy)).toFixed(2)

  const mates=[...p.players.values()].filter(q=>!q.ball&&q.pos!=='football'&&q.team===qb.team&&q.id!==qb.id)
  const ballArr=near(ball,arr)
  let rec=null,rd=1e9
  for(const m of mates){const r=near(m,arr);const d=D(ballArr[1],ballArr[2],r[1],r[2]);if(d<rd){rd=d;rec=m}}

  const people=[...p.players.values()].filter(q=>!q.ball&&q.pos!=='football')
  const endF=Math.max(...people.map(q=>q.rows[q.rows.length-1][0]))
  const ids=new Map(); let n=0
  const clean=(s)=>s.replace(/[^A-Za-z]/g,'').slice(0,4).toUpperCase()||'P'
  for(const q of people){ const base=clean(q.name); let id=base,i=2; while([...ids.values()].includes(id)) id=`${base}${i++}`; ids.set(q.id,id) }

  const tokens=[],paths=[]
  for(const q of people){
    const id=ids.get(q.id)
    const st=q.rows.find(r=>r[0]>=snap-6)??q.rows[0]
    tokens.push({id,side:q.team===qb.team?'offense':'defense',pos:PMAP[q.pos]??(q.team===qb.team?'WR':'CB'),num:q.num,x:X(st[1],st[2]),y:Y(st[1],st[2])})
  }
  // segment covering frames [f0,f1]; delay/duration are contiguous by
  // construction — a frame step is 100ms, and f1's frame is still part of it
  const seg=(q,f0,f1)=>q.rows.filter(r=>r[0]>=f0&&r[0]<=f1).map(r=>[X(r[1],r[2]),Y(r[1],r[2])])
  const span=(f0,f1)=>({delayMs:ms(f0),durationMs:(f1-f0+1)*100})

  for(const q of people){
    const id=ids.get(q.id)
    const isBall=q.id===rec?.id
    // pre-snap motion
    const pre=q.rows.filter(r=>r[0]<snap)
    if(pre.length>=3){
      const s=pre.map(r=>[X(r[1],r[2]),Y(r[1],r[2])])
      if(D(s[0][0],s[0][1],s[s.length-1][0],s[s.length-1][1])>1.2)
        paths.push({tokenId:id,type:'motion',seg:s,timing:{delayMs:ms(pre[0][0]),durationMs:ms(pre[pre.length-1][0])-ms(pre[0][0])}})
    }
    // main track: QB ends at the release, the ballcarrier at the catch, others
    // wherever they actually settle
    const mainEnd = q.id===qb.id ? fwd : isBall ? outF : stopFrame(q, Math.min(endF, outF + 30))
    const s1=seg(q,snap,mainEnd)
    if(s1.length>=2)
      paths.push({tokenId:id,type:q.pos==='QB'?'drop':'route',seg:s1,timing:span(snap,mainEnd)})
    // the ballcarrier keeps going: split so the catch-to-run seam is real
    if(isBall){
      const post=q.rows.filter(r=>r[0]>outF)
      if(post.length>=2){
        const f1=Math.max(outF+2, stopFrame(q, endF))
        const s2=seg(q,outF+1,f1)
        if(s2.length>=2) paths.push({tokenId:id,type:'run',seg:s2,timing:span(outF+1,f1)})
      }
    }
  }

  const recArr=rec?near(rec,arr):null
  const qbRel=near(qb,fwd)
  if(recArr)
    paths.push({tokenId:ids.get(qb.id),type:'pass',endTokenId:ids.get(rec.id),
      seg:[[X(qbRel[1],qbRel[2]),Y(qbRel[1],qbRel[2])],[X(recArr[1],recArr[2]),Y(recArr[1],recArr[2])]],
      timing:{delayMs:ms(fwd),durationMs:(arr-fwd)*100}})

  // slide the whole play so it sits on the field: x centred, y kept in bounds
  let all=paths.flatMap(p=>p.seg)
  const shiftX = 26.65 - (Math.min(...all.map(s=>s[0]))+Math.max(...all.map(s=>s[0])))/2
  const minY=Math.min(...all.map(s=>s[1])), maxY=Math.max(...all.map(s=>s[1]))
  let shiftY = 0
  if (minY < 4) shiftY = 4 - minY
  else if (maxY > 116) shiftY = 116 - maxY
  if (Math.abs(shiftX)>0.01 || Math.abs(shiftY)>0.01) {
    for (const tk of tokens) { tk.x=+(tk.x+shiftX).toFixed(2); tk.y=+(tk.y+shiftY).toFixed(2) }
    for (const pa of paths) pa.seg = pa.seg.map(s=>[+(s[0]+shiftX).toFixed(2),+(s[1]+shiftY).toFixed(2)])
    all = paths.flatMap(p=>p.seg)
  }
  out.push({key:p.key,game:p.game,pdir:p.pdir,snap,fwd,arr,outF,endF,recv:rec?.name,recvPos:rec?.pos,route:rec?.route,
    team:qb.team,tokens,paths,
    box:{minX:Math.min(...all.map(s=>s[0])),maxX:Math.max(...all.map(s=>s[0])),
         minY:Math.min(...all.map(s=>s[1])),maxY:Math.max(...all.map(s=>s[1]))}})
}
process.stdout.write(JSON.stringify(out))
