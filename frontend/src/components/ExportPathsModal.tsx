import { useState, useEffect } from 'react'
import { getResultsUrl } from '../api'

export interface ExportableFile {
  filename: string
  subdir?: string // e.g., 'metadata' for params.json
  defaultChecked: boolean
}

export const EXPORTABLE_FILES: ExportableFile[] = [
  { filename: 'params.json', subdir: 'metadata', defaultChecked: true },
  { filename: 'results.tar.gz', defaultChecked: true },
  { filename: 'output.report.json', defaultChecked: true },
  { filename: 'init.json', subdir: 'metadata', defaultChecked: false },
  { filename: 'error.json', subdir: 'metadata', defaultChecked: false },
  { filename: 'run-infer-start.json', subdir: 'metadata', defaultChecked: false },
  { filename: 'run-infer-end.json', subdir: 'metadata', defaultChecked: false },
  { filename: 'eval-infer-start.json', subdir: 'metadata', defaultChecked: false },
  { filename: 'eval-infer-end.json', subdir: 'metadata', defaultChecked: false },
  { filename: 'cancel-eval.json', subdir: 'metadata', defaultChecked: false },
  { filename: 'cost_report_v2.json', defaultChecked: false },
  { filename: 'conversation-error-report.txt', defaultChecked: false },
  { filename: 'conversation-errors.txt', defaultChecked: false },
  { filename: 'submission.json', subdir: 'metadata', defaultChecked: false },
]

interface RunInfo {
  slug: string
  jobId: string
}

interface ExportPathsModalProps {
  isOpen: boolean
  onClose: () => void
  filteredRuns: RunInfo[]
  filterBenchmark: string
  filterStatus: string
  filterText: string
}

export function buildFilterString(filterBenchmark: string, filterStatus: string, filterText: string): string {
  const parts: string[] = []
  if (filterBenchmark !== 'all') {
    parts.push(`benchmark-${filterBenchmark}`)
  }
  if (filterStatus !== 'all') {
    parts.push(`status-${filterStatus}`)
  }
  if (filterText) {
    // Replace spaces and special chars with dashes, limit length
    const sanitized = filterText.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
    if (sanitized) {
      parts.push(`text-${sanitized}`)
    }
  }
  return parts.length > 0 ? parts.join('_') : 'all'
}

export function getFilePath(file: ExportableFile): string {
  return file.subdir ? `${file.subdir}/${file.filename}` : file.filename
}

export default function ExportPathsModal({ isOpen, onClose, filteredRuns, filterBenchmark, filterStatus, filterText }: ExportPathsModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(() => {
    const defaults = new Set<string>()
    EXPORTABLE_FILES.forEach(f => {
      if (f.defaultChecked) defaults.add(f.filename)
    })
    return defaults
  })
  const [copied, setCopied] = useState(false)

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      const defaults = new Set<string>()
      EXPORTABLE_FILES.forEach(f => {
        if (f.defaultChecked) defaults.add(f.filename)
      })
      setSelectedFiles(defaults)
      setCopied(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const allSelected = selectedFiles.size === EXPORTABLE_FILES.length
  const noneSelected = selectedFiles.size === 0

  const handleToggle = (filename: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filename)) {
        next.delete(filename)
      } else {
        next.add(filename)
      }
      return next
    })
  }

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(EXPORTABLE_FILES.map(f => f.filename)))
    }
  }

  const generateExportData = () => {
    return filteredRuns.map(run => {
      const entry: Record<string, string> = { eval_job_id: run.jobId }
      EXPORTABLE_FILES.forEach(file => {
        if (selectedFiles.has(file.filename)) {
          const path = getFilePath(file)
          entry[file.filename] = getResultsUrl(run.slug, path)
        }
      })
      return entry
    })
  }

  const handleCopy = async () => {
    const exportData = generateExportData()
    await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleExport = () => {
    const exportData = generateExportData()
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const filterString = buildFilterString(filterBenchmark, filterStatus, filterText)
    link.download = `paths-${filterString}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      data-testid="export-modal-backdrop"
    >
      <div className="bg-oh-surface border border-oh-border rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-oh-text">
            Export current instances paths to JSON
          </h2>
          <button
            onClick={onClose}
            className="text-oh-text-muted hover:text-oh-text transition-colors"
            aria-label="Close"
            data-testid="close-modal-button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-oh-text-muted mb-4">
          Select which files to include in the export ({filteredRuns.length} run{filteredRuns.length !== 1 ? 's' : ''})
        </p>

        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-oh-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleToggleAll}
              className="w-4 h-4 rounded border-oh-border bg-oh-bg text-oh-primary focus:ring-oh-primary focus:ring-offset-0"
              data-testid="toggle-all-checkbox"
            />
            <span className="text-sm text-oh-text font-medium">
              {allSelected ? 'Unmark all' : 'Mark all'}
            </span>
          </label>
        </div>

        <div className="overflow-y-auto flex-1 space-y-2">
          {EXPORTABLE_FILES.map(file => (
            <label
              key={file.filename}
              className="flex items-center gap-2 cursor-pointer hover:bg-oh-surface-hover p-1.5 rounded transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedFiles.has(file.filename)}
                onChange={() => handleToggle(file.filename)}
                className="w-4 h-4 rounded border-oh-border bg-oh-bg text-oh-primary focus:ring-oh-primary focus:ring-offset-0"
                data-testid={`checkbox-${file.filename}`}
              />
              <span className="text-sm text-oh-text font-mono">{file.filename}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-oh-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-oh-text-muted hover:text-oh-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={noneSelected}
            className="px-4 py-2 text-sm font-medium border border-oh-border text-oh-text rounded-lg hover:bg-oh-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="copy-button"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleExport}
            disabled={noneSelected}
            className="px-4 py-2 text-sm font-medium bg-oh-primary text-white rounded-lg hover:bg-oh-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="export-button"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
