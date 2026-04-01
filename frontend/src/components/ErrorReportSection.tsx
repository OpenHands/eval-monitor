import { useState, useEffect } from 'react'
import { fetchErrorReport, getResultsUrl } from '../api'

import SectionMenu from './SectionMenu'

interface ErrorReportSectionProps {
  slug: string
  status?: 'pending' | 'building' | 'running-infer' | 'running-eval' | 'completed' | 'error' | 'cancelled'
}

const ERROR_REPORT_FILE = 'conversation-error-report.txt'

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

export default function ErrorReportSection({ slug, status }: ErrorReportSectionProps) {
  const [errorReport, setErrorReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchErrorReport(slug).then((report) => {
      if (!cancelled) {
        setErrorReport(report)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!loading && errorReport && window.location.hash === '#error-report') {
      setTimeout(() => {
        const el = document.getElementById('error-report')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    }
  }, [loading, errorReport])

  const isEvalStarted = status === 'running-eval' || status === 'completed'
  const download = { url: getResultsUrl(slug, ERROR_REPORT_FILE), filename: ERROR_REPORT_FILE }

  if (loading) return null

  if (!errorReport) {
    if (isEvalStarted) {
      return (
        <div id="error-report" data-testid="error-report-section" className="col-span-1 lg:col-span-2 bg-oh-surface border border-oh-border rounded-lg p-5 scroll-mt-24">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏳</span>
              <h3 className="text-lg font-semibold text-oh-text">Error Report</h3>
            </div>
            <SectionMenu id="error-report" download={download} />
          </div>
          <div className="flex items-center gap-2 text-sm text-oh-warning mt-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Evaluation has started but error report is not available yet. Please check back shortly.</span>
          </div>
        </div>
      )
    }
    return null
  }

  const errorsUrl = getResultsUrl(slug, 'conversation-errors.txt')

  const noErrors = errorReport.trim().endsWith('No errors found.')
  const title = noErrors ? "All Conversations Pass Checks" : "Conversation Errors Found"
  const icon = noErrors ? "✅" : "⚠️"

  return (
    <div id="error-report" data-testid="error-report-section" className="col-span-1 lg:col-span-2 bg-oh-surface border border-oh-border rounded-lg p-5 scroll-mt-24">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h3 className="text-lg font-semibold text-oh-text">{title}</h3>
        </div>
        <SectionMenu id="error-report" download={download} />
      </div>
      {!noErrors && (
        <div className="mb-4">
          <ExternalLink href={errorsUrl}>View full list of errors (conversation-errors.txt)</ExternalLink>
        </div>
      )}
      <pre className="text-sm font-mono text-oh-text-muted bg-oh-bg p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
        {errorReport}
      </pre>
    </div>
  )
}
