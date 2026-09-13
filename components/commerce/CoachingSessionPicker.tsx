'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  formatCoachingDateCompact,
  groupSlotsByMonth,
  monthAvailabilityLine,
  type CoachingDateGroup,
  type CoachingMonthGroup,
  type CoachingSlotAvailability,
  type MonthAvailabilityLine,
} from '@/lib/commerce/coachingSlots';
import {
  cutoffCountdownLabel,
  hasOpenSlot,
  isSelectionOpen,
  openSlotOrder,
  parseCoachingSlots,
  selectionKey,
  slotAriaLabel,
  slotOptionParts,
  stepSelection,
  type CoachingSlotSelection,
  type SelectionStep,
} from '@/lib/commerce/coachingPicker';

/**
 * The coaching session picker, shared by the two places a session is chosen:
 * the acquisition page at `/coaching-session` and the in-app booking at
 * `/dashboard/coaching-session` (where a customer who upgraded to Complete in
 * Stripe's Portal picks their date and time afterwards). One copy, so the
 * month counts, cut-offs and sold out states cannot drift between the page a
 * stranger sees and the page a customer sees.
 *
 * Every coaching date offers two slots, morning and afternoon, and each slot
 * takes one booking. Scarcity is counted per month from live slot state; there
 * is deliberately no figure across all months.
 */

export type { CoachingSlotSelection } from '@/lib/commerce/coachingPicker';

const SUPPORT_EMAIL = 'hello@fourteenfisherman.com';

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface CoachingSessionsState {
  /** null while the first load is in flight, or after a failed load. */
  slots: CoachingSlotAvailability[] | null;
  loadError: boolean;
  /** Refetches live availability, e.g. after a 409 or a released checkout hold. */
  reload: () => Promise<void>;
  /** At least one slot can be booked, so a continue button is worth showing. */
  hasSelectable: boolean;
}

/** Loads live coaching slot availability from `GET /api/coaching-sessions`. */
export function useCoachingSessions(): CoachingSessionsState {
  const [slots, setSlots] = useState<CoachingSlotAvailability[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Only the latest request may write state: a slow first load must not
  // overwrite the fresher answer a reload fetched after a 409.
  const latestRequest = useRef(0);
  const mounted = useRef(false);

  const reload = useCallback(async () => {
    const requestId = ++latestRequest.current;
    const isCurrent = () => mounted.current && requestId === latestRequest.current;
    try {
      const res = await fetch('/api/coaching-sessions', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { slots?: unknown };
      const parsed = parseCoachingSlots(data?.slots);
      if (!isCurrent()) return;
      setSlots(parsed);
      setLoadError(false);
    } catch (error) {
      if (!isCurrent()) return;
      console.error('[coaching-sessions] availability load failed', error);
      setSlots(null);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  return { slots, loadError, reload, hasSelectable: hasOpenSlot(slots) };
}

interface CoachingSessionPickerProps {
  slots: CoachingSlotAvailability[] | null;
  loadError: boolean;
  selected: CoachingSlotSelection | null;
  onSelect: (selection: CoachingSlotSelection) => void;
  /** Locks the choice while a booking or checkout request is in flight. */
  disabled?: boolean;
}

export default function CoachingSessionPicker({
  slots,
  loadError,
  selected,
  onSelect,
  disabled = false,
}: CoachingSessionPickerProps) {
  const now = useNow(30_000);
  const reduceMotion = useReducedMotion() ?? false;
  const months = useMemo(() => (slots ? groupSlotsByMonth(slots) : []), [slots]);
  const order = useMemo(() => openSlotOrder(months), [months]);
  const radios = useRef(new Map<string, HTMLButtonElement>());

  // Roving tab stop: the group is one Tab stop, landing on the chosen slot, or
  // the first open one when nothing (still bookable) is chosen.
  const selectionUsable = isSelectionOpen(slots, selected);
  const tabStopKey = selectionUsable && selected ? selectionKey(selected) : order[0] ? selectionKey(order[0]) : null;

  const registerRadio = useCallback((key: string, el: HTMLButtonElement | null) => {
    if (el) radios.current.set(key, el);
    else radios.current.delete(key);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, current: CoachingSlotSelection) => {
      const step: SelectionStep | null =
        event.key === 'ArrowDown' || event.key === 'ArrowRight'
          ? 1
          : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
            ? -1
            : event.key === 'Home'
              ? 'first'
              : event.key === 'End'
                ? 'last'
                : null;
      if (step === null) return;
      event.preventDefault();
      const next = stepSelection(order, current, step);
      if (!next) return;
      onSelect(next);
      radios.current.get(selectionKey(next))?.focus();
    },
    [order, onSelect],
  );

  if (loadError) {
    return (
      <p role="alert" className="rounded-xl border border-stone-200 bg-white p-5 text-sm leading-relaxed text-body">
        We couldn&rsquo;t load the coaching dates. Please refresh the page, or email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline">
          {SUPPORT_EMAIL}
        </a>{' '}
        and we&rsquo;ll book you in directly.
      </p>
    );
  }

  if (slots === null) {
    return (
      <div
        role="status"
        className="flex items-center justify-center rounded-xl border border-stone-200 bg-white py-10"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="sr-only">Loading coaching dates</span>
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm leading-relaxed text-body">
        New coaching dates are being scheduled. Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline">
          {SUPPORT_EMAIL}
        </a>{' '}
        and we&rsquo;ll let you know as soon as dates open.
      </p>
    );
  }

  return (
    <div role="radiogroup" aria-label="Coaching dates and times" className="flex flex-col gap-7">
      {months.map((month, index) => (
        <MonthBlock
          key={month.monthKey}
          month={month}
          index={index}
          now={now}
          reduceMotion={reduceMotion}
          selected={selectionUsable ? selected : null}
          tabStopKey={tabStopKey}
          disabled={disabled}
          onSelect={onSelect}
          onKeyDown={handleKeyDown}
          registerRadio={registerRadio}
        />
      ))}
    </div>
  );
}

interface SharedSlotProps {
  now: number;
  reduceMotion: boolean;
  selected: CoachingSlotSelection | null;
  tabStopKey: string | null;
  disabled: boolean;
  onSelect: (selection: CoachingSlotSelection) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, current: CoachingSlotSelection) => void;
  registerRadio: (key: string, el: HTMLButtonElement | null) => void;
}

function MonthBlock({
  month,
  index,
  ...shared
}: SharedSlotProps & { month: CoachingMonthGroup; index: number }) {
  const headingId = `coaching-month-${month.monthKey}`;
  const line = monthAvailabilityLine(month.slotsLeft);
  const fullyBooked = month.slotsLeft <= 0;

  return (
    <motion.div
      role="group"
      aria-labelledby={headingId}
      initial={shared.reduceMotion ? false : { opacity: 0, y: 12 }}
      // A fully booked month is greyed through its text colours, not opacity:
      // faded grey on cream would drop "Fully booked" below readable contrast.
      animate={{ opacity: 1, y: 0 }}
      transition={
        shared.reduceMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut', delay: Math.min(index, 6) * 0.06 }
      }
    >
      <h2
        id={headingId}
        className={`text-lg font-semibold tracking-tight ${fullyBooked ? 'text-stone-500' : 'text-heading'}`}
      >
        {month.monthLabel}
      </h2>
      <AvailabilityLine line={line} />

      {/* A fully booked month collapses to its heading: nothing in it can be
          picked, and a list of greyed rows would only push open months down. */}
      {!fullyBooked && (
        <ul className="mt-3 border-b border-stone-200/80">
          {month.dates.map((date) => (
            <DateRow key={date.day} date={date} {...shared} />
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function AvailabilityLine({ line }: { line: MonthAvailabilityLine }) {
  if (line.tone === 'urgent') {
    return (
      <p className="mt-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDECEC] px-2.5 py-1 text-xs font-bold text-[#B42318]">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#B42318]" />
          {line.text}
        </span>
      </p>
    );
  }
  return (
    <p
      className={`mt-1 text-sm font-semibold ${line.tone === 'neutral' ? 'text-stone-500' : 'text-[#854F0B]'}`}
    >
      {line.text}
    </p>
  );
}

function DateRow({ date, ...shared }: SharedSlotProps & { date: CoachingDateGroup }) {
  const compact = formatCoachingDateCompact(date.day);

  if (date.status !== 'open') {
    return (
      <li className="flex min-h-[52px] items-center justify-between gap-3 border-t border-stone-200/80 py-3">
        <p className="text-sm font-semibold text-stone-500">{compact}</p>
        <span className="inline-flex shrink-0 items-center rounded-full bg-stone-200 px-2.5 py-1 text-[11px] font-semibold text-stone-700">
          {date.status === 'sold_out' ? 'Sold out' : 'Bookings closed'}
        </span>
      </li>
    );
  }

  const countdown = cutoffCountdownLabel(date.cutoffAt, shared.now);

  return (
    <li className="flex flex-col gap-2.5 border-t border-stone-200/80 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-baseline justify-between gap-3 sm:w-32 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0.5">
        <p className="text-sm font-semibold text-heading">{compact}</p>
        {countdown && <p className="text-xs font-semibold text-[#B42318]">{countdown}</p>}
      </div>
      <div className="grid flex-1 grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        {date.slots.map((slot) => (
          <SlotOption key={slot.slot} slot={slot} {...shared} />
        ))}
      </div>
    </li>
  );
}

function SlotOption({
  slot,
  reduceMotion,
  selected,
  tabStopKey,
  disabled,
  onSelect,
  onKeyDown,
  registerRadio,
}: SharedSlotProps & { slot: CoachingSlotAvailability }) {
  const selection: CoachingSlotSelection = { day: slot.day, slot: slot.slot };
  const key = selectionKey(selection);
  const open = slot.status === 'open';
  const isSelected = open && selected !== null && selectionKey(selected) === key;
  const { name, detail } = slotOptionParts(slot);

  return (
    <motion.button
      ref={(el: HTMLButtonElement | null) => registerRadio(key, el)}
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={slotAriaLabel(slot)}
      disabled={!open || disabled}
      tabIndex={open && key === tabStopKey ? 0 : -1}
      onClick={() => onSelect(selection)}
      onKeyDown={(event) => onKeyDown(event, selection)}
      whileTap={reduceMotion || !open ? undefined : { scale: 0.98 }}
      className={`flex min-h-[52px] w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 sm:gap-2.5 sm:px-3 ${
        isSelected
          ? 'border-primary bg-[#FDF6EC] shadow-elevation-2'
          : open
            ? 'border-stone-200 bg-white hover:border-stone-300'
            : 'cursor-not-allowed border-stone-200 bg-stone-50'
      } ${disabled && open && !isSelected ? 'opacity-60' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isSelected ? 'border-primary' : open ? 'border-stone-300' : 'border-stone-200'
        }`}
      >
        <AnimatePresence initial={false}>
          {isSelected && (
            <motion.span
              key="dot"
              className="h-1.5 w-1.5 rounded-full bg-primary"
              initial={reduceMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { scale: 0 }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </AnimatePresence>
      </span>
      <span aria-hidden="true" className="min-w-0 leading-tight">
        <span className={`block text-[13px] font-semibold sm:inline ${open ? 'text-heading' : 'text-stone-500'}`}>
          {name}
        </span>
        <span className="hidden text-[13px] text-stone-400 sm:inline"> &middot; </span>
        <span
          className={`mt-0.5 block text-xs sm:mt-0 sm:inline sm:text-[13px] ${
            slot.status === 'booked' ? 'font-bold tracking-wide text-stone-500' : open ? 'text-body' : 'text-stone-500'
          }`}
        >
          {detail}
        </span>
      </span>
    </motion.button>
  );
}
