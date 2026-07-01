import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  fetchOutputReport,
  fetchCostReport,
  fetchEfficiencySummary,
  getResultsUrl,
} from '../api'
import type { OutputReport, CostReport, EfficiencySummary } from '../api'

import SectionMenu from './SectionMenu'

interface CompletedRunResultsProps {
  slug: string
  /** Run completion time, ms since epoch. Used to decide whether a
   *  missing `cache_hit_rate` is expected (pre-2026-06-11 runs) or
   *  worth flagging. Optional so legacy callers keep working. */
  runCompletedAtMs?: number | null
}

/** Cutoff: cost_report_v2.jsonl gained `summary.cache_hit_rate` on
 *  2026-06-11. Runs that completed before this date are not expected
 *  to carry the field, so we suppress the "missing" warning for them. */
const CACHE_HIT_RATE_EXPECTED_SINCE_MS = Date.UTC(2026, 5, 11)

function formatSummaryValue(key: string, value: unknown): string {
  if (value === null) return '—'
  if (typeof value !== 'number') return String(value ?? '—')
  if (key === 'cache_hit_rate') return `${(value * 100).toFixed(2)}%`
  if (key.includes('cost') || key.includes('critic')) return `$${value.toFixed(4)}`
  if (key.includes('duration')) return `${value.toFixed(1)}s`
  return String(value)
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

function WarningBanner({ testId, title, body }: { testId: string; title: string; body: string }) {
  return (
    <div
      data-testid={testId}
      className="mb-3 flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-orange-300"
    >
      <span className="text-sm" aria-hidden>⚠️</span>
      <div className="text-xs">
        <div className="font-semibold">{title}</div>
        <div className="text-orange-200/80">{body}</div>
      </div>
    </div>
  )
}

function InfoBanner({ testId, title, body }: { testId: string; title: string; body: ReactNode }) {
  return (
    <div
      data-testid={testId}
      className="mb-3 flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-300"
    >
      <span className="text-sm" aria-hidden>ℹ️</span>
      <div className="text-xs">
        <div className="font-semibold">{title}</div>
        <div className="text-emerald-200/80">{body}</div>
      </div>
    </div>
  )
}

function CostReportCard({
  report,
  runCompletedAtMs,
  efficiencySummary,
}: {
  report: CostReport
  runCompletedAtMs?: number | null
  /** Fallback source for `cache_hit_rate`. The eval-job's
   *  `summarize_efficiency.py` writes `cost.tokens.cache_hit_rate` into
   *  `efficiency_summary.json` (schema_version ≥ 6) for every run, even
   *  when the legacy `cost_report.jsonl` producer has not been upgraded.
   *  Used to silence the missing warning and surface the value when v2
   *  is unavailable. */
  efficiencySummary?: EfficiencySummary | null
}) {
  const summary = report.summary
  const totalCost = summary?.total_cost
  const showZeroCostWarning = typeof totalCost === 'number' && totalCost === 0

  // `cache_hit_rate` may be: a number (including 0), null (run had no
  // measurable input), or undefined (key absent — producer not upgraded).
  const cacheHitRate = summary?.cache_hit_rate
  const cacheHitKeyPresent = !!summary && 'cache_hit_rate' in summary

  // Fallback: efficiency_summary.json ships the same field under
  // cost.tokens.cache_hit_rate for schema_version ≥ 6. We use it as a
  // supplementary source so the user isn't told the rate is missing
  // when it actually lives one file over. The summary table itself is
  // untouched — this is purely a UX nudge + warning suppression.
  const efficiencyCacheHitRate = efficiencySummary?.cache_hit_rate
  const hasEfficiencyCacheHitNumber =
    efficiencySummary != null && typeof efficiencyCacheHitRate === 'number'
  const hasEfficiencyCacheHitNull =
    efficiencySummary != null && efficiencyCacheHitRate === null
  // Any "we measured, here's what we found" signal — including "we
  // measured but there was no input" — suppresses the missing warning.
  // Only a literal `number` triggers the info banner.
  const hasEfficiencyCacheHit =
    hasEfficiencyCacheHitNumber || hasEfficiencyCacheHitNull

  const showZeroCacheHitWarning = cacheHitRate === 0
  // The "missing" warning fires only when we have no source for the rate
  // *anywhere*: the summary key is absent AND efficiency_summary.json
  // didn't ship one either. A literal `null` from either side means
  // "run had no input to measure" — that case is intentionally quiet.
  const showMissingCacheHitWarning =
    !!summary &&
    !cacheHitKeyPresent &&
    !hasEfficiencyCacheHit &&
    runCompletedAtMs != null &&
    runCompletedAtMs >= CACHE_HIT_RATE_EXPECTED_SINCE_MS

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
        <WarningBanner
          testId="zero-cost-warning"
          title="Cost is $0.0000"
          body="Check if cost was added to infra. Token usage was tracked, you can recalculate costs."
        />
      )}

      {showZeroCacheHitWarning && (
        <WarningBanner
          testId="zero-cache-hit-warning"
          title="Cache hit rate is 0%"
          body="Prompt caching may be disabled or misconfigured — every input token is being billed at the cache-miss rate."
        />
      )}

      {hasEfficiencyCacheHitNumber && !cacheHitKeyPresent && (
        <InfoBanner
          testId="cache-hit-rate-from-efficiency"
          title={`Cache hit rate is ${(efficiencyCacheHitRate! * 100).toFixed(2)}%`}
          body={
            <>
              Sourced from{' '}
              <a
                href={efficiencySummary!.fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-emerald-200"
              >
                efficiency_summary.json
              </a>
              .
            </>
          }
        />
      )}

      {showMissingCacheHitWarning && (
        <WarningBanner
          testId="missing-cache-hit-warning"
          title="Cache hit rate not reported"
          body={
            efficiencySummary
              ? "Neither `cost_report_v2` nor `efficiency_summary.json` reports `cache_hit_rate` for this run. Re-run the eval-job against a recent SDK (schema_version ≥ 6) to surface it."
              : "cost_report_v2 is missing `cache_hit_rate`. Re-run the recalculate-costs job (or the eval-job) against a recent SDK to surface it."
          }
        />
      )}

      {summary ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(summary).map(([key, value]) => (
                <tr key={key} className="border-b border-oh-border/50 last:border-0">
                  <td className="py-1.5 pr-4 text-oh-text-muted font-mono text-xs whitespace-nowrap align-top">
                    {key}
                  </td>
                  <td className="py-1.5 text-oh-text font-mono text-xs break-all">
                    {formatSummaryValue(key, value)}
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

export default function CompletedRunResults({ slug, runCompletedAtMs }: CompletedRunResultsProps) {
  const [outputReport, setOutputReport] = useState<OutputReport | null>(null)
  const [costReport, setCostReport] = useState<CostReport | null>(null)
  const [efficiencySummary, setEfficiencySummary] = useState<EfficiencySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchOutputReport(slug),
      fetchCostReport(slug),
      fetchEfficiencySummary(slug),
    ]).then(
      ([output, cost, eff]) => {
        if (cancelled) return
        setOutputReport(output)
        setCostReport(cost)
        setEfficiencySummary(eff)
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
        {costReport && (
          <CostReportCard
            report={costReport}
            runCompletedAtMs={runCompletedAtMs}
            efficiencySummary={efficiencySummary}
          />
        )}
      </div>
      <ArchiveLink slug={slug} />
    </div>
  )
}
