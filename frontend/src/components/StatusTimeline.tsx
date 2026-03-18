import { useState, useEffect } from 'react'
import type { RunMetadata } from '../api'
import { getStageStatus } from '../api'

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

function getTimestamp(data: Record<string, unknown> | null): string | null {
  if (!data) return null
  return (data.timestamp as string) || null
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
  const isDead = getStageStatus(metadata, nowProp ?? Date.now()) === 'dead'
  const [currentTime, setCurrentTime] = useState(nowProp ?? Date.now())

  useEffect(() => {
    if (nowProp !== undefined) {
      setCurrentTime(nowProp)
      return
    }
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [nowProp])

  return (
    <div className="bg-oh-surface border border-oh-border rounded-lg p-5">
      <h3 className="text-sm font-medium text-oh-text-muted mb-4">Pipeline Progress</h3>
      <div className="flex items-center gap-0">
        {STAGES.map((stage, i) => {
          const startData = metadata[stage.startKey]
          const endData = stage.endKey ? metadata[stage.endKey] : startData
          const startTs = getTimestamp(startData)
          const endTs = stage.endKey ? getTimestamp(endData) : startTs

          const isCompleted = !!endData
          const isActive = !!startData && !endData && stage.endKey !== undefined
          const isPending = !startData

          let stageStatus: 'completed' | 'active' | 'pending' | 'error' | 'dead' = 'pending'
          if (hasError && isActive) stageStatus = 'error'
          else if (isDead && isActive) stageStatus = 'dead'
          else if (isCompleted) stageStatus = 'completed'
          else if (isActive) stageStatus = 'active'
          else stageStatus = 'pending'

          const dotColors = {
            completed: 'bg-oh-success',
            active: 'bg-oh-primary',
            pending: 'bg-oh-border',
            error: 'bg-oh-error',
            dead: 'bg-gray-500',
          }

          const lineColors = {
            completed: 'bg-oh-success',
            active: 'bg-oh-primary/40',
            pending: 'bg-oh-border',
            error: 'bg-oh-error/40',
            dead: 'bg-gray-500/40',
          }

          const showDuration = isCompleted || isActive || (hasError && !!startData) || (isDead && !!startData)
          const durationText = showDuration
            ? formatStageDuration(startTs, endTs, isActive && !isDead, currentTime)
            : null

          const durationColor = isCompleted ? 'text-oh-success' : stageStatus === 'dead' ? 'text-gray-400' : isActive ? 'text-oh-primary' : 'text-oh-text-muted'

          return (
            <div key={stage.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${dotColors[stageStatus]} ${stageStatus === 'active' ? 'ring-4 ring-oh-primary/20' : ''}`} />
                <p className="text-xs font-medium text-oh-text mt-2 whitespace-nowrap">{stage.label}</p>
                {durationText && (
                  <p className={`text-[10px] ${durationColor} mt-0.5`}>{durationText}</p>
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
