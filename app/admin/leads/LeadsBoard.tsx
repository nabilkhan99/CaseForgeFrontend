'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import type { LeadView } from '@/lib/leads/assemble'
import { FILTER_LABELS, FILTERS, filterCounts, matchesFilter, matchesSearch, sortLeads, type LeadFilter } from '@/lib/leads/board'
import { londonTime } from '@/lib/leads/time'
import type { AdminLeadsResponse } from '@/app/api/admin/leads/route'
import LeadRow, { ROW_GRID } from './LeadRow'
import { ACTION, EMPTY_CELL, INPUT } from './ui'

const EMPTY_FILTER: Record<LeadFilter, string> = {
  due: 'Nothing is due right now.',
  never: 'Everyone has been called at least once.',
  chasing: 'Nobody is being chased.',
  spoke: 'Nobody spoken to yet.',
  closed: 'No closed leads.',
  all: 'No leads yet.',
}

/**
 * /admin/leads: everyone who tried a free case or the 5-day trial and has not
 * bought, in the order to work them. Open a lead to log a call: type or
 * dictate what happened, the AI tidies it, the next action follows.
 */
export default function LeadsBoard() {
  const [data, setData] = useState<AdminLeadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<LeadFilter>('due')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async (fresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/leads${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' })
      if (response.status === 403) {
        setError('Not authorized.')
        return
      }
      if (!response.ok) {
        setError('Could not load leads.')
        return
      }
      setData((await response.json()) as AdminLeadsResponse)
      setNow(new Date())
    } catch {
      setError('Could not load leads.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Due times move on their own; keep "Now" and "Overdue" honest without a reload.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const replace = useCallback((lead: LeadView, message: string) => {
    setData((current) => (current ? { ...current, leads: current.leads.map((l) => (l.email === lead.email ? lead : l)) } : current))
    setNotice(`${lead.name}: ${message}`)
    setNow(new Date())
  }, [])

  const leads = useMemo(() => data?.leads ?? [], [data])
  const counts = useMemo(() => filterCounts(leads, now), [leads, now])
  const visible = useMemo(
    () => sortLeads(leads.filter((l) => matchesFilter(l, filter, now) && matchesSearch(l, query)), now),
    [leads, filter, query, now],
  )

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">Leads</h1>
            <p className="mt-2 text-sm text-muted">
              {data
                ? `${counts.due} due now · ${counts.never} never called · ${counts.chasing} being chased · ${counts.spoke} spoken to`
                : 'Free case and 5-day trial leads, in the order to call them'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            {data && (
              <span>
                Updated <span className="font-mono">{londonTime(new Date(data.generatedAt))}</span>
              </span>
            )}
            <Link href="/admin" className={ACTION}>
              ← Admin
            </Link>
            <button onClick={() => load(true)} disabled={loading} className={ACTION}>
              Refresh
            </button>
          </div>
        </header>

        {data && (!data.browsing || !data.ai) && (
          <div className="mt-6 space-y-1 text-xs text-amber-700">
            {!data.browsing && <p>Browsing signals are off here, so heat uses platform activity only.</p>}
            {!data.ai && <p>The AI tidy is not set up here: calls are saved as written.</p>}
          </div>
        )}

        {error && <div className="mt-8 border-l-2 border-danger pl-4 py-2 text-sm text-danger">{error}</div>}

        <div className="mt-10 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f ? 'border-heading bg-heading text-surface' : 'border-border text-body hover:border-heading/40'
              }`}
            >
              {FILTER_LABELS[f]} <span className="font-mono opacity-70">{data ? counts[f] : EMPTY_CELL}</span>
            </button>
          ))}
          <input
            type="search"
            aria-label="Search leads"
            placeholder="Search name, email or exam"
            className={`${INPUT} sm:ml-auto sm:w-64`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <AnimatePresence>
          {notice && (
            <motion.p
              key={notice}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 text-sm text-emerald-700"
              aria-live="polite"
            >
              {notice}
            </motion.p>
          )}
        </AnimatePresence>

        {data && (
          <div
            className={`hidden ${ROW_GRID} mt-8 pb-3 border-b border-border text-[10px] font-semibold uppercase tracking-[0.12em] text-muted`}
          >
            <span>Heat</span>
            <span>Lead</span>
            <span>Exam</span>
            <span>Activity</span>
            <span>Latest</span>
            <span>Next action</span>
          </div>
        )}

        {loading && !data && <p className="mt-12 text-sm text-muted animate-pulse">Loading…</p>}
        {data && visible.length === 0 && <p className="mt-12 text-sm text-muted">{query ? 'No lead matches that search.' : EMPTY_FILTER[filter]}</p>}

        <ul key={filter} className={data ? 'border-t border-border md:border-t-0' : ''}>
          {visible.map((lead, index) => (
            <LeadRow
              key={lead.email}
              lead={lead}
              index={index}
              now={now}
              aiAvailable={data?.ai ?? false}
              expanded={open === lead.email}
              onToggle={() => setOpen((current) => (current === lead.email ? null : lead.email))}
              onChange={replace}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}
