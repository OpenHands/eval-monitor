const BASE_URL = '/api'
const RESULTS_BASE_URL = 'https://results.eval.all-hands.dev'

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

export type StageItemStatus = 'completed' | 'active' | 'pending' | 'error'

export interface StageStatuses {
  init: StageItemStatus
  runInferStart: StageItemStatus
  runInferEnd: StageItemStatus
  evalInferStart: StageItemStatus
  evalInferEnd: StageItemStatus
}

const STAGE_KEYS: (keyof StageStatuses)[] = [
  'init',
  'runInferStart',
  'runInferEnd',
  'evalInferStart',
  'evalInferEnd',
]

export function getResultsUrl(slug: string, file: string): string {
  return `${RESULTS_BASE_URL}/${slug.replace(/\/$/, '')}/${file}`
}

export interface OutputReport {
  scalarFields: Record<string, unknown>
  hasListFields: boolean
  fullUrl: string
}

export async function fetchOutputReport(slug: string): Promise<OutputReport | null> {
  const cleanSlug = slug.replace(/\/$/, '')
  const data = await fetchJson(`${BASE_URL}/${cleanSlug}/output.report.json`)
  if (!data) return null
  const scalarFields: Record<string, unknown> = {}
  let hasListFields = false
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      hasListFields = true
    } else {
      scalarFields[key] = value
    }
  }
  return { scalarFields, hasListFields, fullUrl: getResultsUrl(cleanSlug, 'output.report.json') }
}

export interface CostReportSummary {
  total_cost: number
  total_duration: number
  only_main_output_cost: number
  sum_critic_files: number
}

export interface CostReport {
  summary: CostReportSummary | null
  fullUrl: string
}

export async function fetchCostReport(slug: string): Promise<CostReport | null> {
  const cleanSlug = slug.replace(/\/$/, '')
  const data = await fetchJson(`${BASE_URL}/${cleanSlug}/cost_report.jsonl`)
  if (!data) return null
  const summary = (data.summary as CostReportSummary) || null
  return { summary, fullUrl: getResultsUrl(cleanSlug, 'cost_report.jsonl') }
}

export function filterScalarFields(data: Record<string, unknown>): { scalarFields: Record<string, unknown>; hasListFields: boolean } {
  const scalarFields: Record<string, unknown> = {}
  let hasListFields = false
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      hasListFields = true
    } else {
      scalarFields[key] = value
    }
  }
  return { scalarFields, hasListFields }
}

export function getStageStatuses(metadata: RunMetadata): StageStatuses {
  const hasError = !!metadata.error
  const metadataKeys: Record<keyof StageStatuses, keyof RunMetadata> = {
    init: 'init',
    runInferStart: 'runInferStart',
    runInferEnd: 'runInferEnd',
    evalInferStart: 'evalInferStart',
    evalInferEnd: 'evalInferEnd',
  }

  // Find the last present stage to determine which is "active"
  let lastPresentIndex = -1
  for (let i = STAGE_KEYS.length - 1; i >= 0; i--) {
    if (metadata[metadataKeys[STAGE_KEYS[i]]] !== null) {
      lastPresentIndex = i
      break
    }
  }

  const statuses: Partial<StageStatuses> = {}
  for (let i = 0; i < STAGE_KEYS.length; i++) {
    const key = STAGE_KEYS[i]
    const present = metadata[metadataKeys[key]] !== null

    if (present) {
      // If this is the last present stage and the overall run is not completed, it's "active"
      // unless there's an error
      if (i === lastPresentIndex && !metadata.evalInferEnd) {
        statuses[key] = hasError ? 'error' : 'active'
      } else {
        statuses[key] = 'completed'
      }
    } else {
      statuses[key] = 'pending'
    }
  }

  return statuses as StageStatuses
}
