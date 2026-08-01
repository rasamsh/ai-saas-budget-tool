// Shared interface for the real Supabase client and the mock client.
// DbQueryBuilder.then returns data as any[] | null so that (data ?? []).map(row => ...)
// gives an explicit `any` element — avoiding noImplicitAny errors in strict mode.
// DbSingleBuilder.then returns data as any for .single() and mutation results.

export interface DbSingleBuilder {
  eq(col: string, val: any): this
  neq(col: string, val: any): this
  select(cols?: string): this
  then<T>(
    resolve: (val: { data: any; error: any }) => T,
    reject?: (reason: any) => T,
  ): Promise<T>
}

export interface DbQueryBuilder {
  select(cols?: string): this
  eq(col: string, val: any): this
  neq(col: string, val: any): this
  in(col: string, vals: any[]): this
  gte(col: string, val: any): this
  lte(col: string, val: any): this
  order(col: string, opts?: { ascending?: boolean }): this
  range(from: number, to: number): this
  // .single() switches to single-result mode
  single(): DbSingleBuilder
  // mutations return DbSingleBuilder (chainable with .eq, awaitable)
  upsert(data: any, opts?: any): DbSingleBuilder
  insert(data: any): DbSingleBuilder
  update(data: any): DbSingleBuilder
  delete(): DbSingleBuilder
  then<T>(
    resolve: (val: { data: any[] | null; error: any }) => T,
    reject?: (reason: any) => T,
  ): Promise<T>
}

export interface DbClient {
  auth: {
    getUser(): Promise<{ data: { user: { id: string; email?: string } | null }; error: any }>
    getSession(): Promise<{ data: any; error: any }>
    signInWithPassword(creds: { email: string; password: string }): Promise<{ data: any; error: any }>
    signUp(creds: { email: string; password: string }): Promise<{ data: any; error: any }>
    signOut(): Promise<{ error: any }>
    onAuthStateChange(callback: any): any
  }
  from(table: string): DbQueryBuilder
}
