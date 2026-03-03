# A/B Lab

**AI-powered experiment design for growth PMs.** Point it at any webpage — it analyzes the live rendered DOM, generates A/B experiment hypotheses with injection code, and shows you before/after screenshots without touching the real site.

Built as a portfolio project for a Senior PM, Growth role at a music tech company (Splice). Demonstrates growth funnel thinking, experimentation frameworks, and AI product integration.

---

## The Problem

Growth PMs spend hours manually auditing pages, writing hypotheses in Notion docs, and waiting on engineering to stub out variants before anyone can see what the experiment actually looks like. The feedback loop from "I have an idea" to "I can show this to a stakeholder" is days, not minutes.

## The Solution

A/B Lab compresses that loop to ~30 seconds:

1. **Paste a URL** — Playwright renders the full page including JavaScript
2. **Claude analyzes the DOM** — generates 5 experiment hypotheses with copy, selectors, and metrics
3. **Toggle control vs variant** — Playwright injects the change and screenshots both states
4. **Approve to queue** — approved experiments move to a launch-ready list

No design tools. No engineering handoff. No fake wireframes.

---

## Demo

![A/B Lab analyzing splice.com/plans](https://github.com/giancarlomusetti/ab-lab/raw/main/docs/demo.png)

Each experiment card includes:
- **Hypothesis** in standard `If we X, then Y because Z` format
- **Primary metric** to optimize + **guardrail metric** to protect
- **Effort estimate** (Low / Medium / High) and **priority score** (P1–P5)
- **Injection code** — the actual JS that implements the variant
- **Before/after screenshot toggle** rendered on the real live page

---

## Key Product Decisions

**Why Playwright instead of raw HTML fetch?**
Modern SaaS sites (Next.js, React) render most content client-side. A raw `fetch()` returns a skeleton — not what the user actually sees. Playwright waits for hydration, so the AI sees the real DOM and generates selectors that actually work.

**Why screenshot injection instead of a visual editor?**
Point-and-click editors (Optimizely, VWO) require an installed script on the target site. Injection via Playwright works on *any* URL with zero setup — useful for competitive analysis and auditing sites you don't own.

**Why a queue instead of direct export?**
The approval queue separates "AI brainstormed this" from "a PM reviewed and validated this." Experiments in the queue are human-approved hypotheses, not raw model output. This mirrors how real experimentation tools (LaunchDarkly, Amplitude Experiment) gate launch.

**Tradeoff: analysis latency vs. selector accuracy**
Using Playwright to get rendered HTML adds ~5s to analysis time vs. a raw fetch. The payoff: injection code that actually finds elements because it targets the real DOM, not the server-rendered skeleton. Worth it.

---

## What I'd Build Next

- **Critic agent** — a second AI pass that validates each experiment against the rendered HTML before showing it (catches hallucinations like suggesting a "free trial" CTA when none exists)
- **Injection retry loop** — when a variant screenshot is identical to control, automatically rewrite the selector and retry (up to 3 attempts), surfacing live status in the UI
- **Export to Optimizely / LaunchDarkly** — generate experiment configs directly from the queue
- **Funnel chaining** — analyze multiple pages in sequence and identify cross-page drop-off hypotheses
- **Mobile viewport toggle** — many growth experiments behave differently at 375px

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | API routes + React in one repo |
| AI | OpenAI GPT-4o | Strong instruction-following for structured JSON + code generation |
| Browser | Playwright (Chromium) | Full JS rendering, reliable screenshot API |
| Styling | Tailwind CSS | Fast iteration, no context-switching |
| Language | TypeScript (strict) | Catches selector/type mismatches at compile time |

---

## Running Locally

```bash
git clone https://github.com/giancarlomusetti/ab-lab
cd ab-lab
npm install
npx playwright install chromium

cp .env.example .env.local
# Add your OPENAI_API_KEY to .env.local

npm run dev
# → http://localhost:3456
```

**Cost:** ~$0.02–0.05 per analysis (GPT-4o input tokens). Screenshots are free — Playwright runs locally.

---

## Project Context

This was built in a single session using Claude Code as part of researching a Senior PM, Growth role at Splice. The goal was to build something that demonstrates growth thinking in practice rather than describing it — a working tool that generates the kind of experiment backlog a growth PM would actually maintain.

The Splice analysis surfaced three structural gaps in their `/plans` page: no social proof, undifferentiated CTAs, and pricing anxiety with no pre-emption. Those findings are documented in the [initial analysis prompt output](https://github.com/giancarlomusetti/ab-lab).
