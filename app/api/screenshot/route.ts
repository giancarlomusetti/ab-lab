import { chromium } from 'playwright'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { url, injection_code, scroll_to_selector } = await req.json()

  if (!url || !injection_code) {
    return NextResponse.json({ error: 'url and injection_code are required' }, { status: 400 })
  }

  let browser = null
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })

    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Wait for JS to settle
    await page.waitForTimeout(2500)

    // Scroll to the relevant element if provided
    if (scroll_to_selector) {
      try {
        await page.locator(scroll_to_selector).first().scrollIntoViewIfNeeded({ timeout: 3000 })
        await page.waitForTimeout(300)
      } catch {
        // Selector might not match — fall back to top of page
      }
    }

    // Control screenshot
    const controlBuf = await page.screenshot({ type: 'jpeg', quality: 80 })
    const control = controlBuf.toString('base64')

    // Inject variant — capture return value for diagnostics
    let injectionError: string | null = null
    try {
      await page.evaluate(injection_code)
    } catch (e) {
      injectionError = e instanceof Error ? e.message : String(e)
    }
    await page.waitForTimeout(600)

    // Variant screenshot (same scroll position)
    const variantBuf = await page.screenshot({ type: 'jpeg', quality: 80 })
    const variant = variantBuf.toString('base64')

    await browser.close()
    browser = null

    // Warn if nothing visibly changed
    const unchanged = controlBuf.equals(variantBuf)

    return NextResponse.json({
      control,
      variant,
      unchanged,
      injectionError,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Screenshot failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    if (browser) await browser.close()
  }
}
