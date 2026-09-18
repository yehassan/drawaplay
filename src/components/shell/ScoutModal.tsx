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

  const [personnel, setPersonnel] = useState('11')
  const [underCenter, setUnderCenter] = useState(false)
  const [front, setFront] = useState('nickel')
  const [shell, setShell] = useState<Shell>('2-high')
  const side: 'ours' | 'theirs' = losSpec?.side ?? 'ours'
  const n = losSpec?.n ?? 25
  const hash: Hash = 'center'

  if (!open || !close) return null
  // don't offer to add what you already have both of
  if (hasOffense && hasDefense) return null

  const addOffense = hasDefense && !hasOffense
  const addDefense = hasOffense && !hasDefense
  // if empty, default to offense
  const showOffense = addOffense || (!hasOffense && !hasDefense)
  const showDefense = addDefense

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[24px] border border-chrome-700 bg-chrome-900 p-6 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_20px_25px_-5px_rgba(0,0,0,0.1)]">
        <h2 className="font-display text-lg font-semibold tracking-tight text-chrome-100">Add scout team</h2>
        <p className="mt-1 text-xs text-chrome-500">
          {showOffense && showDefense ? 'Pick both sides' : showOffense ? 'Add offense to this look' : 'Add defense to this look'}
        </p>

        <div className="mt-4 space-y-5">
          {showOffense && (
            <section>
              <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">Offense</p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {PERSONNEL.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setPersonnel(p.key)
                      setUnderCenter(p.uc)
                    }}
                    className={`rounded-[16px] border px-2 py-2 text-center text-xs ${
                      personnel === p.key ? 'border-accent-400 bg-accent-400 text-chrome-950' : 'border-chrome-700 bg-chrome-850 text-chrome-300'
                    }`}
                  >
                    {p.key}
                  </button>
                ))}
              </div>
            </section>
          )}
          {showDefense && (
            <>
              <section>
                <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">Front</p>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {DEFENSE_FRONTS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFront(f.key)}
                      className={`rounded-[16px] border px-2 py-2 text-center text-xs ${front === f.key ? 'border-accent-400 bg-accent-400 text-chrome-950' : 'border-chrome-700 bg-chrome-850 text-chrome-300'}`}
                    >
                      {f.dl}-{f.lb}-{f.cb + f.s}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">Coverage shell</p>
                <div className="flex rounded-[16px] border border-chrome-700 p-0.5">
                  {DEFENSE_SHELLS.map((sh) => (
                    <button
                      key={sh.key}
                      type="button"
                      onClick={() => setShell(sh.key)}
                      className={`flex-1 rounded-full px-3 py-1.5 text-xs ${shell === sh.key ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300'}`}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-full px-4 py-2 text-sm text-chrome-400 hover:bg-chrome-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const st = useEditorStore.getState()
              st.beginHistory()
              if (showOffense) {
                const built = buildFormation({ personnel, underCenter, hash, side, yardLine: n })
                // append, keep existing defense where it is
                const existing = st.tokens
                const idMap = new Map<string, string>()
                const fresh = built.tokens.map((t) => {
                  const id = (crypto.randomUUID?.() ?? `t${Date.now()}${Math.random()}`) as string
                  idMap.set(t.id, id)
                  return { ...t, id }
                })
                useEditorStore.setState({ tokens: [...existing, ...fresh] })
              }
              if (showDefense) {
                const built = buildDefenseFormation({ front, shell, hash, side, yardLine: n })
                const existing = useEditorStore.getState().tokens
                const fresh = built.tokens.map((t) => {
                  const id = (crypto.randomUUID?.() ?? `t${Date.now()}${Math.random()}`) as string
                  return { ...t, id }
                })
                useEditorStore.setState({ tokens: [...existing, ...fresh] })
              }
              close()
            }}
            className="rounded-full bg-accent-400 px-4 py-2 text-sm font-semibold text-chrome-950 hover:bg-accent-300"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
