import { useState } from 'react'
import { PERSONNEL, buildFormation, type Hash } from '../../lib/formations'
import { useEditorStore } from '../../stores/editorStore'

export function QuickStartModal() {
  const open = useEditorStore((s) => s.quickStartOpen)
  const closeQuickStart = useEditorStore((s) => s.closeQuickStart)
  const loadPlay = useEditorStore((s) => s.loadPlay)
  const resetPlayIdentity = useEditorStore((s) => s.resetPlayIdentity)

  const [personnel, setPersonnel] = useState('11')
  const [underCenter, setUnderCenter] = useState(false)
  const [hash, setHash] = useState<Hash>('center')
  const [side, setSide] = useState<'ours' | 'theirs'>('ours')
  const [yardLine, setYardLine] = useState(25)

  if (!open) return null
  const def = PERSONNEL.find((p) => p.key === personnel)!

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-chrome-700 bg-chrome-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-chrome-800 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-chrome-100">
              New Play
            </h2>
            <p className="text-xs text-chrome-500">Set the formation — then draw routes and animate.</p>
          </div>
          <button
            type="button"
            onClick={closeQuickStart}
            className="rounded-lg px-3 py-1.5 text-sm text-chrome-400 transition-colors hover:bg-chrome-800 hover:text-chrome-200"
          >
            Cancel
          </button>
        </header>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          {/* personnel */}
          <section>
            <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
              Personnel
            </p>
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
                  className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                    personnel === p.key
                      ? 'border-accent-400/70 bg-accent-400/10'
                      : 'border-chrome-700 bg-chrome-850 hover:border-chrome-600 hover:bg-chrome-800'
                  }`}
                >
                  <span
                    className={`block font-display text-lg font-semibold leading-none ${
                      personnel === p.key ? 'text-accent-400' : 'text-chrome-200'
                    }`}
                  >
                    {p.key}
                  </span>
                  <span className="mt-1 block text-[9px] leading-tight text-chrome-500">
                    {p.rb}RB·{p.te}TE·{p.wr}WR
                  </span>
                </button>
              ))}
            </div>
            <p className="pt-2 text-xs text-chrome-500">{def.formation}</p>
          </section>

          {/* alignment */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                Snap
              </p>
              <div className="flex rounded-lg border border-chrome-700 p-0.5">
                {[false, true].map((uc) => (
                  <button
                    key={String(uc)}
                    type="button"
                    onClick={() => setUnderCenter(uc)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      underCenter === uc
                        ? 'bg-accent-400 text-chrome-950'
                        : 'text-chrome-300 hover:bg-chrome-800'
                    }`}
                  >
                    {uc ? 'Under Center' : 'Shotgun'}
                  </button>
                ))}
              </div>
              <p className="pt-1.5 text-[11px] text-chrome-600">
                QB lines up {underCenter ? '1' : '3'} yards behind the center.
              </p>
            </div>

            <div>
              <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                Ball placement
              </p>
              <div className="flex rounded-lg border border-chrome-700 p-0.5">
                {(['center', 'left', 'right'] as Hash[]).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHash(h)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                      hash === h ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'
                    }`}
                  >
                    {h === 'center' ? 'Middle' : `${h} hash`}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* yard line */}
          <section>
            <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
              Line of scrimmage
            </p>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-chrome-700 p-0.5">
                {(['ours', 'theirs'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      side === s ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'
                    }`}
                  >
                    {s === 'ours' ? 'Own' : "Opp"}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={50}
                value={yardLine}
                onChange={(e) =>
                  setYardLine(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                }
                className="w-20 rounded-lg border border-chrome-700 bg-chrome-850 px-3 py-1.5 text-sm font-medium text-chrome-200 outline-none focus:border-accent-400/60"
              />
              <span className="text-xs text-chrome-500">yard line (both sides: 50 = midfield)</span>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-chrome-800 px-6 py-4">
          <span className="mr-auto text-[11px] text-chrome-600">Defense formations arrive later.</span>
          <button
            type="button"
            onClick={() => {
              const built = buildFormation({ personnel, underCenter, hash, side, yardLine })
              resetPlayIdentity()
              loadPlay({
                name: built.name,
                los: { side, n: yardLine },
                tokens: built.tokens,
                paths: [
                  {
                    tokenId: built.snap.tokenId,
                    endTokenId: built.snap.endTokenId,
                    type: 'snap',
                    points: built.snap.points,
                    d: '',
                  },
                ],
              })
              closeQuickStart()
            }}
            className="flex items-center gap-1.5 rounded-lg bg-accent-400 px-4 py-2 text-sm font-semibold text-chrome-950 transition-colors hover:bg-accent-300"
          >
            Create play
          </button>
        </footer>
      </div>
    </div>
  )
}
