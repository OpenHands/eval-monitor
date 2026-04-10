import { EVAL_TIME_CRITICAL_MS, formatDurationMs, parseRunSlug } from '../../api'
import type { EvalTimeReport } from '../../api'
import { Hint, Section, Stat, STATE_STYLES } from '../ClusterHealth/primitives'

interface Props {
  report: EvalTimeReport
  onClose: () => void
  onSelectRun?: (slug: string) => void
}

export default function EvalTimeModal({ report, onClose, onSelectRun }: Props) {
  const styles = STATE_STYLES[report.state]
  const criticalCount = report.entries.filter(e => e.elapsedMs >= EVAL_TIME_CRITICAL_MS).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-oh-surface border border-oh-border rounded-lg max-w-2xl w-full mt-16 p-5 text-sm text-oh-text"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
            <h2 className="text-base font-semibold">Eval Time</h2>
          </div>
          <button onClick={onClose} className="text-oh-text-muted hover:text-oh-text" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <Stat
            label="Active evals"
            value={String(report.totalActive)}
            hint="Total number of evaluation runs currently in a non-finished state (pending, building, running inference, or running evaluation)."
          />
          <Stat
            label="Slow evals"
            value={String(report.entries.length)}
            valueClass={report.entries.length > 0 ? 'text-oh-warning' : 'text-oh-text-muted'}
            hint="Evaluations that have been in their current stage for more than 10 hours. These may be stuck or experiencing issues."
          />
          <Stat
            label="Critical (>24h)"
            value={String(criticalCount)}
            valueClass={criticalCount > 0 ? 'text-oh-error' : 'text-oh-text-muted'}
            hint="Evaluations stuck in a single stage for more than 24 hours. These are almost certainly broken and should be investigated or cancelled."
          />
        </div>

        {report.entries.length === 0 && (
          <div className="text-oh-text-muted text-center py-6">
            All active evaluations are within normal time ranges.
          </div>
        )}

        {report.entries.length > 0 && (
          <Section title={`Slow evaluations (${report.entries.length})`}>
            <div className="space-y-2">
              {report.entries.map(entry => {
                const parsed = parseRunSlug(entry.slug)
                const isCritical = entry.elapsedMs >= EVAL_TIME_CRITICAL_MS
                return (
                  <div
                    key={entry.slug}
                    className={`bg-oh-bg border rounded px-3 py-2 ${isCritical ? 'border-oh-error/50' : 'border-oh-border'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        {onSelectRun ? (
                          <button
                            onClick={() => { onClose(); onSelectRun(entry.slug) }}
                            className="text-oh-primary hover:underline text-left truncate block max-w-full font-mono text-xs"
                            title={entry.slug}
                          >
                            {parsed.benchmark}/{parsed.model}
                          </button>
                        ) : (
                          <span className="font-mono text-xs truncate block" title={entry.slug}>
                            {parsed.benchmark}/{parsed.model}
                          </span>
                        )}
                        <span className="text-[11px] text-oh-text-muted">{parsed.jobId}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-medium ${isCritical ? 'text-oh-error' : 'text-oh-warning'}`}>
                          {formatDurationMs(entry.elapsedMs)}
                        </div>
                        <div className="text-[11px] text-oh-text-muted flex items-center gap-1 justify-end">
                          {entry.stageLabel}
                          <Hint text={`This evaluation has been in the "${entry.stageLabel}" stage for ${formatDurationMs(entry.elapsedMs)}. Warning threshold is 10 hours, critical threshold is 24 hours.`} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
