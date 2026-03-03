'use client'

import { useState } from 'react'
import { Experiment } from '@/lib/types'
import ExperimentCard from '@/components/ExperimentCard'

type Stage = 'idle' | 'analyzing' | 'results'

export default function Home() {
  const [url, setUrl] = useState('https://splice.com/plans')
  const [stage, setStage] = useState<Stage>('idle')
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'queue'>('all')

  const analyze = async () => {
    if (!url || stage === 'analyzing') return
    setStage('analyzing')
    setError(null)
    setExperiments([])
    setTab('all')

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setExperiments(data.experiments)
      setStage('results')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStage('idle')
    }
  }

  const update = (id: string, updates: Partial<Experiment>) => {
    setExperiments(prev => prev.map(e => (e.id === id ? { ...e, ...updates } : e)))
  }

  const approved = experiments.filter(e => e.status === 'approved')
  const visible = tab === 'queue' ? approved : experiments

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">A/B Lab</h1>
            <p className="text-xs text-gray-500">Claude-powered experiment design</p>
          </div>
          {stage === 'results' && (
            <div className="flex gap-2 text-xs">
              <span className="rounded bg-yellow-500/10 px-2 py-1 text-yellow-400">
                {experiments.filter(e => e.status === 'pending').length} pending
              </span>
              <span className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-400">
                {approved.length} approved
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* URL input */}
        <div className="mb-8 flex gap-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            placeholder="https://splice.com/plans"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={analyze}
            disabled={!url || stage === 'analyzing'}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {stage === 'analyzing' ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {stage === 'analyzing' && (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-sm text-gray-500">
              Claude is reading <span className="text-gray-300">{url}</span> and designing experiments…
            </p>
          </div>
        )}

        {/* Results */}
        {stage === 'results' && (
          <>
            {/* Tabs */}
            <div className="mb-6 flex w-fit gap-1 rounded-lg bg-gray-900 p-1">
              {(['all', 'queue'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                    tab === t ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t === 'all' ? `Experiments (${experiments.length})` : `Queue (${approved.length})`}
                </button>
              ))}
            </div>

            {/* Cards */}
            {visible.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-600">
                {tab === 'queue'
                  ? 'No experiments approved yet — review them in the Experiments tab.'
                  : 'No experiments generated.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {visible.map(exp => (
                  <ExperimentCard
                    key={exp.id}
                    experiment={exp}
                    pageUrl={url}
                    onUpdate={updates => update(exp.id, updates)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {stage === 'idle' && !error && (
          <div className="mt-16 text-center">
            <p className="text-sm text-gray-600">
              Enter any URL above — Claude will analyze the page and generate A/B experiment hypotheses with before/after screenshots.
            </p>
            <p className="mt-2 text-xs text-gray-700">
              Try: splice.com/plans · stripe.com/pricing · notion.so
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
