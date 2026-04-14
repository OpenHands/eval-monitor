import React, { useState, useEffect, useMemo } from 'react'
import type { RunMetadata, DayRunGroup, RunListItemStatus } from '../api'
import { getStageStatus, getRuntime, isFinished, getActiveWorkersForInstance } from '../api'
import ExportPathsModal from './ExportPathsModal'

interface RunInfo {
  slug: string
  benchmark: string
  model: string
  jobId: string
  status?: RunListItemStatus
  triggeredBy?: string
  triggerReason?: string
  runtime?: string
}

interface RunListViewProps {
  runs: RunInfo[]
  loading: boolean
  error: string | null
  onSelectRun: (slug: string) => void
  runMetadataMap: Record<string, RunMetadata>
  loadingMetadataList: boolean
  dayGroups: DayRunGroup[]
  filterBenchmark: string
  setFilterBenchmark: (value: string) => void
  filterStatus: string
  setFilterStatus: (value: string) => void
  filterText: string
  setFilterText: (value: string) => void
  showDetail: boolean
}

type StatusType = 'pending' | 'building' | 'running-infer' | 'running-eval' | 'completed' | 'error' | 'cancelled'

const STATUS_CONFIG: Record<StatusType, { label: string; className: string; dot?: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  },
  building: {
    label: 'Building',
    className: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    dot: 'bg-violet-400 animate-pulse',
  },
  'running-infer': {
    label: 'Inference',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400 animate-pulse',
  },
  'running-eval': {
    label: 'Eval',
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
  cancelled: {
    label: 'Cancelled',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
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


export default function RunListView({
  runs,
  loading,
  error,
  onSelectRun,
  runMetadataMap,
  loadingMetadataList,
  dayGroups,
  filterBenchmark,
  setFilterBenchmark,
  filterStatus,
  setFilterStatus,
  filterText,
  setFilterText,
  showDetail
}: RunListViewProps) {
  const showMultipleDays = dayGroups.length > 1
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Build a slug-to-date mapping for date grouping
  const slugToDate = useMemo(() => {
    const map: Record<string, string> = {}
    for (const group of dayGroups) {
      for (const item of group.runs) {
        map[item.slug] = group.date
      }
    }
    return map
  }, [dayGroups])
  const [now, setNow] = useState(Date.now())

  // Check if any run is non-finished to decide whether to tick the timer
  const hasNonFinished = useMemo(() => {
    return runs.some(run => {
      const metadata = runMetadataMap[run.slug]
      return metadata && !isFinished(metadata)
    })
  }, [runs, runMetadataMap])

  // Tick every 1s so elapsed time updates for non-finished runs
  useEffect(() => {
    if (!hasNonFinished) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [hasNonFinished])

  // Compute statuses and runtimes
  // Status and runtime come from JSONL (pre-parsed), metadata only needed for additional details
  const runsWithStatus = useMemo(() => {
    return runs.map(run => {
      const metadata = runMetadataMap[run.slug]
      // Use pre-parsed status from JSONL, only derive from metadata if needed
      const status: StatusType = run.status || (metadata ? getStageStatus(metadata) : 'pending')
      // Use pre-parsed runtime from JSONL if available, otherwise calculate from metadata
      const runtime: string | null = run.runtime || (metadata ? getRuntime(metadata, now) : null)
      const runFinished = metadata ? isFinished(metadata) : (run.status === 'completed' || run.status === 'error' || run.status === 'cancelled')
      // triggeredBy and triggerReason come directly from JSONL (via RunListItem)
      const triggeredBy = run.triggeredBy
      const triggerReason = run.triggerReason
      return { ...run, status, runtime, runFinished, triggeredBy, triggerReason }
    })
  }, [runs, runMetadataMap, now])

  const benchmarks = useMemo(() => [...new Set(runs.map(r => r.benchmark))].sort(), [runs])
  const statuses = useMemo(() => [...new Set(runsWithStatus.map(r => r.status))].sort(), [runsWithStatus])

  // Apply filters
  const filteredRuns = useMemo(() => {
    return runsWithStatus.filter(run => {
      if (filterBenchmark !== 'all' && run.benchmark !== filterBenchmark) return false
      if (filterStatus !== 'all') {
        if (filterStatus === 'active') {
          // Active status: show all non-terminal statuses
          const activeStatuses: StatusType[] = ['pending', 'building', 'running-infer', 'running-eval']
          if (!activeStatuses.includes(run.status)) return false
        } else if (run.status !== filterStatus) {
          return false
        }
      }
      if (filterText) {
        // Split by whitespace or + and filter out empty strings
        const searchTerms = filterText.toLowerCase().split(/[\s+]+/).filter(term => term.length > 0)
        // Combine all searchable fields into one string for matching
        const searchableContent = [
          run.model,
          run.jobId,
          run.benchmark,
          run.triggeredBy,
          run.triggerReason
        ].join(' ').toLowerCase()
        // ALL terms must match (AND logic)
        const allTermsMatch = searchTerms.every(term => searchableContent.includes(term))
        if (!allTermsMatch) return false
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

  // Active workers count and per-author breakdown (from all runs, independent of filters)
  // Only count runs in inference stage (running-infer)
  const { totalActiveWorkers, activeWorkersByAuthor } = useMemo(() => {
    let totalActiveWorkers = 0
    const activeWorkersByAuthor: Record<string, number> = {}
    // Only count runs in running-infer stage
    const inferStatuses: StatusType[] = ['running-infer']
    runsWithStatus.forEach(r => {
      if (inferStatuses.includes(r.status)) {
        const metadata = runMetadataMap[r.slug]
        const workers = metadata ? getActiveWorkersForInstance(metadata) : 20
        totalActiveWorkers += workers
        const author = r.triggeredBy
        if (author && author !== '—') {
          activeWorkersByAuthor[author] = (activeWorkersByAuthor[author] || 0) + workers
        }
      }
    })
    return { totalActiveWorkers, activeWorkersByAuthor }
  }, [runsWithStatus, runMetadataMap])

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
        <div className="flex items-center gap-4 flex-wrap">
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
          {!loadingMetadataList && !showDetail && totalActiveWorkers > 0 && (
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="text-oh-text-muted">
                Active Workers: <span data-testid="total-active-workers" className={`font-bold ${totalActiveWorkers > 256 ? 'text-oh-error' : totalActiveWorkers >= 240 ? 'text-orange-400' : 'text-oh-primary'}`}>{totalActiveWorkers}</span>
              </span>
              {Object.entries(activeWorkersByAuthor).sort((a, b) => b[1] - a[1]).map(([author, count]) => (
                <span key={author} data-testid={`active-workers-author-${author}`} className="text-oh-text-muted">
                  <span className="font-medium text-oh-text">{author}</span>: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search model, job ID, trigger reason…"
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
          <option value="active">Active</option>
          {statuses.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s as StatusType]?.label || s}</option>
          ))}
        </select>
        <button
          onClick={() => { setFilterText(''); setFilterBenchmark('all'); setFilterStatus('all') }}
          disabled={!filterText && filterBenchmark === 'all' && filterStatus === 'all'}
          className="text-xs text-oh-text-muted hover:text-oh-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear filters
        </button>
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="text-xs text-oh-text-muted hover:text-oh-text transition-colors flex items-center gap-1"
          data-testid="export-paths-button"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Export paths
        </button>
        <a
          href="https://eval-monitor-git-legacy-txt-list-openhands.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-oh-text-muted hover:text-oh-text transition-colors"
        >
          Run missing, try legacy Eval Monitor
        </a>
      </div>

      {/* Export Paths Modal */}
      <ExportPathsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        filteredRuns={filteredRuns.map(run => ({ slug: run.slug, jobId: run.jobId }))}
        filterBenchmark={filterBenchmark}
        filterStatus={filterStatus}
        filterText={filterText}
      />

      {/* Table */}
      <div className="bg-oh-surface border border-oh-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-oh-border">
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Benchmark</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Model</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Job ID</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Runtime</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Trigger Reason</th>
                <th className="text-left text-xs font-medium text-oh-text-muted uppercase tracking-wider px-4 py-3">Triggered By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-oh-border">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-oh-text-muted">
                    No runs match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run, index) => {
                  const runDate = slugToDate[run.slug]
                  const prevRunDate = index > 0 ? slugToDate[filteredRuns[index - 1].slug] : null
                  const showDateHeader = showMultipleDays && runDate && runDate !== prevRunDate

                  return (
                    <React.Fragment key={run.slug}>
                      {showDateHeader && (
                        <tr className="bg-oh-bg">
                          <td colSpan={7} className="px-4 py-2">
                            <span className="text-xs font-semibold text-oh-text-muted uppercase tracking-wider">
                              {runDate}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr
                        onClick={(e) => {
                          if (e.altKey || e.ctrlKey || e.metaKey) {
                            const url = new URL(window.location.href)
                            url.searchParams.set('run', run.slug)
                            window.open(url.toString(), '_blank')
                          } else {
                            onSelectRun(run.slug)
                          }
                        }}
                        onAuxClick={(e) => {
                          if (e.button === 1) {
                            const url = new URL(window.location.href)
                            url.searchParams.set('run', run.slug)
                            window.open(url.toString(), '_blank')
                          }
                        }}
                        className="hover:bg-oh-surface-hover cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={run.status} />
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
                            {run.jobId}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {run.runtime ? (
                            <span className={`text-sm font-mono ${run.runFinished ? 'text-oh-text-muted' : 'text-oh-primary'}`}>
                              {run.runtime}
                              {!run.runFinished && <span className="ml-1 text-xs opacity-60">⏱</span>}
                            </span>
                          ) : (
                            <span className="text-sm text-oh-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-oh-text-muted truncate max-w-[200px] inline-block" title={run.triggerReason}>
                            {run.triggerReason}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-oh-text-muted">
                            {run.triggeredBy}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
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
