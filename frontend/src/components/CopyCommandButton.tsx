import { useState, useEffect } from 'react'

interface CopyCommandButtonProps {
  sdkWorkflowRunId: string | null | undefined
  className?: string
}

async function fetchWorkflowInputParams(runId: string): Promise<Record<string, string> | null> {
  try {
    // Fetch the workflow run jobs
    const jobsUrl = `https://api.github.com/repos/OpenHands/software-agent-sdk/actions/runs/${runId}/jobs`
    const jobsRes = await fetch(jobsUrl)
    
    if (!jobsRes.ok) {
      console.error('[CopyCommandButton] Failed to fetch jobs:', jobsRes.status)
      return null
    }
    
    const jobsData = await jobsRes.json()
    
    // Find the print-parameters job
    const printJob = jobsData.jobs?.find((job: any) => job.name === 'print-parameters')
    if (!printJob) {
      console.error('[CopyCommandButton] print-parameters job not found')
      return null
    }

    // Fetch the job logs
    const logsUrl = `https://api.github.com/repos/OpenHands/software-agent-sdk/actions/jobs/${printJob.id}/logs`
    const logsRes = await fetch(logsUrl)
    
    if (!logsRes.ok) {
      console.error('[CopyCommandButton] Failed to fetch logs:', logsRes.status)
      return null
    }
    
    const logs = await logsRes.text()

    // Parse the "=== Input Parameters ===" section
    const paramsMatch = logs.match(/=== Input Parameters ===\n([\s\S]*?)(?=\n===|\n\n|$)/)
    if (!paramsMatch) {
      console.error('[CopyCommandButton] Could not find Input Parameters section')
      return null
    }

    const paramsSection = paramsMatch[1]
    const params: Record<string, string> = {}

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

    return params
  } catch (error) {
    console.error('[CopyCommandButton] Failed to fetch workflow input params:', error)
    return null
  }
}

function generateGhCommand(params: Record<string, string>): string {
  const parts = [
    'gh workflow run run-eval.yml',
    '--repo OpenHands/software-agent-sdk',
  ]

  for (const [key, value] of Object.entries(params)) {
    parts.push(`-f ${key}="${value}"`)
  }

  return parts.join(' \\\n  ')
}

export default function CopyCommandButton({ sdkWorkflowRunId, className = '' }: CopyCommandButtonProps) {
  const [copied, setCopied] = useState(false)
  const [workflowParams, setWorkflowParams] = useState<Record<string, string> | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadWorkflowInputs = async () => {
      if (!sdkWorkflowRunId) {
        setWorkflowParams(null)
        return
      }
      
      setLoading(true)
      const params = await fetchWorkflowInputParams(sdkWorkflowRunId)
      setWorkflowParams(params)
      setLoading(false)
    }
    
    loadWorkflowInputs()
  }, [sdkWorkflowRunId])

  const handleCopyCommand = async () => {
    if (!workflowParams) return

    const command = generateGhCommand(workflowParams)
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Don't render if no SDK workflow run ID
  if (!sdkWorkflowRunId) {
    return null
  }

  return (
    <button
      onClick={handleCopyCommand}
      disabled={!workflowParams || loading}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
        workflowParams && !loading
          ? 'bg-oh-primary/10 hover:bg-oh-primary/20 text-oh-primary border-oh-primary/30 cursor-pointer'
          : 'bg-oh-surface text-oh-text-muted border-oh-border cursor-not-allowed opacity-50'
      } ${className}`}
      title={
        loading
          ? 'Loading workflow parameters...'
          : workflowParams
          ? 'Copy gh workflow run command'
          : 'No workflow inputs found in parameters'
      }
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : loading ? (
        <>
          <svg className="w-3 h-3 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </>
      ) : (
        <>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy command
        </>
      )}
    </button>
  )
}
