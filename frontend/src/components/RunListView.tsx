import { useState, useMemo } from 'react'
import type { RunMetadata, StageStatuses, StageItemStatus } from '../api'
import { getStageStatus, getStageStatuses } from '../api'

interface RunInfo {
  slug: string
  benchmark: string
  model: string
  jobId: string
}

interface RunListViewProps {
  runs: RunInfo[]
  loading: boolean
  error: string | null
  onSelectRun: (slug: string) => void
  runMetadataMap: Record<string, RunMetadata>
  loadingMetadataList: boolean
}

type StatusType = 'pending' | 'running-infer' | 'running-eval' | 'completed' | 'error'

const STATUS_CONFIG: Record<StatusType, { label: string; className: string; dot?: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  },
  'running-infer': {
    label: 'Running Inference',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400 animate-pulse',
  },
  'running-eval': {
    label: 'Running Eval',
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400 animate-pulse',
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  error: {
    label: 'Error',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
}

const BENCHMARK_COLORS: Record<string, string> = {
  swebench: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  swebenchmultimodal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  swtbench: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  gaia: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  commit0: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

function StatusBadge({ status }: { status: StatusType }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.dot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      {status === 'completed' && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'error' && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {config.label}
    </span>
  )
}

function BenchmarkBadge({ name }: { name: string }) {
  const colorClass = BENCHMARK_COLORS[name] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {name}
    </span>
  )
}

const STAGE_DOT_COLORS: Record<StageItemStatus, string> = {
  completed: 'bg-emerald-400',
  active: 'bg-blue-400 animate-pulse',
  pending: 'bg-gray-600',
  error: 'bg-red-400',
}

const STAGE_LABELS: { key: keyof StageStatuses; label: string }[] = [
  { key: 'init', label: 'Init' },
  { key: 'runInferStart', label: 'Run Infer Start' },
  { key: 'runInferEnd', label: 'Run Infer End' },
  { key: 'evalInferStart', label: 'Eval Infer Start' },
  { key: 'evalInferEnd', label: 'Eval Infer End' },
]

function StagesIndicator({ stages }: { stages: StageStatuses | null }) {
  if (!stages) {
    return (
      <div className="flex items-center gap-1">
        {STAGE_LABELS.map(({ key }) => (
          <span key={key} className="w-2 h-2 rounded-full bg-gray-600" title={key} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {STAGE_LABELS.map(({ key, label }) => (
        <span
          key={key}
          className={`w-2 h-2 rounded-full ${STAGE_DOT_COLORS[stages[key]]}`}
          title={`${label}: ${stages[key]}`}
        />
      ))}
    </div>
  )
}

export default function RunListView({ runs, loading, error, onSelectRun, runMetadataMap, loadingMetadataList }: RunListViewProps) {
  const [filterBenchmark, setFilterBenchmark] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterText, setFilterText] = useState('')

  // Compute statuses
  const runsWithStatus = useMemo(() => {
    return runs.map(run => {
      const metadata = runMetadataMap[run.slug]
      const status: StatusType = metadata ? getStageStatus(metadata) : 'pending'
      return { ...run, status }
    })
  }, [runs, runMetadataMap])

  // Get unique benchmarks and statuses for filters
  const benchmarks = useMemo(() => [...new Set(runs.map(r => r.benchmark))].sort(), [runs])
  const statuses = useMemo(() => [...new Set(runsWithStatus.map(r => r.status))].sort(), [runsWithStatus])

  // Apply filters
  const filteredRuns = useMemo(() => {
    return runsWithStatus.filter(run => {
      if (filterBenchmark !== 'all' && run.benchmark !== filterBenchmark) return false
      if (filterStatus !== 'all' && run.status !== filterStatus) return false
      if (filterText) {
        const search = filterText.toLowerCase()
        if (
          !run.model.toLowerCase().includes(search) &&
          !run.jobId.toLowerCase().includes(search) &&
          !run.benchmark.toLowerCase().includes(search)
        ) return false
      }
      return true
    })
  }, [runsWithStatus, filterBenchmark, filterStatus, filterText])

  // Status counts for summary
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    runsWithStatus.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1
    })
    return counts
  }, [runsWithStatus])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-oh-text-muted">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading runs…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-oh-error/10 border border-oh-error/30 rounded-lg px-6 py-4 text-oh-error">
          {error}
        </div>
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-oh-text-muted text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p>No evaluation runs found for this date.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-medium text-oh-text-muted">
          {runs.length} evaluation run{runs.length !== 1 ? 's' : ''}
          {loadingMetadataList && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-oh-text-muted">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              loading statuses…
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
              className={`text-xs px-2 py-1 rounded transition-colors ${filterStatus === status ? 'ring-1 ring-oh-primary' : 'opacity-70 hover:opacity-100'}`}
            >
              <StatusBadge status={status as StatusType} />
              <span className="ml-1 text-oh-text-muted">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search model, job ID, benchmark…"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="bg-oh-surface border border-oh-border rounded-lg px-3 py-1.5 text-sm text-oh-text placeholder-oh-text-muted focus:outline-none focus:ring-1 focus:ring-oh-primary w-64"
        />
        <select
          value={filterBenchmark}
          onChange={e => setFilterBenchmark(e.target.value)}
          className="bg-oh-surface border border-oh-border rounded-lg px-3 py-1.5 text-sm text-oh-text focus:outline-none focus:ring-1 focus:ring-oh-primary"
        >
          <option value="all">All benchmarks</option>
          {benchmarks.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-oh-surface border border-oh-border rounded-lg px-3 py-1.5 text-sm text-oh-text focus:outline-none focus:ring-1 focus:ring-oh-primary"
        >
          <option value="all">All statuses</option>
          {statuses.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s as StatusType]?.label || s}</option>
          ))}
        </select>
        {(filterText || filterBenchmark !== 'all' || filterStatus !== 'all') && (
          <button
            onClick={() => { setFilterText(''); setFilterBenchmark('all'); setFilterStatus('all') }}
            className="text-xs text-oh-text-muted hover:text-oh-text transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-oh-surface border border-oh-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-oh-border">
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Stages</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Benchmark</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Model</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Job ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-oh-border">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-oh-text-muted">
                    No runs match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRuns.map(run => {
                  const metadata = runMetadataMap[run.slug]
                  const stages = metadata ? getStageStatuses(metadata) : null
                  return (
                    <tr
                      key={run.slug}
                      onClick={() => onSelectRun(run.slug)}
                      className="hover:bg-oh-surface-hover cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StagesIndicator stages={stages} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <BenchmarkBadge name={run.benchmark} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-oh-text group-hover:text-oh-primary transition-colors">
                          {run.model || run.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-oh-text-muted font-mono">
                          #{run.jobId}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRuns.length !== runs.length && (
        <p className="text-xs text-oh-text-muted text-center">
          Showing {filteredRuns.length} of {runs.length} runs
        </p>
      )}
    </div>
  )
}
