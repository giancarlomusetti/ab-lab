import OpenAI from 'openai'
import { chromium } from 'playwright'
import { NextRequest, NextResponse } from 'next/server'
import { Experiment } from '@/lib/types'
import { randomUUID } from 'crypto'

const client = new OpenAI()

const SYSTEM_PROMPT = `You are a senior growth PM and front-end developer specializing in B2C SaaS conversion optimization.

When given a webpage's HTML, you generate high-quality A/B experiment hypotheses AND the JavaScript code to implement each variant on the live page.

Your injection code must:
- Be plain JavaScript statements (NOT wrapped in a function, just the statements)
- Only modify the DOM — no fetch/XHR calls, no localStorage writes
- Use resilient selectors: prefer text content matches, data-* attributes, aria labels, and semantic HTML over hashed class names
- Wrap in try/catch to fail silently if a selector doesn't match
- Be idempotent — safe to run multiple times
- Make the change immediately visible without a page reload

Example injection_code format:
"try { var btn = document.querySelector('button[data-plan=\"creator\"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Try Splice')); if (btn) { btn.textContent = 'Start free — 200 sounds on us'; } } catch(e) {}"

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.`

const USER_PROMPT = (url: string, html: string) => `Analyze this page for A/B experiment opportunities.

URL: ${url}

HTML (may be truncated):
${html}

Generate exactly 5 experiment hypotheses. For each, return a JSON object with these exact fields:
{
  "page": "page path e.g. /plans",
  "location": "specific element or section e.g. Hero CTA button",
  "hypothesis": "If we [change X], then [metric] will [increase/decrease] because [reason]",
  "variant_description": "what the variant looks like or says",
  "primary_metric": "the metric this experiment optimizes",
  "guardrail_metric": "the metric we must not hurt",
  "effort": "Low" or "Medium" or "High",
  "priority": integer 1-5 (5 = highest impact),
  "injection_code": "javascript statements string that implements the variant on the live page",
  "scroll_to_selector": "a CSS selector for the element to scroll to before screenshotting (optional, omit if above fold)"
}

Focus on: CTA copy, social proof, pricing clarity, onboarding friction, trust signals.
Prioritize low-effort, high-priority experiments first.`

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  // Use Playwright to get the fully rendered DOM — raw fetch misses React hydration
  let html = ''
  let browser = null
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2500) // let React hydrate
    html = await page.content()
    await browser.close()
    browser = null
  } catch (e) {
    if (browser) await browser.close()
    return NextResponse.json({ error: `Could not render ${url}: ${e instanceof Error ? e.message : e}` }, { status: 400 })
  }

  // Trim to ~80k chars to stay within token budget
  const truncated = html.slice(0, 80000)

  let raw = ''
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 8096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT(url, truncated) },
      ],
    })
    raw = completion.choices[0]?.message?.content ?? ''
    if (!raw) throw new Error('Empty response from OpenAI')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OpenAI API error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Strip markdown fences if Claude wrapped the JSON
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  let experiments: Omit<Experiment, 'id' | 'status'>[]
  try {
    experiments = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response as JSON', raw }, { status: 500 })
  }

  const result: Experiment[] = experiments.map(exp => ({
    ...exp,
    id: randomUUID(),
    status: 'pending',
  }))

  return NextResponse.json({ experiments: result })
}
