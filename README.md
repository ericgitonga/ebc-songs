# EBC Music

Choir management app: a song library with per-voice-part media and structured, voice-tagged
lyrics, admin/chorister accounts with an invite-only signup flow, a travel logistics module,
a public external links page, and an admin-configurable About page (ordered text sections and
media, freely interleaved).

Cloned from the Umoja Voices codebase as scaffolding for EBC Music — branding replaced, database
cleared. Real content/config for EBC still to come.

## Local development

The database runs on a single Supabase Postgres project, split by schema rather than by separate
project: Production uses the `public` schema, Preview/Development use a `preview` schema in the
*same* database (set via `?schema=preview` on `DATABASE_URL`/`DIRECT_URL`). Auth (Supabase Auth)
and Storage buckets are project-wide, so they are **shared** across environments — only the
app's own tables (`Song`, `User`, etc.) get real separation between Prod and Preview/Dev.

```bash
npm install

# The Vercel project is already linked; this pulls the Development-scoped
# env vars (DATABASE_URL/DIRECT_URL pointed at the preview schema):
vercel env pull .env
vercel env pull .env.local

# Otherwise, copy .env.example and fill in DATABASE_URL/DIRECT_URL by hand
# from Supabase's dashboard, adding ?schema=preview for local/dev work.

npx prisma migrate deploy   # applies any migrations not yet on this schema
npm run storage:setup       # creates the song-audio / song-sheet-music / song-video Storage buckets
npm run db:seed
npm run dev
```

`npm run db:seed` creates two accounts — an admin (`gitonga@gmail.com`) and a fictitious demo
chorister (`demo.chorister@example.com`) — and prints their initial passwords to the console
at seed time (not written here, since this file is public). Both force a password change on
first login.

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

Deployed via `vercel deploy --prod` from the linked project (`ericgitonga/ebc-songs`), with GitHub
connected so pushes to `main` auto-deploy too.

Database/Supabase env vars (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) are scoped **per environment** in
Vercel: Production's `DATABASE_URL`/`DIRECT_URL` point at the `public` schema; Preview and
Development point at the `preview` schema of the same project. Whenever the schema changes,
apply the new migration to **both** schemas.

The build itself never touches the database (every Prisma-backed page is `export const dynamic
= "force-dynamic"`, so nothing is prerendered against live data at build time) — only requests
at runtime do.
