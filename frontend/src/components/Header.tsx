interface HeaderProps {
  date: string
  onDateChange: (date: string) => void
  onRefresh: () => void
  selectedRun: string | null
  onBack: () => void
}

export default function Header({ date, onDateChange, onRefresh, selectedRun, onBack }: HeaderProps) {
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-oh-primary flex items-center justify-center text-white font-bold text-sm">
                OH
              </div>
              <h1 className="text-lg font-semibold text-oh-text hidden sm:block">
                Eval Monitor
              </h1>
            </div>
          </div>

          {/* Center: Date Navigation */}
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
            </div>
          )}

          {/* Right: Refresh */}
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
    </header>
  )
}
