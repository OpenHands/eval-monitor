import { useState, useEffect } from 'react'
import { fetchOutputReport, fetchCostReport, getResultsUrl } from '../api'
import type { OutputReport, CostReport } from '../api'

import SectionMenu from './SectionMenu'

interface CompletedRunResultsProps {
  slug: string
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-oh-primary hover:text-oh-primary/80 text-xs font-medium transition-colors"
    >
      {children}
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

function OutputReportCard({ report }: { report: OutputReport }) {
  return (
    <div className="bg-oh-surface border border-oh-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>📊</span>
          <h3 className="text-sm font-medium text-oh-text">Output Report</h3>
        </div>
        <ExternalLink href={report.fullUrl}>View full report</ExternalLink>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(report.scalarFields).map(([key, value]) => (
              <tr key={key} className="border-b border-oh-border/50 last:border-0">
                <td className="py-1.5 pr-4 text-oh-text-muted font-mono text-xs whitespace-nowrap align-top">
                  {key}
                </td>
                <td className="py-1.5 text-oh-text font-mono text-xs break-all">
                  {String(value ?? '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.hasListFields && (
        <p className="mt-2 text-xs text-oh-text-muted italic">
          List fields omitted.{' '}
          <ExternalLink href={report.fullUrl}>See full report for complete data</ExternalLink>
        </p>
      )}
    </div>
  )
}

function formatProxyCostValue(key: string, value: unknown): string {
  if (typeof value !== 'number') return String(value ?? '—')
  return key.includes('cost') ? `$${value.toFixed(4)}` : String(value)
}

function CostReportCard({ report }: { report: CostReport }) {
  const totalCost = report.summary?.total_cost
  const proxyCost = report.proxySummary?.total_proxy_cost
  const clientCostIsZero = typeof totalCost === 'number' && totalCost === 0
  const hasProxyCost = typeof proxyCost === 'number' && proxyCost > 0
  // Only warn if client cost is zero AND there's no proxy cost to fall back on
  const showZeroCostWarning = clientCostIsZero && !hasProxyCost

  return (
    <div className="bg-oh-surface border border-oh-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>💰</span>
          <h3 className="text-sm font-medium text-oh-text">Cost Report</h3>
        </div>
        <ExternalLink href={report.fullUrl}>View full report</ExternalLink>
      </div>

      {showZeroCostWarning && (
        <div
          data-testid="zero-cost-warning"
          className="mb-3 flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-orange-300"
        >
          <span className="text-sm" aria-hidden>
            ⚠️
          </span>
          <div className="text-xs">
            <div className="font-semibold">Cost is $0.0000</div>
            <div className="text-orange-200/80">
              Check if cost was added to infra. Token usage was tracked, you can recalculate costs.
            </div>
          </div>
        </div>
      )}

      {hasProxyCost && clientCostIsZero && report.proxySummary && (
        <div className="mb-3">
          <p className="text-xs text-oh-text-muted mb-2 italic">
            Client cost unavailable (acp-codex telemetry not wired) — showing proxy-reported cost.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(report.proxySummary).map(([key, value]) => (
                  <tr key={key} className="border-b border-oh-border/50 last:border-0">
                    <td className="py-1.5 pr-4 text-oh-text-muted font-mono text-xs whitespace-nowrap align-top">
                      {key}
                    </td>
                    <td className="py-1.5 text-oh-text font-mono text-xs break-all">
                      {formatProxyCostValue(key, value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report.summary && !clientCostIsZero ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(report.summary).map(([key, value]) => (
                <tr key={key} className="border-b border-oh-border/50 last:border-0">
                  <td className="py-1.5 pr-4 text-oh-text-muted font-mono text-xs whitespace-nowrap align-top">
                    {key}
                  </td>
                  <td className="py-1.5 text-oh-text font-mono text-xs break-all">
                    {typeof value === 'number'
                      ? key.includes('cost') || key.includes('critic')
                        ? `$${value.toFixed(4)}`
                        : key.includes('duration')
                          ? `${value.toFixed(1)}s`
                          : String(value)
                      : String(value ?? '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !hasProxyCost ? (
        <p className="text-xs text-oh-text-muted italic">No summary available</p>
      ) : null}
    </div>
  )
}

function ArchiveLink({ slug }: { slug: string }) {
  const archiveUrl = getResultsUrl(slug, 'results.tar.gz')
  const PUSH_TO_INDEX_URL = 'https://github.com/OpenHands/evaluation/actions/workflows/push-to-index.yml'
  const trajectoryVisualizerUrl = `https://trajectory-visualizer.all-hands.dev/?inUrl=${encodeURIComponent(archiveUrl)}`

  const handleCopyAndOpen = async () => {
    await navigator.clipboard.writeText(archiveUrl)
    window.open(PUSH_TO_INDEX_URL, '_blank')
  }

  return (
    <div className="bg-oh-surface border border-oh-border rounded-lg p-4">
      <div className="flex items-center gap-2">
        <span>📦</span>
        <h3 className="text-sm font-medium text-oh-text">Results Archive</h3>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <a
          href={archiveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-oh-primary/10 text-oh-primary border border-oh-primary/30 rounded-md text-sm font-medium hover:bg-oh-primary/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download results.tar.gz
        </a>
        <a
          href={trajectoryVisualizerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-oh-purple/10 text-oh-purple border border-oh-purple/30 rounded-md text-sm font-medium hover:bg-oh-purple/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          See in Trajectory Visualizer
        </a>
        <button
          onClick={handleCopyAndOpen}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-oh-warning/10 text-oh-warning border border-oh-warning/30 rounded-md text-sm font-medium hover:bg-oh-warning/20 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Copy archive link and submit to index
        </button>
      </div>
    </div>
  )
}

export default function CompletedRunResults({ slug }: CompletedRunResultsProps) {
  const [outputReport, setOutputReport] = useState<OutputReport | null>(null)
  const [costReport, setCostReport] = useState<CostReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchOutputReport(slug), fetchCostReport(slug)]).then(
      ([output, cost]) => {
        if (cancelled) return
        setOutputReport(output)
        setCostReport(cost)
        setLoading(false)
      }
    )
    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return (
      <div id="run-results" className="bg-oh-surface border border-oh-success/30 rounded-lg p-4 scroll-mt-24">
        <div className="flex items-center gap-2 text-oh-text-muted text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading results…
        </div>
      </div>
    )
  }

  if (!outputReport && !costReport) return null

  return (
    <div id="run-results" className="space-y-4 scroll-mt-24">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-oh-text flex items-center gap-2">
          <span className="text-oh-success">✓</span> Run Results
        </h3>
        <SectionMenu id="run-results" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {outputReport && <OutputReportCard report={outputReport} />}
        {costReport && <CostReportCard report={costReport} />}
      </div>
      <ArchiveLink slug={slug} />
    </div>
  )
}
