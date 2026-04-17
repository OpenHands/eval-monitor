import { useMemo } from 'react'
import type { RunListItem, RunMetadata, RunListItemStatus } from '../api'
import { getActiveWorkersForInstance } from '../api'
import { BadgePill } from './ClusterHealth/primitives'
import ActiveWorkersModal from './ActiveWorkers/ActiveWorkersModal'

interface Props {
  runMetadataMap: Record<string, RunMetadata>
  runs: RunListItem[]
  isOpen?: boolean
  onToggle?: (open: boolean) => void
}

export default function ActiveWorkersBadge({ runMetadataMap, runs, isOpen, onToggle }: Props) {
  const { totalActiveWorkers, activeWorkersByAuthor } = useMemo(() => {
    let totalActiveWorkers = 0
    const activeWorkersByAuthor: Record<string, number> = {}
    // Only count runs in running-infer stage
    const inferStatuses: RunListItemStatus[] = ['running-infer']
    
    runs.forEach(r => {
      if (r.status && inferStatuses.includes(r.status)) {
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
  }, [runs, runMetadataMap])

  // Show pulsing placeholder when runs haven't loaded yet
  if (runs.length === 0 && Object.keys(runMetadataMap).length === 0) {
    return <BadgePill dotClass="bg-oh-text-muted" dotPulse label="Active workers" />
  }

  // If no active workers, show a neutral badge but don't make it clickable
  if (totalActiveWorkers === 0) {
    return <BadgePill dotClass="bg-oh-text-muted" label="Active workers: 0" />
  }

  // Determine color based on worker count thresholds
  const dotClass = totalActiveWorkers > 256 
    ? 'bg-oh-error' 
    : totalActiveWorkers >= 240 
      ? 'bg-orange-400' 
      : 'bg-oh-primary'

  return (
    <>
      <BadgePill
        dotClass={dotClass}
        label={`Active workers: ${totalActiveWorkers}`}
        onClick={() => onToggle?.(!isOpen)}
      />
      {isOpen && onToggle && (
        <ActiveWorkersModal
          totalActiveWorkers={totalActiveWorkers}
          activeWorkersByAuthor={activeWorkersByAuthor}
          onClose={() => onToggle(false)}
        />
      )}
    </>
  )
}