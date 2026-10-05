/**
 * TEST-ONLY: a tiny in-memory stand-in for the service-role Supabase client,
 * enough for the case-version gates and the routes around them.
 *
 * Honours `eq`, `in` and `is` filters on reads, so a test states the bank and
 * the keeper rows as plain data and the code under test runs its real queries
 * against them. Records every read (per table) so a test can assert that the
 * today-shaped path — every case live, nothing replaced — costs no extra
 * queries. Writes are recorded, never applied.
 */

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

export interface FakeDb {
    tables: Record<string, Row[]>;
    /** Table name of every read, in order. */
    reads: string[];
    inserts: { table: string; row: Row }[];
    updates: { table: string; patch: Row }[];
    /** Tables whose reads answer with an error instead of rows. */
    failing: Set<string>;
    client: { from: (table: string) => unknown };
}

export function fakeDb(tables: Record<string, Row[]>): FakeDb {
    const db: FakeDb = {
        tables,
        reads: [],
        inserts: [],
        updates: [],
        failing: new Set(),
        client: { from: (table: string) => query(db, table) },
    };
    return db;
}

function query(db: FakeDb, table: string) {
    const filters: Filter[] = [];
    const rows = () => (db.tables[table] ?? []).filter((row) => filters.every((f) => f(row)));
    const result = () => {
        db.reads.push(table);
        return db.failing.has(table)
            ? { data: null, error: { message: `${table} read failed` } }
            : { data: rows(), error: null };
    };
    const one = () => {
        const { data, error } = result();
        return { data: data?.[0] ?? null, error };
    };

    const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
            filters.push((row) => row[column] === value);
            return builder;
        },
        in: (column: string, values: readonly unknown[]) => {
            filters.push((row) => values.includes(row[column]));
            return builder;
        },
        is: (column: string, value: unknown) => {
            filters.push((row) => (row[column] ?? null) === value);
            return builder;
        },
        maybeSingle: async () => one(),
        single: async () => {
            const { data, error } = one();
            return { data, error: error ?? (data ? null : { message: 'no rows' }) };
        },
        // A list read is awaited straight off the builder.
        then: <T>(resolve: (value: ReturnType<typeof result>) => T) => Promise.resolve(result()).then(resolve),
        insert: async (row: Row) => {
            db.inserts.push({ table, row });
            return { error: null };
        },
        update: (patch: Row) => {
            db.updates.push({ table, patch });
            const chain = { eq: () => chain, in: async () => ({ error: null }) };
            return chain;
        },
    };
    return builder;
}
