import { parseRunSlug } from '../api'
import type { RunMetadata } from '../api'
import StatusTimeline from './StatusTimeline'
import JsonCard from './JsonCard'
import CompletedRunResults from './CompletedRunResults'

interface RunDetailViewProps {
  slug: string
  metadata: RunMetadata | null
  loading: boolean
  status: 'pending' | 'running-infer' | 'running-eval' | 'completed' | 'error'
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

  return (
    <div className="space-y-6">
      {/* Run Header */}
      <div className="bg-oh-surface border border-oh-border rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h2 className="text-xl font-semibold text-oh-text">{parsed.model}</h2>
            <p className="text-sm text-oh-text-muted mt-1">
              <span className="font-medium">{parsed.benchmark}</span>
              {parsed.jobId && <span> · Job #{parsed.jobId}</span>}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Completed Run Results */}
      {status === 'completed' && <CompletedRunResults slug={slug} />}

      {/* Status Timeline */}
      {metadata && <StatusTimeline metadata={metadata} />}

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <JsonCard title="Init" data={metadata?.init} icon="🚀" />
        <JsonCard title="Parameters" data={metadata?.params} icon="⚙️" />
        <JsonCard title="Run Infer Start" data={metadata?.runInferStart} icon="▶️" />
        <JsonCard title="Run Infer End" data={metadata?.runInferEnd} icon="⏹️" />
        <JsonCard title="Eval Infer Start" data={metadata?.evalInferStart} icon="🔍" />
        <JsonCard title="Eval Infer End" data={metadata?.evalInferEnd} icon="✅" />
        {metadata?.error && (
          <div className="lg:col-span-2">
            <JsonCard title="Error" data={metadata.error} icon="❌" isError />
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'pending': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    'running-infer': 'bg-oh-primary/20 text-oh-primary border-oh-primary/30',
    'running-eval': 'bg-oh-warning/20 text-oh-warning border-oh-warning/30',
    'completed': 'bg-oh-success/20 text-oh-success border-oh-success/30',
    'error': 'bg-oh-error/20 text-oh-error border-oh-error/30',
  }

  const labels: Record<string, string> = {
    'pending': 'Pending',
    'running-infer': 'Running Inference',
    'running-eval': 'Running Evaluation',
    'completed': 'Completed',
    'error': 'Error',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${styles[status] || styles['pending']}`}>
      {(status === 'running-infer' || status === 'running-eval') && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {labels[status] || status}
    </span>
  )
}
