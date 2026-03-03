'use client'

import { useState } from 'react'
import { Experiment } from '@/lib/types'
import VariantToggle from './VariantToggle'

interface Props {
  experiment: Experiment
  pageUrl: string
  onUpdate: (updates: Partial<Experiment>) => void
}

const EFFORT: Record<string, string> = {
  Low: 'bg-emerald-500/10 text-emerald-400',
  Medium: 'bg-yellow-500/10 text-yellow-400',
  High: 'bg-red-500/10 text-red-400',
}

const PRIORITY: Record<number, string> = {
  5: 'bg-red-500/15 text-red-400',
  4: 'bg-orange-500/15 text-orange-400',
  3: 'bg-blue-500/15 text-blue-400',
  2: 'bg-gray-500/15 text-gray-400',
  1: 'bg-gray-500/15 text-gray-500',
}

export default function ExperimentCard({ experiment: exp, pageUrl, onUpdate }: Props) {
  const [showPreview, setShowPreview] = useState(false)
  const [showCode, setShowCode] = useState(false)

  const isApproved = exp.status === 'approved'
  const isRejected = exp.status === 'rejected'

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border p-5 transition-opacity ${
        isApproved
          ? 'border-emerald-500/30 bg-gray-900'
          : isRejected
          ? 'border-gray-800 bg-gray-900/50 opacity-40'
          : 'border-gray-800 bg-gray-900'
      }`}
    >
      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${PRIORITY[exp.priority] ?? PRIORITY[1]}`}>
          P{exp.priority}
        </span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${EFFORT[exp.effort]}`}>
          {exp.effort}
        </span>
        <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
          {exp.location}
        </span>
        {isApproved && (
          <span className="ml-auto rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
            ✓ Approved
          </span>
        )}
      </div>

      {/* Hypothesis */}
      <p className="text-sm leading-relaxed text-gray-200">{exp.hypothesis}</p>

      {/* Variant description */}
      <p className="text-xs leading-relaxed text-gray-500">{exp.variant_description}</p>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-gray-800 p-2.5">
          <div className="mb-0.5 text-gray-500">Primary metric</div>
          <div className="text-gray-200">{exp.primary_metric}</div>
        </div>
        <div className="rounded-lg bg-gray-800 p-2.5">
          <div className="mb-0.5 text-gray-500">Guardrail</div>
          <div className="text-gray-200">{exp.guardrail_metric}</div>
        </div>
      </div>

      {/* Injection code toggle */}
      <button
        onClick={() => setShowCode(v => !v)}
        className="text-left text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        {showCode ? '▾ Hide' : '▸ Show'} injection code
      </button>
      {showCode && (
        <pre className="overflow-x-auto rounded-lg bg-gray-800 p-3 text-xs text-gray-400 whitespace-pre-wrap break-all">
          {exp.injection_code}
        </pre>
      )}

      {/* Screenshot preview */}
      {!showPreview ? (
        <button
          onClick={() => setShowPreview(true)}
          className="text-left text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          + Preview control vs variant →
        </button>
      ) : (
        <VariantToggle
          pageUrl={pageUrl}
          injectionCode={exp.injection_code}
          scrollToSelector={exp.scroll_to_selector}
          experimentId={exp.id}
          cached={exp.screenshots}
          onLoaded={(s) => onUpdate({ screenshots: s })}
        />
      )}

      {/* Actions */}
      {!isRejected && (
        <div className="flex gap-2 border-t border-gray-800 pt-3">
          {!isApproved ? (
            <>
              <button
                onClick={() => onUpdate({ status: 'approved' })}
                className="flex-1 rounded-lg bg-emerald-700 py-1.5 text-xs font-medium transition-colors hover:bg-emerald-600"
              >
                Approve
              </button>
              <button
                onClick={() => onUpdate({ status: 'rejected' })}
                className="flex-1 rounded-lg bg-gray-800 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-700"
              >
                Reject
              </button>
            </>
          ) : (
            <button
              onClick={() => onUpdate({ status: 'pending' })}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Undo approval
            </button>
          )}
        </div>
      )}
    </div>
  )
}
