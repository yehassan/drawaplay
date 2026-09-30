import type { PlayPath, TextNote, Token } from '../stores/editorStore'

/** A persisted play document. */
export interface PlayRecord {
  id: string
  name: string
  tokens: Token[]
  paths: PlayPath[]
  textNotes: TextNote[]
  ballStartId: string | null
  /** line-of-scrimmage metadata from quickstart (LOS marker) */
  los?: { side: 'ours' | 'theirs'; n: number }
  fieldTheme?: string
  ruleset?: string
  folderId?: string | null
  tags: string[]
  /** soft-delete timestamp; absent = live */
  deletedAt?: number
  createdAt: number
  updatedAt: number
}

/** A playbook folder/collection. */
export interface FolderRecord {
  id: string
  name: string
  createdAt: number
}

export function uid(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `r${Date.now()}${Math.random().toString(36).slice(2)}`
}

// ---------------------------------------------------------------------------
// IndexedDB repository (thin). Falls back to in-memory storage when IDB is
// unavailable (tests, SSR) so callers never branch.
// ---------------------------------------------------------------------------

const DB_NAME = 'drawaplay'
const PLAYS = 'plays'
const FOLDERS = 'folders'
const VERSION = 2

const memoryPlays = new Map<string, PlayRecord>()
const memoryFolders = new Map<string, FolderRecord>()
let idbPromise: Promise<IDBDatabase | null> | null = null

let usingFallback = false

/** 'idb' = persistent · 'memory' = fallback (another tab may be blocking an upgrade) */
export function storageStatus(): 'idb' | 'memory' | 'unknown' {
  if (typeof indexedDB === 'undefined') return 'memory'
  return usingFallback ? 'memory' : idbPromise ? 'idb' : 'unknown'
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    usingFallback = true
    return Promise.resolve(null)
  }
  if (!idbPromise) {
    idbPromise = new Promise((resolve) => {
      let settled = false
      const settle = (db: IDBDatabase | null): void => {
        if (settled) return
        settled = true
        usingFallback = db === null
        if (db === null) idbPromise = null // allow a retry on the next call
        resolve(db)
      }
      try {
        const req = indexedDB.open(DB_NAME, VERSION)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(PLAYS)) db.createObjectStore(PLAYS, { keyPath: 'id' })
          if (!db.objectStoreNames.contains(FOLDERS)) db.createObjectStore(FOLDERS, { keyPath: 'id' })
        }
        req.onsuccess = () => settle(req.result)
        req.onerror = () => {
          console.warn('[drawaplay] IndexedDB open failed', req.error)
          settle(null)
        }
        // a stale tab holding the old version blocks the upgrade forever —
        // fall back to memory rather than hanging silently
        req.onblocked = () => {
          console.warn('[drawaplay] IndexedDB upgrade blocked by another tab')
          settle(null)
        }
      } catch (err) {
        console.warn('[drawaplay] IndexedDB unavailable', err)
        settle(null)
      }
    })
  }
  return idbPromise
}

async function tx<T>(
  mode: IDBTransactionMode,
  storeName: string,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const req = run(db.transaction(storeName, mode).objectStore(storeName))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

// ---- plays ----

export async function putPlay(record: PlayRecord): Promise<void> {
  memoryPlays.set(record.id, record)
  await tx('readwrite', PLAYS, (s) => s.put(record))
}

export async function getPlay(id: string): Promise<PlayRecord | null> {
  const rec = await tx<PlayRecord>('readonly', PLAYS, (s) => s.get(id) as IDBRequest<PlayRecord>)
  return rec ?? memoryPlays.get(id) ?? null
}

async function allPlaysRaw(): Promise<PlayRecord[]> {
  return (
    (await tx<PlayRecord[]>('readonly', PLAYS, (s) => s.getAll() as IDBRequest<PlayRecord[]>)) ?? [
      ...memoryPlays.values(),
    ]
  )
}

export async function listPlays(): Promise<PlayRecord[]> {
  return (await allPlaysRaw()).filter((r) => !r.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function listTrash(): Promise<PlayRecord[]> {
  return (await allPlaysRaw())
    .filter((r) => r.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
}

export async function hardDelete(id: string): Promise<void> {
  memoryPlays.delete(id)
  await tx('readwrite', PLAYS, (s) => s.delete(id) as unknown as IDBRequest<undefined>)
}

export async function duplicatePlay(id: string): Promise<PlayRecord | null> {
  const src = await getPlay(id)
  if (!src) return null
  const now = Date.now()
  const copy: PlayRecord = {
    ...src,
    id: uid(),
    name: `${src.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    deletedAt: undefined,
  }
  await putPlay(copy)
  return copy
}

export async function mostRecentPlay(): Promise<PlayRecord | null> {
  const [first] = await listPlays()
  return first ?? null
}

// ---- folders ----

export async function listFolders(): Promise<FolderRecord[]> {
  const all =
    (await tx<FolderRecord[]>('readonly', FOLDERS, (s) => s.getAll() as IDBRequest<FolderRecord[]>)) ??
    [...memoryFolders.values()]
  return all.sort((a, b) => a.name.localeCompare(b.name))
}

export async function createFolder(name: string): Promise<FolderRecord> {
  const rec: FolderRecord = { id: uid(), name: name.trim(), createdAt: Date.now() }
  memoryFolders.set(rec.id, rec)
  await tx('readwrite', FOLDERS, (s) => s.put(rec))
  return rec
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const all =
    (await tx<FolderRecord[]>('readonly', FOLDERS, (s) => s.getAll() as IDBRequest<FolderRecord[]>)) ?? [
      ...memoryFolders.values(),
    ]
  const rec = all.find((f) => f.id === id) ?? memoryFolders.get(id)
  if (!rec) return
  const updated = { ...rec, name: name.trim() }
  memoryFolders.set(id, updated)
  await tx('readwrite', FOLDERS, (s) => s.put(updated))
}

/** Delete a folder; plays inside become unfiled (never deleted). */
export async function deleteFolder(id: string): Promise<void> {
  memoryFolders.delete(id)
  await tx('readwrite', FOLDERS, (s) => s.delete(id) as unknown as IDBRequest<undefined>)
  const plays = await allPlaysRaw()
  for (const p of plays) {
    if (p.folderId === id) await putPlay({ ...p, folderId: null })
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function matchesQuery(name: string, tags: string[], query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return name.toLowerCase().includes(q) || tags.some((t) => t.toLowerCase().includes(q))
}

export type FolderSelection = 'all' | 'unfiled' | string

export function filterByFolder(plays: PlayRecord[], sel: FolderSelection): PlayRecord[] {
  if (sel === 'all') return plays
  if (sel === 'unfiled') return plays.filter((p) => !p.folderId)
  return plays.filter((p) => p.folderId === sel)
}

/** Parse freeform tag input: comma/space separated, trimmed, deduped. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  for (const raw of input.split(/[,\s]+/)) {
    const t = raw.trim()
    if (t) seen.add(t)
  }
  return [...seen]
}

export function newRecord(
  name: string,
  tokens: Token[],
  paths: PlayPath[],
  ballStartId: string | null,
  textNotes: TextNote[] = [],
): PlayRecord {
  const now = Date.now()
  return { id: uid(), name, tokens, paths, textNotes, ballStartId, tags: [], createdAt: now, updatedAt: now }
}

export function touchName(record: PlayRecord, name: string): PlayRecord {
  return { ...record, name, updatedAt: Date.now() }
}
