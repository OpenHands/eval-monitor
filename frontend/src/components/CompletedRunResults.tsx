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

function CostReportCard({ report }: { report: CostReport }) {
  return (
    <div className="bg-oh-surface border border-oh-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>💰</span>
          <h3 className="text-sm font-medium text-oh-text">Cost Report</h3>
        </div>
        <ExternalLink href={report.fullUrl}>View full report</ExternalLink>
      </div>
      {report.summary ? (
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
      ) : (
        <p className="text-xs text-oh-text-muted italic">No summary available</p>
      )}
    </div>
  )
}

function ArchiveLink({ slug }: { slug: string }) {
  const archiveUrl = getResultsUrl(slug, 'results.tar.gz')
  return (
    <div className="bg-oh-surface border border-oh-border rounded-lg p-4">
      <div className="flex items-center gap-2">
        <span>📦</span>
        <h3 className="text-sm font-medium text-oh-text">Results Archive</h3>
      </div>
      <div className="mt-3">
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
      <div id="run-results" className="bg-oh-surface border border-oh-success/30 rounded-lg p-4 scroll-mt-6">
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
    <div id="run-results" className="space-y-4 scroll-mt-6">
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
