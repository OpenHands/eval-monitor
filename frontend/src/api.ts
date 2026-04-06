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
    .reverse()
}

export function getDateNDaysAgo(baseDate: string, n: number): string {
  const d = new Date(baseDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().split('T')[0]
}

export function getDatesForRange(baseDate: string, numDays: number): string[] {
  const dates: string[] = []
  for (let i = 0; i < numDays; i++) {
    dates.push(getDateNDaysAgo(baseDate, i))
  }
  return dates
}

export interface DayRunGroup {
  date: string
  runs: string[]
}

export async function fetchMultiDayRunList(baseDate: string, numDays: number): Promise<DayRunGroup[]> {
  const dates = getDatesForRange(baseDate, numDays)
  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const runs = await fetchRunList(date)
        return { date, runs }
      } catch {
        return { date, runs: [] }
      }
    })
  )
  return results
}

export interface RunMetadata {
  init: Record<string, unknown> | null
  params: Record<string, unknown> | null
  error: Record<string, unknown> | null
  runInferStart: Record<string, unknown> | null
  runInferEnd: Record<string, unknown> | null
  evalInferStart: Record<string, unknown> | null
  evalInferEnd: Record<string, unknown> | null
  cancelEval: Record<string, unknown> | null
}

const METADATA_FILES = [
  ['init', 'init.json'],
  ['params', 'params.json'],
  ['error', 'error.json'],
  ['runInferStart', 'run-infer-start.json'],
  ['runInferEnd', 'run-infer-end.json'],
  ['evalInferStart', 'eval-infer-start.json'],
  ['evalInferEnd', 'eval-infer-end.json'],
  ['cancelEval', 'cancel-eval.json'],
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

/** Synthesize a `build_action` field from `github_run_id` and `model_id` if not already present.
 *  Format: dispatch-{github_run_id}-{first 10 chars of model_id with dots replaced by hyphens}
 *  inserting it immediately after `sdk_commit` so it appears under it in the UI. */
export function augmentParams(params: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!params) return params
  if (params.build_action || !params.github_run_id || typeof params.github_run_id !== 'string') return params

  const modelId = typeof params.model_id === 'string' ? params.model_id.replace(/\./g, '-').slice(0, 10) : ''
  const buildAction = modelId ? `dispatch-${params.github_run_id}-${modelId}` : `dispatch-${params.github_run_id}`
  const augmented: Record<string, unknown> = {}
  let inserted = false
  for (const [key, value] of Object.entries(params)) {
    augmented[key] = value
    if (key === 'sdk_commit' && !inserted) {
      augmented['build_action'] = buildAction
      inserted = true
    }
  }
  if (!inserted) augmented['build_action'] = buildAction
  return augmented
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
  metadata['params'] = augmentParams(metadata['params'])
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

export function getStageStatus(metadata: RunMetadata): 'pending' | 'building' | 'running-infer' | 'running-eval' | 'completed' | 'error' | 'cancelled' {
  if (metadata.cancelEval) return 'cancelled'
  if (metadata.error) return 'error'
  if (metadata.evalInferEnd) return 'completed'
  if (metadata.evalInferStart) return 'running-eval'
  if (metadata.runInferEnd) return 'running-eval'
  if (metadata.runInferStart) return 'running-infer'
  if (metadata.init) return 'pending'
  if (metadata.params) return 'building'
  return 'pending'
}

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

  const v2Data = await fetchJson(`${BASE_URL}/${cleanSlug}/cost_report_v2.json`)
  if (v2Data) {
    const summary = (v2Data.summary as CostReportSummary) || null
    return { summary, fullUrl: getResultsUrl(cleanSlug, 'cost_report_v2.json') }
  }

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

function getTimestampMs(data: Record<string, unknown> | null): number | null {
  if (!data) return null
  const ts = data.timestamp as string | undefined
  if (!ts) return null
  const ms = new Date(ts).getTime()
  return isNaN(ms) ? null : ms
}

export function getStartTimestamp(metadata: RunMetadata): number | null {
  return getTimestampMs(metadata.params)
}

export function getEndTimestamp(metadata: RunMetadata): number | null {
  const status = getStageStatus(metadata)
  if (status === 'completed') {
    return getTimestampMs(metadata.evalInferEnd) ?? null
  }
  if (status === 'cancelled') {
    return getTimestampMs(metadata.cancelEval) ?? null
  }
  if (status === 'error') {
    return getTimestampMs(metadata.error)
      ?? getTimestampMs(metadata.evalInferStart)
      ?? getTimestampMs(metadata.runInferEnd)
      ?? getTimestampMs(metadata.runInferStart)
      ?? getTimestampMs(metadata.init)
      ?? null
  }
  return null
}

export function isFinished(metadata: RunMetadata): boolean {
  const status = getStageStatus(metadata)
  return status === 'completed' || status === 'error' || status === 'cancelled'
}

export function extractCancelledBy(cancelEval: Record<string, unknown> | null): string {
  if (!cancelEval) return '—'
  const CANCEL_KEYS = ['cancelled_by', 'actor', 'user', 'github_actor', 'sender']
  for (const key of CANCEL_KEYS) {
    if (cancelEval[key] && typeof cancelEval[key] === 'string') return cancelEval[key] as string
  }
  return '—'
}

export function formatDurationMs(ms: number): string {
  if (ms < 0) return '—'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

export function extractTriggeredBy(metadata: RunMetadata | undefined): string {
  if (!metadata) return '—'
  const TRIGGER_KEYS = ['triggered_by', 'actor', 'user', 'github_actor', 'sender']
  for (const source of [metadata.params, metadata.init]) {
    if (!source) continue
    for (const key of TRIGGER_KEYS) {
      if (source[key] && typeof source[key] === 'string') return source[key] as string
    }
  }
  return '—'
}

export function extractTriggerReason(metadata: RunMetadata | undefined): string {
  if (!metadata) return '—'
  const REASON_KEYS = ['trigger_reason', 'event_name', 'event_type']
  for (const source of [metadata.params, metadata.init]) {
    if (!source) continue
    for (const key of REASON_KEYS) {
      if (source[key] && typeof source[key] === 'string') return source[key] as string
    }
  }
  return '—'
}

export function getRuntime(metadata: RunMetadata, now: number = Date.now()): string | null {
  const start = getStartTimestamp(metadata)
  if (start === null) return null

  const finished = isFinished(metadata)
  const end = finished ? getEndTimestamp(metadata) : now
  if (end === null) return null

  return formatDurationMs(end - start)
}

export async function fetchErrorReport(slug: string): Promise<string | null> {
  const cleanSlug = slug.replace(/\/$/, '')
  try {
    const res = await fetch(`${BASE_URL}/${cleanSlug}/conversation-error-report.txt`)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export interface SubmissionData {
  timestamp: string
  url: string
}

export async function fetchSubmissionData(slug: string): Promise<SubmissionData | null> {
  const cleanSlug = slug.replace(/\/$/, '')
  const data = await fetchJson(`${BASE_URL}/${cleanSlug}/metadata/submission.json`)
  if (!data || typeof data.url !== 'string') return null
  return {
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : '',
    url: data.url,
  }
}

/** Calculate active workers for a single instance based on its metadata.
 *  active_workers = if num_infer_workers != null then num_infer_workers
 *                   else if eval_limit <= 20 then eval_limit
 *                   else 20
 */
export function getActiveWorkersForInstance(metadata: RunMetadata): number {
  const params = metadata.params
  if (params) {
    const numInferWorkers = params.num_infer_workers
    const evalLimit = params.eval_limit
    // Handle both number and string types (JSON might have numbers as strings)
    const parsedNumInferWorkers = numInferWorkers !== null && numInferWorkers !== undefined 
      ? Number(numInferWorkers) 
      : null
    const parsedEvalLimit = evalLimit !== null && evalLimit !== undefined 
      ? Number(evalLimit) 
      : null
    const hasNumInferWorkers = parsedNumInferWorkers !== null && !isNaN(parsedNumInferWorkers)
    const hasEvalLimit = parsedEvalLimit !== null && !isNaN(parsedEvalLimit)
    
    if (hasNumInferWorkers) {
      return parsedNumInferWorkers!
    }
    if (hasEvalLimit) {
      // eval_limit is capped at 20
      return Math.min(parsedEvalLimit!, 20)
    }
  }
  return 20
}
