import { useState, useEffect } from 'react'
import { fetchErrorReport, getResultsUrl } from '../api'

interface ErrorReportSectionProps {
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

export default function ErrorReportSection({ slug }: ErrorReportSectionProps) {
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

  if (loading || !errorReport) return null

  const errorsUrl = getResultsUrl(slug, 'conversation-errors.txt')

  const noErrors = errorReport.trim().endsWith('No errors found.')
  const title = noErrors ? "All Conversations Pass Checks" : "Conversation Errors Found"
  const icon = noErrors ? "✅" : "⚠️"

  return (
    <div data-testid="error-report-section" className="col-span-1 lg:col-span-2 bg-oh-surface border border-oh-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <h3 className="text-lg font-semibold text-oh-text">{title}</h3>
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
