/**
 * Mint five-station sign-in links for people we already know.
 *
 *   npx tsx scripts/trial-links/mint.ts                    # DRY RUN — mints, writes a CSV, sends nothing
 *   npx tsx scripts/trial-links/mint.ts --leads            # verified trial_leads only
 *   npx tsx scripts/trial-links/mint.ts --waitlist         # waitlist_entries only
 *   npx tsx scripts/trial-links/mint.ts --cohort <uuid>    # one trainer's cohort, source 'cohort'
 *   npx tsx scripts/trial-links/mint.ts --limit 20         # first N addresses, for a smoke test
 *
 *   TRIAL_LINK_SEND=1 npx tsx scripts/trial-links/mint.ts --send   # ⚠️ ACTUALLY EMAILS PEOPLE
 *
 * With no audience flag it does both `--leads` and `--waitlist`.
 *
 * ## ⚠️ --send is a human decision, every time
 *
 * `--send` is refused unless `TRIAL_LINK_SEND=1` is also in the environment.
 * Two independent switches, because one flag is one typo away from mailing a
 * few hundred real trainees, and the failure is unrecoverable — you cannot
 * un-send. NO AGENT MAY RUN IT. Nabil's explicit go-ahead is required for every
 * send to real people, even mid-runbook.
 *
 * The default is not merely "safe", it is USEFUL: it mints the real links and
 * writes them to a CSV, so the batch can be reviewed, pasted into a Brevo
 * campaign, or sent by hand to three people first.
 *
 * ## ⚠️ The CSV is a file full of account credentials
 *
 * Every row contains a URL that signs its holder into that person's account for
 * 24 hours. It is written under scripts/trial-links/out/, which is gitignored,
 * and it should be deleted once used. Do not paste it into a chat, a ticket, or
 * a commit.
 *
 * ## What it reads, and what it does not write
 *
 * READ ONLY, on every path including `--send`. It reads `trial_leads` (verified
 * addresses only — an unverified lead is an unproven claim on somebody else's
 * inbox), `waitlist_entries`, and for `--cohort` the `cohort_members` →
 * `profiles` join. It creates no accounts and inserts no grants: that all
 * happens when a link is actually opened, in /api/auth/start, so an unopened
 * link costs nothing and leaves no row behind.
 *
 * ## Requirements
 *
 * `.env.local` must carry NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * and TRIAL_LINK_SECRET — the same secret the deployment redeeming these links
 * uses, or every link will fail its signature check. `--send` additionally
 * needs BREVO_API_KEY.
 *
 * Run with `npx tsx` (it resolves the `@/` alias from tsconfig). Node's own
 * --experimental-strip-types will not: the alias is a bundler convention, not
 * a Node one.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mintTrialLink, trialLinkUrl, TRIAL_LINK_TTL_MS } from '@/lib/auth/trialLink'
import type { TrialLinkSource } from '@/lib/auth/trialLink'
import { sendDashboardLinkEmail } from '@/lib/auth/dashboardLinkEmail'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

// Same .env.local parse the other scripts in this directory use, so one command
// works against production without a wrapper.
for (const line of readFileSync(join(REPO_ROOT, '.env.local'), 'utf8').split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match) process.env[match[1]] ??= match[2].trim()
}

interface Recipient {
  email: string
  name: string | null
  /** Which list they came from, for the CSV — not the grant's source. */
  audience: string
}

interface Args {
  send: boolean
  leads: boolean
  waitlist: boolean
  cohortId: string | null
  limit: number | null
  origin: string
}

function parseArgs(argv: readonly string[]): Args {
  const has = (flag: string) => argv.includes(flag)
  const value = (flag: string) => {
    const index = argv.indexOf(flag)
    return index >= 0 ? (argv[index + 1] ?? null) : null
  }

  const cohortId = value('--cohort')
  const explicitAudience = has('--leads') || has('--waitlist') || Boolean(cohortId)
  const limitRaw = value('--limit')

  return {
    send: has('--send'),
    // With no audience flag, both of the "people we already know" lists.
    leads: cohortId ? false : has('--leads') || !explicitAudience,
    waitlist: cohortId ? false : has('--waitlist') || !explicitAudience,
    cohortId,
    limit: limitRaw ? Number(limitRaw) : null,
    origin: value('--origin') ?? 'https://www.fourteenfisherman.com',
  }
}

function requireEnv(name: string): string {
  const found = process.env[name]?.trim()
  if (!found) {
    console.error(`Missing ${name}. Add it to .env.local and try again.`)
    process.exit(1)
  }
  return found
}

/** Verified leads only. An unverified row is an unproven claim on an inbox. */
async function verifiedLeads(supabase: SupabaseClient): Promise<Recipient[]> {
  const { data, error } = await supabase
    .from('trial_leads')
    .select('email, first_name, email_verified_at')
    .not('email_verified_at', 'is', null)
  if (error) throw new Error(`trial_leads: ${error.message}`)
  return (data ?? []).map((row) => ({
    email: String(row.email),
    name: (row.first_name as string | null) ?? null,
    audience: 'lead',
  }))
}

async function waitlistEntries(supabase: SupabaseClient): Promise<Recipient[]> {
  const { data, error } = await supabase.from('waitlist_entries').select('email, full_name')
  if (error) throw new Error(`waitlist_entries: ${error.message}`)
  return (data ?? []).map((row) => ({
    email: String(row.email),
    name: (row.full_name as string | null) ?? null,
    audience: 'waitlist',
  }))
}

/**
 * One trainer's trainees.
 *
 * `cohort_members` holds `user_id` and nothing else — the membership is by
 * account, not by address (supabase/migrations/20260901_trainer_cohorts.sql) —
 * so the addresses come from `profiles`, which the on_auth_user_created trigger
 * keeps complete. Anyone in the cohort therefore already HAS an account; the
 * link's job here is to sign them in and grant the five, not to create
 * anything.
 */
async function cohortTrainees(supabase: SupabaseClient, cohortId: string): Promise<Recipient[]> {
  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('id, name, trainer_email')
    .eq('id', cohortId)
    .maybeSingle()
  if (cohortError) throw new Error(`cohorts: ${cohortError.message}`)
  if (!cohort) throw new Error(`No cohort with id ${cohortId}`)

  const { data: members, error: memberError } = await supabase
    .from('cohort_members')
    .select('user_id')
    .eq('cohort_id', cohortId)
  if (memberError) throw new Error(`cohort_members: ${memberError.message}`)

  const userIds = (members ?? []).map((row) => String(row.user_id))
  if (userIds.length === 0) return []

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)
  if (profileError) throw new Error(`profiles: ${profileError.message}`)

  console.log(`Cohort "${cohort.name}" (trainer ${cohort.trainer_email})`)
  return (profiles ?? [])
    .filter((row) => Boolean(row.email))
    .map((row) => ({
      email: String(row.email),
      name: (row.full_name as string | null) ?? null,
      audience: 'cohort',
    }))
}

/** One row per address, keeping the first name we saw for it. */
function dedupe(recipients: readonly Recipient[]): Recipient[] {
  const byEmail = new Map<string, Recipient>()
  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase()
    if (!email || byEmail.has(email)) continue
    byEmail.set(email, { ...recipient, email })
  }
  return [...byEmail.values()]
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  // Checked up front rather than per address: minting returns null without it,
  // and a CSV of 185 empty links is a confusing way to learn that.
  requireEnv('TRIAL_LINK_SECRET')

  if (args.send && process.env.TRIAL_LINK_SEND !== '1') {
    console.error(
      '--send refused: set TRIAL_LINK_SEND=1 as well.\n' +
        'Two switches on purpose — one flag is one typo away from mailing every\n' +
        'lead we have, and you cannot un-send. This needs an explicit go-ahead.',
    )
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const source: TrialLinkSource = args.cohortId ? 'cohort' : 'link'

  const collected: Recipient[] = []
  if (args.cohortId) collected.push(...(await cohortTrainees(supabase, args.cohortId)))
  if (args.leads) collected.push(...(await verifiedLeads(supabase)))
  if (args.waitlist) collected.push(...(await waitlistEntries(supabase)))

  let recipients = dedupe(collected)
  if (args.limit && args.limit > 0) recipients = recipients.slice(0, args.limit)

  if (recipients.length === 0) {
    console.log('No recipients matched. Nothing minted.')
    return
  }

  const expiresAt = new Date(Date.now() + TRIAL_LINK_TTL_MS).toISOString()
  const rows: string[] = ['email,name,audience,source,expires_at,url']
  const minted: { recipient: Recipient; url: string }[] = []

  for (const recipient of recipients) {
    const token = mintTrialLink({ email: recipient.email, source })
    if (!token) {
      console.error(`Could not mint for ${recipient.email} — skipped`)
      continue
    }
    const url = trialLinkUrl(args.origin, token)
    minted.push({ recipient, url })
    rows.push(
      [
        recipient.email,
        recipient.name ?? '',
        recipient.audience,
        source,
        expiresAt,
        url,
      ]
        .map(csvCell)
        .join(','),
    )
  }

  const outDir = join(HERE, 'out')
  mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = join(outDir, `trial-links-${source}-${stamp}.csv`)
  writeFileSync(outPath, `${rows.join('\n')}\n`, 'utf8')

  console.log(`Minted ${minted.length} link(s), source "${source}".`)
  console.log(`Expire: ${expiresAt}`)
  console.log(`CSV:    ${outPath}`)
  console.log('⚠️  Every URL in that file signs its holder into that account. Delete it when done.')

  if (!args.send) {
    console.log('\nDRY RUN — nothing was emailed. Add --send (and TRIAL_LINK_SEND=1) to send.')
    return
  }

  console.log(`\nSENDING to ${minted.length} real people...`)
  let sent = 0
  for (const { recipient, url } of minted) {
    const result = await sendDashboardLinkEmail({
      toEmail: recipient.email,
      toName: recipient.name,
      dashboardUrl: url,
    })
    if (result.sent) {
      sent += 1
    } else {
      console.error(`  failed: ${recipient.email} (${result.skipped})`)
    }
    // Brevo's transactional API is not the bottleneck here; a person reading a
    // bounce report is. A gentle pace keeps a bad address from taking the whole
    // batch down with a burst-rate refusal.
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  console.log(`Sent ${sent} of ${minted.length}.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
