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
- `/clinical-master/session/[sessionId]` — Live consultation (browser↔Azure gpt-realtime over WebRTC)
- `/clinical-master/feedback/[sessionId]` — Scored feedback
- `/portfolio/`, `/cases/` — Portfolio tool UI
- `/try/` — Unauthenticated free trial (API routes at `app/api/try/`)
- `/pricing/`, `/admin/`

### Data Flow

- **Supabase** (`lib/supabase/`) — auth + all DB. Client: `client.ts`, Server: `server.ts`, queries in `queries/`
- **Azure backend** via `lib/api.ts` — base URL `https://caseforge2025a.azurewebsites.net/api` (override with `NEXT_PUBLIC_API_BASE_URL`)
- `next.config.js` rewrites ALL `/api/*` → `http://localhost:8000/api` in dev
- **Clinical Master voice**: browser connects directly to Azure `gpt-realtime` (speech-to-speech) over WebRTC. `app/api/realtime-token/route.ts` (+ `app/api/try/realtime-token`) mints a short-lived Azure ephemeral key server-side; the real Azure key never reaches the client. Transcript persisted via `app/api/clinical-master/save-transcript`.
- Feedback generation: `app/api/generate-feedback/route.ts` (Gemini)

### Key Files

- `hooks/useRealtimeSession.ts` — WebRTC connection to Azure gpt-realtime, transcript collection, speaking/mute state, function tools, consultation timer
- `lib/clinical-master/` — `patientPrompt.ts` (patient system prompt), `realtimeSession.ts` (Azure session config + tools), `realtimeToken.ts` (ephemeral-key minting, server-only)
- `lib/api.ts` — All Azure Functions API calls (portfolio tool)
- `lib/types.ts` — Shared TypeScript types
- `components/landing/` — Landing page sections
- `components/clinical-master/` — Consultation UI components
- `components/cases/` — Portfolio tool components
- `components/magicui/` — Magic UI animation components

### State

Local React state only. Supabase is source of truth; the WebRTC realtime connection holds ephemeral in-call state. No Zustand/Redux.

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
AZURE_OPENAI_REALTIME_ENDPOINT   # https://<resource>.openai.azure.com
AZURE_OPENAI_REALTIME_API_KEY    # server-only; ephemeral keys minted from it
AZURE_OPENAI_REALTIME_DEPLOYMENT # gpt-realtime-2
GOOGLE_API_KEY                   # Gemini — /api/generate-feedback
```

These three `AZURE_OPENAI_REALTIME_*` vars must also be set in Vercel for the deployed Clinical Master voice to work.

## Deployment

Vercel. Domain: `www.fourteenfisherman.com`. Images configured for `case-forge-frontend-n5fd.vercel.app` and `www.fourteenfisherman.com`.

## Backend Dependency

The Python backend lives in a sibling repo at `../CaseForgeAzure/` and serves only the **Portfolio tool** (Azure Functions). For local dev, run it so the Next.js rewrite can proxy `/api/*` (portfolio endpoints) to `localhost:8000`. The Clinical Master voice no longer has a Python service — the browser talks directly to Azure gpt-realtime, so nothing extra needs to run locally for voice.
