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

  // Metadata map for all runs (used by the list view for status)
  const [runMetadataMap, setRunMetadataMap] = useState<Record<string, RunMetadata>>({})
  const [loadingMetadataList, setLoadingMetadataList] = useState(false)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelectedRun(null)
    setRunMetadata(null)
    setRunMetadataMap({})
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

  // Fetch metadata for all runs to show status in the list
  const loadAllMetadata = useCallback(async (runSlugs: string[]) => {
    if (runSlugs.length === 0) return
    setLoadingMetadataList(true)
    const batchSize = 10
    for (let i = 0; i < runSlugs.length; i += batchSize) {
      const batch = runSlugs.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async slug => {
          try {
            const metadata = await fetchRunMetadata(slug)
            return { slug, metadata }
          } catch {
            return { slug, metadata: null }
          }
        })
      )
      const batchMap: Record<string, RunMetadata> = {}
      results.forEach(({ slug, metadata }) => {
        if (metadata) batchMap[slug] = metadata
      })
      setRunMetadataMap(prev => ({ ...prev, ...batchMap }))
    }
    setLoadingMetadataList(false)
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  // When runs are loaded, fetch all their metadata
  useEffect(() => {
    if (runs.length > 0 && !selectedRun) {
      loadAllMetadata(runs)
    }
  }, [runs, selectedRun, loadAllMetadata])

  const handleSelectRun = async (slug: string) => {
    setSelectedRun(slug)
    setLoadingMetadata(true)
    // Use cached metadata if available
    const cached = runMetadataMap[slug]
    if (cached) {
      setRunMetadata(cached)
      setLoadingMetadata(false)
    } else {
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
            runMetadataMap={runMetadataMap}
            loadingMetadataList={loadingMetadataList}
          />
        )}
      </main>
    </div>
  )
}
