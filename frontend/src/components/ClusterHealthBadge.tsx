import { useEffect, useState } from 'react'
import { fetchClusterHealth, getClusterHealthState } from '../api'
import type { ClusterHealthReport } from '../api'
import { BadgePill, STATE_STYLES, formatAge } from './ClusterHealth/primitives'
import ClusterHealthModal from './ClusterHealth/ClusterHealthModal'

interface Props {
  refreshNonce: number
}

export default function ClusterHealthBadge({ refreshNonce }: Props) {
  const [report, setReport] = useState<ClusterHealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchClusterHealth()
      .then(r => { if (!cancelled) setReport(r) })
      .catch(() => { if (!cancelled) setReport(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshNonce])

  if (loading && !report) {
    return <BadgePill dotClass="bg-oh-text-muted" dotPulse label="Cluster" />
  }

  if (!report) {
    return <BadgePill dotClass="bg-oh-text-muted" label="Cluster: n/a" title="Cluster health unavailable" />
  }

  const state = getClusterHealthState(report)
  const styles = STATE_STYLES[state]
  const issueCount = report.summary.issues.length
  const badgeLabel =
    state === 'healthy' ? 'Cluster: healthy'
    : state === 'stale' ? `Cluster: stale ${formatAge(report.timestamp)}`
    : state === 'warning' ? `Cluster: warning${issueCount ? ` (${issueCount})` : ''}`
    : `Cluster: critical${issueCount ? ` (${issueCount})` : ''}`

  return (
    <>
      <BadgePill
        dotClass={styles.dot}
        labelClass={styles.label}
        label={badgeLabel}
        title={`Updated ${formatAge(report.timestamp)}`}
        onClick={() => setOpen(true)}
      />
      {open && <ClusterHealthModal report={report} onClose={() => setOpen(false)} />}
    </>
  )
}
