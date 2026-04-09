import type { ClusterHealthState } from '../../api'

/** Dot + label color classes per severity tier. Shared by the header badge
 *  (pill) and the modal (title row). `warning` and `stale` intentionally share
 *  visuals — the semantic distinction is preserved at the type level so we can
 *  diverge later (e.g., a clock icon for stale) without revisiting call sites. */
export const STATE_STYLES: Record<ClusterHealthState, { dot: string; label: string }> = {
  healthy: { dot: 'bg-oh-success', label: 'text-oh-success' },
  warning: { dot: 'bg-oh-warning', label: 'text-oh-warning' },
  critical: { dot: 'bg-oh-error', label: 'text-oh-error' },
  stale: { dot: 'bg-oh-warning', label: 'text-oh-warning' },
}

export function pctColor(pct: number): string {
  if (pct >= 80) return 'text-oh-error'
  if (pct >= 60) return 'text-oh-warning'
  return 'text-oh-text'
}

export function pctBg(pct: number): string {
  if (pct >= 80) return 'bg-oh-error/40'
  if (pct >= 60) return 'bg-oh-warning/40'
  return 'bg-oh-success/30'
}

export function formatAge(timestamp: string, now: number = Date.now()): string {
  const ts = new Date(timestamp).getTime()
  if (isNaN(ts)) return ''
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`
}

export function formatTimestamp(timestamp: string): string {
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return timestamp
  return d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
}

const PILL_BASE = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-oh-bg border border-oh-border text-xs'

/** Pill chrome shared by the loading, error, and live badge variants.
 *  Renders as a button when `onClick` is provided, otherwise as a div. */
export function BadgePill({
  dotClass,
  dotPulse,
  label,
  labelClass,
  title,
  onClick,
}: {
  dotClass: string
  dotPulse?: boolean
  label: string
  labelClass?: string
  title?: string
  onClick?: () => void
}) {
  const dot = <span className={`w-2 h-2 rounded-full ${dotClass} ${dotPulse ? 'animate-pulse' : ''}`} />
  const text = <span className={labelClass ?? 'text-oh-text-muted'}>{label}</span>
  if (onClick) {
    return (
      <button onClick={onClick} className={`${PILL_BASE} hover:bg-oh-surface-hover transition-colors`} title={title}>
        {dot}{text}
      </button>
    )
  }
  return (
    <div className={`${PILL_BASE} text-oh-text-muted`} title={title}>
      {dot}{text}
    </div>
  )
}

/** A compact horizontal usage bar with the percent overlaid. Color-codes by
 *  threshold (>=80% red, >=60% yellow, else green) so high reservation jumps
 *  out at a glance. */
export function UsageBar({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase text-oh-text-muted w-7 text-right">{label}</span>
      <div className="relative w-24 h-4 bg-oh-bg border border-oh-border rounded overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${pctBg(clamped)}`} style={{ width: `${clamped}%` }} />
        <div className={`absolute inset-0 flex items-center justify-end pr-1.5 text-[10px] font-mono ${pctColor(clamped)}`}>
          {clamped.toFixed(1)}%
        </div>
      </div>
    </div>
  )
}

export function Stat({ label, value, valueClass, hint }: { label: string; value: string; valueClass?: string; hint?: string }) {
  return (
    <div className="bg-oh-bg border border-oh-border rounded px-3 py-2">
      <div className="text-xs text-oh-text-muted leading-tight">
        {label}
        {hint && <Hint text={hint} />}
      </div>
      <div className={`text-base font-medium mt-0.5 ${valueClass ?? 'text-oh-text'}`}>{value}</div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-xs uppercase tracking-wide text-oh-text-muted mb-1">{title}</h3>
      {children}
    </div>
  )
}

/** Small "?" icon with a hover tooltip explaining what a metric/label means.
 *  Uses CSS group-hover so it appears instantly with no JS state. */
export function Hint({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1 align-middle">
      <span
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-oh-border text-[9px] text-oh-text-muted cursor-help leading-none select-none"
        aria-label="More info"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-100 absolute z-[60] left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-64 bg-oh-surface border border-oh-border rounded px-2.5 py-1.5 text-xs text-oh-text shadow-lg pointer-events-none whitespace-normal text-left normal-case font-normal tracking-normal leading-snug"
      >
        {text}
      </span>
    </span>
  )
}
