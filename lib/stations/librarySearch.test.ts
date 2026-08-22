import { describe, expect, it } from 'vitest'
import {
    dailySeed,
    filterStations,
    isFilterActive,
    matchesQuery,
    parseStatus,
    pickNextForYou,
    stationStatus,
    summariseDomains,
    type LibraryStation,
} from './librarySearch'

function station(overrides: Partial<LibraryStation> & { id: string }): LibraryStation {
    return {
        title: 'Man with chest pain on exertion',
        patient_name: 'Simon Fletcher',
        domain_id: 'cardio',
        domain_name: 'Cardiovascular',
        presenting_complaint: 'Patient complaining of tightness when he walks uphill.',
        attempts: [],
        passed: false,
        ...overrides,
    }
}

describe('matchesQuery', () => {
    const s = station({ id: '1' })

    it('matches on the title, the patient and the presenting complaint', () => {
        expect(matchesQuery(s, 'chest')).toBe(true)
        expect(matchesQuery(s, 'fletcher')).toBe(true)
        expect(matchesQuery(s, 'uphill')).toBe(true)
        expect(matchesQuery(s, 'cardiovascular')).toBe(true)
    })

    it('matches every word in any order, across fields', () => {
        expect(matchesQuery(s, 'pain chest')).toBe(true)
        expect(matchesQuery(s, 'fletcher uphill')).toBe(true)
        expect(matchesQuery(s, 'chest headache')).toBe(false)
    })

    it('matches partial words so typing is useful before you finish', () => {
        expect(matchesQuery(s, 'cardio')).toBe(true)
        expect(matchesQuery(s, 'exert')).toBe(true)
    })

    it('ignores case, punctuation and apostrophes', () => {
        const apostrophe = station({
            id: '2',
            title: "Adult son concerned about his father's rapid decline",
        })
        expect(matchesQuery(apostrophe, 'fathers')).toBe(true)
        expect(matchesQuery(apostrophe, "FATHER'S")).toBe(true)
    })

    it('folds accents, so a name typed plainly still finds it', () => {
        expect(matchesQuery(station({ id: '3', patient_name: 'Zoë Bardají' }), 'zoe bardaji')).toBe(true)
    })

    it('matches everything on an empty or whitespace query', () => {
        expect(matchesQuery(s, '')).toBe(true)
        expect(matchesQuery(s, '   ')).toBe(true)
    })
})

describe('stationStatus and the status filter', () => {
    const notStarted = station({ id: 'a' })
    const attempted = station({ id: 'b', attempts: [{}, {}] })
    const passed = station({ id: 'c', attempts: [{}], passed: true })
    const all = [notStarted, attempted, passed]

    it('classifies each station into one bucket', () => {
        expect(stationStatus(notStarted)).toBe('not-started')
        expect(stationStatus(attempted)).toBe('attempted')
        expect(stationStatus(passed)).toBe('passed')
    })

    it('treats "attempted" as a superset that includes passed stations', () => {
        // The chip is labelled "Attempted", not "Not passed yet" — hiding a
        // station that matches its own label would be a small lie.
        expect(filterStations(all, { status: 'attempted' }).map(s => s.id)).toEqual(['b', 'c'])
    })

    it('filters not-started and passed exactly', () => {
        expect(filterStations(all, { status: 'not-started' }).map(s => s.id)).toEqual(['a'])
        expect(filterStations(all, { status: 'passed' }).map(s => s.id)).toEqual(['c'])
        expect(filterStations(all, { status: 'all' })).toHaveLength(3)
    })

    it('combines query, status and domain', () => {
        const other = station({ id: 'd', domain_id: 'resp', title: 'Man with chest pain and cough' })
        const result = filterStations([...all, other], {
            query: 'chest',
            status: 'not-started',
            domainId: 'resp',
        })
        expect(result.map(s => s.id)).toEqual(['d'])
    })
})

describe('parseStatus', () => {
    it('accepts the four known values and rejects anything else', () => {
        expect(parseStatus('passed')).toBe('passed')
        expect(parseStatus('not-started')).toBe('not-started')
        // A hand-edited or stale URL must degrade to "no filter", never to an
        // empty list the user cannot explain.
        expect(parseStatus('nonsense')).toBe('all')
        expect(parseStatus(null)).toBe('all')
        expect(parseStatus(undefined)).toBe('all')
    })
})

describe('isFilterActive', () => {
    it('is false for an untouched control and true for any real filter', () => {
        expect(isFilterActive({ query: '', status: 'all' })).toBe(false)
        expect(isFilterActive({ query: '   ', status: 'all' })).toBe(false)
        expect(isFilterActive({ query: 'chest', status: 'all' })).toBe(true)
        expect(isFilterActive({ query: '', status: 'passed' })).toBe(true)
        expect(isFilterActive({ query: '', status: 'all', domainId: 'cardio' })).toBe(true)
    })
})

describe('summariseDomains', () => {
    const stations = [
        station({ id: '1', domain_id: 'resp', domain_name: 'Respiratory' }),
        station({ id: '2', domain_id: 'cardio', domain_name: 'Cardiovascular', attempts: [{}] }),
        station({ id: '3', domain_id: 'cardio', domain_name: 'Cardiovascular', attempts: [{}, {}], passed: true }),
        station({ id: '4', domain_id: 'cardio', domain_name: 'Cardiovascular' }),
    ]

    it('rolls stations up into domains, alphabetically', () => {
        expect(summariseDomains(stations)).toEqual([
            { id: 'cardio', name: 'Cardiovascular', station_count: 3, completed_count: 2, passed_count: 1 },
            { id: 'resp', name: 'Respiratory', station_count: 1, completed_count: 0, passed_count: 0 },
        ])
    })

    it('counts stations, not attempts — three tries at one case is one attempted case', () => {
        const summary = summariseDomains(stations)[0]
        expect(summary.completed_count).toBeLessThanOrEqual(summary.station_count)
    })

    it('handles an empty bank', () => {
        expect(summariseDomains([])).toEqual([])
    })
})

describe('pickNextForYou', () => {
    const bank = ['a', 'b', 'c', 'd', 'e'].map(id => station({ id }))

    it('is stable for a given day and rotates the next day', () => {
        const monday = dailySeed(new Date(2026, 8, 1), 'user-1')
        const tuesday = dailySeed(new Date(2026, 8, 2), 'user-1')

        expect(pickNextForYou(bank, monday)!.id).toBe(pickNextForYou(bank, monday)!.id)

        // Over a fortnight the pick must actually move, not sit on one case.
        const fortnight = new Set(
            Array.from({ length: 14 }, (_, i) =>
                pickNextForYou(bank, dailySeed(new Date(2026, 8, 1 + i), 'user-1'))!.id),
        )
        expect(fortnight.size).toBeGreaterThan(1)
        expect(monday).not.toBe(tuesday)
    })

    it('gives two users different cases on the same evening', () => {
        const day = new Date(2026, 8, 1)
        const picks = ['user-1', 'user-2', 'user-3', 'user-4'].map(
            u => pickNextForYou(bank, dailySeed(day, u))!.id,
        )
        expect(new Set(picks).size).toBeGreaterThan(1)
    })

    it('never recommends a case the user has already attempted', () => {
        const withHistory = bank.map(s =>
            s.id === 'a' ? s : { ...s, attempts: [{}] },
        )
        for (let i = 0; i < 30; i++) {
            expect(pickNextForYou(withHistory, dailySeed(new Date(2026, 8, 1 + i), 'u'))!.id).toBe('a')
        }
    })

    it('returns null once nothing is left unattempted', () => {
        const done = bank.map(s => ({ ...s, attempts: [{}] }))
        expect(pickNextForYou(done, 'seed')).toBeNull()
        expect(pickNextForYou([], 'seed')).toBeNull()
    })

    it('does not depend on the order the rows arrived in', () => {
        const seed = dailySeed(new Date(2026, 8, 1), 'user-1')
        const reversed = [...bank].reverse()
        expect(pickNextForYou(reversed, seed)!.id).toBe(pickNextForYou(bank, seed)!.id)
    })
})
