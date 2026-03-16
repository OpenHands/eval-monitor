import { useState, useEffect, useCallback } from 'react'
import { fetchRunList, fetchRunMetadata, parseRunSlug, getStageStatus } from './api'
import type { RunMetadata } from './api'
import RunListView from './components/RunListView'
import RunDetailView from './components/RunDetailView'
import Header from './components/Header'

function getTodayUTC(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

export default function App() {
  const [date, setDate] = useState(getTodayUTC)
  const [runs, setRuns] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [runMetadata, setRunMetadata] = useState<RunMetadata | null>(null)
  const [loadingMetadata, setLoadingMetadata] = useState(false)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelectedRun(null)
    setRunMetadata(null)
    try {
      const list = await fetchRunList(date)
      setRuns(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs')
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  const handleSelectRun = async (slug: string) => {
    setSelectedRun(slug)
    setLoadingMetadata(true)
    setRunMetadata(null)
    try {
      const metadata = await fetchRunMetadata(slug)
      setRunMetadata(metadata)
    } catch {
      setRunMetadata(null)
    } finally {
      setLoadingMetadata(false)
    }
  }

  const handleBack = () => {
    setSelectedRun(null)
    setRunMetadata(null)
  }

  const handleRefresh = () => {
    if (selectedRun) {
      handleSelectRun(selectedRun)
    } else {
      loadRuns()
    }
  }

  // Derive quick status summaries for the run list
  const runSummaries = runs.map(slug => {
    const parsed = parseRunSlug(slug)
    return { slug, ...parsed }
  })

  return (
    <div className="min-h-screen bg-oh-bg">
      <Header
        date={date}
        onDateChange={setDate}
        onRefresh={handleRefresh}
        selectedRun={selectedRun}
        onBack={handleBack}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {selectedRun ? (
          <RunDetailView
            slug={selectedRun}
            metadata={runMetadata}
            loading={loadingMetadata}
            status={runMetadata ? getStageStatus(runMetadata) : 'pending'}
          />
        ) : (
          <RunListView
            runs={runSummaries}
            loading={loading}
            error={error}
            onSelectRun={handleSelectRun}
          />
        )}
      </main>
    </div>
  )
}
