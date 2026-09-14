import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CoachingSessionPicker from './CoachingSessionPicker'
import type { CoachingSlotAvailability } from '@/lib/commerce/coachingSlots'

// Vitest compiles JSX with the classic runtime (Next uses the automatic one),
// so the component's JSX needs React in scope when it renders.
;(globalThis as { React?: typeof React }).React = React

const slot = (
  day: string,
  s: CoachingSlotAvailability['slot'],
  status: CoachingSlotAvailability['status'] = 'open',
): CoachingSlotAvailability => ({ day, slot: s, status, cutoff_at: `${day}T00:00:00+01:00` })

type PickerProps = Parameters<typeof CoachingSessionPicker>[0]

const render = (props: Partial<PickerProps>): string =>
  renderToStaticMarkup(
    createElement(CoachingSessionPicker, {
      slots: null,
      loadError: false,
      selected: null,
      onSelect: () => {},
      ...props,
    }),
  )

/** The markup of one month block, from its heading to the next block. */
const monthBlock = (html: string, monthKey: string): string => {
  const start = html.indexOf(`aria-labelledby="coaching-month-${monthKey}"`)
  const next = html.indexOf('role="group"', start + 1)
  return html.slice(start, next === -1 ? undefined : next)
}

const radioFor = (html: string, ariaLabel: string): string => {
  const at = html.indexOf(`aria-label="${ariaLabel}"`)
  expect(at, `radio "${ariaLabel}"`).toBeGreaterThan(-1)
  return html.slice(html.lastIndexOf('<button', at), html.indexOf('>', at) + 1)
}

const SLOTS = [
  slot('2026-10-03', 'morning'),
  slot('2026-10-03', 'afternoon'),
  slot('2026-10-04', 'morning', 'booked'),
  slot('2026-10-04', 'afternoon'),
  slot('2026-10-10', 'morning', 'booked'),
  slot('2026-10-10', 'afternoon', 'booked'),
  slot('2026-10-11', 'morning', 'closed'),
  slot('2026-10-11', 'afternoon', 'closed'),
  slot('2026-11-07', 'morning', 'booked'),
  slot('2026-11-07', 'afternoon', 'booked'),
  slot('2026-12-05', 'morning'),
  slot('2026-12-05', 'afternoon', 'booked'),
]

describe('CoachingSessionPicker', () => {
  const html = render({ slots: SLOTS, selected: { day: '2026-10-03', slot: 'afternoon' } })

  it('is one radio group with a month heading and that month’s own count', () => {
    expect(html.match(/role="radiogroup"/g)).toHaveLength(1)
    expect(monthBlock(html, '2026-10')).toMatch(/>October<\/h2><p[^>]*>Only 3 slots left</)
    expect(monthBlock(html, '2026-12')).toContain('Only 1 slot left')
    expect(monthBlock(html, '2026-12')).toContain('bg-[#FDECEC]')
    // Never a single figure across all months (3 + 0 + 1).
    expect(html).not.toContain('Only 4 slots left')
  })

  it('collapses a fully booked month to its heading with nothing selectable', () => {
    const november = monthBlock(html, '2026-11')
    expect(november).toContain('Fully booked')
    expect(november).not.toContain('role="radio"')
  })

  it('shows both slots per open date, with a booked slot sold out and disabled', () => {
    expect(html).toContain('>Sat 3 Oct<')
    expect(html).toContain('09:00 to 12:00')
    expect(html).toContain('13:00 to 16:00')
    const soldOut = radioFor(html, 'Sunday 4 October 2026, Morning, sold out')
    expect(soldOut).toContain('disabled=""')
    expect(html).toContain('SOLD OUT')
  })

  it('renders a fully sold out date and a closed date as a whole, without radios', () => {
    expect(html).toMatch(/>Sat 10 Oct<\/p><span[^>]*>Sold out</)
    expect(html).toMatch(/>Sun 11 Oct<\/p><span[^>]*>Bookings closed</)
    expect(html).not.toContain('Saturday 10 October 2026')
    expect(html).not.toContain('Sunday 11 October 2026')
  })

  it('checks the selected slot and makes it the group’s single tab stop', () => {
    const chosen = radioFor(html, 'Saturday 3 October 2026, Afternoon, 13:00 to 16:00')
    expect(chosen).toContain('aria-checked="true"')
    expect(chosen).toContain('tabindex="0"')
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
  })

  it('puts the tab stop on the first open slot when nothing is selected', () => {
    const fresh = render({ slots: SLOTS })
    expect(radioFor(fresh, 'Saturday 3 October 2026, Morning, 09:00 to 12:00')).toContain('tabindex="0"')
    expect(fresh).not.toContain('aria-checked="true"')
  })

  it('does not check a selection that has since been booked', () => {
    const stale = render({ slots: SLOTS, selected: { day: '2026-10-04', slot: 'morning' } })
    expect(stale).not.toContain('aria-checked="true"')
  })

  it('has loading, error and empty states', () => {
    expect(render({ slots: null })).toContain('Loading coaching dates')
    const failed = render({ loadError: true })
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('mailto:hello@fourteenfisherman.com')
    expect(render({ slots: [] })).toContain('New coaching dates are being scheduled')
  })

  it('never renders a dash or the old format', () => {
    const all = [html, render({ slots: null }), render({ loadError: true }), render({ slots: [] })].join('')
    expect(all).not.toMatch(/[–—]|&mdash;|&ndash;/)
    expect(all).not.toMatch(/coaching day|small group|class of|9am|full day/i)
  })
})
