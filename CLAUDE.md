# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on http://localhost:3456
npm run build    # Build for production
npm start        # Run production server (port 3456)
npx tsc --noEmit # Type-check without building
```

No test suite or lint config is currently configured.

## Architecture

A/B Lab analyzes any webpage and generates 5 A/B experiment hypotheses with JS injection code and before/after screenshots — without touching the real site.

**Core data flow:**
```
URL → /api/analyze → Playwright renders HTML (2.5s wait)
  → Claude generates 5 experiments (JSON)
  → Claude critic validates against real DOM
  → Return experiments { status: "pending" }
    → User toggles preview → /api/screenshot
      → Playwright injects code, screenshots control + variant
    → User approves/rejects or refines via /api/refine
```

**Key files:**
- `app/page.tsx` — URL input, tab switching (All / Queue), experiment list
- `components/ExperimentCard.tsx` — Hypothesis, metrics, approve/reject, inline refine
- `components/VariantToggle.tsx` — Before/after screenshot toggle
- `lib/types.ts` — `Experiment` interface (single source of truth for data shape)
- `app/api/analyze/route.ts` — Playwright render + Claude generation + critic pass
- `app/api/screenshot/route.ts` — Playwright code injection + screenshot capture
- `app/api/refine/route.ts` — Claude refinement from natural language feedback

## API Routes

**POST /api/analyze**
- Renders page via Playwright (1440×900, 2.5s hydration wait), truncates HTML to 80KB
- Two Claude Opus 4.6 calls: generation pass (8096 tokens) + critic validation pass (8096 tokens)
- Cost: ~$0.02–0.05 per analysis
- Returns `Experiment[]` with `status: "pending"`

**POST /api/screenshot**
- Injects `injection_code` via `page.evaluate()`, waits 600ms, screenshots both states
- Returns base64 JPEGs; sets `unchanged: true` if control === variant (selector likely missed)
- `maxDuration: 60` (Vercel timeout)

**POST /api/refine**
- Strips screenshots from experiment before sending (avoids API size limit)
- One Claude Opus 4.6 call; preserves `id`, `status`, `page` — rewrites everything else
- Returns updated `Experiment`

## Key Implementation Details

**Experiment shape** (`lib/types.ts`):
```ts
interface Experiment {
  id: string                               // UUID
  status: 'pending' | 'approved' | 'rejected'
  injection_code: string                   // Plain JS statements, no function wrapper
  scroll_to_selector?: string              // Optional: scroll before screenshot
  screenshots?: { control: string; variant: string } // base64 JPEGs, stripped before refine
  // ...hypothesis, metrics, effort, priority, etc.
}
```

**Injection code constraints** (enforced via system prompt):
- Plain statements, no `function` wrapper
- Must use resilient selectors: text content, `data-*`, `aria-*`, semantic HTML
- Must be wrapped in `try/catch` and idempotent

**State management:** React `useState` only — no persistence, no backend DB, experiments are lost on page reload.

**Playwright config:** `serverExternalPackages: ['playwright']` in `next.config.ts` prevents bundling.

## Environment Variables

```
ANTHROPIC_API_KEY   # Required — Claude Opus 4.6
```

See `.env.example`. Never commit `.env.local`.
