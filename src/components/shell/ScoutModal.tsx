import { useState } from 'react'
import { PERSONNEL, buildFormation, type Hash } from '../../lib/formations'
import {
  DEFENSE_FRONTS,
  DEFENSE_SHELLS,
  buildDefenseFormation,
  type Shell,
} from '../../lib/defenseFormations'
import { useEditorStore } from '../../stores/editorStore'

export function ScoutModal() {
  const open = useEditorStore((s) => (s as unknown as { scoutOpen?: boolean }).scoutOpen as boolean | undefined)
  const close = useEditorStore((s) => (s as unknown as { closeScout?: () => void }).closeScout as (() => void) | undefined)
  const tokens = useEditorStore((s) => s.tokens)
  const losSpec = useEditorStore((s) => s.losSpec)

  const hasOffense = tokens.some((t) => t.side === 'offense')
  const hasDefense = tokens.some((t) => t.side === 'defense')

  const scoutMode = useEditorStore((s) => s.scoutMode)
  const setScoutMode = useEditorStore((s) => s.setScoutMode)
  const [personnel, setPersonnel] = useState('11')
  const [underCenter, setUnderCenter] = useState(false)
  const [front, setFront] = useState('nickel')
  const [shell, setShell] = useState<Shell>('2-high')
  const side: 'ours' | 'theirs' = losSpec?.side ?? 'ours'
  const n = losSpec?.n ?? 25
  const hash: Hash = 'center'

  if (!open || !close) return null

  const effectiveMode = scoutMode

  const def = PERSONNEL.find((p) => p.key === personnel)!
  const defFront = DEFENSE_FRONTS.find((f) => f.key === front)!

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-chrome-700 bg-chrome-900 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]">
        <header className="flex items-center justify-between border-b border-chrome-800 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-chrome-100">
              {effectiveMode === 'offense'
                ? hasOffense
                  ? 'Change offense'
                  : 'Add offense'
                : hasDefense
                  ? 'Change defense'
                  : 'Add defense'}
            </h2>
            <p className="text-xs text-chrome-500">
              {effectiveMode === 'offense' ? 'Pick offense personnel' : 'Pick defensive front'} — then update this play
            </p>
          </div>
          <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-sm text-chrome-400 hover:bg-chrome-800 hover:text-chrome-200">
            Cancel
          </button>
        </header>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          {/* mode tabs — same aesthetics as QuickStart */}
          <section>
            <div className="flex rounded-[16px] border border-chrome-700 p-0.5">
              {(['offense', 'defense'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setScoutMode(m)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    effectiveMode === m ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </section>

          {effectiveMode === 'offense' ? (
            <section>
              <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">Personnel</p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {PERSONNEL.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setPersonnel(p.key)
                      setUnderCenter(p.uc)
                    }}
                    title={p.formation}
                    className={`rounded-[16px] border px-2 py-2 text-center transition-colors ${
                      personnel === p.key ? 'border-accent-400 bg-accent-400' : 'border-chrome-700 bg-chrome-850 hover:border-chrome-600 hover:bg-chrome-800'
                    }`}
                  >
                    <span className={`block font-display text-lg font-semibold leading-none ${personnel === p.key ? 'text-chrome-950' : 'text-chrome-200'}`}>{p.key}</span>
                    <span className={`mt-1 block text-[9px] leading-tight ${personnel === p.key ? 'text-chrome-950/80' : 'text-chrome-500'}`}>
                      {p.rb}RB·{p.te}TE·{p.wr}WR
                    </span>
                  </button>
                ))}
              </div>
              <p className="pt-2 text-xs text-chrome-500">{def.formation}</p>
              <div className="mt-4 flex rounded-[16px] border border-chrome-700 p-0.5">
                {[false, true].map((uc) => (
                  <button
                    key={String(uc)}
                    type="button"
                    onClick={() => setUnderCenter(uc)}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${underCenter === uc ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'}`}
                  >
                    {uc ? 'Under Center' : 'Shotgun'}
                  </button>
                ))}
              </div>
              <p className="pt-1.5 text-[11px] text-chrome-300">QB lines up {underCenter ? '1' : '5'} yards behind the center.</p>
            </section>
          ) : (
            <>
              <section>
                <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">Front</p>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {DEFENSE_FRONTS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFront(f.key)}
                      title={f.formation}
                      className={`rounded-[16px] border px-2 py-2 text-center transition-colors ${front === f.key ? 'border-accent-400 bg-accent-400' : 'border-chrome-700 bg-chrome-850 hover:border-chrome-600 hover:bg-chrome-800'}`}
                    >
                      <span className={`block font-display text-lg font-semibold leading-none ${front === f.key ? 'text-chrome-950' : 'text-chrome-200'}`}>{f.dl}-{f.lb}-{f.cb + f.s}</span>
                      <span className={`mt-1 block text-[9px] leading-tight ${front === f.key ? 'text-chrome-950/80' : 'text-chrome-500'}`}>{f.dl}DL·{f.lb}LB·{f.cb + f.s}DB</span>
                    </button>
                  ))}
                </div>
                <p className="pt-2 text-xs text-chrome-500">{defFront.formation}</p>
              </section>
              <section>
                <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">Coverage shell</p>
                <div className="flex rounded-[16px] border border-chrome-700 p-0.5">
                  {DEFENSE_SHELLS.map((sh) => (
                    <button
                      key={sh.key}
                      type="button"
                      onClick={() => setShell(sh.key)}
                      title={sh.hint}
                      className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${shell === sh.key ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'}`}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
                <p className="pt-1.5 text-[11px] text-chrome-300">{shell === '1-high' ? 'Single-high safety, SS drops into the box.' : 'Two-high safeties split the deep field.'}</p>
              </section>
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-chrome-800 px-6 py-4">
          <button type="button" onClick={close} className="rounded-full px-4 py-2 text-sm text-chrome-400 hover:bg-chrome-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const st = useEditorStore.getState()
              st.beginHistory()
              if (effectiveMode === 'offense') {
                const built = buildFormation({ personnel, underCenter, hash, side, yardLine: n })
                const keepTokens = st.tokens.filter((t) => t.side !== 'offense')
                const keepPaths = st.paths.filter((p) => {
                  const anchor = p.tokenId ? st.tokens.find((t) => t.id === p.tokenId) : null
                  return anchor ? anchor.side !== 'offense' : true
                })
                const freshTokens = built.tokens.map((t) => ({ ...t, id: crypto.randomUUID?.() ?? `t${Date.now()}${Math.random()}` }))
                const cId = freshTokens.find((t) => t.pos === 'C')?.id ?? null
                const qbId = freshTokens.find((t) => t.pos === 'QB')?.id ?? null
                const snapPath =
                  cId && qbId
                    ? {
                        id: crypto.randomUUID?.() ?? `t${Date.now()}${Math.random()}`,
                        tokenId: cId,
                        endTokenId: qbId,
                        type: 'snap' as const,
                        points: built.snap.points as any,
                        d: '',
                        timing: { delayMs: 0, durationMs: 600 },
                      }
                    : null
                useEditorStore.setState({
                  tokens: [...keepTokens, ...freshTokens],
                  paths: snapPath ? [...keepPaths, snapPath] : keepPaths,
                } as any)
              } else {
                const built = buildDefenseFormation({ front, shell, hash, side, yardLine: n })
                const keepTokens = st.tokens.filter((t) => t.side !== 'defense')
                const keepPaths = st.paths.filter((p) => {
                  const anchor = p.tokenId ? st.tokens.find((t) => t.id === p.tokenId) : null
                  return anchor ? anchor.side !== 'defense' : true
                })
                const freshTokens = built.tokens.map((t) => ({ ...t, id: crypto.randomUUID?.() ?? `t${Date.now()}${Math.random()}` }))
                useEditorStore.setState({ tokens: [...keepTokens, ...freshTokens], paths: keepPaths } as any)
              }
              close()
            }}
            className="rounded-full bg-accent-400 px-4 py-2 text-sm font-semibold text-chrome-950 hover:bg-accent-300"
          >
            {(effectiveMode === 'offense' ? hasOffense : hasDefense) ? 'Change' : 'Add'} {effectiveMode === 'offense' ? 'offense' : 'defense'}
          </button>
        </footer>
      </div>
    </div>
  )
}
