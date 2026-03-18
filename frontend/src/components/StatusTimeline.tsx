import type { RunMetadata } from '../api'

interface StatusTimelineProps {
  metadata: RunMetadata
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

function formatDuration(startStr: string, endStr: string): string {
  const start = new Date(startStr).getTime()
  const end = new Date(endStr).getTime()
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

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC'
}

export default function StatusTimeline({ metadata }: StatusTimelineProps) {
  const hasError = !!metadata.error

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

          return (
            <div key={stage.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${dotColors[stageStatus]} ${stageStatus === 'active' ? 'ring-4 ring-oh-primary/20' : ''}`} />
                <p className="text-xs font-medium text-oh-text mt-2 whitespace-nowrap">{stage.label}</p>
                {startTs && (
                  <p className="text-[10px] text-oh-text-muted mt-0.5">{formatTime(startTs)}</p>
                )}
                {startTs && endTs && stage.endKey && isCompleted && (
                  <p className="text-[10px] text-oh-success mt-0.5">{formatDuration(startTs, endTs)}</p>
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
