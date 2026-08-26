import { useEffect, useState, type ReactNode } from 'react'
import { storageStatus } from '../../lib/playbook'
import {
  createFolder,
  deleteFolder,
  duplicatePlay,
  filterByFolder,
  hardDelete,
  listFolders,
  listPlays,
  listTrash,
  matchesQuery,
  parseTags,
  putPlay,
  touchName,
  type FolderRecord,
  type FolderSelection,
  type PlayRecord,
} from '../../lib/playbook'
import { thumbSvg } from '../../lib/thumb'
import { useEditorStore } from '../../stores/editorStore'
import { Icon } from '../ui/icons'
import { IconButton } from '../ui/IconButton'

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function TagChips({ tags, onRemove }: { tags: string[]; onRemove?: (t: string) => void }) {
  if (tags.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 rounded-full bg-accent-400/10 px-1.5 py-0.5 text-[9px] font-medium text-accent-400"
        >
          {t}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(t)}
              className="text-accent-400/50 hover:text-accent-400"
            >
              ×
            </button>
          )}
        </span>
      ))}
    </span>
  )
}

function MetaEditor({
  rec,
  folders,
  onSave,
  onClose,
}: {
  rec: PlayRecord
  folders: FolderRecord[]
  onSave: (patch: { folderId: string | null; tags: string[] }) => void
  onClose: () => void
}) {
  const [folderId, setFolderId] = useState<string | null>(rec.folderId ?? null)
  const [input, setInput] = useState('')
  const [tags, setTags] = useState<string[]>([...rec.tags])

  const addTags = (): void => {
    const parsed = parseTags(input)
    if (parsed.length === 0) return
    setTags((prev) => [...new Set([...prev, ...parsed])])
    setInput('')
  }

  return (
    <div className="space-y-2 border-t border-chrome-800 bg-chrome-900/60 p-2.5">
      <label className="block text-[10px] uppercase tracking-[0.06em] text-chrome-500">
        Folder
        <select
          value={folderId ?? ''}
          onChange={(e) => setFolderId(e.target.value || null)}
          className="mt-1 w-full rounded border border-chrome-700 bg-chrome-850 px-1.5 py-1 text-xs normal-case text-chrome-200 outline-none focus:border-accent-400/60"
        >
          <option value="">Unfiled</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <div className="text-[10px] uppercase tracking-[0.06em] text-chrome-500">Tags</div>
      <TagChips tags={tags} onRemove={(t) => setTags((prev) => prev.filter((x) => x !== t))} />
      <div className="flex gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTags()
            }
          }}
          placeholder="add tag…"
          className="min-w-0 flex-1 rounded border border-chrome-700 bg-chrome-850 px-1.5 py-1 text-xs text-chrome-200 outline-none focus:border-accent-400/60"
        />
        <button
          type="button"
          onClick={addTags}
          className="rounded border border-chrome-700 px-2 text-xs text-chrome-300 hover:bg-chrome-800"
        >
          Add
        </button>
      </div>

      <div className="flex justify-end gap-1 pt-0.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-chrome-400 hover:bg-chrome-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onSave({ folderId, tags })
            onClose()
          }}
          className="rounded bg-accent-400 px-2.5 py-1 text-xs font-semibold text-chrome-950 hover:bg-accent-300"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function PlayCard({
  rec,
  folders,
  thumbTheme,
  onOpen,
  onChanged,
}: {
  rec: PlayRecord
  folders: FolderRecord[]
  thumbTheme: string
  onOpen: (rec: PlayRecord) => void
  onChanged: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(rec.name)
  const [editingMeta, setEditingMeta] = useState(false)

  const save = async (): Promise<void> => {
    const name = draft.trim() || rec.name
    await putPlay(touchName(rec, name))
    setRenaming(false)
    onChanged()
  }

  const folderName = folders.find((f) => f.id === rec.folderId)?.name

  return (
    <div className="group relative overflow-hidden rounded-xl border border-chrome-700 bg-chrome-850 transition-colors hover:border-chrome-600">
      {!rec.deletedAt && (
        <IconButton
          label="Move to trash"
          onClick={async () => {
            await putPlay({ ...rec, deletedAt: Date.now() })
            onChanged()
          }}
          className="!absolute right-1.5 top-1.5 z-10 size-7 !bg-chrome-900/90 shadow-md"
        >
          <Icon name="trash" className="size-3.5" />
        </IconButton>
      )}

      <button type="button" onClick={() => onOpen(rec)} className="block w-full" title="Open play">
        <div
          className="h-36 w-full bg-chrome-900 p-1 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: thumbSvg(rec.tokens, rec.paths, (rec.fieldTheme as never) ?? thumbTheme) }}
        />
      </button>

      <div className="border-t border-chrome-800 px-2.5 py-2">
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
              if (e.key === 'Escape') setRenaming(false)
            }}
            className="w-full rounded border border-accent-400/60 bg-chrome-900 px-1.5 py-0.5 text-sm text-chrome-200 outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => {
              setDraft(rec.name)
              setRenaming(true)
            }}
            title="Double-click to rename"
            onClick={() => onOpen(rec)}
            className="block w-full truncate text-left text-sm font-medium text-chrome-200 hover:text-accent-400"
          >
            {rec.name}
          </button>
        )}

        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-chrome-500">
            <span>{timeAgo(rec.updatedAt)}</span>
            {folderName && (
              <span className="truncate rounded bg-chrome-800 px-1 py-px text-chrome-400">{folderName}</span>
            )}
          </span>
          <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <IconButton
              label="Tags & folder"
              onClick={() => setEditingMeta((v) => !v)}
              className={`size-7 ${editingMeta ? '!text-accent-400' : ''}`}
            >
              <Icon name="book" className="size-3.5" />
            </IconButton>
            <IconButton
              label="Duplicate"
              onClick={async () => {
                await duplicatePlay(rec.id)
                onChanged()
              }}
              className="size-7"
            >
              <Icon name="plus" className="size-3.5" />
            </IconButton>
            {rec.deletedAt ? (
              <>
                <IconButton
                  label="Restore"
                  onClick={async () => {
                    await putPlay({ ...rec, deletedAt: undefined, updatedAt: Date.now() })
                    onChanged()
                  }}
                  className="size-7"
                >
                  <Icon name="loop" className="size-3.5" />
                </IconButton>
                <IconButton
                  label="Delete forever"
                  onClick={async () => {
                    await hardDelete(rec.id)
                    onChanged()
                  }}
                  className="size-7"
                >
                  <Icon name="minus" className="size-3.5" />
                </IconButton>
              </>
            ) : null}
          </span>
        </div>

        {(rec.tags.length > 0 || rec.folderId) && !editingMeta && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <TagChips tags={rec.tags} />
          </div>
        )}
      </div>

      {editingMeta && (
        <MetaEditor
          rec={rec}
          folders={folders}
          onClose={() => setEditingMeta(false)}
          onSave={async (patch) => {
            await putPlay({ ...rec, ...patch, updatedAt: Date.now() })
            onChanged()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function PlaybookModal() {
  const open = useEditorStore((s) => s.libraryOpen)
  const close = useEditorStore((s) => s.closeLibrary)
  const openQuickStart = useEditorStore((s) => s.openQuickStart)
  const resetPlayIdentity = useEditorStore((s) => s.resetPlayIdentity)
  const loadPlay = useEditorStore((s) => s.loadPlay)
  const setPlayId = useEditorStore((s) => s.setPlayId)

  const fieldTheme = useEditorStore((s) => s.fieldTheme)
  const [live, setLive] = useState<PlayRecord[] | null>(null)
  const [trash, setTrash] = useState<PlayRecord[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<FolderSelection>('all')
  const [newFolder, setNewFolder] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [folderDraft, setFolderDraft] = useState('')

  async function refresh(): Promise<void> {
    setLive(await listPlays())
    setTrash(await listTrash())
    setFolders(await listFolders())
  }

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open])

  if (!open) return null

  const inSel = filterByFolder(live ?? [], sel).filter((r) =>
    matchesQuery(r.name, r.tags, q),
  )
  const countIn = (selKey: FolderSelection): number =>
    filterByFolder(live ?? [], selKey).filter((r) => matchesQuery(r.name, r.tags, q)).length

  function openRec(rec: PlayRecord): void {
    loadPlay({
      name: rec.name,
      tokens: rec.tokens,
      paths: rec.paths,
      fieldTheme: rec.fieldTheme as never,
      ruleset: rec.ruleset as never,
    })
    setPlayId(rec.id)
    close()
  }

  function newPlay(): void {
    resetPlayIdentity()
    openQuickStart()
    close()
  }

  async function addFolder(): Promise<void> {
    const name = newFolder.trim()
    if (!name) return
    const f = await createFolder(name)
    setNewFolder('')
    setAddingFolder(false)
    await refresh()
    setSel(f.id)
  }

  async function removeFolder(id: string): Promise<void> {
    await deleteFolder(id)
    if (sel === id) setSel('all')
    await refresh()
  }

  const sideItem = (
    key: FolderSelection,
    label: string,
    count: number,
  ): ReactNode => (
    <button
      key={key}
      type="button"
      onClick={() => setSel(key)}
      onDoubleClick={
        typeof key === 'string' && key !== 'all' && key !== 'unfiled'
          ? () => {
              setRenamingFolder(key)
              setFolderDraft(folders.find((f) => f.id === key)?.name ?? '')
            }
          : undefined
      }
      title={typeof key === 'string' && key !== 'all' && key !== 'unfiled' ? 'Double-click to rename' : undefined}
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
        sel === key ? 'bg-accent-400/15 text-accent-400' : 'text-chrome-300 hover:bg-chrome-850'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">
        {renamingFolder === key ? (
          <input
            autoFocus
            value={folderDraft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setFolderDraft(e.target.value)}
            onBlur={async () => {
              if (folderDraft.trim()) await renameFolderById(key, folderDraft)
              setRenamingFolder(null)
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                if (folderDraft.trim()) await renameFolderById(key, folderDraft)
                setRenamingFolder(null)
              }
              if (e.key === 'Escape') setRenamingFolder(null)
            }}
            className="w-full rounded border border-accent-400/60 bg-chrome-900 px-1 py-0.5 text-xs text-chrome-200 outline-none"
          />
        ) : (
          label
        )}
      </span>
      <span className="ml-2 flex items-center gap-1">
        {typeof key === 'string' && key !== 'all' && key !== 'unfiled' && (
          <span
            role="button"
            tabIndex={-1}
            title="Delete folder (plays become unfiled)"
            onClick={async (e) => {
              e.stopPropagation()
              await removeFolder(key)
            }}
            className="hidden text-chrome-600 hover:text-defense-400 group-hover/sidebar:inline"
          >
            <Icon name="trash" className="size-3" />
          </span>
        )}
        <span className="text-[10px] text-chrome-500">{count}</span>
      </span>
    </button>
  )

  async function renameFolderById(id: string, name: string): Promise<void> {
    const { renameFolder } = await import('../../lib/playbook')
    await renameFolder(id, name)
    await refresh()
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-chrome-700 bg-chrome-900 shadow-2xl">
        <header className="flex items-center gap-3 border-b border-chrome-800 px-5 py-3.5">
          <h2 className="font-display text-xl font-semibold tracking-tight text-chrome-100">Playbook</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search plays & tags…"
            className="ml-2 w-56 rounded-lg border border-chrome-700 bg-chrome-850 px-3 py-1.5 text-sm text-chrome-200 outline-none focus:border-accent-400/60"
          />
          <div className="flex-1" />
          <button
            type="button"
            onClick={newPlay}
            className="flex items-center gap-1.5 rounded-lg bg-accent-400 px-3 py-1.5 text-sm font-semibold text-chrome-950 transition-colors hover:bg-accent-300"
          >
            <Icon name="plus" className="size-4" />
            New play
          </button>
          <IconButton label="Close library" onClick={close}>
            <Icon name="plus" className="size-4 rotate-45" />
          </IconButton>
        </header>

        {storageStatus() === 'memory' && (
          <div className="flex items-center gap-2 border-b border-amber-400/30 bg-amber-400/10 px-5 py-2 text-xs text-amber-300">
            ⚠ Storage unavailable — plays won't persist. Close other DrawAPLAY tabs and refresh to
            restore your playbook.
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          {/* folders sidebar */}
          <aside className="group/sidebar flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-chrome-800 p-3">
            {sideItem('all', 'All plays', countIn('all'))}
            {sideItem('unfiled', 'Unfiled', countIn('unfiled'))}
            {folders.length > 0 && (
              <p className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-chrome-600">
                Folders
              </p>
            )}
            {folders.map((f) => (
              <div key={f.id}>{sideItem(f.id, f.name, countIn(f.id))}</div>
            ))}
            <div className="pt-2">
              {addingFolder ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={newFolder}
                    placeholder="Folder name"
                    onChange={(e) => setNewFolder(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') await addFolder()
                      if (e.key === 'Escape') setAddingFolder(false)
                    }}
                    className="min-w-0 flex-1 rounded border border-accent-400/60 bg-chrome-900 px-1.5 py-1 text-xs text-chrome-200 outline-none"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingFolder(true)}
                  className="flex w-full items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-chrome-400 transition-colors hover:bg-chrome-850 hover:text-accent-400"
                >
                  <Icon name="plus" className="size-3" />
                  New folder
                </button>
              )}
            </div>
          </aside>

          {/* main grid */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
            {!live ? (
              <p className="grid h-32 place-items-center text-sm text-chrome-500">Loading…</p>
            ) : inSel.length === 0 ? (
              <div className="grid h-48 place-items-center text-center">
                <div>
                  <p className="text-sm text-chrome-400">
                    {q ? 'No plays match your search.' : 'No plays here yet.'}
                  </p>
                  {!q && (
                    <button
                      type="button"
                      onClick={newPlay}
                      className="mt-3 rounded-lg bg-accent-400 px-4 py-2 text-sm font-semibold text-chrome-950 hover:bg-accent-300"
                    >
                      Create your first play
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                {inSel.map((rec) => (
                  <PlayCard
                    key={rec.id}
                    rec={rec}
                    folders={folders}
                    thumbTheme={fieldTheme}
                    onOpen={openRec}
                    onChanged={() => void refresh()}
                  />
                ))}
              </div>
            )}

            {trash.length > 0 && (
              <section className="mt-6 border-t border-chrome-800 pt-4">
                <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
                  Trash ({trash.length})
                </p>
                <ul className="space-y-1">
                  {trash.map((rec) => (
                    <li
                      key={rec.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-chrome-850"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-chrome-400">{rec.name}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await putPlay({ ...rec, deletedAt: undefined, updatedAt: Date.now() })
                          void refresh()
                        }}
                        className="rounded px-2 py-1 text-xs text-chrome-300 hover:bg-chrome-800 hover:text-accent-400"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await hardDelete(rec.id)
                          void refresh()
                        }}
                        className="rounded px-2 py-1 text-xs text-defense-400 hover:bg-defense-500/10"
                      >
                        Delete forever
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
