// Demo/dev seed data only — no real EBC member names or data belong here.
// The one fictitious demo chorister below is a safe, reusable example.

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { extractSchema, searchPathOption, stripSslMode } from "../src/lib/db-url";
import { createClient } from "@supabase/supabase-js";

const rawConnectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
if (!rawConnectionString) {
  throw new Error("Neither POSTGRES_PRISMA_URL nor DATABASE_URL is set — see .env.example.");
}

// See src/lib/db-url.ts for why sslmode must be stripped, ssl set
// explicitly, and schema pulled out separately for both PrismaPg's own
// `schema` option and a real search_path.
const seedSchema = extractSchema(rawConnectionString);
const adapter = new PrismaPg(
  {
    connectionString: stripSslMode(rawConnectionString),
    ssl: { rejectUnauthorized: false },
    options: searchPathOption(seedSchema),
  },
  { schema: seedSchema }
);
const prisma = new PrismaClient({ adapter });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Idempotent: creates the Supabase Auth user (with a known password —
 *  intentional for these two seed accounts, see SKILL.md's data-handling
 *  rules) only if our Prisma profile doesn't already have an authUserId,
 *  then upserts the profile row. */
async function seedAccount(opts: { email: string; name: string; role: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  if (existing?.authUserId) {
    return prisma.user.update({ where: { email: opts.email }, data: { name: opts.name, role: opts.role } });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    app_metadata: { role: opts.role },
  });
  if (error || !data.user) {
    throw new Error(`Could not create Supabase Auth user for ${opts.email}: ${error?.message}`);
  }

  return prisma.user.upsert({
    where: { email: opts.email },
    update: { authUserId: data.user.id, name: opts.name, role: opts.role },
    create: {
      authUserId: data.user.id,
      email: opts.email,
      name: opts.name,
      role: opts.role,
      status: "active",
    },
  });
}

async function main() {
  const adminPassword = "admin12345";
  const choristerPassword = "chorister12345";
  const e2eProfileTestPassword = "e2eprofiletest12345";

  const admin = await seedAccount({
    email: "gitonga@gmail.com",
    name: "Eric Gitonga",
    role: "admin",
    password: adminPassword,
  });

  await seedAccount({
    email: "demo.chorister@example.com",
    name: "Demo Chorister",
    role: "chorister",
    password: choristerPassword,
  });

  // Dedicated to e2e/test_profile.py (#73) -- a chorister account distinct
  // from the seed admin above, which the app owner also uses for their own
  // manual Preview testing. That test edits its own account's profile
  // fields/photo (there's no throwaway target the way other specs create a
  // throwaway song/section) and resets them to blank when it's done, which
  // wiped the app owner's real profile data twice before this account
  // existed. Never use this account for anything but that test.
  await seedAccount({
    email: "e2e.profile.test@example.com",
    name: "E2E Profile Test",
    role: "chorister",
    password: e2eProfileTestPassword,
  });

  const songCount = await prisma.song.count();
  if (songCount === 0) {
    const song = await prisma.song.create({
      data: {
        title: "Rising Together (demo song)",
        createdById: admin.id,
        sections: {
          create: [
            {
              part: "S",
              sectionLabel: "Soprano",
              labelDescription: "",
              sortOrder: 0,
              media: { create: [{ label: "Soprano", mediaUrl: "https://youtu.be/dQw4w9WgXcQ", mediaKind: "youtube", sortOrder: 0 }] },
            },
            {
              part: "A",
              sectionLabel: "Alto",
              labelDescription: "",
              sortOrder: 1,
              media: { create: [{ label: "Alto", mediaUrl: "https://youtu.be/dQw4w9WgXcQ", mediaKind: "youtube", sortOrder: 0 }] },
            },
            {
              part: "T",
              sectionLabel: "Tenor",
              labelDescription: "",
              sortOrder: 2,
              media: { create: [{ label: "Tenor", mediaUrl: "https://youtu.be/dQw4w9WgXcQ", mediaKind: "youtube", sortOrder: 0 }] },
            },
            {
              part: "B",
              sectionLabel: "Bass",
              labelDescription: "",
              sortOrder: 3,
              media: { create: [{ label: "Bass", mediaUrl: "https://youtu.be/dQw4w9WgXcQ", mediaKind: "youtube", sortOrder: 0 }] },
            },
            {
              part: "All",
              sectionLabel: "SATB",
              labelDescription: "Required for all members, closing set.",
              sortOrder: 4,
              media: { create: [{ label: "Full choir", mediaUrl: "https://youtu.be/dQw4w9WgXcQ", mediaKind: "youtube", sortOrder: 0 }] },
            },
          ],
        },
        lyricSections: {
          create: [
            {
              sectionType: "verse",
              sectionLabel: "Verse 1",
              content: "Placeholder verse lyrics go here, line by line,\nready to be replaced with the real song.",
              voiceTags: "SATB",
              sortOrder: 0,
            },
            {
              sectionType: "chorus",
              sectionLabel: "Chorus",
              content: "Placeholder chorus lyrics,\nsung by everyone together.",
              voiceTags: "SATB",
              sortOrder: 1,
            },
            {
              sectionType: "bridge",
              sectionLabel: "Bridge (Soprano descant)",
              content: "Placeholder descant line for sopranos only.",
              voiceTags: "S",
              sortOrder: 2,
            },
          ],
        },
      },
    });
    console.log(`Seeded demo song: ${song.title}`);
  }

  // No Trip or ExternalLink seed data — those were real Umoja Voices content
  // (an actual tour, a real Instagram link) that don't belong in EBC's
  // scaffold. Add EBC's own via the admin UI once there's real content.

  console.log("\nSeed complete. Dev login credentials:");
  console.log(`  Admin:          gitonga@gmail.com / ${adminPassword}`);
  console.log(`  Chorister:      demo.chorister@example.com / ${choristerPassword}`);
  console.log(`  E2E profile test (e2e/test_profile.py only): e2e.profile.test@example.com / ${e2eProfileTestPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
