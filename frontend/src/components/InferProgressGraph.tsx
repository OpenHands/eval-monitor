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

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const cleanSlug = slug.replace(/\/$/, '')
        const url = `/api/${cleanSlug}/metadata/run-infer-progress.txt`
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
    <div id="infer-progress" className="bg-oh-surface border border-oh-border rounded-lg p-4 scroll-mt-24">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>📊</span>
          <h3 className="text-sm font-medium text-oh-text">Inference Progress</h3>
        </div>
        <SectionMenu id="infer-progress" download={{ url: downloadUrl, filename: 'run-infer-progress.txt' }} />
      </div>
      
      <ProgressChart data={data} />
      <SpeedStats data={data} />
    </div>
  )
}

interface ProgressChartProps {
  data: ProgressDataPoint[]
}

function ProgressChart({ data }: ProgressChartProps) {
  if (data.length === 0) return null

  const width = 800
  const height = 300
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

  const createPath = (getValue: (d: ProgressDataPoint) => number) => {
    return data
      .map((d, i) => {
        const x = xScale(d.timestamp.getTime())
        const y = yScale(getValue(d))
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }

  const outputPath = createPath(d => d.output)
  const critic1Path = createPath(d => d.critic1)
  const critic2Path = createPath(d => d.critic2)
  const critic3Path = createPath(d => d.critic3)

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
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-oh-text-muted">
        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="none" stroke="currentColor" opacity="0.2" />
        
        {timeLabels}
        {countLabels}

        <path d={outputPath} fill="none" stroke="#22c55e" strokeWidth="2" />
        <path d={critic1Path} fill="none" stroke="#eab308" strokeWidth="2" />
        <path d={critic2Path} fill="none" stroke="#f97316" strokeWidth="2" />
        <path d={critic3Path} fill="none" stroke="#ef4444" strokeWidth="2" />

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
          <div className="w-4 h-0.5 bg-[#22c55e]" />
          <span className="text-oh-text-muted">Output</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-[#eab308]" />
          <span className="text-oh-text-muted">Critic 1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-[#f97316]" />
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

  return (
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
  )
}
