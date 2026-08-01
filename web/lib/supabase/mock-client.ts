import type { DbClient, DbQueryBuilder, DbSingleBuilder } from './db-client'
import { getMockTable, MOCK_USER } from '../mock-data'

// ─── Single-result builder (used after .single() or mutations) ────────────────

class MockSingleBuilder implements DbSingleBuilder {
  private _row: any
  private _filters: Array<(r: any) => boolean> = []
  private _sourceRows?: any[]

  constructor(rowOrRows: any) {
    if (Array.isArray(rowOrRows)) {
      this._sourceRows = rowOrRows
      this._row = rowOrRows[0] ?? null
    } else {
      this._row = rowOrRows
    }
  }

  eq(col: string, val: any): this {
    if (this._sourceRows) {
      this._filters.push(r => r[col] === val)
    }
    return this
  }

  neq(col: string, val: any): this {
    if (this._sourceRows) {
      this._filters.push(r => r[col] !== val)
    }
    return this
  }

  select(_cols?: string): this { return this }

  then<T>(
    resolve: (val: { data: any; error: null }) => T,
    _reject?: (reason: any) => T,
  ): Promise<T> {
    let data: any = this._row
    if (this._sourceRows && this._filters.length > 0) {
      let rows = [...this._sourceRows]
      for (const f of this._filters) rows = rows.filter(f)
      data = rows[0] ?? null
    }
    return Promise.resolve({ data, error: null }).then(resolve)
  }
}

// ─── Multi-result query builder ───────────────────────────────────────────────

class MockQueryBuilder implements DbQueryBuilder {
  private _rows: any[]
  private _filters: Array<(r: any) => boolean> = []
  private _sortKey?: string
  private _sortAsc = true

  constructor(rows: any[]) {
    this._rows = [...rows]
  }

  select(_cols?: string): this { return this }

  eq(col: string, val: any): this {
    this._filters.push(r => r[col] === val)
    return this
  }

  neq(col: string, val: any): this {
    this._filters.push(r => r[col] !== val)
    return this
  }

  in(col: string, vals: any[]): this {
    const set = new Set(vals)
    this._filters.push(r => set.has(r[col]))
    return this
  }

  gte(col: string, val: any): this {
    this._filters.push(r => r[col] >= val)
    return this
  }

  lte(col: string, val: any): this {
    this._filters.push(r => r[col] <= val)
    return this
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this._sortKey = col
    this._sortAsc = opts?.ascending !== false
    return this
  }

  range(_from: number, _to: number): this { return this }

  single(): DbSingleBuilder {
    const result = this._resolve()
    return new MockSingleBuilder(result)
  }

  // Mutations — return a no-op single builder
  upsert(_data: any, _opts?: any): DbSingleBuilder { return new MockSingleBuilder(null) }
  insert(_data: any): DbSingleBuilder { return new MockSingleBuilder(null) }
  update(_data: any): DbSingleBuilder { return new MockSingleBuilder(null) }
  delete(): DbSingleBuilder { return new MockSingleBuilder(null) }

  private _resolve(): any[] {
    let result = [...this._rows]
    for (const f of this._filters) result = result.filter(f)

    if (this._sortKey) {
      const key = this._sortKey
      const asc = this._sortAsc
      result = [...result].sort((a, b) => {
        const av = a[key], bv = b[key]
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return asc ? cmp : -cmp
      })
    }

    return result
  }

  then<T>(
    resolve: (val: { data: any[] | null; error: null }) => T,
    _reject?: (reason: any) => T,
  ): Promise<T> {
    return Promise.resolve({ data: this._resolve(), error: null }).then(resolve)
  }
}

// ─── Auth mock — always returns a valid session ────────────────────────────────

const mockAuth = {
  getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
  getSession: async () => ({
    data: {
      session: {
        user: MOCK_USER,
        access_token: 'mock',
        refresh_token: 'mock',
        expires_at: 9_999_999_999,
      },
    },
    error: null,
  }),
  signInWithPassword: async (_creds: { email: string; password: string }) => ({
    data: { user: MOCK_USER, session: null },
    error: null,
  }),
  signUp: async (_creds: { email: string; password: string }) => ({
    data: { user: MOCK_USER, session: null },
    error: null,
  }),
  signOut: async () => ({ error: null }),
  onAuthStateChange: (_cb: any) => ({
    data: { subscription: { unsubscribe: () => {} } },
  }),
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createMockClient(): DbClient {
  const userId = MOCK_USER.id
  return {
    auth: mockAuth,
    from: (table: string) => new MockQueryBuilder(getMockTable(table, userId)),
  }
}
