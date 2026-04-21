const BASE_URL = '/api'
const RESULTS_BASE_URL = 'https://results.eval.all-hands.dev'

export type RunListItemStatus = 'pending' | 'building' | 'running-infer' | 'running-eval' | 'completed' | 'error' | 'cancelled'

export interface RunListItem {
  slug: string
  status?: RunListItemStatus
  triggeredBy?: string
  triggerReason?: string
  model?: string
  runtime?: string
}

const VALID_STATUSES = new Set([
  'pending',
  'building',
  'running-infer',
  'running-eval',
  'completed',
  'error',
  'cancelled',
])

/** Map status from JSONL format to RunListItemStatus.
 *  Only returns a status if it's a known status value. */
function mapStatus(status: string | undefined): RunListItemStatus | undefined {
  if (!status) return undefined
  // Map JSONL status values to our canonical status
  if (status === 'cancel') return 'cancelled'
  if (status === 'inferring') return 'running-infer'
  if (status === 'evaluating') return 'running-eval'
  if (status === 'init') return 'building'
  if (VALID_STATUSES.has(status)) return status as RunListItemStatus
  return undefined
}

/** Parse a single line from the JSONL run list file.
 *  The JSONL file has "path" field for slug and "status" for the status.
 *  Some entries may not have "path" - those use "github_run_id" instead. */
interface JsonlRunItem {
  path?: string
  status?: string
  triggered_by?: string
  trigger_reason?: string
  github_run_id?: string
  benchmark?: string
  model_display_name?: string
  model_name?: string
  model_id?: string
  init_timestamp?: string
  end_timestamp?: string
}

export async function fetchRunList(date: string): Promise<RunListItem[]> {
  const cacheBust = Math.floor(Date.now() / 1000)
  const res = await fetch(`${BASE_URL}/metadata/${date}.jsonl?${cacheBust}`)
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Failed to fetch run list: ${res.status}`)
  }
  const text = await res.text()
  const items: RunListItem[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const item = JSON.parse(trimmed) as JsonlRunItem
      let slug = item.path
      // Some entries may not have path; construct from model_name and github_run_id
      if (!slug && item.github_run_id) {
        const benchmark = item.benchmark || 'unknown'
        // Replace / and . with - in model_name to match folder structure
        const modelName = item.model_name ? item.model_name.replace(/[\/\.]/g, '-') : 'unknown'
        slug = `${benchmark}/${modelName}/${item.github_run_id}/`
      }
      if (slug) {
        // Extract model from path for entries with path, otherwise use model_id from JSONL
        let model: string | undefined
        if (item.path) {
          const parsed = parseRunSlug(item.path)
          model = parsed.model
        } else if (item.model_id) {
          model = item.model_id
        }
        // Calculate runtime from JSONL timestamps
        let runtime: string | undefined
        if (item.init_timestamp) {
          const start = new Date(item.init_timestamp).getTime()
          const end = item.end_timestamp ? new Date(item.end_timestamp).getTime() : Date.now()
          runtime = formatDurationMs(end - start)
        }
        items.push({
          slug,
          status: mapStatus(item.status),
          triggeredBy: item.triggered_by || undefined,
          triggerReason: item.trigger_reason || undefined,
          model,
          runtime,
        })
      }
    } catch {
      // Skip invalid JSON lines
    }
  }
  return items.reverse()
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
  runs: RunListItem[]
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

/** Get the partial archive URL from metadata.
 *  Returns the partial_archive_url if it exists and is non-empty.
 *  If it's a full URL, extracts just the path portion.
 */
export function getPartialArchiveUrl(metadata: RunMetadata | null): string | null {
  if (!metadata?.params) return null
  const partialArchiveUrl = metadata.params.partial_archive_url
  if (typeof partialArchiveUrl !== 'string' || !partialArchiveUrl) return null
  
  // If it's a full URL, extract the path portion
  try {
    const url = new URL(partialArchiveUrl)
    return url.pathname.replace(/^\//, '') // Remove leading slash
  } catch {
    // If URL parsing fails, return as-is (might be just a path)
    return partialArchiveUrl
  }
}

/** Extract the benchmark/model path from a partial_archive_url.
 *  For example:
 *  Input: "swtbench/litellm_proxy-minimax-MiniMax-M2-7/24039895569/results.tar.gz"
 *  Output: "swtbench/litellm_proxy-minimax-MiniMax-M2-7"
 */
export function extractBenchmarkModelFromPartialArchiveUrl(partialArchiveUrl: string | null | undefined): string | null {
  if (!partialArchiveUrl || typeof partialArchiveUrl !== 'string') return null
  
  // Pattern to match: benchmark/model/timestamp/anything
  // Extract benchmark/model by removing the timestamp and everything after
  const match = partialArchiveUrl.match(/^(.+?)\/\d+\//)
  if (!match) return null
  
  return match[1]
}

/** Check if a run is a resumed run by looking for partial_archive_url in params.
 *  A resumed run has a partial_archive_url that points to another run's results.
 */
export function isResumedRun(metadata: RunMetadata | null): boolean {
  const partialArchiveUrl = getPartialArchiveUrl(metadata)
  return partialArchiveUrl !== null
}

/** Get the original run's slug from a partial_archive_url.
 *  The partial_archive_url contains information about where the partial results came from.
 *  We need to extract the benchmark/model path and find the original timestamp.
 *  
 *  The original timestamp is stored in params.original_run_id or can be inferred
 *  from the partial_archive_url structure.
 */
export function getOriginalRunSlug(metadata: RunMetadata | null, _currentSlug: string): string | null {
  if (!metadata?.params) return null
  
  // Check for original_run_id in params (this is the most reliable source)
  const originalRunId = metadata.params.original_run_id
  if (typeof originalRunId === 'string' && originalRunId) {
    // The original_run_id should be the full slug (benchmark/model/timestamp)
    return originalRunId
  }
  
  // If original_run_id is not available, try to construct from partial_archive_url
  const partialArchiveUrl = getPartialArchiveUrl(metadata)
  if (!partialArchiveUrl) return null
  
  // Extract benchmark/model from partial_archive_url
  const benchmarkModel = extractBenchmarkModelFromPartialArchiveUrl(partialArchiveUrl)
  if (!benchmarkModel) return null
  
  // The original timestamp might be in params.original_timestamp
  const originalTimestamp = metadata.params.original_timestamp
  if (typeof originalTimestamp === 'string' && originalTimestamp) {
    return `${benchmarkModel}/${originalTimestamp}`
  }
  
  // Try to get timestamp from params.github_run_id if it's actually a timestamp
  const githubRunId = metadata.params.github_run_id
  if (typeof githubRunId === 'string' && githubRunId && /^\d+$/.test(githubRunId)) {
    return `${benchmarkModel}/${githubRunId}`
  }
  
  return null
}

/** Build the eval monitor URL for the original run.
 *  Constructs the monitor URL with the original run slug and text filter.
 */
export interface ClusterHealthSummary {
  healthy: boolean
  issues: string[]
  errors: string[]
}

export interface ClusterHealthPodPhases {
  Running?: number
  Pending?: number
  Failed?: number
  Succeeded?: number
  Unknown?: number
}

export interface ClusterHealthPodProblem {
  name: string
  state: string
  reason?: string
  age_minutes?: number
  restarts?: number
}

export interface ClusterHealthEventEntry {
  name: string
  reason: string
  message: string
  count?: number
  last_seen?: string
}

export interface ClusterHealthReport {
  timestamp: string
  nodes: {
    total: number
    ready: number
    not_ready: number
    pressure: { memory: string[]; disk: string[]; pid: string[] }
    resources: Array<{
      name: string
      cpu_allocatable: number
      cpu_capacity: number
      cpu_reserved_percent: number
      memory_allocatable: number
      memory_capacity: number
      memory_reserved_percent: number
    }>
  }
  pods: {
    namespace: string
    total: number
    phases: ClusterHealthPodPhases
    problems: ClusterHealthPodProblem[]
  }
  events: {
    failed_scheduling: ClusterHealthEventEntry[]
    warnings: ClusterHealthEventEntry[]
    warnings_summary: Record<string, number>
  }
  pvcs: { unbound: Array<{ name: string; phase: string }> }
  runtime_pods: { total: number; running: number }
  summary: ClusterHealthSummary
}

export type ClusterHealthState = 'healthy' | 'warning' | 'critical' | 'stale'

const CLUSTER_HEALTH_STALE_MS = 15 * 60 * 1000

// Pod states that indicate the workload is actively failing — capacity loss
// or hard errors. These trip the "critical" tier.
const CRITICAL_POD_STATES = new Set([
  'OOMKilled',
  'CrashLoopBackOff',
  'CreateContainerError',
  'ImagePullBackOff',
  'ErrImagePull',
  'Error',
  'Evicted',
])

// Pod states that indicate something is *off* but not actively destructive —
// stuck pods, flapping containers. These trip the "warning" tier.
const WARNING_POD_STATES = new Set([
  'Pending',
  'Terminating',
  'Unknown',
  'HighRestartCount',
])

// "Terminating" and "Unknown" pods are stuck in a half-dead state — the
// upstream cluster-health collector groups them as "zombies". Subset of
// WARNING_POD_STATES, exported so the UI can render a single zombie count.
export const ZOMBIE_POD_STATES: ReadonlySet<string> = new Set(['Terminating', 'Unknown'])

export async function fetchClusterHealth(): Promise<ClusterHealthReport | null> {
  const cacheBust = Math.floor(Date.now() / 1000)
  return (await fetchJson(`${BASE_URL}/cluster-health/latest.json?${cacheBust}`)) as ClusterHealthReport | null
}

/** Compute the cluster health severity tier from a report.
 *  Returns 'stale' if data is older than CLUSTER_HEALTH_STALE_MS,
 *  'critical' for capacity loss or hard pod failures,
 *  'warning' for soft issues (PVCs, stuck/flapping pods, partial collector failures),
 *  'healthy' otherwise. */
export function getClusterHealthState(report: ClusterHealthReport, now: number = Date.now()): ClusterHealthState {
  const ts = new Date(report.timestamp).getTime()
  if (!isNaN(ts) && now - ts > CLUSTER_HEALTH_STALE_MS) return 'stale'

  // Critical: lost capacity or pods can't run.
  if (report.nodes.not_ready > 0) return 'critical'
  if (
    report.nodes.pressure.memory.length > 0 ||
    report.nodes.pressure.disk.length > 0 ||
    report.nodes.pressure.pid.length > 0
  ) return 'critical'
  if (report.events.failed_scheduling.length > 0) return 'critical'
  if (report.pods.problems.some(p => CRITICAL_POD_STATES.has(p.state))) return 'critical'

  // Warning: degraded but not capacity-impacting.
  if (report.summary.errors.length > 0) return 'warning'
  if (report.pvcs.unbound.length > 0) return 'warning'
  if (report.pods.problems.some(p => WARNING_POD_STATES.has(p.state))) return 'warning'

  // If the upstream healthy flag is false but nothing matched, surface as warning
  // rather than silently green — there's an unaccounted issue we should see.
  if (!report.summary.healthy) return 'warning'

  return 'healthy'
}

// ---------------------------------------------------------------------------
// Eval Time Health — monitors how long active evals spend in each stage
// ---------------------------------------------------------------------------

export type EvalTimeState = 'healthy' | 'warning' | 'critical'

/** Per-stage warning / critical thresholds (milliseconds). */
export const EVAL_TIME_WARNING_MS = 10 * 60 * 60 * 1000  // 10 hours
export const EVAL_TIME_CRITICAL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface EvalTimeEntry {
  slug: string
  status: RunListItemStatus
  elapsedMs: number
  stageLabel: string
  triggeredBy: string
}

export interface EvalTimeReport {
  entries: EvalTimeEntry[]           // only entries that exceed the warning threshold
  totalActive: number                // total non-finished evals inspected
  state: EvalTimeState
}

/** Human-readable label for the stage an eval is stuck in. */
function stageLabelFor(status: RunListItemStatus): string {
  switch (status) {
    case 'building': return 'Building'
    case 'running-infer': return 'Inference'
    case 'running-eval': return 'Evaluation'
    case 'pending': return 'Pending'
    default: return status
  }
}

/** Return the timestamp (ms) at which the current stage started, or null. */
function stageStartMs(metadata: RunMetadata, status: RunListItemStatus): number | null {
  switch (status) {
    case 'building': return getTimestampMs(metadata.params)
    case 'pending': return getTimestampMs(metadata.init) ?? getTimestampMs(metadata.params)
    case 'running-infer': return getTimestampMs(metadata.runInferStart)
    case 'running-eval': return getTimestampMs(metadata.evalInferStart) ?? getTimestampMs(metadata.runInferEnd)
    default: return null
  }
}

/** Build an EvalTimeReport from all known run metadata.
 *  Only non-finished runs are inspected; only entries exceeding the warning
 *  threshold appear in `entries`. */
export function computeEvalTimeReport(
  metadataMap: Record<string, RunMetadata>,
  preStatuses: Record<string, RunListItemStatus>,
  now: number = Date.now(),
): EvalTimeReport {
  const entries: EvalTimeEntry[] = []
  let totalActive = 0

  for (const [slug, metadata] of Object.entries(metadataMap)) {
    const status = preStatuses[slug] ?? getStageStatus(metadata)
    if (status === 'completed' || status === 'error' || status === 'cancelled') continue
    totalActive++

    const start = stageStartMs(metadata, status)
    if (start === null) continue
    const elapsed = now - start
    if (elapsed >= EVAL_TIME_WARNING_MS) {
      entries.push({ slug, status, elapsedMs: elapsed, stageLabel: stageLabelFor(status), triggeredBy: extractTriggeredBy(metadata) })
    }
  }

  // Sort longest-running first
  entries.sort((a, b) => b.elapsedMs - a.elapsedMs)

  let state: EvalTimeState = 'healthy'
  if (entries.some(e => e.elapsedMs >= EVAL_TIME_CRITICAL_MS)) state = 'critical'
  else if (entries.length > 0) state = 'warning'

  return { entries, totalActive, state }
}

export function buildOriginalRunUrl(_currentUrl: string, originalRunSlug: string): string {
  // Extract the original timestamp from the slug (last part after the last /)
  const parts = originalRunSlug.split('/')
  const originalTimestamp = parts[parts.length - 1]
  
  // Build the monitor URL directly using the current host
  // This avoids issues when window.location.href points to a different domain (e.g., results bucket)
  const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`
  const params = new URLSearchParams()
  params.set('run', originalRunSlug)
  if (originalTimestamp) {
    params.set('text', originalTimestamp)
  }
  return `${baseUrl}?${params.toString()}`
}
