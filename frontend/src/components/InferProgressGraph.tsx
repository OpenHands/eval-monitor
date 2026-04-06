import { useState, useEffect } from 'react'
import SectionMenu from './SectionMenu'
import { getResultsUrl } from '../api'

interface ProgressDataPoint {
  timestamp: Date
  output: number
  critic1: number
  critic2: number
  critic3: number
}

interface InferProgressGraphProps {
  slug: string
}

export default function InferProgressGraph({ slug }: InferProgressGraphProps) {
  const [data, setData] = useState<ProgressDataPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const cleanSlug = slug.replace(/\/$/, '')
        const cacheBust = Math.floor(Date.now() / 1000)
        const url = `/api/${cleanSlug}/metadata/run-infer-progress.txt?${cacheBust}`
        const res = await fetch(url)
        if (cancelled) return
        if (!res.ok) {
          setError(true)
          setLoading(false)
          return
        }
        const text = await res.text()
        if (cancelled) return
        const lines = text.trim().split('\n').filter(line => line.trim())
        const parsed: ProgressDataPoint[] = lines.map(line => {
          const parts = line.split(',').map(p => p.trim())
          return {
            timestamp: new Date(parts[0]),
            output: parseInt(parts[1], 10),
            critic1: parseInt(parts[2], 10),
            critic2: parseInt(parts[3], 10),
            critic3: parseInt(parts[4], 10),
          }
        })
        if (!cancelled) {
          setData(parsed)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading || error || !data || data.length === 0) {
    return null
  }

  const downloadUrl = getResultsUrl(slug, 'metadata/run-infer-progress.txt')
  
  return (
    <>
      <div id="infer-progress" className="bg-oh-surface border border-oh-border rounded-lg p-4 scroll-mt-24">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span>📊</span>
            <h3 className="text-sm font-medium text-oh-text">Inference Progress</h3>
          </div>
          <SectionMenu id="infer-progress" download={{ url: downloadUrl, filename: 'run-infer-progress.txt' }} />
        </div>
        
        <div 
          className="cursor-pointer hover:opacity-80 transition-opacity relative group"
          onClick={() => setIsExpanded(true)}
          title="Click to expand"
        >
          <ProgressChart data={data} compact />
          <div className="absolute top-2 right-2 bg-oh-surface/80 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4 text-oh-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
        </div>
        <SpeedStats data={data} />
      </div>

      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div 
            className="bg-oh-surface border border-oh-border rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span>📊</span>
                <h3 className="text-lg font-semibold text-oh-text">Inference Progress</h3>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-oh-text-muted hover:text-oh-text transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ProgressChart data={data} />
            <SpeedStats data={data} />
          </div>
        </div>
      )}
    </>
  )
}

interface ProgressChartProps {
  data: ProgressDataPoint[]
  compact?: boolean
}

function ProgressChart({ data, compact = false }: ProgressChartProps) {
  if (data.length === 0) return null

  const width = 800
  const height = compact ? 200 : 300
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const startTime = data[0].timestamp.getTime()
  const endTime = data[data.length - 1].timestamp.getTime()
  const timeRange = endTime - startTime

  const maxCount = Math.max(
    ...data.map(d => Math.max(d.output, d.critic1, d.critic2, d.critic3))
  )

  const xScale = (time: number) => {
    if (timeRange === 0) return padding.left
    return padding.left + ((time - startTime) / timeRange) * chartWidth
  }

  const yScale = (count: number) => {
    if (maxCount === 0) return padding.top + chartHeight
    return padding.top + chartHeight - (count / maxCount) * chartHeight
  }

  const createPath = (getValue: (d: ProgressDataPoint) => number, offset = 0) => {
    return data
      .map((d, i) => {
        const x = xScale(d.timestamp.getTime())
        const y = yScale(getValue(d)) + offset
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }

  const outputPath = createPath(d => d.output, -10)
  const critic1Path = createPath(d => d.critic1, -5)
  const critic2Path = createPath(d => d.critic2, 0)
  const critic3Path = createPath(d => d.critic3, 5)

  const formatTime = (ms: number) => {
    const totalMinutes = Math.floor(ms / 60000)
    if (totalMinutes < 60) return `${totalMinutes}m`
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
  }

  const timeLabels = []
  const numLabels = 5
  for (let i = 0; i <= numLabels; i++) {
    const time = startTime + (timeRange * i) / numLabels
    const x = xScale(time)
    const label = formatTime(time - startTime)
    timeLabels.push(
      <g key={i}>
        <line x1={x} y1={padding.top + chartHeight} x2={x} y2={padding.top + chartHeight + 5} stroke="currentColor" opacity="0.3" />
        <text x={x} y={padding.top + chartHeight + 20} fill="currentColor" fontSize="10" textAnchor="middle" opacity="0.6">
          {label}
        </text>
      </g>
    )
  }

  const countLabels = []
  const numCountLabels = 5
  for (let i = 0; i <= numCountLabels; i++) {
    const count = Math.round((maxCount * i) / numCountLabels)
    const y = yScale(count)
    countLabels.push(
      <g key={i}>
        <line x1={padding.left - 5} y1={y} x2={padding.left} y2={y} stroke="currentColor" opacity="0.3" />
        <text x={padding.left - 10} y={y + 3} fill="currentColor" fontSize="10" textAnchor="end" opacity="0.6">
          {count}
        </text>
      </g>
    )
  }

  return (
    <div className={compact ? "w-full" : "overflow-x-auto"}>
      <svg 
        width="100%" 
        height={height} 
        viewBox={`0 0 ${width} ${height}`} 
        className="text-oh-text-muted"
        preserveAspectRatio="xMidYMid meet"
        style={{ minWidth: compact ? 'auto' : `${width}px` }}
      >
        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="none" stroke="currentColor" opacity="0.2" />
        
        {timeLabels}
        {countLabels}

        <path d={outputPath} fill="none" stroke="#0ea5e9" strokeWidth="2" />
        <path d={critic1Path} fill="none" stroke="#a3e635" strokeWidth="2" />
        <path d={critic2Path} fill="none" stroke="#fb923c" strokeWidth="2" />
        <path d={critic3Path} fill="none" stroke="#ef4444" strokeWidth="2" />

        {/* Data point markers */}
        {data.map((d, i) => {
          const x = xScale(d.timestamp.getTime())
          return (
            <g key={i}>
              <circle cx={x} cy={yScale(d.output) - 10} r="3" fill="#0ea5e9" />
              <circle cx={x} cy={yScale(d.critic1) - 5} r="3" fill="#a3e635" />
              <circle cx={x} cy={yScale(d.critic2) + 0} r="3" fill="#fb923c" />
              <circle cx={x} cy={yScale(d.critic3) + 5} r="3" fill="#ef4444" />
            </g>
          )
        })}

        <g transform={`translate(${padding.left + chartWidth / 2}, ${height - 5})`}>
          <text fill="currentColor" fontSize="12" textAnchor="middle" opacity="0.8">
            Time
          </text>
        </g>
        
        <g transform={`translate(15, ${padding.top + chartHeight / 2})`}>
          <text fill="currentColor" fontSize="12" textAnchor="middle" opacity="0.8" transform="rotate(-90)">
            Instances
          </text>
        </g>
      </svg>
      
      <div className="flex items-center justify-center gap-6 mt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-[#0ea5e9]" />
          <span className="text-oh-text-muted">Output</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-[#a3e635]" />
          <span className="text-oh-text-muted">Critic 1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-[#fb923c]" />
          <span className="text-oh-text-muted">Critic 2</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-[#ef4444]" />
          <span className="text-oh-text-muted">Critic 3</span>
        </div>
      </div>
    </div>
  )
}

interface SpeedStatsProps {
  data: ProgressDataPoint[]
}

function SpeedStats({ data }: SpeedStatsProps) {
  if (data.length === 0) return null

  const firstPoint = data[0]
  const lastPoint = data[data.length - 1]
  
  const totalTime = (lastPoint.timestamp.getTime() - firstPoint.timestamp.getTime()) / 1000 / 60
  const totalCritics = lastPoint.critic1 + lastPoint.critic2 + lastPoint.critic3
  
  const avgSpeed = totalTime > 0 ? totalCritics / totalTime : 0

  let currentSpeed = 0
  const oneHourAgo = lastPoint.timestamp.getTime() - 3600000
  const pointOneHourAgo = data.find(d => d.timestamp.getTime() >= oneHourAgo) || firstPoint
  
  if (pointOneHourAgo) {
    const timeDiff = (lastPoint.timestamp.getTime() - pointOneHourAgo.timestamp.getTime()) / 1000 / 60
    const currentCritics = totalCritics
    const oldCritics = pointOneHourAgo.critic1 + pointOneHourAgo.critic2 + pointOneHourAgo.critic3
    currentSpeed = timeDiff > 0 ? (currentCritics - oldCritics) / timeDiff : 0
  }

  // Calculate accepted for each critic
  // Find the last point where critic2=0 AND critic3=0 (only critic 1 ran)
  const lastCritic1OnlyPoint = [...data].reverse().find(d => d.critic2 === 0 && d.critic3 === 0)
  // Find the last point where critic3=0 (critic 1 and 2 ran, but not 3)
  const lastCritic2DonePoint = [...data].reverse().find(d => d.critic3 === 0 && d.critic2 > 0)

  // Accepted by critic 1: output / critic1 at the last point where only critic 1 ran
  const acceptedCritic1 = lastCritic1OnlyPoint && lastCritic1OnlyPoint.critic1 !== 0
    ? lastCritic1OnlyPoint.output / lastCritic1OnlyPoint.critic1
    : 0

  // Accepted by critic 2: (output - previousOutput) / critic2 at the last point where critic 3=0
  const acceptedCritic2 = lastCritic2DonePoint && lastCritic2DonePoint.critic2 !== 0
    ? (lastCritic2DonePoint.output - (lastCritic1OnlyPoint?.output || 0)) / lastCritic2DonePoint.critic2
    : 0

  // Accepted by critic 3: (output - previousOutput) / critic3 at the final point
  const previousOutput = lastCritic2DonePoint?.output || lastCritic1OnlyPoint?.output || 0
  const acceptedCritic3 = lastPoint.critic3 !== 0
    ? (lastPoint.output - previousOutput) / lastPoint.critic3
    : 0

  const formatAccepted = (value: number) => {
    if (value === 1.0) return '100%'
    return `${Math.round(value * 100)}%`
  }

  return (
    <>
      <div className="mt-4 pt-4 border-t border-oh-border/50 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-oh-text-muted">Average Speed:</span>{' '}
          <span className="font-mono text-oh-text">{avgSpeed.toFixed(2)} instances/min</span>
        </div>
        <div>
          <span className="text-oh-text-muted">Current Speed:</span>{' '}
          <span className="font-mono text-oh-text">{currentSpeed.toFixed(2)} instances/min</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-oh-text-muted">Accepted critic 1:</span>{' '}
          <span className="font-mono text-oh-text">{formatAccepted(acceptedCritic1)}</span>
        </div>
        <div>
          <span className="text-oh-text-muted">Accepted critic 2:</span>{' '}
          <span className="font-mono text-oh-text">{acceptedCritic1 === 1.0 ? '-' : formatAccepted(acceptedCritic2)}</span>
        </div>
        <div>
          <span className="text-oh-text-muted">Accepted critic 3:</span>{' '}
          <span className="font-mono text-oh-text">{acceptedCritic1 === 1.0 || acceptedCritic2 === 1.0 ? '-' : formatAccepted(acceptedCritic3)}</span>
        </div>
      </div>
    </>
  )
}
