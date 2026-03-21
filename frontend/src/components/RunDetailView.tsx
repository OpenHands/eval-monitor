import { useState } from 'react'
import { parseRunSlug, extractTriggeredBy, extractTriggerReason, extractCancelledBy, getRuntime, isFinished } from '../api'
import type { RunMetadata } from '../api'
import StatusTimeline from './StatusTimeline'
import JsonCard from './JsonCard'
import CompletedRunResults from './CompletedRunResults'

import ErrorReportSection from './ErrorReportSection'

const BENCHMARK_COLORS: Record<string, string> = {
  swebench: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  swebenchmultimodal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  swtbench: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  gaia: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  commit0: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

interface RunDetailViewProps {
  slug: string
  metadata: RunMetadata | null
  loading: boolean
  status: 'pending' | 'building' | 'running-infer' | 'running-eval' | 'completed' | 'error' | 'cancelled'
}

export default function RunDetailView({ slug, metadata, loading, status }: RunDetailViewProps) {
  const parsed = parseRunSlug(slug)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-oh-text-muted">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading metadata…
        </div>
      </div>
    )
  }

  const triggeredBy = metadata ? extractTriggeredBy(metadata) : '—'
  const triggerReason = metadata ? extractTriggerReason(metadata) : '—'
  const runFinished = metadata ? isFinished(metadata) : true
  const runtime = metadata ? getRuntime(metadata) : null

  return (
    <div className="space-y-6">
      {/* Run Header */}
      <div className="bg-oh-surface border border-oh-border rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: model, benchmark + job id, trigger reason */}
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-oh-text">{parsed.model}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <BenchmarkBadge name={parsed.benchmark} />
              {parsed.jobId && <CopyJobId jobId={parsed.jobId} />}
            </div>
            <div className="mt-2 text-sm text-oh-text-muted">
              <span data-testid="trigger-reason">
                <span className="font-medium">Trigger reason:</span> {triggerReason}
              </span>
            </div>
          </div>
          {/* Right: status, runtime, triggered by */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={status} />
            <span data-testid="runtime" className="text-sm text-oh-text-muted">
              {runtime ? (
                <span className={`font-mono ${runFinished ? '' : 'text-oh-primary'}`}>
                  {runtime}
                  {!runFinished && <span className="ml-1 text-xs opacity-60">⏱</span>}
                </span>
              ) : '—'}
            </span>
            <span data-testid="triggered-by" className="text-sm text-oh-text-muted text-right">
              {triggeredBy}
            </span>
          </div>
        </div>
      </div>

      {/* Cancelled Section */}
      {metadata?.cancelEval && (
        <div data-testid="cancelled-section" className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <span className="text-xl">🚫</span>
            <div>
              <h3 className="text-base font-semibold text-orange-400 mb-1">Evaluation Cancelled</h3>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-oh-text-muted">
                {!!metadata.cancelEval.timestamp && (
                  <span data-testid="cancelled-timestamp">
                    <span className="font-medium">Cancelled at:</span>{' '}
                    {new Date(metadata.cancelEval.timestamp as string).toLocaleString()}
                  </span>
                )}
                <span data-testid="cancelled-by">
                  <span className="font-medium">Cancelled by:</span>{' '}
                  {extractCancelledBy(metadata.cancelEval)}
                </span>
                {metadata.cancelEval.kubernetes_jobs_found !== undefined && (
                  <span data-testid="kubernetes-jobs-found">
                    <span className="font-medium">Kubernetes jobs found:</span>{' '}
                    {String(metadata.cancelEval.kubernetes_jobs_found)}
                  </span>
                )}
                {metadata.cancelEval.helm_releases_found !== undefined && (
                  <span data-testid="helm-releases-found">
                    <span className="font-medium">Helm releases found:</span>{' '}
                    {String(metadata.cancelEval.helm_releases_found)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Section */}
      {metadata?.error && (
        <div data-testid="error-section">
          <JsonCard title="Error" data={metadata.error} icon="❌" isError />
        </div>
      )}

      {/* Completed Run Results */}
      {status === 'completed' && <CompletedRunResults slug={slug} />}

      {/* Status Timeline */}
      {metadata && <StatusTimeline metadata={metadata} />}

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ErrorReportSection slug={slug} />
        <JsonCard title="Parameters" data={metadata?.params} icon="⚙️" />
        <JsonCard title="Init" data={metadata?.init} icon="🚀" />
        <JsonCard title="Run Infer Start" data={metadata?.runInferStart} icon="▶️" />
        <JsonCard title="Run Infer End" data={metadata?.runInferEnd} icon="⏹️" />
        <JsonCard title="Eval Infer Start" data={metadata?.evalInferStart} icon="🔍" />
        <JsonCard title="Eval Infer End" data={metadata?.evalInferEnd} icon="✅" />
      </div>

      {/* Cancel Evaluation Section */}
      {!runFinished && parsed.jobId && (
        <CancelEvaluationSection jobId={parsed.jobId} />
      )}
    </div>
  )
}

const KILL_WORKFLOW_URL = 'https://github.com/OpenHands/evaluation/actions/workflows/kill-eval-job.yml'

function CancelEvaluationSection({ jobId }: { jobId: string }) {
  const handleClick = async () => {
    await navigator.clipboard.writeText(jobId)
    window.open(KILL_WORKFLOW_URL, '_blank')
  }

  return (
    <div data-testid="cancel-evaluation-section" className="bg-oh-surface border border-oh-border rounded-lg p-5">
      <h3 className="text-lg font-semibold text-oh-text mb-3">Cancel Evaluation</h3>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white transition-colors cursor-pointer"
      >
        Copy Id and Open Cancel Action
      </button>
    </div>
  )
}

function BenchmarkBadge({ name }: { name: string }) {
  const colorClass = BENCHMARK_COLORS[name] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  return (
    <span data-testid="benchmark-badge" className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {name}
    </span>
  )
}

function CopyJobId({ jobId }: { jobId: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jobId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      data-testid="copy-job-id"
      onClick={handleCopy}
      className="flex items-center gap-1 text-sm text-oh-text-muted font-mono hover:text-oh-text transition-colors cursor-pointer"
      title="Copy to clipboard"
    >
      <span data-testid="job-id">Job {jobId}</span>
      {copied ? (
        <svg className="w-3 h-3 text-oh-success shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'pending': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    'building': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    'running-infer': 'bg-oh-primary/20 text-oh-primary border-oh-primary/30',
    'running-eval': 'bg-oh-warning/20 text-oh-warning border-oh-warning/30',
    'completed': 'bg-oh-success/20 text-oh-success border-oh-success/30',
    'error': 'bg-oh-error/20 text-oh-error border-oh-error/30',
    'cancelled': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }

  const labels: Record<string, string> = {
    'pending': 'Pending',
    'building': 'Building Images',
    'running-infer': 'Running Inference',
    'running-eval': 'Running Evaluation',
    'completed': 'Completed',
    'error': 'Error',
    'cancelled': 'Cancelled',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${styles[status] || styles['pending']}`}>
      {(status === 'building' || status === 'running-infer' || status === 'running-eval') && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {labels[status] || status}
    </span>
  )
}
