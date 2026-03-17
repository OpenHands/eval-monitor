const BASE_URL = '/api'

export async function fetchRunList(date: string): Promise<string[]> {
  const cacheBust = Math.floor(Date.now() / 1000)
  const res = await fetch(`${BASE_URL}/metadata/${date}.txt?${cacheBust}`)
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Failed to fetch run list: ${res.status}`)
  }
  const text = await res.text()
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
}

export interface RunMetadata {
  init: Record<string, unknown> | null
  params: Record<string, unknown> | null
  error: Record<string, unknown> | null
  runInferStart: Record<string, unknown> | null
  runInferEnd: Record<string, unknown> | null
  evalInferStart: Record<string, unknown> | null
  evalInferEnd: Record<string, unknown> | null
}

const METADATA_FILES = [
  ['init', 'init.json'],
  ['params', 'params.json'],
  ['error', 'error.json'],
  ['runInferStart', 'run-infer-start.json'],
  ['runInferEnd', 'run-infer-end.json'],
  ['evalInferStart', 'eval-infer-start.json'],
  ['evalInferEnd', 'eval-infer-end.json'],
] as const

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('xml')) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchRunMetadata(runSlug: string): Promise<RunMetadata> {
  const slug = runSlug.replace(/\/$/, '')
  const results = await Promise.all(
    METADATA_FILES.map(([, file]) =>
      fetchJson(`${BASE_URL}/${slug}/metadata/${file}`)
    )
  )
  const metadata: Record<string, Record<string, unknown> | null> = {}
  METADATA_FILES.forEach(([key], i) => {
    metadata[key] = results[i]
  })
  return metadata as unknown as RunMetadata
}

export function parseRunSlug(slug: string) {
  const parts = slug.replace(/\/$/, '').split('/')
  if (parts.length >= 3) {
    return {
      benchmark: parts[0],
      model: parts[1].replace('litellm_proxy-', ''),
      jobId: parts[2],
    }
  }
  return { benchmark: slug, model: '', jobId: '' }
}

export function getStageStatus(metadata: RunMetadata): 'pending' | 'running-infer' | 'running-eval' | 'completed' | 'error' {
  if (metadata.error) return 'error'
  if (metadata.evalInferEnd) return 'completed'
  if (metadata.evalInferStart) return 'running-eval'
  if (metadata.runInferEnd) return 'running-eval'
  if (metadata.runInferStart) return 'running-infer'
  if (metadata.init) return 'pending'
  return 'pending'
}

function getTimestampMs(data: Record<string, unknown> | null): number | null {
  if (!data) return null
  const ts = data.timestamp as string | undefined
  if (!ts) return null
  const ms = new Date(ts).getTime()
  return isNaN(ms) ? null : ms
}

export function formatRuntime(diffMs: number): string {
  if (diffMs < 0) return '—'
  const totalMinutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function computeRuntime(metadata: RunMetadata, now?: number): string | null {
  const status = getStageStatus(metadata)
  if (status === 'pending') return null

  // Find the earliest start time
  const startMs =
    getTimestampMs(metadata.init) ??
    getTimestampMs(metadata.runInferStart) ??
    getTimestampMs(metadata.evalInferStart)
  if (startMs == null) return null

  // For completed or errored jobs, use the latest available end timestamp
  if (status === 'completed' || status === 'error') {
    const endMs =
      getTimestampMs(metadata.evalInferEnd) ??
      getTimestampMs(metadata.runInferEnd) ??
      getTimestampMs(metadata.error) ??
      getTimestampMs(metadata.evalInferStart) ??
      getTimestampMs(metadata.runInferStart)
    if (endMs == null) return null
    return formatRuntime(endMs - startMs)
  }

  // For running jobs, compute elapsed time from now
  const currentMs = now ?? Date.now()
  return formatRuntime(currentMs - startMs)
}
