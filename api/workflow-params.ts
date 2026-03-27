import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { runId } = req.query

  if (!runId || typeof runId !== 'string') {
    return res.status(400).json({ error: 'runId query parameter is required' })
  }

  try {
    // Fetch the workflow run jobs
    const jobsUrl = `https://api.github.com/repos/OpenHands/software-agent-sdk/actions/runs/${runId}/jobs`
    const jobsRes = await fetch(jobsUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'eval-monitor',
      },
    })

    if (!jobsRes.ok) {
      console.error(`Failed to fetch jobs: ${jobsRes.status}`)
      return res.status(jobsRes.status).json({ error: 'Failed to fetch workflow jobs' })
    }

    const jobsData = await jobsRes.json()

    // Find the print-parameters job
    const printJob = jobsData.jobs?.find((job: any) => job.name === 'print-parameters')
    if (!printJob) {
      return res.status(404).json({ error: 'print-parameters job not found' })
    }

    // Fetch the job logs
    const logsUrl = `https://api.github.com/repos/OpenHands/software-agent-sdk/actions/jobs/${printJob.id}/logs`
    const logsRes = await fetch(logsUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'eval-monitor',
      },
    })

    if (!logsRes.ok) {
      console.error(`Failed to fetch logs: ${logsRes.status}`)
      return res.status(logsRes.status).json({ error: 'Failed to fetch job logs' })
    }

    const logs = await logsRes.text()

    // Parse the "=== Input Parameters ===" section
    const paramsMatch = logs.match(/=== Input Parameters ===\n([\s\S]*?)(?=\n===|\n\n|$)/)
    if (!paramsMatch) {
      return res.status(404).json({ error: 'Input Parameters section not found in logs' })
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

    return res.status(200).json({ params })
  } catch (error) {
    console.error('Error fetching workflow params:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
