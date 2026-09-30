import { useState } from 'react'
import { PERSONNEL, buildFormation, type Hash } from '../../lib/formations'
import {
  DEFENSE_FRONTS,
  DEFENSE_SHELLS,
  buildDefenseFormation,
  type Shell,
} from '../../lib/defenseFormations'
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
  const [yardLineDraft, setYardLineDraft] = useState(String(25))
  const [mode, setMode] = useState<'offense' | 'defense'>('offense')
  const [step, setStep] = useState<1 | 2>(1)
  const [showOther, setShowOther] = useState(false)
  const [front, setFront] = useState('nickel')
  const [shell, setShell] = useState<Shell>('2-high')

  if (!open) return null
  const def = PERSONNEL.find((p) => p.key === personnel)!
  const defFront = DEFENSE_FRONTS.find((f) => f.key === front)!

  const handleClose = () => {
    setStep(1)
    setShowOther(false)
    closeQuickStart()
  }

  const handleBack = () => {
    setStep(1)
    setShowOther(false)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-chrome-700 bg-chrome-900 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]">
        <header className="flex items-center justify-between border-b border-chrome-800 px-6 py-4">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg px-2 py-1 text-sm text-chrome-400 transition-colors hover:bg-chrome-800 hover:text-chrome-200"
              >
                ← Back
              </button>
            )}
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-chrome-100">
                New Play
              </h2>
              <p className="text-xs text-chrome-500">Set the formation — then draw routes and animate.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-3 py-1.5 text-sm text-chrome-400 transition-colors hover:bg-chrome-800 hover:text-chrome-200"
          >
            Cancel
          </button>
        </header>

        {step === 1 ? (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {(['offense', 'defense'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m)
                    setStep(2)
                    setShowOther(false)
                  }}
                  className="rounded-[16px] border border-chrome-700 bg-chrome-850 p-6 text-center transition-colors hover:border-accent-400 hover:bg-chrome-800"
                >
                  <span className="block font-display text-lg font-semibold capitalize text-chrome-200">{m}</span>
                  <span className="mt-1 block text-xs text-chrome-500">
                    {m === 'offense' ? '11 players' : '11 defenders'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
            {mode === 'offense' ? (
              <>
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
                        className={`rounded-[16px] border px-2 py-2 text-center transition-colors ${
                          personnel === p.key
                            ? 'border-accent-400 bg-accent-400'
                            : 'border-chrome-700 bg-chrome-850 hover:border-chrome-600 hover:bg-chrome-800'
                        }`}
                      >
                        <span
                          className={`block font-display text-lg font-semibold leading-none ${
                            personnel === p.key ? 'text-chrome-950' : 'text-chrome-200'
                          }`}
                        >
                          {p.key}
                        </span>
                        <span
                          className={`mt-1 block text-[9px] leading-tight ${
                            personnel === p.key ? 'text-chrome-950/80' : 'text-chrome-500'
                          }`}
                        >
                          {p.rb}RB·{p.te}TE·{p.wr}WR
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="pt-2 text-xs text-chrome-500">{def.formation}</p>
                </section>
              </>
            ) : (
              <>
                {/* front */}
                <section>
                  <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                    Front
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {DEFENSE_FRONTS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFront(f.key)}
                        title={f.formation}
                        className={`rounded-[16px] border px-2 py-2 text-center transition-colors ${
                          front === f.key
                            ? 'border-accent-400 bg-accent-400'
                            : 'border-chrome-700 bg-chrome-850 hover:border-chrome-600 hover:bg-chrome-800'
                        }`}
                      >
                        <span
                          className={`block font-display text-lg font-semibold leading-none ${
                            front === f.key ? 'text-chrome-950' : 'text-chrome-200'
                          }`}
                        >
                          {f.dl}-{f.lb}-{f.cb + f.s}
                        </span>
                        <span
                          className={`mt-1 block text-[9px] leading-tight ${
                            front === f.key ? 'text-chrome-950/80' : 'text-chrome-500'
                          }`}
                        >
                          {f.dl}DL·{f.lb}LB·{f.cb + f.s}DB
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="pt-2 text-xs text-chrome-500">{defFront.formation}</p>
                </section>

                {/* shell */}
                <section>
                  <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                    Coverage shell
                  </p>
                  <div className="flex rounded-[16px] border border-chrome-700 p-0.5">
                    {DEFENSE_SHELLS.map((sh) => (
                      <button
                        key={sh.key}
                        type="button"
                        onClick={() => setShell(sh.key)}
                        title={sh.hint}
                        className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          shell === sh.key ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'
                        }`}
                      >
                        {sh.label}
                      </button>
                    ))}
                  </div>
                  <p className="pt-1.5 text-[11px] text-chrome-300">
                    {shell === '1-high'
                      ? 'Single-high safety, SS drops into the box.'
                      : 'Two-high safeties split the deep field.'}
                  </p>
                </section>
              </>
            )}

            {/* alignment — snap is offense-only, hash applies to both */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(mode === 'offense' || showOther) && (
                <div>
                  <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                    Snap
                  </p>
                  <div className="flex rounded-[16px] border border-chrome-700 p-0.5">
                    {[false, true].map((uc) => (
                      <button
                        key={String(uc)}
                        type="button"
                        onClick={() => setUnderCenter(uc)}
                        className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          underCenter === uc ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'
                        }`}
                      >
                        {uc ? 'Under Center' : 'Shotgun'}
                      </button>
                    ))}
                  </div>
                  <p className="pt-1.5 text-[11px] text-chrome-300">
                    QB lines up {underCenter ? '1' : '5'} yards behind the center.
                  </p>
                </div>
              )}

              <div>
                <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                  Ball placement
                </p>
                <div className="flex rounded-[16px] border border-chrome-700 p-0.5">
                  {(['center', 'left', 'right'] as Hash[]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHash(h)}
                      className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
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
                <div className="flex rounded-[16px] border border-chrome-700 p-0.5">
                  {(['ours', 'theirs'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSide(s)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        side === s ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'
                      }`}
                    >
                      {s === 'ours' ? 'Own' : "Opp"}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={yardLineDraft}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^\d*$/.test(v)) {
                      setYardLineDraft(v)
                      if (v !== '' && v !== '0') {
                        const n = Number(v)
                        if (!Number.isNaN(n)) setYardLine(n)
                      }
                    }
                  }}
                  onBlur={() => {
                    const raw = Number(yardLineDraft)
                    const clamped = Math.max(1, Math.min(50, Math.round(Number.isNaN(raw) ? yardLine : raw) || 1))
                    setYardLine(clamped)
                    setYardLineDraft(String(clamped))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                  className="w-20 rounded-[16px] border border-chrome-700 bg-chrome-850 px-3 py-1.5 text-sm font-medium text-chrome-200 outline-none focus:border-accent-400/60"
                />
                <span className="text-xs text-chrome-500">yard line (both sides: 50 = midfield)</span>
              </div>
            </section>
                {mode === 'offense' && !showOther && (
                  <button
                    type="button"
                    onClick={() => setShowOther(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-chrome-600 px-3 py-2 text-xs font-medium text-chrome-400 transition-colors hover:border-accent-400 hover:text-accent-400"
                  >
                    + Add Defense
                  </button>
                )}
                {mode === 'offense' && showOther && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                        Scout Defense
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowOther(false)}
                        className="text-xs text-chrome-400 hover:text-defense-400"
                      >
                        Remove
                      </button>
                    </div>
                    <section>
                      <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                        Front
                      </p>
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                        {DEFENSE_FRONTS.map((f) => (
                          <button
                            key={`scout-${f.key}`}
                            type="button"
                            onClick={() => setFront(f.key)}
                            title={f.formation}
                            className={`rounded-[16px] border px-2 py-2 text-center transition-colors ${
                              front === f.key
                                ? 'border-accent-400 bg-accent-400'
                                : 'border-chrome-700 bg-chrome-850 hover:border-chrome-600 hover:bg-chrome-800'
                            }`}
                          >
                            <span
                              className={`block font-display text-lg font-semibold leading-none ${
                                front === f.key ? 'text-chrome-950' : 'text-chrome-200'
                              }`}
                            >
                              {f.dl}-{f.lb}-{f.cb + f.s}
                            </span>
                            <span
                              className={`mt-1 block text-[9px] leading-tight ${
                                front === f.key ? 'text-chrome-950/80' : 'text-chrome-500'
                              }`}
                            >
                              {f.dl}DL·{f.lb}LB·{f.cb + f.s}DB
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="pt-2 text-xs text-chrome-500">{defFront.formation}</p>
                    </section>
                    <section>
                      <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                        Coverage shell
                      </p>
                      <div className="flex rounded-[16px] border border-chrome-700 p-0.5">
                        {DEFENSE_SHELLS.map((sh) => (
                          <button
                            key={`scout-${sh.key}`}
                            type="button"
                            onClick={() => setShell(sh.key)}
                            title={sh.hint}
                            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              shell === sh.key ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'
                            }`}
                          >
                            {sh.label}
                          </button>
                        ))}
                      </div>
                    </section>
                  </>
                )}
                {mode === 'defense' && !showOther && (
                  <button
                    type="button"
                    onClick={() => setShowOther(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-chrome-600 px-3 py-2 text-xs font-medium text-chrome-400 transition-colors hover:border-accent-400 hover:text-accent-400"
                  >
                    + Add Offense
                  </button>
                )}
                {mode === 'defense' && showOther && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                        Scout Offense
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowOther(false)}
                        className="text-xs text-chrome-400 hover:text-defense-400"
                      >
                        Remove
                      </button>
                    </div>
                    <section>
                      <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                        Personnel
                      </p>
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                        {PERSONNEL.map((p) => (
                          <button
                            key={`scout-${p.key}`}
                            type="button"
                            onClick={() => {
                              setPersonnel(p.key)
                              setUnderCenter(p.uc)
                            }}
                            title={p.formation}
                            className={`rounded-[16px] border px-2 py-2 text-center transition-colors ${
                              personnel === p.key
                                ? 'border-accent-400 bg-accent-400'
                                : 'border-chrome-700 bg-chrome-850 hover:border-chrome-600 hover:bg-chrome-800'
                            }`}
                          >
                            <span
                              className={`block font-display text-lg font-semibold leading-none ${
                                personnel === p.key ? 'text-chrome-950' : 'text-chrome-200'
                              }`}
                            >
                              {p.key}
                            </span>
                            <span
                              className={`mt-1 block text-[9px] leading-tight ${
                                personnel === p.key ? 'text-chrome-950/80' : 'text-chrome-500'
                              }`}
                            >
                              {p.rb}RB·{p.te}TE·{p.wr}WR
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="pt-2 text-xs text-chrome-500">{def.formation}</p>
                    </section>
                  </>
                )}
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-chrome-800 px-6 py-4">
          {step === 1 ? (
            <span className="mr-auto text-xs text-chrome-500">Choose a side to start</span>
          ) : null}
          {step === 2 && (
            <button
              type="button"
              onClick={() => {
                const raw = Number(yardLineDraft)
                const n = Math.max(1, Math.min(50, Math.round(Number.isNaN(raw) ? yardLine : raw) || 1))
                resetPlayIdentity()
                const withOffense = mode === 'offense' || showOther
                const withDefense = mode === 'defense' || showOther
                let tokens: ReturnType<typeof buildFormation>['tokens'] = []
                let snap: ReturnType<typeof buildFormation>['snap'] | null = null
                let name = ''
                if (withOffense) {
                  const builtOff = buildFormation({ personnel, underCenter, hash, side, yardLine: n })
                  tokens = [...tokens, ...builtOff.tokens]
                  snap = builtOff.snap
                  name = builtOff.name
                }
                if (withDefense) {
                  const builtDef = buildDefenseFormation({ front, shell, hash, side, yardLine: n })
                  tokens = [...tokens, ...builtDef.tokens]
                  if (!name) name = builtDef.name
                  else name = `${name} vs ${builtDef.name}`
                }
                loadPlay({
                  name,
                  los: { side, n },
                  tokens,
                  paths: snap
                    ? [
                        {
                          tokenId: snap.tokenId,
                          endTokenId: snap.endTokenId,
                          type: 'snap',
                          points: snap.points,
                          d: '',
                        },
                      ]
                    : [],
                })
                handleClose()
              }}
              className="flex items-center gap-1.5 rounded-full bg-accent-400 px-4 py-2 text-sm font-semibold text-chrome-950 transition-colors hover:bg-accent-300"
            >
              Create play
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
