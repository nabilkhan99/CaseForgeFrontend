'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { coachingSessionLabel, formatCoachingDate } from '@/lib/commerce/coachingSlots';
import { londonToday, type AdminCoachingBooking } from '@/lib/commerce/adminCoaching';
import type { AdminCoachingListResponse } from '@/app/api/admin/coaching/route';
import type { AdminCoachingSaveResponse } from '@/app/api/admin/coaching/[orderId]/route';
import type { AdminCoachingSendResponse } from '@/app/api/admin/coaching/[orderId]/send/route';

/** What an empty cell shows. Not a dash: no em or en dashes in this product's copy. */
const EMPTY_CELL = '·';

const DAY_MS = 86_400_000;

/** "In 6 days", "Tomorrow", "Today", "Past", counted in London calendar days. */
function countdown(day: string): string {
  const [ty, tm, td] = londonToday().split('-').map(Number);
  const [y, m, d] = day.split('-').map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / DAY_MS);
  if (days < 0) return 'Past';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** "29 Sep, 14:32" */
function fmtStamp(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

function whenLabel(booking: AdminCoachingBooking): string {
  return booking.slot ? coachingSessionLabel(booking.day, booking.slot) : formatCoachingDate(booking.day);
}

interface CoachDefaults {
  coachName: string;
  coachEmail: string;
}

interface Draft {
  coachName: string;
  coachEmail: string;
  meetingUrl: string;
}

function draftFrom(booking: AdminCoachingBooking, defaults: CoachDefaults): Draft {
  return {
    coachName: booking.coachName ?? defaults.coachName,
    coachEmail: booking.coachEmail ?? defaults.coachEmail,
    meetingUrl: booking.meetingUrl ?? '',
  };
}

const INPUT =
  'w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-heading placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30';
const LABEL = 'block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5';
const ACTION =
  'text-primary hover:text-primary-light underline underline-offset-4 disabled:opacity-40 disabled:no-underline';

interface BookingRowProps {
  booking: AdminCoachingBooking;
  defaults: CoachDefaults;
  index: number;
  onChange: (booking: AdminCoachingBooking) => void;
}

/**
 * One booking. Save first, then Send: the send route reads what is saved, so
 * the button stays disabled while the form holds edits it would not include.
 */
function BookingRow({ booking, defaults, index, onChange }: BookingRowProps) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(booking, defaults));
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dirty =
    draft.coachName !== (booking.coachName ?? '') ||
    draft.coachEmail !== (booking.coachEmail ?? '') ||
    draft.meetingUrl !== (booking.meetingUrl ?? '');
  const complete = Boolean(booking.coachName && booking.coachEmail && booking.meetingUrl);
  const canSend = complete && !dirty && booking.slot !== null && !saving && !sending;
  const student = booking.fullName?.trim() || booking.email;

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/coaching/${booking.orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((body as { error?: string }).error ?? 'Could not save.');
        return;
      }
      const saved = body as AdminCoachingSaveResponse;
      onChange(saved.booking);
      setDraft(draftFrom(saved.booking, defaults));
      setWarnings(saved.warnings);
      setNotice('Saved.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  async function sendConfirmation() {
    const question = booking.detailsSentAt
      ? `Email the confirmation and joining link to ${booking.email} again? They were last sent one on ${fmtStamp(booking.detailsSentAt)}.`
      : `Email the confirmation and joining link to ${booking.email}?`;
    if (!window.confirm(question)) return;

    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/coaching/${booking.orderId}/send`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((body as { error?: string }).error ?? 'The email did not send.');
        return;
      }
      const { sentAt } = body as AdminCoachingSendResponse;
      onChange({ ...booking, detailsSentAt: sentAt });
      setNotice(`Sent to ${booking.email}.`);
    } catch {
      setError('Could not reach the server. Check the Sent time before trying again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 + index * 0.06, ease: 'easeOut' }}
      className="border-b border-border py-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-heading">
          {whenLabel(booking)}
        </h2>
        <span className="text-sm font-medium text-primary">{countdown(booking.day)}</span>
      </div>
      <p className="mt-1 text-sm text-body">
        {student}
        {booking.fullName ? <span className="text-muted"> · {booking.email}</span> : null}
        {!booking.studentHasAccount && <span className="text-amber-700"> · no account yet</span>}
      </p>

      <form
        className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_1.4fr]"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div>
          <label htmlFor={`${id}-name`} className={LABEL}>
            Coach name, as the student sees it
          </label>
          <input
            id={`${id}-name`}
            className={INPUT}
            value={draft.coachName}
            placeholder="Dr Hassan Khan"
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, coachName: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={LABEL}>
            Coach sign-in email
          </label>
          <input
            id={`${id}-email`}
            type="email"
            className={INPUT}
            value={draft.coachEmail}
            placeholder="coach@example.com"
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, coachEmail: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${id}-url`} className={LABEL}>
            Meeting link
          </label>
          <input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            className={INPUT}
            value={draft.meetingUrl}
            placeholder="https://meet.google.com/…"
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, meetingUrl: event.target.value })}
          />
        </div>

        <div className="md:col-span-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <button type="submit" disabled={saving || sending || !dirty} className={ACTION}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={sendConfirmation} disabled={!canSend} className={ACTION}>
            {sending ? 'Sending…' : booking.detailsSentAt ? 'Resend' : 'Send confirmation'}
          </button>
          <span className="text-xs text-muted">
            {booking.detailsSentAt ? (
              <>
                Sent <span className="font-mono">{fmtStamp(booking.detailsSentAt)}</span>
              </>
            ) : booking.slot === null ? (
              'No time slot on this booking, so it cannot be confirmed from here.'
            ) : dirty ? (
              'Save before sending.'
            ) : (
              'Not sent yet'
            )}
          </span>
        </div>
      </form>

      <div className="mt-3 space-y-1 text-xs" aria-live="polite">
        <p className={booking.coachSeesStudent ? 'text-emerald-700' : 'text-muted'}>
          {booking.coachSeesStudent
            ? `${booking.coachName ?? 'The coach'} can see ${student}'s progress on their Students tab.`
            : 'Coach cannot see this student yet. Saving links them.'}
        </p>
        {warnings.map((warning) => (
          <p key={warning} className="text-amber-700">
            {warning}
          </p>
        ))}
        {notice && <p className="text-muted">{notice}</p>}
        {error && <p className="text-danger">{error}</p>}
      </div>
    </motion.li>
  );
}

/**
 * /admin/coaching: every booked one to one session from a week ago onwards.
 * Set the coach and the video call link, then send the student their
 * confirmation. Saving also puts the student on the coach's Students tab.
 */
export default function CoachingAdmin() {
  const [bookings, setBookings] = useState<AdminCoachingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/coaching', { cache: 'no-store' });
      if (response.status === 403) {
        setError('Not authorized.');
        return;
      }
      if (!response.ok) {
        setError('Could not load coaching bookings.');
        return;
      }
      const body = (await response.json()) as AdminCoachingListResponse;
      setBookings(body.bookings);
      setLoadedAt(Date.now());
    } catch {
      setError('Could not load coaching bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** The same coach runs most sessions: prefill from the latest booking that names one. */
  const defaults = useMemo<CoachDefaults>(() => {
    const named = [...bookings].reverse().find((b) => b.coachName && b.coachEmail);
    return { coachName: named?.coachName ?? '', coachEmail: named?.coachEmail ?? '' };
  }, [bookings]);

  const replace = useCallback((next: AdminCoachingBooking) => {
    setBookings((current) => current.map((b) => (b.orderId === next.orderId ? next : b)));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">Coaching</h1>
            <p className="mt-2 text-sm text-muted">
              One to one sessions: set the coach and link, then send the confirmation
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link href="/admin" className={ACTION}>
              ← Admin
            </Link>
            <button onClick={load} disabled={loading} className={ACTION}>
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-8 border-l-2 border-danger pl-4 py-2 text-sm text-danger">{error}</div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <p className="mt-12 text-sm text-muted">No coaching sessions booked from last week onwards.</p>
        )}

        {bookings.length > 0 && (
          // Keyed on the load so Refresh resets every form to what is saved.
          <ul key={loadedAt} className="mt-10 border-t border-border">
            {bookings.map((booking, index) => (
              <BookingRow
                key={booking.orderId}
                booking={booking}
                defaults={defaults}
                index={index}
                onChange={replace}
              />
            ))}
          </ul>
        )}

        {loading && bookings.length === 0 && <p className="mt-12 text-sm text-muted">{EMPTY_CELL}</p>}
      </div>
    </div>
  );
}
