/**
 * node-postgres treats `sslmode=require` in a connection string as an alias
 * for `verify-full` (strict CA-chain verification) — see the pg-connection-string
 * v3 deprecation warning. That silently overrides any explicit `ssl` option
 * passed to `pg.Pool`/`PrismaPg`, so a connection string carrying
 * `sslmode=require` (as Supabase's auto-provisioned POSTGRES_PRISMA_URL /
 * POSTGRES_URL_NON_POOLING both do) rejects Supabase's pooler certificate
 * chain regardless of what we configure in code. Stripping the param here
 * lets our explicit `ssl: { rejectUnauthorized: false }` take effect —
 * the connection is still TLS-encrypted end-to-end; only CA-chain
 * verification is relaxed.
 */
export function stripSslMode(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return url.toString();
}

/**
 * EBC Music runs Prod (`public`) and Preview/Dev (`preview`) on one shared
 * Supabase project, split by Postgres schema, selected via `?schema=` on
 * DATABASE_URL/DIRECT_URL. Prisma's own migrate engine reads that query
 * param natively, but `@prisma/adapter-pg`'s runtime driver adapter hands
 * the connection string straight to `pg`, which does not recognize
 * `schema` at all — so it must be extracted here instead and applied two
 * ways: passed as PrismaPg's own `{ schema }` option (covers Prisma
 * Client's generated model queries) AND turned into a `search_path` via
 * `searchPathOption()` below, set as the pg connection's own `options`
 * field (covers hand-written `$queryRaw`/`$executeRaw` SQL, e.g.
 * src/lib/rate-limit.ts's unqualified `"RateLimitBucket"`, which resolves
 * purely by Postgres session search_path — PrismaPg's `schema` option
 * doesn't touch those at all).
 */
export function extractSchema(connectionString: string): string | undefined {
  return new URL(connectionString).searchParams.get("schema") ?? undefined;
}

export function searchPathOption(schema: string | undefined): string | undefined {
  return schema ? `-c search_path=${schema},public` : undefined;
}
