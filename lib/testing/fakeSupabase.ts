/**
 * A tiny in-memory stand-in for the service-role Supabase client, for tests of
 * code that reads and writes several tables in one flow (the admin coaching
 * routes and the coach cohort linker). Supports only the PostgREST calls that
 * code uses: select, eq, ilike (exact, as exactEmailPattern builds it), in,
 * gte, order, limit, maybeSingle, single, insert, update, upsert.
 *
 * Test-only. Never imported by application code.
 */

type Row = Record<string, unknown>
type Answer = { data: unknown; error: unknown }

export interface FakeSupabase {
  tables: Record<string, Row[]>
  /** Force the next operation on a table to fail. */
  failOn: Record<string, { message: string } | undefined>
  calls: Array<{ table: string; op: string; args: unknown[] }>
  from: (table: string) => unknown
}

/** Undo exactEmailPattern's escaping, then compare case-insensitively. */
function ilikeMatches(value: unknown, pattern: string): boolean {
  const literal = pattern.replace(/\\([\\%_])/g, '$1')
  return typeof value === 'string' && value.toLowerCase() === literal.toLowerCase()
}

let idCounter = 0

export function createFakeSupabase(tables: Record<string, Row[]> = {}): FakeSupabase {
  const fake: FakeSupabase = {
    tables,
    failOn: {},
    calls: [],
    from: (table: string) => builder(table),
  }

  function rows(table: string): Row[] {
    fake.tables[table] ??= []
    return fake.tables[table]
  }

  function takeFailure(table: string): { message: string } | null {
    const failure = fake.failOn[table]
    if (failure) {
      fake.failOn[table] = undefined
      return failure
    }
    return null
  }

  function builder(table: string) {
    const filters: Array<(row: Row) => boolean> = []
    let op: 'select' | 'update' | 'insert' | 'upsert' = 'select'
    let patch: Row = {}
    let inserted: Row[] = []
    let orderBy: { column: string; ascending: boolean } | null = null
    let limitTo: number | null = null

    const record = (name: string, args: unknown[]) => fake.calls.push({ table, op: name, args })

    function run(): Answer {
      const failure = takeFailure(table)
      if (failure) return { data: null, error: failure }

      if (op === 'insert' || op === 'upsert') return { data: inserted, error: null }

      let matched = rows(table).filter((row) => filters.every((f) => f(row)))
      if (op === 'update') {
        for (const row of matched) Object.assign(row, patch)
        return { data: matched, error: null }
      }
      if (orderBy) {
        const { column, ascending } = orderBy
        matched = [...matched].sort((a, b) => {
          const cmp = String(a[column] ?? '').localeCompare(String(b[column] ?? ''))
          return ascending ? cmp : -cmp
        })
      }
      if (limitTo !== null) matched = matched.slice(0, limitTo)
      return { data: matched, error: null }
    }

    const chain: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        record('select', args)
        return chain
      },
      eq: (column: string, value: unknown) => {
        record('eq', [column, value])
        filters.push((row) => row[column] === value)
        return chain
      },
      ilike: (column: string, pattern: string) => {
        record('ilike', [column, pattern])
        filters.push((row) => ilikeMatches(row[column], pattern))
        return chain
      },
      in: (column: string, values: unknown[]) => {
        record('in', [column, values])
        filters.push((row) => values.includes(row[column]))
        return chain
      },
      gte: (column: string, value: string) => {
        record('gte', [column, value])
        filters.push((row) => String(row[column] ?? '') >= value)
        return chain
      },
      order: (column: string, opts?: { ascending?: boolean }) => {
        orderBy = { column, ascending: opts?.ascending ?? true }
        return chain
      },
      limit: (n: number) => {
        limitTo = n
        return chain
      },
      update: (values: Row) => {
        record('update', [values])
        op = 'update'
        patch = values
        return chain
      },
      insert: (values: Row | Row[]) => {
        record('insert', [values])
        op = 'insert'
        const list = Array.isArray(values) ? values : [values]
        if (!fake.failOn[table]) {
          inserted = list.map((value) => ({
            id: `fake-${table}-${++idCounter}`,
            created_at: new Date(Date.now() + idCounter).toISOString(),
            ...value,
          }))
          rows(table).push(...inserted)
        }
        return chain
      },
      upsert: (values: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
        record('upsert', [values, opts])
        op = 'upsert'
        const keys = (opts?.onConflict ?? 'id').split(',').map((key) => key.trim())
        const list = Array.isArray(values) ? values : [values]
        inserted = []
        if (!fake.failOn[table]) {
          for (const value of list) {
            const existing = rows(table).find((row) => keys.every((key) => row[key] === value[key]))
            if (existing) {
              if (!opts?.ignoreDuplicates) Object.assign(existing, value)
              continue
            }
            const added = { created_at: new Date(Date.now() + ++idCounter).toISOString(), ...value }
            rows(table).push(added)
            inserted.push(added)
          }
        }
        return chain
      },
      maybeSingle: async (): Promise<Answer> => {
        const answer = run()
        if (answer.error) return answer
        const list = answer.data as Row[]
        if (list.length > 1) return { data: null, error: { message: 'multiple rows' } }
        return { data: list[0] ?? null, error: null }
      },
      single: async (): Promise<Answer> => {
        const answer = run()
        if (answer.error) return answer
        const list = answer.data as Row[]
        return list.length === 1
          ? { data: list[0], error: null }
          : { data: null, error: { message: 'expected one row' } }
      },
      then: (resolve: (value: Answer) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    }
    return chain
  }

  return fake
}
