import type { RunMetadata, RunListItem } from '../api'
import ClusterHealthBadge from './ClusterHealthBadge'
import EvalTimeBadge from './EvalTimeBadge'

interface HeaderProps {
  date: string
  onDateChange: (date: string) => void
  onRefresh: () => void
  selectedRun: string | null
  onBack: () => void
  numDays: number
  onNumDaysChange: (days: number) => void
  refreshNonce: number
  clusterHealthOpen: boolean
  onClusterHealthToggle: (open: boolean) => void
  evalTimeOpen: boolean
  onEvalTimeToggle: (open: boolean) => void
  runMetadataMap: Record<string, RunMetadata>
  runs: RunListItem[]
  onSelectRun?: (slug: string) => void
}

export default function Header({ date, onDateChange, onRefresh, selectedRun, onBack, numDays, onNumDaysChange, refreshNonce, clusterHealthOpen, onClusterHealthToggle, evalTimeOpen, onEvalTimeToggle, runMetadataMap, runs, onSelectRun }: HeaderProps) {
  const handlePrevDay = () => {
    const d = new Date(date + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    onDateChange(d.toISOString().split('T')[0])
  }

  const handleNextDay = () => {
    const d = new Date(date + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    onDateChange(d.toISOString().split('T')[0])
  }

  return (
    <header className="bg-oh-surface border-b border-oh-border sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            {selectedRun && (
              <button
                onClick={onBack}
                className="text-oh-text-muted hover:text-oh-text transition-colors mr-2"
                title="Back to run list"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {selectedRun ? (
              <button
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) {
                    window.open('/', '_blank')
                  } else {
                    onBack()
                  }
                }}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                title="Back to run list"
              >
                <img
                  src="/openhands-logo.svg"
                  alt="OpenHands"
                  className="w-8 h-8"
                  data-testid="openhands-logo"
                />
                <h1 className="text-lg font-semibold text-oh-text hidden sm:block">
                  OpenHands Eval Monitor
                </h1>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <img
                  src="/openhands-logo.svg"
                  alt="OpenHands"
                  className="w-8 h-8"
                  data-testid="openhands-logo"
                />
                <h1 className="text-lg font-semibold text-oh-text hidden sm:block">
                  OpenHands Eval Monitor
                </h1>
              </div>
            )}
          </div>

          {/* Center: Date Navigation + Days Selector */}
          {!selectedRun && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevDay}
                className="p-1.5 rounded-lg text-oh-text-muted hover:text-oh-text hover:bg-oh-surface-hover transition-colors"
                title="Previous day"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-oh-bg border border-oh-border rounded-lg px-3 py-1.5 text-sm text-oh-text focus:outline-none focus:border-oh-primary transition-colors"
              />
              <button
                onClick={handleNextDay}
                className="p-1.5 rounded-lg text-oh-text-muted hover:text-oh-text hover:bg-oh-surface-hover transition-colors"
                title="Next day"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <select
                value={numDays}
                onChange={(e) => onNumDaysChange(parseInt(e.target.value, 10))}
                className="bg-oh-bg border border-oh-border rounded-lg px-3 py-1.5 text-sm text-oh-text focus:outline-none focus:border-oh-primary transition-colors ml-2"
                title="Number of days to display"
              >
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'day' : 'days'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Right: Cluster health + Refresh */}
          <div className="flex items-center gap-2">
            {!selectedRun && <ClusterHealthBadge refreshNonce={refreshNonce} isOpen={clusterHealthOpen} onToggle={onClusterHealthToggle} />}
            {!selectedRun && <EvalTimeBadge runMetadataMap={runMetadataMap} runs={runs} isOpen={evalTimeOpen} onToggle={onEvalTimeToggle} onSelectRun={onSelectRun} />}
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg text-oh-text-muted hover:text-oh-text hover:bg-oh-surface-hover transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          </div>
        </div>
      </div>
    </header>
  )
}
