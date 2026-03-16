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
}

const BENCHMARK_COLORS: Record<string, string> = {
  swebench: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  swebenchmultimodal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  swtbench: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  gaia: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  commit0: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

function BenchmarkBadge({ name }: { name: string }) {
  const colorClass = BENCHMARK_COLORS[name] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {name}
    </span>
  )
}

export default function RunListView({ runs, loading, error, onSelectRun }: RunListViewProps) {
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

  // Group runs by benchmark
  const grouped = runs.reduce<Record<string, RunInfo[]>>((acc, run) => {
    const key = run.benchmark
    if (!acc[key]) acc[key] = []
    acc[key].push(run)
    return acc
  }, {})

  const benchmarks = Object.keys(grouped).sort()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-oh-text-muted">
          {runs.length} evaluation run{runs.length !== 1 ? 's' : ''}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {benchmarks.map(b => (
            <BenchmarkBadge key={b} name={b} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {runs.map((run) => (
          <button
            key={run.slug}
            onClick={() => onSelectRun(run.slug)}
            className="w-full text-left bg-oh-surface hover:bg-oh-surface-hover border border-oh-border rounded-lg p-4 transition-all duration-150 group"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <BenchmarkBadge name={run.benchmark} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-oh-text truncate">
                    {run.model || run.slug}
                  </p>
                  <p className="text-xs text-oh-text-muted mt-0.5">
                    Job #{run.jobId}
                  </p>
                </div>
              </div>
              <svg className="w-4 h-4 text-oh-text-muted group-hover:text-oh-text transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
