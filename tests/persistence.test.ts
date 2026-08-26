import { describe, expect, it } from 'vitest'
import {
  createFolder,
  deleteFolder,
  duplicatePlay,
  filterByFolder,
  getPlay,
  hardDelete,
  listFolders,
  listPlays,
  listTrash,
  matchesQuery,
  newRecord,
  parseTags,
  putPlay,
  touchName,
} from '../src/lib/playbook'
import { thumbSvg } from '../src/lib/thumb'
import type { PlayPath } from '../src/stores/editorStore'

describe('search filter', () => {
  it('matches name case-insensitively', () => {
    expect(matchesQuery('Red Zone Slant', [], 'slant')).toBe(true)
    expect(matchesQuery('Red Zone Slant', [], 'SLANT')).toBe(true)
    expect(matchesQuery('Red Zone Slant', [], 'post')).toBe(false)
  })
  it('matches tags too', () => {
    expect(matchesQuery('Weak', ['redzone', '3rd-down'], '3rd')).toBe(true)
  })
  it('empty query matches everything', () => {
    expect(matchesQuery('Anything', [], '  ')).toBe(true)
  })
})

describe('record helpers', () => {
  it('newRecord stamps timestamps and empty tags', () => {
    const rec = newRecord('Test', [], [], null)
    expect(rec.name).toBe('Test')
    expect(rec.tags).toEqual([])
    expect(rec.createdAt).toBeGreaterThan(0)
  })
  it('touchName updates the name and bumps updatedAt', () => {
    const rec = newRecord('A', [], [], null)
    const touched = touchName(rec, 'B')
    expect(touched.name).toBe('B')
    expect(touched.updatedAt).toBeGreaterThanOrEqual(rec.updatedAt)
  })
})

describe('repository round-trip (memory fallback in node)', () => {
  it('put → get → list returns the record', async () => {
    const rec = newRecord('Roundtrip', [], [], null)
    await putPlay(rec)
    expect((await getPlay(rec.id))?.name).toBe('Roundtrip')
    expect((await listPlays()).some((r) => r.id === rec.id)).toBe(true)
  })

  it('duplicate copies under a new id with "(copy)" suffix', async () => {
    const rec = newRecord('Original', [], [], null)
    await putPlay(rec)
    const copy = await duplicatePlay(rec.id)
    expect(copy).not.toBeNull()
    expect(copy!.id).not.toBe(rec.id)
    expect(copy!.name).toBe('Original (copy)')
  })

  it('soft delete keeps it out of listPlays but in listTrash; hard delete purges', async () => {
    const rec = newRecord('Doomed', [], [], null)
    await putPlay(rec)
    await putPlay({ ...rec, deletedAt: Date.now() })
    expect((await listPlays()).some((r) => r.id === rec.id)).toBe(false)
    expect((await listTrash()).some((r) => r.id === rec.id)).toBe(true)
    await hardDelete(rec.id)
    expect(await getPlay(rec.id)).toBeNull()
  })
})

describe('thumbnails', () => {
  it('renders svg wrapper for an empty play', () => {
    const svg = thumbSvg([], [])
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
  })
  it('draws one stroke per path and one circle per token', () => {
    const tokens = [
      { x: 10, y: 80, side: 'offense' as const },
      { x: 20, y: 82, side: 'defense' as const },
    ]
    const paths: Pick<PlayPath, 'points' | 'type'>[] = [
      { points: [{ x: 12, y: 79 }, { x: 16, y: 74 }], type: 'route' },
      { points: [{ x: 26, y: 92 }, { x: 26, y: 94 }], type: 'snap' },
    ]
    const svg = thumbSvg(tokens, paths)
    expect(svg.match(/<path /g)?.length).toBe(2)
    expect(svg.match(/<circle /g)?.length).toBe(2)
    // offense/defense ring colors present
    expect(svg).toContain('#60a5fa')
    expect(svg).toContain('#f87171')
  })
})

describe('folders & tags', () => {
  it('parseTags splits, trims, and dedupes', () => {
    expect(parseTags('redzone,  3rd-down, redzone')).toEqual(['redzone', '3rd-down'])
    expect(parseTags('goal-line goal short')).toEqual(['goal-line', 'goal', 'short'])
    expect(parseTags('   ')).toEqual([])
  })

  it('folder CRUD + plays become unfiled when folder is deleted', async () => {
    const f = await createFolder('Red Zone')
    expect((await listFolders()).some((x) => x.id === f.id)).toBe(true)

    const rec = newRecord('Goal shot', [], [], null)
    await putPlay({ ...rec, folderId: f.id })

    const filed = { ...rec, folderId: f.id }
    const loose = { ...rec, id: 'b', folderId: null }
    expect(filterByFolder([filed, loose], f.id)).toHaveLength(1)
    expect(filterByFolder([filed], 'unfiled')).toHaveLength(0)
    expect(filterByFolder([loose], 'unfiled')).toHaveLength(1)
    expect(filterByFolder([filed, loose], 'all')).toHaveLength(2)

    await deleteFolder(f.id)
    expect((await listFolders()).some((x) => x.id === f.id)).toBe(false)
    const after = await getPlay(rec.id)
    expect(after?.folderId ?? null).toBeNull()
  })
})
