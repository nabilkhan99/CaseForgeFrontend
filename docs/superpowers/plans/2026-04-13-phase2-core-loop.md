# Phase 2: Core Loop (Brief → Consultation → Feedback) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT CONTEXT:** This is Phase 2 of a 5-phase product overhaul. Read the full spec at `docs/superpowers/specs/2026-04-13-product-overhaul.md` for the big picture. Phase 1 (design system) must be completed first — this phase uses the `components/ui/` components created there.

**Goal:** Redesign the three core product screens (Reading Brief, Live Consultation, Feedback) from dark mode to warm editorial aesthetic, fix all critical flow bugs (session creation, timer, dead buttons, incomplete feedback data), and create the session creation API endpoints.

**Architecture:** Each screen is a full page rewrite. The Reading Brief and Feedback pages use Phase 1's Container, PrimaryButton, ScoreBadge components. The Consultation page is a minimal full-screen voice UI. Two new API routes handle session creation (authenticated + guest). The feedback API is patched to pull from all domains.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Framer Motion, Supabase, LiveKit

**Current files to understand:**
- `app/clinical-master/station/[stationId]/page.tsx` — Reading phase (dark, 3-column, dead buttons)
- `app/clinical-master/session/[sessionId]/page.tsx` — Live consultation (dark, transcript feed)
- `app/clinical-master/feedback/[sessionId]/page.tsx` — Feedback (dark, incomplete data)
- `app/clinical-master/page.tsx` — Station selection (becomes redirect)
- `hooks/useLiveKitSession.ts` — LiveKit hook (needs audio cleanup fix)
- `components/clinical-master/ConsultationTimer.tsx` — Timer (double-fire bug)
- `app/api/generate-feedback/route.ts` — Feedback API (no auth, incomplete data)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/api/clinical-master/create-session/route.ts` | Create session record for authenticated users |
| Create | `app/api/try/create-session/route.ts` | Create session record for guest users |
| Rewrite | `app/clinical-master/page.tsx` | Redirect to library or station |
| Rewrite | `app/clinical-master/station/[stationId]/page.tsx` | Warm single-column reading brief |
| Rewrite | `app/clinical-master/session/[sessionId]/page.tsx` | Warm voice-only consultation UI |
| Rewrite | `app/clinical-master/feedback/[sessionId]/page.tsx` | Warm feedback with all-domain data |
| Modify | `app/api/generate-feedback/route.ts` | Add auth check, fix domain data extraction |
| Modify | `hooks/useLiveKitSession.ts` | Fix audio element cleanup, remove console.logs |
| Modify | `components/clinical-master/ConsultationTimer.tsx` | Fix double-fire, remove pause, add warning colors |
| Delete | `app/dashboard/feedback/[sessionId]/page.tsx` | Remove re-export (feedback lives at /clinical-master/feedback/) |

---

### Task 1: Create Session API Endpoints

**Files:**
- Create: `CaseForgeFrontend/app/api/clinical-master/create-session/route.ts`
- Create: `CaseForgeFrontend/app/api/try/create-session/route.ts`

This fixes the **#1 critical bug**: no `clinical_sessions` record is created before the LiveKit agent starts.

- [ ] **Step 1: Create authenticated session creation endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, stationId } = await req.json();

  if (!sessionId || !stationId) {
    return NextResponse.json({ error: 'sessionId and stationId are required' }, { status: 400 });
  }

  // Check if session already exists (idempotent)
  const { data: existing } = await supabase
    .from('clinical_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (existing) {
    return NextResponse.json({ status: 'exists', sessionId });
  }

  // Create the session record
  const { error } = await supabase
    .from('clinical_sessions')
    .insert({
      id: sessionId,
      user_id: user.id,
      station_id: stationId,
      status: 'reading',
      started_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'created', sessionId });
}
```

- [ ] **Step 2: Create guest session creation endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const { sessionId, stationId } = await req.json();

  if (!sessionId || !stationId) {
    return NextResponse.json({ error: 'sessionId and stationId are required' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify station is a free trial station
  const { data: station } = await supabase
    .from('stations')
    .select('id, is_free_trial, is_active')
    .eq('id', stationId)
    .single();

  if (!station || !station.is_free_trial || !station.is_active) {
    return NextResponse.json({ error: 'Invalid free trial station' }, { status: 400 });
  }

  // Check if session already exists (idempotent)
  const { data: existing } = await supabase
    .from('clinical_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (existing) {
    return NextResponse.json({ status: 'exists', sessionId });
  }

  // Create guest session (user_id is null)
  const { error } = await supabase
    .from('clinical_sessions')
    .insert({
      id: sessionId,
      user_id: null,
      station_id: stationId,
      status: 'reading',
      started_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'created', sessionId });
}
```

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/api/clinical-master/create-session/route.ts app/api/try/create-session/route.ts && git commit -m "feat: add session creation API endpoints (authenticated + guest)"
```

---

### Task 2: Fix ConsultationTimer

**Files:**
- Modify: `CaseForgeFrontend/components/clinical-master/ConsultationTimer.tsx`

- [ ] **Step 1: Rewrite the timer component**

Replace the entire file. Fixes: double-fire bug, removes pause button, adds warning colors.

```tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ConsultationTimerProps {
  durationSeconds: number;
  onComplete?: () => void;
  autoStart?: boolean;
  label?: string;
  className?: string;
}

export default function ConsultationTimer({
  durationSeconds,
  onComplete,
  autoStart = false,
  label,
  className = '',
}: ConsultationTimerProps) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const hasFiredRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleComplete = useCallback(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, handleComplete]);

  useEffect(() => {
    if (autoStart && !isRunning && !hasFiredRef.current) {
      setIsRunning(true);
    }
  }, [autoStart, isRunning]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Warning states
  const isLow = timeLeft <= 120 && timeLeft > 30;
  const isCritical = timeLeft <= 30;

  const colorClass = isCritical
    ? 'text-danger'
    : isLow
    ? 'text-primary'
    : 'text-heading';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-[12px] text-muted">{label}</span>}
      <span className={`font-mono text-[16px] font-semibold tabular-nums ${colorClass}`}>
        {timeString}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/clinical-master/ConsultationTimer.tsx && git commit -m "fix: rewrite ConsultationTimer — fix double-fire, remove pause, add warning colors"
```

---

### Task 3: Fix useLiveKitSession Hook

**Files:**
- Modify: `CaseForgeFrontend/hooks/useLiveKitSession.ts`

- [ ] **Step 1: Fix audio element cleanup and remove console.logs**

In the `TrackSubscribed` handler (around line 158), change the audio attachment to track elements for cleanup:

Find the block:
```typescript
console.log('[LiveKit] Playing agent audio track');
const audioEl = track.attach();
document.body.appendChild(audioEl);
```

Replace with:
```typescript
const audioEl = track.attach();
audioEl.dataset.livekitTrack = publication.trackSid;
document.body.appendChild(audioEl);
```

In the `TrackUnsubscribed` handler, find:
```typescript
track.detach().forEach((el) => el.remove());
```

This is already correct — `detach()` returns all attached elements and we remove them.

Add cleanup in the room `Disconnected` handler. Find the block starting with `room.on(RoomEvent.Disconnected,` and replace with:

```typescript
room.on(RoomEvent.Disconnected, () => {
    // Clean up any orphaned audio elements
    document.querySelectorAll('audio[data-livekit-track]').forEach(el => el.remove());
    setStatus('disconnected');
    setIsSpeaking(false);
    onConsultationEnded?.();
});
```

Remove all `console.log` statements from the file (there are several scattered throughout).

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add hooks/useLiveKitSession.ts && git commit -m "fix: clean up audio elements on disconnect, remove console.logs"
```

---

### Task 4: Convert Station Selection to Redirect

**Files:**
- Rewrite: `CaseForgeFrontend/app/clinical-master/page.tsx`

- [ ] **Step 1: Replace the station selection page with a redirect**

```tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function RedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stationId = searchParams.get('station');

  useEffect(() => {
    if (stationId) {
      router.replace(`/clinical-master/station/${stationId}`);
    } else {
      router.replace('/dashboard/library');
    }
  }, [stationId, router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="animate-pulse text-muted text-sm">Redirecting...</div>
    </div>
  );
}

export default function ClinicalMasterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <RedirectContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add app/clinical-master/page.tsx && git commit -m "refactor: convert station selection page to redirect"
```

---

### Task 5: Rewrite Reading Brief Page

**Files:**
- Rewrite: `CaseForgeFrontend/app/clinical-master/station/[stationId]/page.tsx`

- [ ] **Step 1: Replace the entire reading phase page**

This removes: dark mode, three-column layout, dead buttons, sidebar, notepad. Adds: warm single-column, session creation on CTA click, timer enables CTA.

```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import DomainTag from '@/components/ui/DomainTag';
import ConsultationTimer from '@/components/clinical-master/ConsultationTimer';

interface StationData {
  id: string;
  title: string;
  patient_name: string;
  candidate_instructions: string;
  reading_duration_seconds: number;
  consultation_duration_seconds: number;
  domain_name: string;
}

export default function ReadingPhasePage() {
  const params = useParams();
  const router = useRouter();
  const stationId = params.stationId as string;

  const [station, setStation] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerDone, setTimerDone] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function fetchStation() {
      const supabase = createClient();
      const { data: s, error } = await supabase
        .from('stations')
        .select('id, title, patient_name, candidate_instructions, domain_id, reading_duration_seconds, consultation_duration_seconds')
        .eq('id', stationId)
        .single();

      if (error || !s) {
        setLoading(false);
        return;
      }

      const { data: domain } = await supabase
        .from('domains')
        .select('name')
        .eq('id', s.domain_id)
        .single();

      setStation({
        id: s.id,
        title: s.title,
        patient_name: s.patient_name,
        candidate_instructions: s.candidate_instructions || '',
        reading_duration_seconds: s.reading_duration_seconds || 180,
        consultation_duration_seconds: s.consultation_duration_seconds || 480,
        domain_name: domain?.name || 'General Practice',
      });
      setLoading(false);
    }

    if (stationId) fetchStation();
  }, [stationId]);

  const handleStartConsultation = useCallback(async () => {
    if (starting) return;
    setStarting(true);

    const sessionId = crypto.randomUUID();

    try {
      const res = await fetch('/api/clinical-master/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, stationId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create session');
      }

      router.push(`/clinical-master/session/${sessionId}?stationId=${stationId}`);
    } catch (err) {
      setStarting(false);
      alert(err instanceof Error ? err.message : 'Failed to start consultation');
    }
  }, [stationId, router, starting]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Station not found</p>
          <Link href="/dashboard/library" className="text-primary hover:underline text-sm">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  // Parse candidate instructions into sections
  const sections = station.candidate_instructions.split('\n').filter(line => line.trim());

  return (
    <div className="min-h-screen bg-surface font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-[640px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/dashboard/library"
            className="text-[13px] text-muted hover:text-heading transition-colors flex items-center gap-1"
          >
            ← Back to Library
          </Link>
          <ConsultationTimer
            durationSeconds={station.reading_duration_seconds}
            label="Reading Time"
            autoStart={true}
            onComplete={() => setTimerDone(true)}
          />
          <span className="text-[12px] text-muted">{station.title}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[640px] mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <Container>
            {/* Patient identity */}
            <div className="flex items-start gap-4 mb-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-[18px] font-semibold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)', boxShadow: '0 4px 16px rgba(180,83,9,0.2)' }}
              >
                {station.patient_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1">
                <div className="text-[16px] font-semibold text-heading mb-0.5">{station.patient_name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <DomainTag name={station.domain_name} size="sm" />
                  <span className="text-[11px] font-mono text-primary font-semibold px-2 py-0.5 rounded-md" style={{ background: 'rgba(180,83,9,0.08)' }}>
                    {Math.round(station.consultation_duration_seconds / 60)} min
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-black/[0.05] mb-5" />

            {/* Candidate instructions */}
            <div className="mb-6">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-3">
                Candidate Brief
              </div>
              <div
                className="px-4 py-3 rounded-xl text-[14px] text-heading leading-[1.8]"
                style={{ background: 'linear-gradient(135deg, rgba(180,83,9,0.03), rgba(245,158,11,0.03))', borderLeft: '3px solid #B45309' }}
              >
                {sections.map((line, i) => {
                  const isHeader = line.includes(':') && /^[A-Z]/.test(line);
                  return (
                    <p key={i} className={isHeader ? 'font-semibold mt-3 first:mt-0' : 'mt-1'}>
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <PrimaryButton
              fullWidth
              size="lg"
              disabled={!timerDone && !starting}
              onClick={handleStartConsultation}
            >
              {starting ? 'Starting...' : timerDone ? 'Begin Consultation →' : 'Reading time remaining...'}
            </PrimaryButton>

            {!timerDone && (
              <p className="text-[11px] text-muted text-center mt-3">
                Button activates when reading time completes
              </p>
            )}
          </Container>
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add app/clinical-master/station/\\[stationId\\]/page.tsx && git commit -m "feat: rewrite reading brief — warm single-column, session creation, timer CTA"
```

---

### Task 6: Rewrite Live Consultation Page

**Files:**
- Rewrite: `CaseForgeFrontend/app/clinical-master/session/[sessionId]/page.tsx`

- [ ] **Step 1: Replace the entire consultation page**

Removes: dark mode, transcript feed, permanent notepad column, ClinicalLayout. Adds: warm full-screen voice UI, ConfirmModal, proper navigation.

```tsx
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useLiveKitSession } from '@/hooks/useLiveKitSession';
import { createClient } from '@/lib/supabase/client';
import ConsultationTimer from '@/components/clinical-master/ConsultationTimer';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface StationData {
  id: string;
  title: string;
  patient_name: string;
  consultation_duration_seconds: number;
}

function AudioVisualizer({ active }: { active: boolean }) {
  const barCount = 48;
  return (
    <div className="flex items-center justify-center gap-[3px] h-20 w-full max-w-[400px] mx-auto">
      {Array.from({ length: barCount }).map((_, i) => {
        const center = barCount / 2;
        const dist = Math.abs(i - center) / center;
        const maxH = active ? 100 - dist * 55 : 15;
        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: '3px',
              background: active
                ? `linear-gradient(180deg, rgba(180,83,9,${0.8 - dist * 0.4}) 0%, rgba(245,158,11,${0.2 + (1 - dist) * 0.3}) 100%)`
                : 'rgba(0,0,0,0.08)',
            }}
            animate={{
              height: active
                ? [
                    `${10 + Math.sin(i * 0.5) * 6}%`,
                    `${maxH * (0.3 + Math.sin(i * 0.35 + 1) * 0.7)}%`,
                    `${10 + Math.sin(i * 0.5 + 2) * 6}%`,
                  ]
                : ['15%'],
            }}
            transition={
              active
                ? { duration: 0.8 + (i % 6) * 0.1, repeat: Infinity, delay: (i % 8) * 0.05, ease: 'easeInOut' }
                : { duration: 0.3 }
            }
          />
        );
      })}
    </div>
  );
}

function LiveConsultationContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const stationId = searchParams.get('stationId');

  const [station, setStation] = useState<StationData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchStation() {
      if (!stationId) return;
      const supabase = createClient();
      const { data } = await supabase
        .from('stations')
        .select('id, title, patient_name, consultation_duration_seconds')
        .eq('id', stationId)
        .single();
      if (data) setStation(data);
    }
    fetchStation();
  }, [stationId]);

  const { isConnected, isSpeaking, connect, endConsultation, setMicMuted, error, status } =
    useLiveKitSession({
      sessionId,
      stationId: stationId || undefined,
      userId,
      onSessionStarted: () => {},
      onConsultationEnded: () => {},
      onError: () => {},
    });

  useEffect(() => {
    if (station && status === 'disconnected') connect();
  }, [station, status, connect]);

  const finishConsultation = useCallback(async () => {
    setIsProcessing(true);
    try {
      await endConsultation();
    } catch {
      // Continue to feedback even if disconnect fails
    }
    router.push(`/clinical-master/feedback/${sessionId}`);
  }, [endConsultation, router, sessionId]);

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setMicMuted(newMuted);
  };

  const patientInitials = station
    ? station.patient_name.split(' ').map(n => n[0]).join('').slice(0, 2)
    : '??';

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-6">
        <motion.div
          className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <div className="text-center">
          <h3 className="text-[18px] font-semibold text-heading mb-1">Finalising Consultation</h3>
          <p className="text-[14px] text-muted">Generating your feedback...</p>
        </div>
      </div>
    );
  }

  if (!stationId) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Missing station information</p>
          <a href="/dashboard/library" className="text-primary hover:underline text-sm">Back to Library</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-sans flex flex-col">
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-6 border-b border-black/[0.06] bg-surface/80 backdrop-blur-xl flex-shrink-0">
        <div className="text-[13px] text-muted truncate max-w-[200px]">
          {station?.patient_name || 'Loading...'}
        </div>
        <ConsultationTimer
          durationSeconds={station?.consultation_duration_seconds || 480}
          autoStart={isConnected}
          onComplete={finishConsultation}
        />
        <div className="flex items-center gap-2">
          {isConnected && (
            <div className="flex items-center gap-1.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-success"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
              <span className="text-[10px] font-semibold text-success uppercase">Live</span>
            </div>
          )}
          {error && <span className="text-[11px] text-danger">{error}</span>}
        </div>
      </div>

      {/* Main voice area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8">
        {/* Patient avatar with pulse */}
        <motion.div className="relative" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
          <motion.div
            className="absolute rounded-full"
            style={{ inset: '-16px', border: '1.5px solid rgba(180,83,9,0.1)' }}
            animate={isSpeaking ? { scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] } : { scale: 1, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{ inset: '-8px', border: '2px solid rgba(180,83,9,0.15)' }}
            animate={isSpeaking ? { scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] } : { scale: 1, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
          />
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-[24px] font-semibold relative"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)', boxShadow: '0 8px 32px rgba(180,83,9,0.3)' }}
          >
            {patientInitials}
          </div>
        </motion.div>

        {/* Speaking indicator */}
        <div className="text-center">
          <motion.div
            className="text-[12px] font-semibold text-primary uppercase tracking-[0.1em] mb-0.5"
            animate={isSpeaking ? { opacity: [1, 0.4, 1] } : { opacity: 0.5 }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            {isSpeaking ? 'Patient Speaking' : 'Listening...'}
          </motion.div>
          <div className="text-[12px] text-muted">
            {station?.patient_name || 'Patient'}
          </div>
        </div>

        {/* Waveform */}
        <AudioVisualizer active={isSpeaking} />
      </div>

      {/* Controls bar */}
      <div className="h-20 flex items-center justify-center gap-6 px-6 border-t border-black/[0.06] flex-shrink-0">
        <button
          onClick={handleToggleMute}
          disabled={!isConnected}
          className="w-11 h-11 rounded-full flex items-center justify-center border border-black/[0.08] cursor-pointer hover:bg-black/[0.02] transition-colors disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className={isMuted ? 'text-danger' : 'text-muted'}>
            {isMuted ? (
              <path d="M7 1v12M4 4v6M10 3v8M1 6v2M13 5v4M2 2l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path d="M7 1v12M4 4v6M10 3v8M1 6v2M13 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            )}
          </svg>
        </button>

        <motion.div
          className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #B45309, #D97706)', boxShadow: '0 4px 16px rgba(180,83,9,0.25)' }}
          animate={isConnected ? { boxShadow: ['0 4px 16px rgba(180,83,9,0.25)', '0 6px 20px rgba(180,83,9,0.35)', '0 4px 16px rgba(180,83,9,0.25)'] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path d="M7 1C5.62 1 4.5 2.12 4.5 3.5v3.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V3.5C9.5 2.12 8.38 1 7 1z" fill="white" />
            <path d="M3 6.5v.5a4 4 0 0 0 8 0v-.5M7 11v2M5 13h4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </motion.div>

        <button
          onClick={() => setShowEndModal(true)}
          className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-danger bg-red-50 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
        >
          End Consultation
        </button>
      </div>

      <ConfirmModal
        open={showEndModal}
        title="End Consultation"
        message="Are you sure you want to end this consultation? Your feedback will be generated based on the conversation so far."
        confirmLabel="End Now"
        cancelLabel="Continue"
        variant="danger"
        onConfirm={() => { setShowEndModal(false); finishConsultation(); }}
        onCancel={() => setShowEndModal(false)}
      />
    </div>
  );
}

export default function LiveConsultationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center"><div className="text-muted text-sm">Loading...</div></div>}>
      <LiveConsultationContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add app/clinical-master/session/\\[sessionId\\]/page.tsx && git commit -m "feat: rewrite consultation page — warm voice-only UI, ConfirmModal, no transcript"
```

---

### Task 7: Rewrite Feedback Page

**Files:**
- Rewrite: `CaseForgeFrontend/app/clinical-master/feedback/[sessionId]/page.tsx`

- [ ] **Step 1: Replace the entire feedback page**

Fixes: pulls from ALL domains, warm design, proper navigation.

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import ScoreBadge from '@/components/ui/ScoreBadge';
import { ConsultationFeedback } from '@/lib/clinical-master/types';

export default function FeedbackPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [feedback, setFeedback] = useState<ConsultationFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const generationTriggered = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const generateAndFetch = async () => {
      if (generationTriggered.current) return;
      generationTriggered.current = true;

      try {
        const response = await fetch('/api/generate-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        if (cancelled) return;

        if (response.status === 404) {
          generationTriggered.current = false;
          setTimeout(generateAndFetch, 3000);
          return;
        }

        if (!response.ok) {
          setError(true);
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data.status === 'ready' && data.feedback) {
          setFeedback(data.feedback);
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
      } catch {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      }
    };

    const timer = setTimeout(generateAndFetch, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <motion.div
          className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-muted text-sm animate-pulse">Generating feedback...</p>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Unable to load feedback. Please try again later.</p>
          <Link href="/dashboard" className="text-primary hover:underline text-sm">Return to Dashboard</Link>
        </div>
      </div>
    );
  }

  const overallScore = feedback.overall_score ?? Math.round(
    (feedback.data_gathering.score + feedback.clinical_management.score + feedback.interpersonal_skills.score) / 3
  );
  const isPassing = overallScore >= 60;

  // Collect ALL strengths and improvements from ALL domains
  const allStrengths = [
    ...feedback.data_gathering.strengths,
    ...feedback.clinical_management.strengths,
    ...feedback.interpersonal_skills.strengths,
  ];
  const allImprovements = [
    ...feedback.data_gathering.improvements,
    ...feedback.clinical_management.improvements,
    ...feedback.interpersonal_skills.improvements,
  ];

  const domains = [
    { label: 'Data Gathering', score: feedback.data_gathering.score },
    { label: 'Clinical Management', score: feedback.clinical_management.score },
    { label: 'Interpersonal Skills', score: feedback.interpersonal_skills.score },
  ];

  return (
    <div className="min-h-screen bg-surface font-sans">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        {/* Score hero */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">
            Session Complete
          </div>

          {/* Ring gauge */}
          <div className="relative inline-flex items-center justify-center mb-4">
            <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
              <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="10" />
              <motion.circle
                cx="70" cy="70" r="58" fill="none"
                stroke="url(#scoreGrad)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 58}
                initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - overallScore / 100) }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#B45309" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className="text-[40px] font-extrabold leading-none gradient-text"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                {overallScore}
              </motion.span>
              <span className="text-[11px] text-muted">out of 100</span>
            </div>
          </div>

          <div className="text-[14px] text-muted mb-3">{feedback.station_title || 'Station Feedback'}</div>

          <motion.div
            className={`inline-flex px-5 py-2 rounded-full text-[12px] font-semibold uppercase`}
            style={{
              background: isPassing ? 'rgba(34,197,94,0.1)' : 'rgba(220,38,38,0.1)',
              color: isPassing ? '#16A34A' : '#DC2626',
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.8 }}
          >
            {isPassing ? '✓ Pass' : '✗ Refer'}
          </motion.div>
        </motion.div>

        {/* Domain breakdown */}
        <Container className="mb-8">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-5">
            Domain Scores
          </div>
          <div className="flex flex-col gap-4">
            {domains.map((d, i) => (
              <motion.div
                key={d.label}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + i * 0.12 }}
              >
                <span className="text-[13px] text-stone-600 font-medium w-[160px] flex-shrink-0">{d.label}</span>
                <div className="flex-1 h-2.5 bg-black/[0.04] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${d.score}%` }}
                    transition={{ type: 'spring', stiffness: 40, damping: 18, delay: 1.0 + i * 0.15 }}
                  />
                </div>
                <ScoreBadge score={d.score} size="sm" />
              </motion.div>
            ))}
          </div>
        </Container>

        {/* Strengths and improvements — two columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
                <span className="text-[10px] text-success">✓</span>
              </div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">Strengths</span>
            </div>
            <div className="flex flex-col gap-2">
              {allStrengths.slice(0, 5).map((s, i) => (
                <motion.p
                  key={i}
                  className="text-[13px] text-stone-600 leading-[1.6] pl-3"
                  style={{ borderLeft: '2px solid rgba(34,197,94,0.3)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.3 + i * 0.08 }}
                >
                  {s}
                </motion.p>
              ))}
            </div>
          </div>

          {/* Improvements */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.1)' }}>
                <span className="text-[10px] text-amber-600">⚡</span>
              </div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">To Improve</span>
            </div>
            <div className="flex flex-col gap-2">
              {allImprovements.slice(0, 5).map((s, i) => (
                <motion.p
                  key={i}
                  className="text-[13px] text-stone-600 leading-[1.6] pl-3"
                  style={{ borderLeft: '2px solid rgba(217,119,6,0.3)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.3 + i * 0.08 }}
                >
                  {s}
                </motion.p>
              ))}
            </div>
          </div>
        </div>

        {/* Key learning points */}
        {feedback.key_learning_points && feedback.key_learning_points.length > 0 && (
          <Container className="mb-8">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">
              Key Learning Points
            </div>
            <ol className="flex flex-col gap-2">
              {feedback.key_learning_points.map((point, i) => (
                <li key={i} className="flex gap-3 text-[13px] text-stone-600 leading-[1.6]">
                  <span className="text-primary font-mono font-semibold flex-shrink-0">{i + 1}.</span>
                  {point}
                </li>
              ))}
            </ol>
          </Container>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          <Link href="/dashboard/library">
            <PrimaryButton>Practice Another Case →</PrimaryButton>
          </Link>
          <Link href="/dashboard" className="text-[13px] text-muted hover:text-heading transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add app/clinical-master/feedback/\\[sessionId\\]/page.tsx && git commit -m "feat: rewrite feedback page — warm design, all-domain strengths/improvements, ring gauge"
```

---

### Task 8: Remove Dashboard Feedback Re-export

**Files:**
- Modify: `CaseForgeFrontend/app/dashboard/feedback/[sessionId]/page.tsx`

- [ ] **Step 1: Replace the re-export with a redirect**

Instead of re-exporting the clinical-master feedback component (which would render inside the dashboard layout), redirect to the clinical-master feedback page.

```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardFeedbackRedirect() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  useEffect(() => {
    router.replace(`/clinical-master/feedback/${sessionId}`);
  }, [sessionId, router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-muted text-sm animate-pulse">Redirecting to feedback...</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add app/dashboard/feedback/\\[sessionId\\]/page.tsx && git commit -m "refactor: replace feedback re-export with redirect to clinical-master"
```

---

### Task 9: Build Verification

- [ ] **Step 1: Run build**

```bash
cd CaseForgeFrontend && npx next build 2>&1 | tail -10
```

Fix any TypeScript or build errors.

- [ ] **Step 2: Run lint**

```bash
cd CaseForgeFrontend && npm run lint 2>&1 | tail -10
```

Fix any lint errors.

- [ ] **Step 3: Commit fixes**

```bash
cd CaseForgeFrontend && git add -A && git commit -m "fix: resolve build errors from Phase 2 core loop"
```
