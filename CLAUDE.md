# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

**Fourteen Fisherman** — medical education SaaS for GP trainees preparing for the SCA exam. Brand identity is premium modern SaaS (Linear, Arc aesthetic), not clinical/medical. Two user-facing tools:

1. **Clinical Master** — Voice SCA consultation practice with AI patient (primary product)
2. **Portfolio Tool** — Generates GP portfolio case reviews (CCRs) — has active users, don't remove or hide

## Commands

```bash
npm run dev        # Dev server (Turbopack) — localhost:3000
npm run build      # Production build
npm run lint       # ESLint
```

No test runner configured (no Jest/Vitest).

## Architecture

Next.js 15 App Router, TypeScript, Tailwind CSS 3, Framer Motion, React 19.

### Routes

- `/` — Landing page
- `/auth/` — Supabase JWT auth; protected routes in `middleware.ts` → `lib/supabase/middleware.ts`
- `/dashboard/` — Post-login home: history, library, feedback, settings tabs
- `/clinical-master/station/[stationId]` — Pre-consultation brief
- `/clinical-master/session/[sessionId]` — Live consultation (LiveKit)
- `/clinical-master/feedback/[sessionId]` — Scored feedback
- `/portfolio/`, `/cases/` — Portfolio tool UI
- `/try/` — Unauthenticated free trial (API routes at `app/api/try/`)
- `/pricing/`, `/admin/`

### Data Flow

- **Supabase** (`lib/supabase/`) — auth + all DB. Client: `client.ts`, Server: `server.ts`, queries in `queries/`
- **Azure backend** via `lib/api.ts` — base URL `https://caseforge2025a.azurewebsites.net/api` (override with `NEXT_PUBLIC_API_BASE_URL`)
- `next.config.js` rewrites ALL `/api/*` → `http://localhost:8000/api` in dev
- LiveKit tokens: `app/api/livekit-token/route.ts`
- Feedback generation: `app/api/generate-feedback/route.ts` (Gemini)

### Key Files

- `hooks/useLiveKitSession.ts` — LiveKit room connection, transcript collection, mute state
- `lib/api.ts` — All Azure Functions API calls (portfolio tool)
- `lib/types.ts` — Shared TypeScript types
- `components/landing/` — Landing page sections
- `components/clinical-master/` — Consultation UI components
- `components/cases/` — Portfolio tool components
- `components/magicui/` — Magic UI animation components

### State

Local React state only. Supabase is source of truth; LiveKit for ephemeral real-time state. No Zustand/Redux.

## Design System

- **Font:** Plus Jakarta Sans (body), JetBrains Mono (code)
- **Palette:** Warm amber/stone — primary `#B45309`, surfaces `#FAFAF7`/`#FFFCF8`/`#F5F0EB`, heading `#1C1917`, body `#44403C`
- **Legacy:** `medical-blue: #0EA5E9` kept for portfolio tool compat
- **Shadows:** `elevation-1` through `elevation-4` in tailwind config
- **Animations:** Framer Motion required for all UI work. Custom keyframes for marquee, shimmer, border-beam in tailwind config.
- **Style:** Typography-driven flowing layouts, NOT boxy card grids. Only box things that earn a container. Features as numbered rows, stats as big type between rules, testimonials as big quote text. No purple (too "AI"). Warm earth tones.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_LIVEKIT_URL          # wss://...livekit.cloud
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
NEXT_PUBLIC_ELEVENLABS_AGENT_ID
GOOGLE_API_KEY                   # Gemini — /api/generate-feedback
NEXT_PUBLIC_CLINICAL_MASTER_URL  # http://localhost:8000 for local dev
```

## Deployment

Vercel. Domain: `www.fourteenfisherman.com`. Images configured for `case-forge-frontend-n5fd.vercel.app` and `www.fourteenfisherman.com`.

## Backend Dependency

The Python backend lives in a sibling repo at `../CaseForgeAzure/`. For local dev, run the Clinical Master agent (`cd ../CaseForgeAzure/clinical_master && uv run python agent.py start`) alongside this dev server — the Next.js rewrite proxies `/api/*` to `localhost:8000`.
