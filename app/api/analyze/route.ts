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

const CRITIC_SYSTEM = `You are a QA reviewer for A/B experiments. Given a webpage's rendered HTML and a list of proposed experiments, validate each one and fix problems before they reach the user.

For each experiment check:
1. Does the element being modified actually exist in the HTML? If not, rewrite the experiment to target something that does exist.
2. Is the proposed variant genuinely different from the current page state? (e.g. do not suggest adding an accordion if one already exists, do not reference a free trial if there is no free trial on the page)
3. Does the injection_code use selectors likely to match real elements in the HTML?

Return the same JSON array format. Fix broken experiments by rewriting them. Remove unfixable ones. It is fine to return fewer than 5.
Return ONLY a valid JSON array. No markdown, no explanation, no code fences.`

const CRITIC_PROMPT = (experiments: object[], html: string) =>
  `Here are the proposed experiments:\n${JSON.stringify(experiments, null, 2)}\n\nHere is the rendered page HTML (may be truncated):\n${html}`

function parseJSON(raw: string): object[] | null {
  const cleaned = raw.replace(/^` + '```' + `(?:json)?\n?/m, '').replace(/\n?` + '```' + `$/m, '').trim()
  try { return JSON.parse(cleaned) as object[] } catch { return null }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

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
    await page.waitForTimeout(2500)
    html = await page.content()
    await browser.close()
    browser = null
  } catch (e) {
    if (browser) await browser.close()
    return NextResponse.json({ error: `Could not render ${url}: ${e instanceof Error ? e.message : e}` }, { status: 400 })
  }

  const truncated = html.slice(0, 80000)

  // Step 1: Generate experiments
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
    return NextResponse.json({ error: e instanceof Error ? e.message : 'OpenAI API error' }, { status: 500 })
  }

  const parsed = parseJSON(raw)
  if (!parsed) return NextResponse.json({ error: 'Failed to parse experiments as JSON', raw }, { status: 500 })

  // Step 2: Critic pass — validate and fix against the real HTML
  let validated = parsed
  try {
    const criticCompletion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 8096,
      messages: [
        { role: 'system', content: CRITIC_SYSTEM },
        { role: 'user', content: CRITIC_PROMPT(parsed, truncated) },
      ],
    })
    const criticRaw = criticCompletion.choices[0]?.message?.content ?? ''
    validated = parseJSON(criticRaw) ?? parsed
  } catch {
    // Critic failed — fall back to original unvalidated experiments
  }

  const result: Experiment[] = (validated as Omit<Experiment, 'id' | 'status'>[]).map(exp => ({
    ...exp,
    id: randomUUID(),
    status: 'pending',
  }))

  return NextResponse.json({ experiments: result })
}
