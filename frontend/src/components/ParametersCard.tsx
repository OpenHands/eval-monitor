import { useState, useEffect } from 'react'
import { formatValue } from './JsonCard'
import SectionMenu from './SectionMenu'

interface ParametersCardProps {
  data: Record<string, unknown> | null | undefined
}

interface WorkflowInputParams {
  [key: string]: string
}

async function fetchWorkflowInputParams(runId: string): Promise<WorkflowInputParams | null> {
  try {
    console.log('[ParametersCard] Fetching workflow params for run:', runId)
    
    // Fetch the workflow run jobs
    const jobsUrl = `https://api.github.com/repos/OpenHands/software-agent-sdk/actions/runs/${runId}/jobs`
    console.log('[ParametersCard] Fetching jobs from:', jobsUrl)
    const jobsRes = await fetch(jobsUrl)
    
    console.log('[ParametersCard] Jobs response status:', jobsRes.status)
    if (!jobsRes.ok) {
      console.error('[ParametersCard] Failed to fetch jobs:', jobsRes.status, jobsRes.statusText)
      return null
    }
    
    const jobsData = await jobsRes.json()
    console.log('[ParametersCard] Jobs data:', jobsData)
    
    // Find the print-parameters job
    const printJob = jobsData.jobs?.find((job: any) => job.name === 'print-parameters')
    if (!printJob) {
      console.error('[ParametersCard] print-parameters job not found. Available jobs:', jobsData.jobs?.map((j: any) => j.name))
      return null
    }
    
    console.log('[ParametersCard] Found print-parameters job:', printJob.id)

    // Fetch the job logs
    const logsUrl = `https://api.github.com/repos/OpenHands/software-agent-sdk/actions/jobs/${printJob.id}/logs`
    console.log('[ParametersCard] Fetching logs from:', logsUrl)
    const logsRes = await fetch(logsUrl)
    
    console.log('[ParametersCard] Logs response status:', logsRes.status)
    if (!logsRes.ok) {
      console.error('[ParametersCard] Failed to fetch logs:', logsRes.status, logsRes.statusText)
      return null
    }
    
    const logs = await logsRes.text()
    console.log('[ParametersCard] Logs length:', logs.length)

    // Parse the "=== Input Parameters ===" section
    const paramsMatch = logs.match(/=== Input Parameters ===\n([\s\S]*?)(?=\n===|\n\n|$)/)
    if (!paramsMatch) {
      console.error('[ParametersCard] Could not find Input Parameters section in logs')
      return null
    }

    const paramsSection = paramsMatch[1]
    console.log('[ParametersCard] Found params section:', paramsSection)
    const params: WorkflowInputParams = {}

    // Parse each line: "key: value"
    for (const line of paramsSection.split('\n')) {
      const match = line.match(/^([^:]+):\s*(.+)$/)
      if (!match) continue
      
      const [, key, value] = match
      const trimmedKey = key.trim()
      const trimmedValue = value.trim()
      
      // Skip N/A and (default) values
      if (trimmedValue === 'N/A' || trimmedValue === '(default)') continue
      
      params[trimmedKey] = trimmedValue
    }

    console.log('[ParametersCard] Parsed params:', params)
    return params
  } catch (error) {
    console.error('[ParametersCard] Failed to fetch workflow input params:', error)
    return null
  }
}

function generateGhCommand(params: WorkflowInputParams): string {
  const parts = [
    'gh workflow run run-eval.yml',
    '--repo OpenHands/software-agent-sdk',
  ]

  // Output each parameter exactly as it appears in the workflow logs
  for (const [key, value] of Object.entries(params)) {
    parts.push(`-f ${key}="${value}"`)
  }

  return parts.join(' \\\n  ')
}

export default function ParametersCard({ data }: ParametersCardProps) {
  const [copied, setCopied] = useState(false)
  const [workflowParams, setWorkflowParams] = useState<WorkflowInputParams | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadWorkflowParams = async () => {
      if (!data) return
      
      const runId = data.sdk_workflow_run_id as string | undefined
      if (!runId) {
        console.log('[ParametersCard] No sdk_workflow_run_id found in data:', data)
        return
      }

      console.log('[ParametersCard] Starting to load workflow params for run:', runId)
      setLoading(true)
      setError(false)
      const params = await fetchWorkflowInputParams(runId)
      if (params) {
        setWorkflowParams(params)
      } else {
        setError(true)
      }
      setLoading(false)
    }

    loadWorkflowParams()
  }, [data])

  const handleCopyCommand = async () => {
    if (!workflowParams) return

    const command = generateGhCommand(workflowParams)
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (data === null || data === undefined) {
    return (
      <div id="parameters" className="bg-oh-surface border border-oh-border rounded-lg p-4 opacity-50 scroll-mt-24">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span>⚙️</span>
            <h3 className="text-sm font-medium text-oh-text-muted">Parameters</h3>
          </div>
          <SectionMenu id="parameters" />
        </div>
        <p className="text-xs text-oh-text-muted italic">Not available yet</p>
      </div>
    )
  }

  const sectionId = 'parameters'

  return (
    <div id={sectionId} className="bg-oh-surface border border-oh-border rounded-lg p-4 scroll-mt-24">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>⚙️</span>
          <h3 className="text-sm font-medium text-oh-text">Parameters</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCommand}
            disabled={!workflowParams || loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              workflowParams && !loading
                ? 'bg-oh-primary/10 hover:bg-oh-primary/20 text-oh-primary border-oh-primary/30 cursor-pointer'
                : 'bg-oh-surface text-oh-text-muted border-oh-border cursor-not-allowed opacity-50'
            }`}
            title={
              loading
                ? 'Loading workflow parameters...'
                : workflowParams
                ? 'Copy gh workflow run command'
                : error
                ? 'Failed to load workflow parameters (check console for details)'
                : !data?.sdk_workflow_run_id
                ? 'Workflow run ID not available'
                : 'Workflow parameters not available'
            }
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : loading ? (
              <>
                <svg className="w-3.5 h-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </>
            ) : error ? (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Error
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy command
              </>
            )}
          </button>
          <SectionMenu id={sectionId} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(data).map(([key, value]) => (
              <tr key={key} className="border-b border-oh-border/50 last:border-0">
                <td className="py-1.5 pr-4 text-oh-text-muted font-mono text-xs whitespace-nowrap align-top">
                  {key}
                </td>
                <td className="py-1.5 text-oh-text font-mono text-xs break-all">
                  {formatValue(key, value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
