import { PALETTE_GROUPS } from '../../lib/positions'

function TokenChip({ pos, side }: { pos: string; side: string }) {
  const color =
    side === 'offense'
      ? 'bg-offense-500/10 text-offense-400 ring-offense-500/40'
      : 'bg-defense-500/10 text-defense-400 ring-defense-500/40'
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-dap-pos', pos)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      title="Drag onto the field"
      className="flex cursor-grab items-center justify-center rounded-lg p-1 transition-colors hover:bg-chrome-800 active:cursor-grabbing"
    >
      <span
        className={`grid size-8 place-items-center rounded-full text-[11px] font-bold ring-1 ${color}`}
      >
        {pos}
      </span>
    </div>
  )
}

export function TokenPalette() {
  return (
    <div className="w-52 shrink-0 overflow-y-auto border-r border-chrome-800 bg-chrome-900 p-3">
      {PALETTE_GROUPS.map(({ side, title, positions }) => (
        <section key={side} className={side === 'defense' ? 'mt-4' : undefined}>
          <p className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-widest text-chrome-500">
            {title}
          </p>
          <div className="grid grid-cols-4 gap-1">
            {positions.map((pos) => (
              <TokenChip key={pos} pos={pos} side={side} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
