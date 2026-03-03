import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { Experiment } from '@/lib/types'

const client = new OpenAI()

const SYSTEM_PROMPT = `You are a growth PM and front-end developer refining an A/B experiment based on user feedback.

Given the current experiment and a piece of natural language feedback, return an updated version of the full experiment JSON object. Apply the feedback to whichever fields it implies: hypothesis, variant_description, injection_code, location, effort, priority, primary_metric, guardrail_metric, scroll_to_selector.

Rules for injection_code:
- Plain JavaScript statements only (not wrapped in a function)
- DOM modifications only — no fetch/XHR, no localStorage
- Use resilient selectors: text content matches, data-* attributes, aria labels
- Wrap in try/catch
- Idempotent — safe to run multiple times

Keep the same "id" and "status" from the input. Keep "page" unchanged.
Return ONLY the updated JSON object. No markdown, no explanation, no code fences.`

export async function POST(req: NextRequest) {
  const { experiment, feedback } = await req.json() as { experiment: Experiment; feedback: string }

  if (!experiment || !feedback?.trim()) {
    return NextResponse.json({ error: 'experiment and feedback are required' }, { status: 400 })
  }

  let raw = ''
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Current experiment:\n${JSON.stringify(experiment, null, 2)}\n\nUser feedback: ${feedback}`,
        },
      ],
    })
    raw = completion.choices[0]?.message?.content ?? ''
    if (!raw) throw new Error('Empty response')
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'OpenAI API error' }, { status: 500 })
  }

  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  let updated: Experiment
  try {
    updated = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse refined experiment as JSON', raw }, { status: 500 })
  }

  // Ensure immutable fields are preserved
  updated.id = experiment.id
  updated.status = experiment.status
  updated.page = experiment.page

  return NextResponse.json({ experiment: updated })
}
