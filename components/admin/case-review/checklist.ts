import type { ChecklistCounts } from './types'

/**
 * Count the indicators in a station's mark_scheme_structured, per domain.
 *
 * The column holds `{ domains: [{ domain, indicators: [...] }] }`, with domain
 * one of data_gathering | clinical_management | relating_to_others (every
 * live station, checked 5 Oct 2026). It is the checklist the marker scores
 * against, so a reviewer wants to see at a glance that a new case has one, and
 * roughly how big it is next to the prose tables.
 *
 * Returns null for anything that is not that shape, rather than a misleading
 * row of zeros: "no checklist" and "an empty checklist" are different problems.
 */
export function countChecklist(structured: unknown): ChecklistCounts | null {
  if (!structured || typeof structured !== 'object') return null
  const domains = (structured as { domains?: unknown }).domains
  if (!Array.isArray(domains)) return null

  const counts: ChecklistCounts = { data_gathering: 0, clinical_management: 0, relating_to_others: 0 }
  let recognised = false
  for (const entry of domains) {
    if (!entry || typeof entry !== 'object') continue
    const { domain, indicators } = entry as { domain?: unknown; indicators?: unknown }
    if (typeof domain !== 'string' || !(domain in counts) || !Array.isArray(indicators)) continue
    recognised = true
    counts[domain as keyof ChecklistCounts] += indicators.length
  }
  return recognised ? counts : null
}

export const CHECKLIST_LABELS: Record<keyof ChecklistCounts, string> = {
  data_gathering: 'Data gathering',
  clinical_management: 'Clinical management',
  relating_to_others: 'Relating to others',
}
