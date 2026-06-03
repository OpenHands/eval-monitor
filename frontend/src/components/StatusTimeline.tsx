import { useState, useEffect } from 'react'
import type { RunMetadata } from '../api'

import SectionMenu from './SectionMenu'

interface StatusTimelineProps {
  metadata: RunMetadata
  now?: number
}

interface Stage {
  label: string
  startKey: keyof RunMetadata
  endKey?: keyof RunMetadata
}

const STAGES: Stage[] = [
  { label: 'Building Images', startKey: 'params', endKey: 'init' },
  { label: 'Run Inference', startKey: 'runInferStart', endKey: 'runInferEnd' },
  { label: 'Run Evaluation', startKey: 'evalInferStart', endKey: 'evalInferEnd' },
]

// Laminar project ID used to build trace URLs.
// Configurable at build time via the VITE_LAMINAR_PROJECT_ID env var so that
// the deployment (e.g. Vercel) can point at the correct Laminar project
// without hard-coding it in the repo. Read lazily so that tests can stub it.
function getLaminarProjectId(): string {
  return (import.meta.env?.VITE_LAMINAR_PROJECT_ID as string | undefined) || ''
}

function getTimestamp(data: Record<string, unknown> | null): string | null {
  if (!data) return null
  return (data.timestamp as string) || null
}

/**
 * Build a Laminar traces URL filtered by the run's unique_eval_name and
 * starting at the beginning of inference. Returns null if we don't have
 * enough information (no project ID configured or no eval name available).
 *
 * Mirrors the laminar link added by the push-to-index workflow
 * (https://github.com/OpenHands/evaluation/actions/workflows/push-to-index.yml)
 * but uses the project traces view so that traces are visible while the run
 * is still in progress (the shared evals URL needs an eval_id that only
 * becomes available after inference completes).
 */
export function buildLaminarTracesUrl(
  uniqueEvalName: string | null | undefined,
  inferStartTimestamp: string | null | undefined,
  projectId?: string,
): string | null {
  const pid = projectId !== undefined ? projectId : getLaminarProjectId()
  if (!pid || !uniqueEvalName) return null
  const params = new URLSearchParams()
  params.set('search', uniqueEvalName)
  if (inferStartTimestamp) {
    // Laminar's traces view accepts a startDate query param (ISO 8601) to
    // anchor the time window at the beginning of inference.
    params.set('startDate', inferStartTimestamp)
  }
  return `https://laminar.sh/project/${pid}/traces?${params.toString()}`
}

export function formatStageDuration(startStr: string | null, endStr: string | null, isActive: boolean, now: number): string {
  if (!startStr) return '—'
  const start = new Date(startStr).getTime()
  if (isNaN(start)) return '—'
  const end = isActive ? now : (endStr ? new Date(endStr).getTime() : NaN)
  if (isNaN(end)) return '—'
  const diffMs = end - start
  if (diffMs < 0) return '—'
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

export default function StatusTimeline({ metadata, now: nowProp }: StatusTimelineProps) {
  const hasError = !!metadata.error
  const [currentTime, setCurrentTime] = useState(nowProp ?? Date.now())

  const uniqueEvalName = (metadata.params?.unique_eval_name as string | undefined) ?? null
  const inferStartTs = getTimestamp(metadata.runInferStart)
  const laminarUrl = metadata.runInferStart
    ? buildLaminarTracesUrl(uniqueEvalName, inferStartTs)
    : null

  useEffect(() => {
    if (nowProp !== undefined) {
      setCurrentTime(nowProp)
      return
    }
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [nowProp])

  return (
    <div id="pipeline-progress" className="bg-oh-surface border border-oh-border rounded-lg p-5 scroll-mt-24">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-oh-text-muted">Pipeline Progress</h3>
        <SectionMenu id="pipeline-progress" />
      </div>
      <div className="flex items-center gap-0">
        {STAGES.map((stage, i) => {
          const startData = metadata[stage.startKey]
          const endData = stage.endKey ? metadata[stage.endKey] : startData
          const startTs = getTimestamp(startData)
          const endTs = stage.endKey ? getTimestamp(endData) : startTs

          const isCompleted = !!endData
          const isActive = !!startData && !endData && stage.endKey !== undefined
          const isPending = !startData

          let stageStatus: 'completed' | 'active' | 'pending' | 'error' = 'pending'
          if (hasError && isActive) stageStatus = 'error'
          else if (isCompleted) stageStatus = 'completed'
          else if (isActive) stageStatus = 'active'
          else stageStatus = 'pending'

          const dotColors = {
            completed: 'bg-oh-success',
            active: 'bg-oh-primary',
            pending: 'bg-oh-border',
            error: 'bg-oh-error',
          }

          const lineColors = {
            completed: 'bg-oh-success',
            active: 'bg-oh-primary/40',
            pending: 'bg-oh-border',
            error: 'bg-oh-error/40',
          }

          const showDuration = isCompleted || isActive || (hasError && !!startData)
          const durationText = showDuration
            ? formatStageDuration(startTs, endTs, isActive, currentTime)
            : null

          const durationColor = isCompleted ? 'text-oh-success' : isActive ? 'text-oh-primary' : 'text-oh-text-muted'

          const showLaminarButton =
            stage.label === 'Run Inference' && !!laminarUrl

          return (
            <div key={stage.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${dotColors[stageStatus]} ${stageStatus === 'active' ? 'ring-4 ring-oh-primary/20' : ''}`} />
                <p className="text-xs font-medium text-oh-text mt-2 whitespace-nowrap">{stage.label}</p>
                {durationText && (
                  <p className={`text-[10px] ${durationColor} mt-0.5`}>{durationText}</p>
                )}
                {showLaminarButton && (
                  <a
                    href={laminarUrl!}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="laminar-traces-button"
                    title="View Laminar traces from the beginning of inference"
                    className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-oh-primary/10 text-oh-primary border border-oh-primary/30 hover:bg-oh-primary/20 transition-colors whitespace-nowrap"
                  >
                    🔍 Laminar traces
                  </a>
                )}
              </div>
              {i < STAGES.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isPending ? lineColors.pending : lineColors[stageStatus]}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
