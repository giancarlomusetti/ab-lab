'use client'

import { useState, useEffect } from 'react'

interface Screenshots {
  control: string
  variant: string
  unchanged?: boolean
  injectionError?: string | null
}

interface Props {
  pageUrl: string
  injectionCode: string
  scrollToSelector?: string
  experimentId: string
  cached?: Screenshots
  onLoaded: (s: Screenshots) => void
}

export default function VariantToggle({
  pageUrl,
  injectionCode,
  scrollToSelector,
  experimentId,
  cached,
  onLoaded,
}: Props) {
  const [shots, setShots] = useState<Screenshots | null>(cached ?? null)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<'control' | 'variant'>('control')

  useEffect(() => {
    if (cached) return
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: pageUrl,
            injection_code: injectionCode,
            scroll_to_selector: scrollToSelector,
            experiment_id: experimentId,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Screenshot failed')
        if (!cancelled) {
          setShots(data)
          onLoaded(data)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg bg-gray-800 h-44 flex flex-col items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-500">Playwright is rendering the page…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
        {error}
      </div>
    )
  }

  if (!shots) return null

  return (
    <div className="space-y-2">
      {shots.unchanged && (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2.5 text-xs text-yellow-400">
          ⚠ Variant looks identical to control. The selector may not match the live page. Use 'Refine' below to describe what should change.
          {shots.injectionError && <span className="block mt-1 text-yellow-600">{shots.injectionError}</span>}
        </div>
      )}
      <div className="flex items-center gap-1 bg-gray-800 p-0.5 rounded-lg w-fit">
        <button
          onClick={() => setActive('control')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            active === 'control' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'
          }`}
        >
          Control
        </button>
        <button
          onClick={() => setActive('variant')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            active === 'variant' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Variant
        </button>
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-700 max-h-72 overflow-y-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/jpeg;base64,${active === 'control' ? shots.control : shots.variant}`}
          alt={active}
          className="w-full"
        />
      </div>
    </div>
  )
}
