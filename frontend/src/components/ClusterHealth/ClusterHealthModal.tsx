import { getClusterHealthState, ZOMBIE_POD_STATES } from '../../api'
import type { ClusterHealthReport, ClusterHealthPodProblem } from '../../api'
import { Hint, Section, Stat, STATE_STYLES, UsageBar, formatAge, formatTimestamp } from './primitives'

// Always-visible placeholder boxes for the most diagnostic problem states.
// Each box owns its own count function so the data table is self-contained
// (no special-case branching at the call site).
const PROBLEM_STATE_BOXES: Array<{
  label: string
  count: (problems: ClusterHealthPodProblem[]) => number
  hint: string
}> = [
  {
    label: 'OOMKilled',
    count: ps => ps.filter(p => p.state === 'OOMKilled').length,
    hint: 'Pods whose container was killed by the Linux kernel out-of-memory killer. Almost always means the workload exceeded its memory limit and needs more headroom or a leak fix.',
  },
  {
    label: 'CrashLoopBackOff',
    count: ps => ps.filter(p => p.state === 'CrashLoopBackOff').length,
    hint: 'Containers that keep crashing on startup. Kubernetes adds an exponential delay between restarts. Indicates a persistent failure — bad config, missing dependency, panic on init, etc.',
  },
  {
    label: 'Terminating',
    count: ps => ps.filter(p => p.state === 'Terminating').length,
    hint: 'Pods stuck in the Terminating state past the collector threshold — deletion was requested but kubelet or a finalizer is blocking it. Usually safe to force-delete after investigation.',
  },
  {
    label: 'Zombies',
    count: ps => ps.filter(p => ZOMBIE_POD_STATES.has(p.state)).length,
    hint: 'Sum of Terminating and Unknown pods — pods that should be gone or recovered but linger in a half-dead state. Tracked together because both represent failed cleanup, not active workload.',
  },
]

interface Props {
  report: ClusterHealthReport
  onClose: () => void
}

export default function ClusterHealthModal({ report, onClose }: Props) {
  const state = getClusterHealthState(report)
  const styles = STATE_STYLES[state]

  const pressureEntries: Array<[string, string[]]> = [
    ['memory', report.nodes.pressure.memory],
    ['disk', report.nodes.pressure.disk],
    ['pid', report.nodes.pressure.pid],
  ]
  const hasPressure = pressureEntries.some(([, list]) => list.length > 0)

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
            <h2 className="text-base font-semibold">Cluster Health</h2>
            <span className="text-xs text-oh-text-muted font-mono">{formatTimestamp(report.timestamp)}</span>
            <span className="text-xs text-oh-text-muted">({formatAge(report.timestamp)})</span>
          </div>
          <button onClick={onClose} className="text-oh-text-muted hover:text-oh-text" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-xs text-oh-text-muted mb-3 flex items-center">
          namespace: <span className="text-oh-text ml-1">{report.pods.namespace}</span>
          <Hint text="The Kubernetes namespace this report covers. Eval orchestrator pods (the harness driving each benchmark run) live here. Runtime sandbox pods live in a separate runtime-pods namespace and are reported lower down." />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <Stat
            label="Nodes ready"
            value={`${report.nodes.ready} / ${report.nodes.total}`}
            hint="Nodes in Kubernetes Ready condition vs total nodes in the cluster. A node is Ready when kubelet reports healthy and can accept pods. Anything less than total means the cluster has lost capacity."
          />
          <Stat
            label="Orchestrator pods"
            value={`${report.pods.phases.Running ?? 0} / ${report.pods.total}`}
            hint="Pods in the evaluation-jobs namespace, one per evaluation run. Each runs the harness that drives a benchmark (swebench, swtbench, etc.) for a specific model. Shows running / total — total includes pending, failed, succeeded, and unknown."
          />
          <Stat
            label="Pods pending"
            value={String(report.pods.phases.Pending ?? 0)}
            hint="Eval orchestrator pods stuck in the Pending phase — typically waiting for a node with enough capacity, a missing image, or an unbound PVC. A growing pending count usually means the cluster is full."
          />
          <Stat
            label="Problem pods"
            value={String(report.pods.problems.length)}
            hint="Total count of evaluation-jobs pods the collector has flagged with a known failure state — OOMKilled, CrashLoopBackOff, Error, Evicted, ImagePullBackOff, or stuck Pending/Terminating. The breakdown by state is in the row below."
          />
          <Stat
            label="Instance pods"
            value={`${report.runtime_pods.running} / ${report.runtime_pods.total}`}
            hint="Pods in the runtime-pods namespace — sandboxed runtime containers spawned by the orchestrator pods so the agent can edit files and run code in isolation. They come and go as the agent works through instances. Shows running / total."
          />
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {PROBLEM_STATE_BOXES.map(({ label, count, hint }) => {
            const n = count(report.pods.problems)
            return (
              <Stat
                key={label}
                label={label}
                value={String(n)}
                valueClass={n > 0 ? 'text-oh-error' : 'text-oh-text-muted'}
                hint={hint}
              />
            )
          })}
        </div>

        {hasPressure && (
          <Section title="Node pressure">
            <ul className="text-oh-text-muted space-y-0.5">
              {pressureEntries
                .filter(([, list]) => list.length > 0)
                .map(([type, list]) => (
                  <li key={type}>
                    <span className="text-oh-warning">{type}:</span> {list.join(', ')}
                  </li>
                ))}
            </ul>
          </Section>
        )}

        {report.nodes.resources.length > 0 && (
          <Section title="Node utilization">
            <div className="space-y-1.5">
              {report.nodes.resources.map(n => (
                <div key={n.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                  <div className="text-xs font-mono text-oh-text truncate" title={n.name}>
                    {n.name}
                  </div>
                  <UsageBar label="cpu" pct={n.cpu_reserved_percent} />
                  <UsageBar label="mem" pct={n.memory_reserved_percent} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {report.summary.issues.length > 0 && (
          <Section title={`Issues (${report.summary.issues.length})`}>
            <ul className="list-disc list-inside text-oh-text-muted space-y-0.5">
              {report.summary.issues.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          </Section>
        )}

        {report.pods.problems.length > 0 && (
          <Section title="Problem pods">
            <ul className="space-y-1 text-oh-text-muted">
              {report.pods.problems.slice(0, 10).map((p, idx) => (
                <li key={idx}>
                  <span className="text-oh-text">{p.name}</span> — {p.state}
                  {p.restarts ? ` (${p.restarts} restarts)` : ''}
                </li>
              ))}
              {report.pods.problems.length > 10 && (
                <li className="italic">+{report.pods.problems.length - 10} more</li>
              )}
            </ul>
          </Section>
        )}

        {report.events.failed_scheduling.length > 0 && (
          <Section title={`Failed scheduling (${report.events.failed_scheduling.length})`}>
            <ul className="space-y-1 text-oh-text-muted">
              {report.events.failed_scheduling.slice(0, 5).map((e, idx) => (
                <li key={idx}>
                  <span className="text-oh-text">{e.name}</span>
                  {e.reason ? <> — <span className="text-oh-warning">{e.reason}</span></> : null}
                  {e.message ? <>: {e.message}</> : null}
                  {e.count && e.count > 1 ? ` (${e.count}×)` : ''}
                </li>
              ))}
              {report.events.failed_scheduling.length > 5 && (
                <li className="italic">+{report.events.failed_scheduling.length - 5} more</li>
              )}
            </ul>
          </Section>
        )}

        {Object.keys(report.events.warnings_summary).length > 0 && (
          <Section title="Warnings">
            <ul className="text-oh-text-muted">
              {Object.entries(report.events.warnings_summary).map(([reason, count]) => (
                <li key={reason}>{reason}: {count}</li>
              ))}
            </ul>
          </Section>
        )}

        {report.pvcs.unbound.length > 0 && (
          <Section title="Unbound PVCs">
            <ul className="text-oh-text-muted">
              {report.pvcs.unbound.map((p, idx) => (
                <li key={idx}>{p.name} ({p.phase})</li>
              ))}
            </ul>
          </Section>
        )}

        {report.summary.errors.length > 0 && (
          <Section title="Collection errors">
            <ul className="list-disc list-inside text-oh-warning">
              {report.summary.errors.map((e, idx) => <li key={idx}>{e}</li>)}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}
