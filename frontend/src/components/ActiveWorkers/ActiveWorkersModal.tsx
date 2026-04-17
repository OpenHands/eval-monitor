import { Stat } from '../ClusterHealth/primitives'

interface Props {
  totalActiveWorkers: number
  activeWorkersByAuthor: Record<string, number>
  onClose: () => void
}

export default function ActiveWorkersModal({ totalActiveWorkers, activeWorkersByAuthor, onClose }: Props) {
  const sortedAuthors = Object.entries(activeWorkersByAuthor).sort((a, b) => b[1] - a[1])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-oh-surface border border-oh-border rounded-lg max-w-md w-full mt-16 p-5 text-sm text-oh-text"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Active Workers</h2>
          </div>
          <button onClick={onClose} className="text-oh-text-muted hover:text-oh-text" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 mb-4">
          <Stat
            label="Total active workers"
            value={String(totalActiveWorkers)}
            valueClass={totalActiveWorkers > 256 ? 'text-oh-error' : totalActiveWorkers >= 240 ? 'text-orange-400' : 'text-oh-text'}
          />
        </div>

        {sortedAuthors.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-oh-text-muted mb-2">Workers by developer</h3>
            <div className="space-y-2">
              {sortedAuthors.map(([author, count]) => (
                <div key={author} className="flex items-center justify-between bg-oh-bg border border-oh-border rounded px-3 py-2">
                  <span className="text-oh-text font-medium">{author}</span>
                  <span className="text-oh-text-muted">{count} workers</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sortedAuthors.length === 0 && (
          <div className="text-oh-text-muted text-center py-4">
            No active workers at the moment.
          </div>
        )}
      </div>
    </div>
  )
}