import { useMemo } from 'react'
import { computeEvalTimeReport } from '../api'
import type { RunMetadata, RunListItem, RunListItemStatus, EvalTimeReport } from '../api'
import { BadgePill, STATE_STYLES } from './ClusterHealth/primitives'
import EvalTimeModal from './EvalTime/EvalTimeModal'

interface Props {
  runMetadataMap: Record<string, RunMetadata>
  runs: RunListItem[]
  isOpen?: boolean
  onToggle?: (open: boolean) => void
  onSelectRun?: (slug: string) => void
}

export default function EvalTimeBadge({ runMetadataMap, runs, isOpen, onToggle, onSelectRun }: Props) {
  const report: EvalTimeReport = useMemo(() => {
    // Build a preStatuses map from runs that already carry a status
    const preStatuses: Record<string, RunListItemStatus> = {}
    for (const run of runs) {
      if (run.status) {
        preStatuses[run.slug] = run.status
      }
    }
    return computeEvalTimeReport(runMetadataMap, preStatuses)
  }, [runMetadataMap, runs])

  const open = isOpen ?? false

  // Show pulsing placeholder only while the initial run list hasn't loaded yet.
  // Once runs are available (even if runMetadataMap is empty because all runs
  // had pre-parsed statuses), show the computed state.
  if (runs.length === 0 && Object.keys(runMetadataMap).length === 0) {
    return <BadgePill dotClass="bg-oh-text-muted" dotPulse label="Eval Time" />
  }

  const { state, entries } = report
  const styles = STATE_STYLES[state]
  const badgeLabel =
    state === 'healthy' ? 'Eval Time: ok'
    : state === 'warning' ? `Eval Time: slow (${entries.length})`
    : `Eval Time: critical (${entries.length})`

  return (
    <>
      <BadgePill
        dotClass={styles.dot}
        labelClass={styles.label}
        label={badgeLabel}
        title={state === 'healthy' ? 'All active evals within normal time' : `${entries.length} eval(s) exceeding time thresholds`}
        onClick={() => onToggle?.(!open)}
      />
      {open && onToggle && (
        <EvalTimeModal
          report={report}
          onClose={() => onToggle(false)}
          onSelectRun={onSelectRun}
        />
      )}
    </>
  )
}
