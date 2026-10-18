import { computeScene, fitView, frameView, type Frame } from './render'
import { drawFrame } from './exportCanvas'
import { timelineDuration } from './timing'
import type { LosSpecLike } from './los'
import type { Ruleset } from './field'
import type { PlayPath, TextNote, Token } from '../stores/editorStore'

export interface ExportDoc {
  name: string
  tokens: Token[]
  paths: PlayPath[]
  textNotes?: TextNote[]
  ballStartId: string | null
  losSpec?: LosSpecLike | null
  fieldTheme?: 'green' | 'white' | 'black'
  ruleset?: Ruleset
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function safeFilename(name: string): string {
  return name.replace(/[^\w\d-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'play'
}

const VIDEO_CANDIDATES: ReadonlyArray<{ mime: string; ext: string }> = [
  { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
]

/** Prefer MP4 (Chrome/Safari); fall back to WebM (Firefox). */
export function pickVideoMime(
  isSupported: (mime: string) => boolean,
): { mime: string; ext: string } | null {
  for (const c of VIDEO_CANDIDATES) {
    if (isSupported(c.mime)) return c
  }
  return null
}

/**
 * The one shape every export has, so a play's export size never depends on the
 * shape of the play. 9:16 portrait, because the field is vertical and a play is
 * normally taller than it is wide. The still is twice the video's density.
 */
export const VIDEO_FRAME: Frame = { w: 1080, h: 1920 }
export const PNG_FRAME: Frame = { w: 2160, h: 3840 }

/** Static hi-res PNG of the diagram, in the standard frame. */
export async function exportPNG(doc: ExportDoc): Promise<void> {
  const content = fitView(doc.tokens, doc.paths, { tMs: 0, playing: false, ballStartId: doc.ballStartId }, 5, 20, doc.textNotes ?? [])
  const { view, scale, width, height } = frameView(content, PNG_FRAME)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const scene = computeScene(doc.tokens, doc.paths, { tMs: 0, playing: false, ballStartId: doc.ballStartId })
  drawFrame(ctx, { ...scene, tokens: doc.tokens, textNotes: doc.textNotes }, { scale, losSpec: doc.losSpec ?? null, view, theme: doc.fieldTheme, ruleset: doc.ruleset })
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG export failed')
  download(blob, `${safeFilename(doc.name)}.png`)
}

const VIDEO_FPS = 60
const VIDEO_BITRATE = 12_000_000
const TAIL_HOLD_MS = 400

export async function exportWebM(
  doc: ExportDoc,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video recording is not supported in this browser')
  }

  const content = fitView(doc.tokens, doc.paths, { tMs: 0, playing: true, ballStartId: doc.ballStartId }, 5, 20, doc.textNotes ?? [])
  const { view, scale, width, height } = frameView(content, VIDEO_FRAME)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const D = timelineDuration(doc.paths)
  if (doc.paths.length === 0) throw new Error('Nothing to record — draw some routes first')

  const scene0 = computeScene(doc.tokens, doc.paths, { tMs: 0, playing: true, ballStartId: doc.ballStartId })
  drawFrame(ctx, { ...scene0, tokens: doc.tokens, textNotes: doc.textNotes }, { scale, losSpec: doc.losSpec ?? null, view, theme: doc.fieldTheme, ruleset: doc.ruleset })

  let stream: MediaStream
  let track: MediaStreamTrack
  let canRequestFrame = false
  try {
    stream = canvas.captureStream(0)
    track = stream.getVideoTracks()[0]
    canRequestFrame = typeof (track as { requestFrame?: unknown }).requestFrame === 'function'
    if (!canRequestFrame) {
      track.stop()
      stream = canvas.captureStream(VIDEO_FPS)
      track = stream.getVideoTracks()[0]
    }
  } catch {
    stream = canvas.captureStream(VIDEO_FPS)
    track = stream.getVideoTracks()[0]
  }

  const pick = pickVideoMime((m) => MediaRecorder.isTypeSupported(m))
  if (!pick) throw new Error('No supported video recording format in this browser')
  const rec = new MediaRecorder(stream, { mimeType: pick.mime, videoBitsPerSecond: VIDEO_BITRATE })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: pick.mime }))
  })

  rec.start()

  const drawAt = (t: number): void => {
    const scene = computeScene(doc.tokens, doc.paths, { tMs: t, playing: true, ballStartId: doc.ballStartId })
    drawFrame(ctx, { ...scene, tokens: doc.tokens, textNotes: doc.textNotes }, { scale, losSpec: doc.losSpec ?? null, view, theme: doc.fieldTheme, ruleset: doc.ruleset })
  }

  if (canRequestFrame) {
    const interval = 1000 / VIDEO_FPS
    const totalFrames = Math.ceil(D / interval)
    const holdFrames = Math.ceil(TAIL_HOLD_MS / interval)
    for (let i = 0; i <= totalFrames + holdFrames; i++) {
      const t = Math.min(D, i * interval)
      drawAt(t)
      ;(track as unknown as { requestFrame: () => void }).requestFrame()
      onProgress?.(Math.min(1, t / D))
      await new Promise((r) => setTimeout(r, interval))
    }
  } else {
    await new Promise<void>((resolve) => {
      const start = performance.now()
      const tick = (): void => {
        const t = Math.min(D, performance.now() - start)
        drawAt(t)
        onProgress?.(t / D)
        if (t < D) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
    await new Promise((r) => setTimeout(r, TAIL_HOLD_MS))
  }

  rec.stop()
  track.stop()
  stream.getTracks().forEach((tr) => tr.stop())
  const blob = await done
  download(blob, `${safeFilename(doc.name)}.${pick.ext}`)
}
