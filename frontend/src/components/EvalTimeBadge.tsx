import { useMemo } from 'react'
import { computeEvalTimeReport } from '../api'
import type { RunListItem, EvalTimeReport } from '../api'
import { BadgePill, STATE_STYLES } from './ClusterHealth/primitives'
import EvalTimeModal from './EvalTime/EvalTimeModal'

interface Props {
  runs: RunListItem[]
  isOpen?: boolean
  onToggle?: (open: boolean) => void
  onSelectRun?: (slug: string) => void
}

export default function EvalTimeBadge({ runs, isOpen, onToggle, onSelectRun }: Props) {
  const report: EvalTimeReport = useMemo(() => computeEvalTimeReport(runs), [runs])

  const open = isOpen ?? false

  if (runs.length === 0) {
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
